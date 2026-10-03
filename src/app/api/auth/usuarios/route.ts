import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { claveUsuario, usuarioDesdeNombre } from "@/lib/auth";
import { ensurePermisosSchema, sesionSoloSysadmin, rolExiste } from "@/lib/permisosDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Usuarios registrados (solo sysadmin).
export async function GET(req: NextRequest) {
  const s = await sesionSoloSysadmin(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensurePermisosSchema();
    const result = await getPool().query(
      `SELECT id, nombre, correo, usuario, rol, expediente_id, created_at, (foto IS NOT NULL) AS tiene_foto FROM usuarios ORDER BY created_at ASC`
    );
    return NextResponse.json({ ok: true, usuarios: result.rows, miId: s.userId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al listar usuarios." }, { status: 500 });
  }
}

// Edita nombre, usuario de acceso, correo y rol de una cuenta.
export async function PUT(req: NextRequest) {
  const s = await sesionSoloSysadmin(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.id);
    if (!id) return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
    const nombre = String(b.nombre || "").replace(/\s+/g, " ").trim();
    if (!nombre) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
    const rol = String(b.rol || "");
    if (!(await rolExiste(rol))) return NextResponse.json({ error: "Rol no válido." }, { status: 400 });
    if (id === s.userId && rol !== "sysadmin") return NextResponse.json({ error: "No puedes quitarte el rol de sysadmin a ti mismo." }, { status: 400 });
    const correo = String(b.correo || "").trim().toLowerCase() || null;
    const usuario = String(b.usuario || "").trim() ? usuarioDesdeNombre(String(b.usuario)) : null;
    const clave = usuario ? claveUsuario(usuario) : null;
    if (!correo && !usuario) return NextResponse.json({ error: "Indica un usuario de acceso o un correo." }, { status: 400 });

    await ensurePermisosSchema();
    const pool = getPool();
    if (correo) {
      const d = await pool.query(`SELECT id FROM usuarios WHERE correo = $1 AND id != $2`, [correo, id]);
      if (d.rows.length) return NextResponse.json({ error: "Ese correo ya lo usa otra cuenta." }, { status: 409 });
    }
    if (clave) {
      const d = await pool.query(`SELECT id FROM usuarios WHERE usuario_clave = $1 AND id != $2`, [clave, id]);
      if (d.rows.length) return NextResponse.json({ error: "Ese usuario ya lo usa otra cuenta." }, { status: 409 });
    }
    const r = await pool.query(
      `UPDATE usuarios SET nombre = $2, correo = $3, usuario = $4, usuario_clave = $5, rol = $6 WHERE id = $1`,
      [id, nombre, correo, usuario, clave, rol]
    );
    if (!r.rowCount) return NextResponse.json({ error: "El usuario no existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al editar el usuario." }, { status: 500 });
  }
}
