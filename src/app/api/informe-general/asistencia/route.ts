import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema } from "@/lib/asistenciaDB";
import { ahoraMx } from "@/lib/asistenciaData";
import { FECHA_RE, sesionInforme } from "@/lib/informeDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Estado = "presente" | "viaje" | "falta" | "pendiente" | "otro" | "futuro";
const aMin = (h?: string | null) => {
  const m = String(h || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Estado de asistencia del personal en un día, con los registros del módulo Asistencia
// (hoy: QR/manual; cuando se conecte el biométrico sus checadas llegarán al mismo módulo) y los viajes del calendario.
export async function GET(req: NextRequest) {
  const s = await sesionInforme(req);
  if (s instanceof NextResponse) return s;
  try {
    const ahora = ahoraMx();
    const fecha = req.nextUrl.searchParams.get("fecha") || ahora.fecha;
    if (!FECHA_RE.test(fecha)) return NextResponse.json({ error: "Fecha no válida." }, { status: 400 });
    await ensureAsistenciaSchema();
    const p = getPool();
    const cfg = await p.query(`SELECT hora_entrada, tolerancia_min FROM asistencia_config WHERE id = 1`);
    const entradaDef = cfg.rows[0]?.hora_entrada || "08:00";
    const tolerancia = Number(cfg.rows[0]?.tolerancia_min ?? 10);
    const r = await p.query(
      `SELECT e.id, e.nombre, e.puesto, e.hora_entrada AS plan_entrada, rg.tipo, rg.hora_entrada, rg.retardo,
         EXISTS (
           SELECT 1 FROM viajes_calendario v
           WHERE (v.operador_id = e.id OR v.ayudante_id = e.id) AND v.fecha <= $1::date
             AND (v.fecha = $1::date OR substring(COALESCE(NULLIF(v.datos->>'TERMINO DE SERVICIO', ''), NULLIF(v.datos->>'TERMINO ESTIMADO DE TERMINO DEL SERVICIO', ''), '') from 1 for 10) >= $1::text)
         ) AS en_viaje
       FROM expedientes e
       LEFT JOIN asistencia_registros rg ON rg.expediente_id = e.id AND rg.fecha = $1::date
       WHERE COALESCE(e.estatus_laboral, 'Activo') != 'Baja'
       ORDER BY e.nombre ASC`,
      [fecha]
    );
    const personas = r.rows.map((x) => {
      let estado: Estado;
      let etiqueta: string;
      if (x.tipo === "Falta") [estado, etiqueta] = ["falta", "Falta"];
      else if (x.tipo === "Asistencia") [estado, etiqueta] = ["presente", `${x.hora_entrada || "Presente"}${x.retardo ? " · retardo" : ""}`];
      else if (x.tipo === "Viaje foráneo" || x.en_viaje) [estado, etiqueta] = ["viaje", "En viaje"];
      else if (x.tipo) [estado, etiqueta] = ["otro", x.tipo];
      else if (fecha > ahora.fecha) [estado, etiqueta] = ["futuro", "—"];
      else {
        const limite = (aMin(x.plan_entrada || entradaDef) ?? 480) + tolerancia;
        const aun = fecha === ahora.fecha && (aMin(ahora.hora) ?? 0) <= limite;
        [estado, etiqueta] = aun ? ["pendiente", "Sin checada"] : ["falta", "Sin checada"];
      }
      return { id: x.id, nombre: x.nombre, puesto: x.puesto, estado, etiqueta };
    });
    const cuenta = (e: Estado) => personas.filter((x) => x.estado === e).length;
    return NextResponse.json({ ok: true, fecha, personas, resumen: { presentes: cuenta("presente"), viaje: cuenta("viaje"), sinChecada: cuenta("falta") + cuenta("pendiente"), total: personas.length } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer la asistencia." }, { status: 500 });
  }
}
