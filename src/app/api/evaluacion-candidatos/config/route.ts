import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { leerConfigEvaluacion } from "@/lib/evaluacionCandidatosConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Configuración privada de la evaluación (requiere sesión): municipios zona roja y rango de edad.
export async function GET() {
  try {
    await ensureSchema();
    return NextResponse.json({ ok: true, ...(await leerConfigEvaluacion()) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la configuración." }, { status: 500 });
  }
}

// POST → { zonas_rojas: string[], edad_min, edad_max }
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const b = await req.json();
    const zonas = Array.from(
      new Set(
        (Array.isArray(b.zonas_rojas) ? b.zonas_rojas : [])
          .filter((z: unknown) => typeof z === "string")
          .map((z: string) => z.trim().slice(0, 80))
          .filter(Boolean)
      )
    ).slice(0, 300);
    const min = Number(b.edad_min);
    const max = Number(b.edad_max);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 16 || max > 99 || min > max) {
      return NextResponse.json({ error: "Rango de edad no válido." }, { status: 400 });
    }
    await getPool().query(
      `INSERT INTO evaluacion_config (id, zonas_rojas, edad_min, edad_max, updated_at) VALUES (1, $1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET zonas_rojas = EXCLUDED.zonas_rojas, edad_min = EXCLUDED.edad_min, edad_max = EXCLUDED.edad_max, updated_at = now()`,
      [JSON.stringify(zonas), min, max]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo guardar la configuración." }, { status: 500 });
  }
}
