import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { verificarPassword, claveUsuario } from "@/lib/auth";
import { seccionesDeRol } from "@/lib/permisosDB";
import { crearTokenSesion, COOKIE_SESION, DURACION_SESION_SEGUNDOS, Rol } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // "usuario" es el campo nuevo (nombre en MAYÚSCULAS o correo); "correo" se mantiene por compatibilidad.
    const identificador = String(body.usuario ?? body.correo ?? "").trim();
    const password = body.password;
    if (!identificador || !password) return NextResponse.json({ error: "Ingresa usuario y contraseña." }, { status: 400 });

    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.correo, u.usuario, u.password_hash, u.rol, e.estatus_laboral
       FROM usuarios u
       LEFT JOIN expedientes e ON e.id = u.expediente_id
       WHERE u.correo = $1 OR u.usuario_clave = $2
       LIMIT 1`,
      [identificador.toLowerCase(), claveUsuario(identificador)]
    );
    const usuario = result.rows[0];
    if (!usuario) return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });

    const valido = await verificarPassword(password, usuario.password_hash);
    if (!valido) return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });

    // Si el colaborador fue dado de baja en Expedientes, pierde el acceso.
    if (usuario.estatus_laboral === "Baja") {
      return NextResponse.json({ error: "Tu acceso está deshabilitado. Contacta al administrador." }, { status: 403 });
    }

    const secciones = await seccionesDeRol(usuario.rol);
    const token = await crearTokenSesion({ userId: usuario.id, nombre: usuario.nombre, correo: usuario.correo || "", rol: usuario.rol as Rol, secciones });

    const expiraEn = new Date(Date.now() + DURACION_SESION_SEGUNDOS * 1000);
    await pool.query(`INSERT INTO sesiones (token, usuario_id, expira_en) VALUES ($1,$2,$3)`, [token, usuario.id, expiraEn]);

    const res = NextResponse.json({ ok: true, nombre: usuario.nombre, rol: usuario.rol });
    res.cookies.set(COOKIE_SESION, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      // sin maxAge: cookie de sesión, se elimina al cerrar el navegador
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al iniciar sesión." }, { status: 500 });
  }
}
