import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, sesionAsistencia } from "@/lib/asistenciaDB";
import { sumarDiasIso } from "@/lib/asistenciaData";
import { CAMPOS_VIAJE, calcularEstatusViaje, esViajeLocal } from "@/lib/viajesData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const CLAVES = new Set(CAMPOS_VIAJE.map((c) => c.clave));

function error(e: unknown, m: string) {
  return NextResponse.json({ error: e instanceof Error ? e.message : m }, { status: 500 });
}

function limpiarDatos(datos: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (datos && typeof datos === "object") {
    for (const [k, v] of Object.entries(datos as Record<string, unknown>)) {
      if (CLAVES.has(k) && v !== null && v !== undefined && String(v).trim() !== "") out[k] = String(v).slice(0, 300);
    }
  }
  return out;
}

// Marca en Asistencia "Viaje foráneo" al operador y al ayudante, desde la fecha del viaje hasta el término
// del servicio (máx. 14 días). No sobrescribe días que ya tengan otro registro (manual, QR, vacaciones…).
// Los viajes de tipo LOCAL no generan "Viaje foráneo" (ni bono por ruta).
async function sincronizarAsistencia(c: PoolClient, viajeId: number) {
  await c.query(`DELETE FROM asistencia_registros WHERE viaje_id = $1 AND origen = 'Viaje'`, [viajeId]);
  const r = await c.query(`SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, datos, operador_id, ayudante_id FROM viajes_calendario WHERE id = $1`, [viajeId]);
  const v = r.rows[0];
  if (!v) return;
  const d = v.datos as Record<string, string>;
  if (esViajeLocal(d)) return;
  const fin = String(d["TERMINO DE SERVICIO"] || d["TERMINO ESTIMADO DE TERMINO DEL SERVICIO"] || "").slice(0, 10);
  const hasta = FECHA.test(fin) && fin >= v.fecha ? (fin > sumarDiasIso(v.fecha, 13) ? sumarDiasIso(v.fecha, 13) : fin) : v.fecha;
  for (const persona of [v.operador_id, v.ayudante_id].filter(Boolean) as number[]) {
    for (let f = v.fecha; f <= hasta; f = sumarDiasIso(f, 1)) {
      const ins = await c.query(
        `INSERT INTO asistencia_registros (expediente_id, fecha, tipo, estado_destino, ruta, viaje_id, origen, notas, registrado_por)
         VALUES ($1, $2, 'Viaje foráneo', $3, $4, $5, 'Viaje', $6, 'Control de viajes')
         ON CONFLICT (expediente_id, fecha) DO NOTHING`,
        [persona, f, d["ESTADO DESTINO"] || null, d["RUTA O DESTINO"] || null, viajeId, d["NOMBRE CUENTA"] ? `Cuenta: ${d["NOMBRE CUENTA"]}` : null]
      );
      if (ins.rowCount) {
        await c.query(
          `INSERT INTO asistencia_diaria (expediente_id, fecha, presente) VALUES ($1, $2, true) ON CONFLICT (expediente_id, fecha) DO UPDATE SET presente = true`,
          [persona, f]
        );
      }
    }
  }
}

