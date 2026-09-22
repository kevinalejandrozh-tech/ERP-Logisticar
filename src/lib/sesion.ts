import { SignJWT, jwtVerify } from "jose";

export type Rol = "sysadmin" | "supervisor_tms";
export type SesionPayload = { userId: number; nombre: string; correo: string; rol: Rol };

export const COOKIE_SESION = "gl_sesion";
// La cookie es de sesión de navegador (se borra al cerrarlo) y el token caduca en 12 h como respaldo.
export const DURACION_SESION_SEGUNDOS = 12 * 60 * 60;
const DURACION_SESION = "12h";

function obtenerSecreto() {
  const secreto = process.env.JWT_SECRET || "gl-8f3a2c9d1e6b4f7a2d9c5e1b8f4a7c2d9e6b1f4a8c3d7e2b9f5a1c6d8e3b7f2a";
  return new TextEncoder().encode(secreto);
}

export async function crearTokenSesion(payload: SesionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(DURACION_SESION)
    .sign(obtenerSecreto());
}

export async function verificarTokenSesion(token: string): Promise<SesionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, obtenerSecreto());
    if (!payload.userId || !payload.rol) return null;
    return payload as unknown as SesionPayload;
  } catch {
    return null;
  }
}
