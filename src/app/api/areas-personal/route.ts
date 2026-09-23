import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const result = await getPool().query(`SELECT nombre FROM areas_personal ORDER BY nombre ASC`);
    return NextResponse.json({ ok: true, areas: result.rows.map((r) => r.nombre) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las áreas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre } = await req.json();
    if (!nombre || !String(nombre).trim()) return NextResponse.json({ error: "Falta el nombre del área." }, { status: 400 });
    await ensureSchema();
    await getPool().query(`INSERT INTO areas_personal (nombre) VALUES ($1) ON CONFLICT DO NOTHING`, [String(nombre).trim()]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al agregar el área." }, { status: 500 });
  }
}
