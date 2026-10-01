import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, leerConfigAsistencia, sincronizarAsistenciaDiaria } from "@/lib/asistenciaDB";
import { ahoraMx, esRetardo, minutos } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Ruta PÚBLICA usada por la página del código QR (sin cuenta).
// GET: solo nombres del personal activo. POST: registra entrada (1er escaneo del día) o salida (siguientes).
// La fecha y la hora siempre las pone el servidor (zona horaria de la empresa).

export async function GET() {
  try {
    await ensureAsistenciaSchema();
    const r = await getPool().query(`SELECT id, nombre FROM expedientes WHERE COALESCE(estatus_laboral, 'Activo') != 'Baja' ORDER BY nombre ASC`);
    return NextResponse.json({ ok: true, personas: r.rows });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar la lista del personal." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const expedienteId = Number(body.expediente_id);
    if (!expedienteId) return NextResponse.json({ error: "Selecciona tu nombre." }, { status: 400 });
    await ensureAsistenciaSchema();
    const pool = getPool();
    const emp = await pool.query(`SELECT id, nombre FROM expedientes WHERE id = $1 AND COALESCE(estatus_laboral, 'Activo') != 'Baja'`, [expedienteId]);
    if (!emp.rows[0]) return NextResponse.json({ error: "No se encontró tu nombre en el personal activo." }, { status: 404 });
    const nombre = emp.rows[0].nombre as string;
    const { fecha, hora } = ahoraMx();
    const cfg = await leerConfigAsistencia();

    const actual = await pool.query(`SELECT tipo, hora_entrada, hora_salida FROM asistencia_registros WHERE expediente_id = $1 AND fecha = $2`, [expedienteId, fecha]);
    const r = actual.rows[0];

    if (r && r.tipo === "Asistencia" && r.hora_entrada) {
      const ultimo = minutos(r.hora_salida || r.hora_entrada) ?? 0;
      if ((minutos(hora) ?? 0) - ultimo < cfg.minutos_entre_registros) {
        return NextResponse.json({ ok: true, accion: "duplicado", nombre, hora: r.hora_salida || r.hora_entrada, fecha });
      }
      await pool.query(
        `UPDATE asistencia_registros SET hora_salida = $3, origen = 'QR', updated_at = now() WHERE expediente_id = $1 AND fecha = $2`,
        [expedienteId, fecha, hora]
      );
      return NextResponse.json({ ok: true, accion: "salida", nombre, hora, fecha });
    }

    const retardo = esRetardo(hora, cfg);
    await pool.query(
      `INSERT INTO asistencia_registros (expediente_id, fecha, tipo, hora_entrada, hora_salida, retardo, origen, registrado_por)
       VALUES ($1, $2, 'Asistencia', $3, NULL, $4, 'QR', 'QR')
       ON CONFLICT (expediente_id, fecha) DO UPDATE SET tipo = 'Asistencia', hora_entrada = $3, hora_salida = NULL, retardo = $4,
         origen = 'QR', registrado_por = 'QR', updated_at = now()`,
      [expedienteId, fecha, hora, retardo]
    );
    await sincronizarAsistenciaDiaria(expedienteId, fecha, "Asistencia");
    return NextResponse.json({ ok: true, accion: "entrada", nombre, hora, fecha, retardo });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar la asistencia. Intenta de nuevo." }, { status: 500 });
  }
}
