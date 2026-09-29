import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cambia la contraseña de un usuario. Exclusivo del sysadmin.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarTokenSesion(token) : null;
    if (!sesion || sesion.rol !== "sysadmin") {
      return NextResponse.json({ error: "Solo el sysadmin puede cambiar contraseñas." }, { status: 403 });
    }

    const { usuarioId, nuevaPassword } = await req.json();
    if (!usuarioId) return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
    if (!nuevaPassword || typeof nuevaPassword !== "string") return NextResponse.json({ error: "Escribe la nueva contraseña." }, { status: 400 });

    await ensureSchema();
    const pool = getPool();
    const existente = await pool.query(`SELECT id, rol FROM usuarios WHERE id = $1`, [usuarioId]);
    const usuario = existente.rows[0];
    if (!usuario) return NextResponse.json({ error: "El usuario no existe." }, { status: 404 });

    // El personal nace con "1234", así que se permiten contraseñas cortas (mínimo 4). Las cuentas sysadmin/supervisor conservan el mínimo de 8.
    const minimo = usuario.rol === "personal" ? 4 : 8;
    if (nuevaPassword.length < minimo) {
      return NextResponse.json({ error: `La contraseña debe tener al menos ${minimo} caracteres.` }, { status: 400 });
    }

    const hash = await hashPassword(nuevaPassword);
    await pool.query(`UPDATE usuarios SET password_hash = $2 WHERE id = $1`, [usuarioId, hash]);
    // Cierra las sesiones abiertas de esa cuenta.
    await pool.query(`DELETE FROM sesiones WHERE usuario_id = $1`, [usuarioId]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al cambiar la contraseña." }, { status: 500 });
  }
}
