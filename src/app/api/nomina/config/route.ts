import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, leerConfigNomina, sesionNomina } from "@/lib/nominaDB";
import { aNumero } from "@/lib/nominaCalculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureNominaSchema();
    return NextResponse.json({ ok: true, config: await leerConfigNomina() });
  } catch (err) {
    return errorJson(err, "Error al leer la configuración de nómina.");
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const body = await req.json();
    const diasBase = aNumero(body.dias_base);
    const retardos = Math.max(0, Math.floor(aNumero(body.retardos_por_falta)));
    const empresa = String(body.empresa || "").trim() || "Transportes Logisticar";
    if (diasBase <= 0 || diasBase > 31) return NextResponse.json({ error: "Los días base deben estar entre 1 y 31." }, { status: 400 });
    await ensureNominaSchema();
    await getPool().query(
      `UPDATE nomina_config SET dias_base = $1, retardos_por_falta = $2, empresa = $3, updated_at = now() WHERE id = 1`,
      [diasBase, retardos, empresa]
    );
    return NextResponse.json({ ok: true, config: await leerConfigNomina() });
  } catch (err) {
    return errorJson(err, "Error al guardar la configuración de nómina.");
  }
}
