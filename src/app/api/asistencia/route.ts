import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { SELECT_REGISTRO, ensureAsistenciaSchema, leerConfigAsistencia, sesionAsistencia, sincronizarAsistenciaDiaria } from "@/lib/asistenciaDB";
import { RE_FECHA_HORA, TIPOS_ASISTENCIA, TipoAsistencia, evaluarJornada, horarioDe, sumarDiasIso } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function error(err: unknown, mensaje: string) {
  return NextResponse.json({ error: err instanceof Error ? err.message : mensaje }, { status: 500 });
}

// Calendario: personal activo (con su horario) + registros del rango (máx. 62 días).
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
    const emp = await pool.query(
      `SELECT id, nombre, puesto, area, hora_entrada, hora_salida, to_char(fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso
       FROM expedientes WHERE COALESCE(estatus_laboral, 'Activo') != 'Baja' ORDER BY nombre ASC`
    );
    const reg = await pool.query(`SELECT ${SELECT_REGISTRO} FROM asistencia_registros WHERE fecha BETWEEN $1 AND $2`, [desde, hasta]);
    const rutas = await pool.query(`SELECT nombre, estado_destino, bono FROM rutas WHERE activa ORDER BY nombre`);
    return NextResponse.json({ ok: true, config: await leerConfigAsistencia(), empleados: emp.rows, registros: reg.rows, rutas: rutas.rows.map((r) => ({ ...r, bono: Number(r.bono) || 0 })) });
  } catch (err) {
    return error(err, "Error al leer la asistencia.");
  }
}

// Captura manual.
// - Asistencia: fecha y hora de entrada y de salida (la salida puede ser otro día: turnos seguidos).
// - Viaje foráneo: estado destino y ruta (las horas son opcionales).
// - Falta / vacaciones / descanso / permiso / incapacidad: con "fecha_hasta" se aplica a varios días (máx. 31).
export async function PUT(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const expedienteId = Number(b.expediente_id);
    const tipo = String(b.tipo) as TipoAsistencia;
    const fecha = String(b.fecha || "");
    const conHoras = tipo === "Asistencia" || tipo === "Viaje foráneo";
    const fechaHasta = tipo === "Asistencia" ? fecha : b.fecha_hasta ? String(b.fecha_hasta) : fecha;
    if (!expedienteId || !TIPOS_ASISTENCIA.includes(tipo) || !FECHA.test(fecha) || !FECHA.test(fechaHasta) || fechaHasta < fecha) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    if (sumarDiasIso(fecha, 30) < fechaHasta) return NextResponse.json({ error: "Máximo 31 días por captura." }, { status: 400 });
    const entrada = conHoras && b.entrada_ts ? String(b.entrada_ts).slice(0, 16) : "";
    const salida = conHoras && b.salida_ts ? String(b.salida_ts).slice(0, 16) : "";
    if (tipo === "Asistencia" && !RE_FECHA_HORA.test(entrada)) return NextResponse.json({ error: "Indica la fecha y hora de entrada." }, { status: 400 });
    if (entrada && !RE_FECHA_HORA.test(entrada)) return NextResponse.json({ error: "Fecha y hora de entrada inválida." }, { status: 400 });
    if (salida && !RE_FECHA_HORA.test(salida)) return NextResponse.json({ error: "Fecha y hora de salida inválida." }, { status: 400 });
    if (salida && !entrada) return NextResponse.json({ error: "Indica también la entrada." }, { status: 400 });
    if (salida && salida <= entrada) return NextResponse.json({ error: "La salida debe ser posterior a la entrada." }, { status: 400 });
    if (salida && sumarDiasIso(entrada.slice(0, 10), 3) < salida.slice(0, 10)) return NextResponse.json({ error: "Un turno no puede durar más de 3 días." }, { status: 400 });

    await ensureAsistenciaSchema();
    const pool = getPool();
    const er = await pool.query(`SELECT id, hora_entrada, hora_salida FROM expedientes WHERE id = $1`, [expedienteId]);
    if (!er.rows[0]) return NextResponse.json({ error: "El empleado no existe." }, { status: 404 });
    const h = horarioDe(er.rows[0], await leerConfigAsistencia());
    const ev = tipo === "Asistencia" ? evaluarJornada(entrada, salida || null, h) : { retardo: false, estado_salida: null };
    const notas = b.notas ? String(b.notas).slice(0, 300) : null;
    const estadoDestino = tipo === "Viaje foráneo" && b.estado_destino ? String(b.estado_destino).slice(0, 60) : null;
    const ruta = tipo === "Viaje foráneo" && b.ruta ? String(b.ruta).slice(0, 120) : null;

    for (let f = fecha; f <= fechaHasta; f = sumarDiasIso(f, 1)) {
      await pool.query(
        `INSERT INTO asistencia_registros
           (expediente_id, fecha, tipo, hora_entrada, hora_salida, entrada_ts, salida_ts, retardo, estado_salida, estado_destino, ruta, origen, notas, registrado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Manual', $12, $13)
         ON CONFLICT (expediente_id, fecha) DO UPDATE SET
           origen = CASE WHEN asistencia_registros.tipo = EXCLUDED.tipo AND asistencia_registros.origen IN ('Programada', 'Viaje') THEN asistencia_registros.origen ELSE 'Manual' END,
           viaje_id = CASE WHEN asistencia_registros.tipo = EXCLUDED.tipo THEN asistencia_registros.viaje_id ELSE NULL END,
           tipo = $3, hora_entrada = $4, hora_salida = $5, entrada_ts = $6, salida_ts = $7, retardo = $8, estado_salida = $9,
           estado_destino = $10, ruta = $11, notas = $12, registrado_por = $13, updated_at = now()`,
        [expedienteId, f, tipo, entrada ? entrada.slice(11) : null, salida ? salida.slice(11) : null, entrada || null, salida || null,
          ev.retardo, ev.estado_salida, estadoDestino, ruta, notas, s.nombre]
      );
      await sincronizarAsistenciaDiaria(expedienteId, f, tipo === "Viaje foráneo" ? "Asistencia" : tipo);
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
