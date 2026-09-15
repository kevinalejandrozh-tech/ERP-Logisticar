import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { verificarPassword } from "@/lib/auth";
import { crearTokenSesion, COOKIE_SESION, Rol } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { correo, password } = await req.json();
    if (!correo || !password) return NextResponse.json({ error: "Ingresa correo y contraseña." }, { status: 400 });

    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, nombre, correo, password_hash, rol FROM usuarios WHERE correo = $1`, [String(correo).trim().toLowerCase()]);
    const usuario = result.rows[0];
    if (!usuario) return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });

    const valido = await verificarPassword(password, usuario.password_hash);
    if (!valido) return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });

    const token = await crearTokenSesion({ userId: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol as Rol });

    const expiraEn = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(`INSERT INTO sesiones (token, usuario_id, expira_en) VALUES ($1,$2,$3)`, [token, usuario.id, expiraEn]);

    const res = NextResponse.json({ ok: true, nombre: usuario.nombre, rol: usuario.rol });
    res.cookies.set(COOKIE_SESION, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al iniciar sesión." }, { status: 500 });
  }
}
