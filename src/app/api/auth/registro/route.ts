import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarTokenSesion(token) : null;
    if (!sesion || sesion.rol !== "sysadmin") {
      return NextResponse.json({ error: "Solo el sysadmin puede registrar nuevos usuarios." }, { status: 403 });
    }

    const { nombre, correo, password, confirmarPassword, rol } = await req.json();
    if (!nombre || !String(nombre).trim()) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
    if (!correo || !String(correo).trim()) return NextResponse.json({ error: "Falta el correo." }, { status: 400 });
    if (!password || password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    if (password !== confirmarPassword) return NextResponse.json({ error: "Las contraseñas no coinciden." }, { status: 400 });
    if (rol !== "sysadmin" && rol !== "supervisor_tms") return NextResponse.json({ error: "Rol inválido." }, { status: 400 });

    await ensureSchema();
    const pool = getPool();
    const correoNormalizado = String(correo).trim().toLowerCase();
    const existente = await pool.query(`SELECT id FROM usuarios WHERE correo = $1`, [correoNormalizado]);
    if (existente.rows.length > 0) return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });

    const hash = await hashPassword(password);
    await pool.query(`INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES ($1,$2,$3,$4)`, [String(nombre).trim(), correoNormalizado, hash, rol]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al registrar el usuario." }, { status: 500 });
  }
}
