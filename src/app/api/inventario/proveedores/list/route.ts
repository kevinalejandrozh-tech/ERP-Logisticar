import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, nombre, contacto, telefono, email, notas FROM proveedores ORDER BY orden ASC`);
    const registros = result.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre || "",
      contacto: r.contacto || "",
      telefono: r.telefono || "",
      email: r.email || "",
      notas: r.notas || "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los proveedores." }, { status: 500 });
  }
}
