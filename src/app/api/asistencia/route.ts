import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, leerConfigAsistencia, sesionAsistencia, sincronizarAsistenciaDiaria } from "@/lib/asistenciaDB";
import { TIPOS_ASISTENCIA, TipoAsistencia, esRetardo, sumarDiasIso } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function error(err: unknown, mensaje: string) {
  return NextResponse.json({ error: err instanceof Error ? err.message : mensaje }, { status: 500 });
}

// Calendario: personal activo + registros del rango (máx. 62 días).
export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const desde = req.nextUrl.searchParams.get("desde") || "";
    const hasta = req.nextUrl.searchParams.get("hasta") || "";
    if (!FECHA.test(desde) || !FECHA.test(hasta) || hasta < desde) return NextResponse.json({ error: "Rango de fechas inválido." }, { status: 400 });
    if (sumarDiasIso(desde, 62) < hasta) return NextResponse.json({ error: "El rango máximo es de 62 días." }, { status: 400 });
    await ensureAsistenciaSchema();
    const pool = getPool();
    const [emp, reg, config] = [
      await pool.query(`SELECT id, nombre, puesto, area FROM expedientes WHERE COALESCE(estatus_laboral, 'Activo') != 'Baja' ORDER BY nombre ASC`),
      await pool.query(
        `SELECT expediente_id, to_char(fecha, 'YYYY-MM-DD') AS fecha, tipo, hora_entrada, hora_salida, retardo, origen, notas
         FROM asistencia_registros WHERE fecha BETWEEN $1 AND $2`,
        [desde, hasta]
      ),
      await leerConfigAsistencia(),
    ];
    return NextResponse.json({ ok: true, config, empleados: emp.rows, registros: reg.rows });
  } catch (err) {
    return error(err, "Error al leer la asistencia.");
  }
}

// Captura manual: asistencia con horas, o falta / vacaciones / descanso / permiso / incapacidad.
// Con "fecha_hasta" se aplica a varios días seguidos (máx. 31), útil para vacaciones o incapacidades.
export async function PUT(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const expedienteId = Number(b.expediente_id);
    const tipo = String(b.tipo) as TipoAsistencia;
    const fecha = String(b.fecha || "");
    const fechaHasta = b.fecha_hasta ? String(b.fecha_hasta) : fecha;
    if (!expedienteId || !TIPOS_ASISTENCIA.includes(tipo) || !FECHA.test(fecha) || !FECHA.test(fechaHasta) || fechaHasta < fecha) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    if (sumarDiasIso(fecha, 30) < fechaHasta) return NextResponse.json({ error: "Máximo 31 días por captura." }, { status: 400 });
    const entrada = tipo === "Asistencia" ? String(b.hora_entrada || "") : "";
    const salida = tipo === "Asistencia" ? String(b.hora_salida || "") : "";
    if (tipo === "Asistencia" && !HORA.test(entrada)) return NextResponse.json({ error: "Indica la hora de entrada (HH:MM)." }, { status: 400 });
    if (salida && !HORA.test(salida)) return NextResponse.json({ error: "La hora de salida debe ser HH:MM." }, { status: 400 });
    if (salida && salida <= entrada) return NextResponse.json({ error: "La salida debe ser posterior a la entrada." }, { status: 400 });

    await ensureAsistenciaSchema();
    const pool = getPool();
    const existe = await pool.query(`SELECT id FROM expedientes WHERE id = $1`, [expedienteId]);
    if (!existe.rows[0]) return NextResponse.json({ error: "El empleado no existe." }, { status: 404 });
    const cfg = await leerConfigAsistencia();
    const retardo = tipo === "Asistencia" ? esRetardo(entrada, cfg) : false;
    const notas = b.notas ? String(b.notas).slice(0, 300) : null;

    for (let f = fecha; f <= fechaHasta; f = sumarDiasIso(f, 1)) {
      await pool.query(
        `INSERT INTO asistencia_registros (expediente_id, fecha, tipo, hora_entrada, hora_salida, retardo, origen, notas, registrado_por)
         VALUES ($1, $2, $3, $4, $5, $6, 'Manual', $7, $8)
         ON CONFLICT (expediente_id, fecha) DO UPDATE SET tipo = $3, hora_entrada = $4, hora_salida = $5, retardo = $6,
           origen = 'Manual', notas = $7, registrado_por = $8, updated_at = now()`,
        [expedienteId, f, tipo, entrada || null, salida || null, retardo, notas, s.nombre]
      );
      await sincronizarAsistenciaDiaria(expedienteId, f, tipo);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return error(err, "Error al guardar la asistencia.");
  }
}

export async function DELETE(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const expedienteId = Number(req.nextUrl.searchParams.get("expediente_id"));
    const fecha = req.nextUrl.searchParams.get("fecha") || "";
    if (!expedienteId || !FECHA.test(fecha)) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(`DELETE FROM asistencia_registros WHERE expediente_id = $1 AND fecha = $2`, [expedienteId, fecha]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return error(err, "Error al eliminar el registro.");
  }
}