export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const desde = req.nextUrl.searchParams.get("desde") || "";
    const hasta = req.nextUrl.searchParams.get("hasta") || "";
    if (!FECHA.test(desde) || !FECHA.test(hasta) || hasta < desde || sumarDiasIso(desde, 62) < hasta) {
      return NextResponse.json({ error: "Rango de fechas inválido." }, { status: 400 });
    }
    await ensureAsistenciaSchema();
    const pool = getPool();
    const unidades = await pool.query(`SELECT eco, datos->>'Unidad' AS unidad, datos->>'Placas' AS placas, datos->>'Ref. Capacidad' AS capacidad, disponible FROM unidades ORDER BY eco ASC`);
    const viajes = await pool.query(
      `SELECT id, eco, to_char(fecha, 'YYYY-MM-DD') AS fecha, datos, operador_id, ayudante_id FROM viajes_calendario WHERE fecha BETWEEN $1 AND $2 ORDER BY id`,
      [desde, hasta]
    );
    const personas = await pool.query(`SELECT id, nombre, puesto FROM expedientes WHERE COALESCE(estatus_laboral, 'Activo') != 'Baja' ORDER BY nombre`);
    const rutas = await pool.query(`SELECT id, nombre, estado_destino, bono FROM rutas WHERE activa ORDER BY nombre`);
    const bonos = await pool.query(`SELECT ruta_id, eco, bono FROM rutas_bonos_unidad`);
    return NextResponse.json({
      ok: true,
      unidades: unidades.rows,
      viajes: viajes.rows,
      personas: personas.rows,
      rutas: rutas.rows.map((r) => ({
        nombre: r.nombre,
        estado_destino: r.estado_destino,
        bono: Number(r.bono) || 0,
        bonos_unidad: Object.fromEntries(bonos.rows.filter((b) => b.ruta_id === r.id).map((b) => [b.eco, Number(b.bono) || 0])),
      })),
    });
  } catch (e) {
    return error(e, "Error al leer los viajes.");
  }
}

async function guardar(req: NextRequest, id: number | null) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  const b = await req.json();
  const eco = String(b.eco || "").trim();
  const fecha = String(b.fecha || "");
  if (!eco || !FECHA.test(fecha)) return NextResponse.json({ error: "Faltan la unidad o la fecha." }, { status: 400 });
  const datos = limpiarDatos(b.datos);
  datos["ECO"] = eco;
  // Estatus patio / almacén se calculan siempre a partir de los horarios (no se capturan).
  const est = calcularEstatusViaje(datos);
  if (est.patio) datos["ESTATUS PATIO"] = est.patio;
  else delete datos["ESTATUS PATIO"];
  if (est.almacen) datos["ESTATUS ALMACEN"] = est.almacen;
  else delete datos["ESTATUS ALMACEN"];
  const operador = Number(b.operador_id) || null;
  const ayudante = Number(b.ayudante_id) || null;
  await ensureAsistenciaSchema();
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    for (const [campo, pid] of [["OPERADOR", operador], ["AYUDANTE", ayudante]] as const) {
      if (pid) {
        const p = await c.query(`SELECT nombre FROM expedientes WHERE id = $1`, [pid]);
        if (!p.rows[0]) throw new Error(`El ${campo.toLowerCase()} no existe.`);
        datos[campo] = p.rows[0].nombre;
      } else delete datos[campo];
    }
    let viajeId = id;
    if (id) {
      const u = await c.query(
        `UPDATE viajes_calendario SET eco = $2, fecha = $3, datos = $4, operador_id = $5, ayudante_id = $6, registrado_por = $7, updated_at = now() WHERE id = $1`,
        [id, eco, fecha, datos, operador, ayudante, s.nombre]
      );
      if (!u.rowCount) throw new Error("El viaje no existe.");
    } else {
      const r = await c.query(
        `INSERT INTO viajes_calendario (eco, fecha, datos, operador_id, ayudante_id, registrado_por) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [eco, fecha, datos, operador, ayudante, s.nombre]
      );
      viajeId = r.rows[0].id;
    }
    await sincronizarAsistencia(c, viajeId!);
    await c.query("COMMIT");
    return NextResponse.json({ ok: true, id: viajeId });
  } catch (e) {
    await c.query("ROLLBACK");
    return error(e, "Error al guardar el viaje.");
  } finally {
    c.release();
  }
}

export async function POST(req: NextRequest) {
  return guardar(req, null);
}

export async function PUT(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Falta el viaje." }, { status: 400 });
  return guardar(req, id);
}

export async function DELETE(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta el viaje." }, { status: 400 });
    await ensureAsistenciaSchema();
    const pool = getPool();
    await pool.query(`DELETE FROM asistencia_registros WHERE viaje_id = $1 AND origen = 'Viaje'`, [id]);
    await pool.query(`DELETE FROM viajes_calendario WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return error(e, "Error al eliminar el viaje.");
  }
}
