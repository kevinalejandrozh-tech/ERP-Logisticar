import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, sesionAsistencia } from "@/lib/asistenciaDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Catálogo de rutas con bono por ruta (lo usan Control de viajes, Asistencia y Nómina).
function err(e: unknown, m: string) {
  const msg = e instanceof Error ? e.message : m;
  return NextResponse.json({ error: /unique|duplicate/i.test(msg) ? "Ya existe una ruta con ese nombre." : msg }, { status: /unique|duplicate/i.test(msg) ? 409 : 500 });
}

type BonoUnidad = { eco: string; bono: number };

function leer(b: Record<string, unknown>) {
  const vistos = new Set<string>();
  const bonos: BonoUnidad[] = [];
  for (const x of Array.isArray(b.bonos_unidad) ? (b.bonos_unidad as Record<string, unknown>[]) : []) {
    const eco = String(x?.eco || "").trim().slice(0, 40);
    if (!eco || vistos.has(eco)) continue;
    vistos.add(eco);
    bonos.push({ eco, bono: Math.max(0, Number(x.bono) || 0) });
  }
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))] : []);
  const horas = (v: unknown) => (v === "" || v == null ? null : Math.max(0, Number(v) || 0));
  return {
    origen: b.origen ? String(b.origen).trim().slice(0, 120) : null,
    destino: b.destino ? String(b.destino).trim().slice(0, 120) : null,
    km: horas(b.km),
    horas_ida: horas(b.horas_ida),
    horas_regreso_vacio: horas(b.horas_regreso_vacio),
    horas_regreso_devolucion: horas(b.horas_regreso_devolucion),
    casetas: ids(b.casetas), // el orden del arreglo es el orden de la ruta
    resguardos: ids(b.resguardos),
    alimentos: ids(b.alimentos),
    gasolineras: ids(b.gasolineras),
    bonos,
    nombre: String(b.nombre || "").trim().slice(0, 120),
    estado: b.estado_destino ? String(b.estado_destino).slice(0, 60) : null,
    bono: Math.max(0, Number(b.bono) || 0),
    activa: b.activa !== false,
    notas: b.notas ? String(b.notas).slice(0, 300) : null,
  };
}

// Reemplaza los bonos por unidad de la ruta (un solo INSERT multi-fila).
async function guardarBonosUnidad(rutaId: number, bonos: BonoUnidad[]) {
  const pool = getPool();
  await pool.query(`DELETE FROM rutas_bonos_unidad WHERE ruta_id = $1`, [rutaId]);
  if (!bonos.length) return;
  const valores = bonos.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(", ");
  await pool.query(`INSERT INTO rutas_bonos_unidad (ruta_id, eco, bono) VALUES ${valores}`, [rutaId, ...bonos.flatMap((b) => [b.eco, b.bono])]);
}

export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureAsistenciaSchema();
    const pool = getPool();
    const r = await pool.query(`SELECT id, nombre, estado_destino, bono, activa, notas, origen, destino, km::float AS km, horas_ida::float AS horas_ida,
              horas_regreso_vacio::float AS horas_regreso_vacio, horas_regreso_devolucion::float AS horas_regreso_devolucion, casetas, resguardos, alimentos, gasolineras
       FROM rutas ORDER BY activa DESC, nombre ASC`);
    const b = await pool.query(`SELECT ruta_id, eco, bono FROM rutas_bonos_unidad ORDER BY eco`);
    const u = await pool.query(`SELECT eco, datos->>'Unidad' AS unidad FROM unidades ORDER BY eco ASC`);
    const rutas = r.rows.map((x) => ({
      ...x,
      bono: Number(x.bono) || 0,
      bonos_unidad: b.rows.filter((y) => y.ruta_id === x.id).map((y) => ({ eco: y.eco, bono: Number(y.bono) || 0 })),
    }));
    return NextResponse.json({ ok: true, rutas, unidades: u.rows });
  } catch (e) {
    return err(e, "Error al leer las rutas.");
  }
}

export async function POST(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const d = leer(await req.json());
    if (!d.nombre) return NextResponse.json({ error: "Indica el nombre de la ruta." }, { status: 400 });
    await ensureAsistenciaSchema();
    const r = await getPool().query(
      `INSERT INTO rutas (nombre, estado_destino, bono, activa, notas, origen, destino, km, horas_ida, horas_regreso_vacio, horas_regreso_devolucion, casetas, resguardos, alimentos, gasolineras)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb) RETURNING id`,
      [d.nombre, d.estado, d.bono, d.activa, d.notas, d.origen, d.destino, d.km, d.horas_ida, d.horas_regreso_vacio, d.horas_regreso_devolucion, JSON.stringify(d.casetas), JSON.stringify(d.resguardos), JSON.stringify(d.alimentos), JSON.stringify(d.gasolineras)]
    );
    await guardarBonosUnidad(r.rows[0].id, d.bonos);
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    return err(e, "Error al guardar la ruta.");
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.id);
    const d = leer(b);
    if (!id || !d.nombre) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(
      `UPDATE rutas SET nombre = $2, estado_destino = $3, bono = $4, activa = $5, notas = $6, origen = $7, destino = $8, km = $9, horas_ida = $10,
         horas_regreso_vacio = $11, horas_regreso_devolucion = $12, casetas = $13::jsonb, resguardos = $14::jsonb, alimentos = $15::jsonb, gasolineras = $16::jsonb, updated_at = now() WHERE id = $1`,
      [id, d.nombre, d.estado, d.bono, d.activa, d.notas, d.origen, d.destino, d.km, d.horas_ida, d.horas_regreso_vacio, d.horas_regreso_devolucion, JSON.stringify(d.casetas), JSON.stringify(d.resguardos), JSON.stringify(d.alimentos), JSON.stringify(d.gasolineras)]
    );
    await guardarBonosUnidad(id, d.bonos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e, "Error al guardar la ruta.");
  }
}

export async function DELETE(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta la ruta." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(`DELETE FROM rutas WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e, "Error al eliminar la ruta.");
  }
}
