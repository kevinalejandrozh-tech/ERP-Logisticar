import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { hashPassword, verificarPassword } from "@/lib/auth";
import { ensurePermisosSchema, sesionDe } from "@/lib/permisosDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Perfil del usuario en sesión (todos los roles): foto de perfil y cambio de su propia contraseña.
const MAX_FOTO = 400_000; // ~300 KB de imagen en base64
const RE_FOTO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export async function GET(req: NextRequest) {
  const s = await sesionDe(req);
  if (!s) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    await ensurePermisosSchema();
    const r = await getPool().query(`SELECT nombre, rol, foto FROM usuarios WHERE id = $1`, [s.userId]);
    return NextResponse.json({ ok: true, nombre: r.rows[0]?.nombre || s.nombre, rol: s.rol, foto: r.rows[0]?.foto || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el perfil." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const s = await sesionDe(req);
  if (!s) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const b = await req.json();
    await ensurePermisosSchema();
    const pool = getPool();

    if (b.foto !== undefined) {
      if (b.foto === null || b.foto === "") {
        await pool.query(`UPDATE usuarios SET foto = NULL WHERE id = $1`, [s.userId]);
        return NextResponse.json({ ok: true });
      }
      const foto = String(b.foto);
      if (!RE_FOTO.test(foto) || foto.length > MAX_FOTO) return NextResponse.json({ error: "La imagen no es válida o es demasiado grande." }, { status: 400 });
      await pool.query(`UPDATE usuarios SET foto = $2 WHERE id = $1`, [s.userId, foto]);
      return NextResponse.json({ ok: true });
    }

    const actual = String(b.passwordActual || "");
    const nueva = String(b.nuevaPassword || "");
    const confirmar = String(b.confirmarPassword || "");
    const u = await pool.query(`SELECT password_hash, rol FROM usuarios WHERE id = $1`, [s.userId]);
    if (!u.rows[0]) return NextResponse.json({ error: "El usuario no existe." }, { status: 404 });
    if (!(await verificarPassword(actual, u.rows[0].password_hash))) return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
    const minimo = u.rows[0].rol === "personal" ? 4 : 8;
    if (nueva.length < minimo) return NextResponse.json({ error: `La nueva contraseña debe tener al menos ${minimo} caracteres.` }, { status: 400 });
    if (nueva !== confirmar) return NextResponse.json({ error: "Las contraseñas no coinciden." }, { status: 400 });
    await pool.query(`UPDATE usuarios SET password_hash = $2 WHERE id = $1`, [s.userId, await hashPassword(nueva)]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el perfil." }, { status: 500 });
  }
}
