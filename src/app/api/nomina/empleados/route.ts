import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, sesionNomina } from "@/lib/nominaDB";
import { aNumero } from "@/lib/nominaCalculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Lista del personal activo con su sueldo semanal de nómina.
// Si aún no tiene sueldo de nómina, se sugiere el "sueldo ofertado" del expediente.
export async function GET(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureNominaSchema();
    const r = await getPool().query(`
      SELECT e.id, e.nombre, e.puesto, e.sueldo_ofertado,
             n.sueldo_semanal, COALESCE(n.incluir, true) AS incluir, n.notas,
             (n.expediente_id IS NOT NULL) AS configurado
      FROM expedientes e
      LEFT JOIN nomina_empleados n ON n.expediente_id = e.id
      WHERE COALESCE(e.estatus_laboral, 'Activo') != 'Baja'
      ORDER BY e.nombre ASC
    `);
    const empleados = r.rows.map((f) => ({
      expediente_id: f.id,
      nombre: f.nombre,
      puesto: f.puesto,
      sueldo_ofertado: f.sueldo_ofertado,
      sueldo_semanal: f.configurado ? aNumero(f.sueldo_semanal) : aNumero(f.sueldo_ofertado),
      incluir: f.incluir,
      notas: f.notas,
      configurado: f.configurado,
    }));
    return NextResponse.json({ ok: true, empleados });
  } catch (err) {
    return errorJson(err, "Error al leer el personal de nómina.");
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const body = await req.json();
    const expedienteId = Number(body.expediente_id);
    if (!expedienteId) return NextResponse.json({ error: "Falta el empleado." }, { status: 400 });
    const sueldo = Math.max(0, aNumero(body.sueldo_semanal));
    await ensureNominaSchema();
    await getPool().query(
      `INSERT INTO nomina_empleados (expediente_id, sueldo_semanal, incluir, notas)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (expediente_id) DO UPDATE SET sueldo_semanal = $2, incluir = $3, notas = $4, updated_at = now()`,
      [expedienteId, sueldo, body.incluir !== false, body.notas ? String(body.notas) : null]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al guardar el sueldo.");
  }
}
