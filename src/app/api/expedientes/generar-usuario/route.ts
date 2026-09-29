import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { hashPassword, PASSWORD_INICIAL_PERSONAL, usuarioDesdeNombre, claveUsuario } from "@/lib/auth";
import { COOKIE_SESION, verificarTokenSesion, tienePermisosAdmin } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Genera el usuario de acceso de un colaborador a partir de su expediente:
// usuario = nombre del expediente en MAYÚSCULAS, contraseña inicial = 1234 (solo el sysadmin puede cambiarla).
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarTokenSesion(token) : null;
    if (!sesion || !tienePermisosAdmin(sesion.rol)) {
      return NextResponse.json({ error: "No tienes permisos para generar usuarios." }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta el id del expediente." }, { status: 400 });

    await ensureSchema();
    const pool = getPool();
    const exp = await pool.query(`SELECT id, nombre, estatus_laboral FROM expedientes WHERE id = $1`, [id]);
    const expediente = exp.rows[0];
    if (!expediente) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
    if ((expediente.estatus_laboral || "Activo") === "Baja") {
      return NextResponse.json({ error: "No se puede generar usuario a un colaborador dado de baja." }, { status: 400 });
    }

    const usuario = usuarioDesdeNombre(expediente.nombre);
    const clave = claveUsuario(expediente.nombre);
    if (!clave) return NextResponse.json({ error: "El expediente no tiene un nombre válido." }, { status: 400 });

    const yaTiene = await pool.query(`SELECT id FROM usuarios WHERE expediente_id = $1`, [expediente.id]);
    if (yaTiene.rows.length > 0) return NextResponse.json({ error: "Este colaborador ya tiene usuario generado." }, { status: 409 });

    const duplicado = await pool.query(`SELECT id FROM usuarios WHERE usuario_clave = $1`, [clave]);
    if (duplicado.rows.length > 0) {
      return NextResponse.json({ error: `Ya existe un usuario "${usuario}". Distingue los nombres en los expedientes.` }, { status: 409 });
    }

    const hash = await hashPassword(PASSWORD_INICIAL_PERSONAL);
    await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, usuario, usuario_clave, expediente_id) VALUES ($1, NULL, $2, 'personal', $3, $4, $5)`,
      [String(expediente.nombre).trim(), hash, usuario, clave, expediente.id]
    );
    return NextResponse.json({ ok: true, usuario, passwordInicial: PASSWORD_INICIAL_PERSONAL });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al generar el usuario." }, { status: 500 });
  }
}
