import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verificarPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Contraseña con la que nace cada usuario generado desde Expedientes. Solo el sysadmin puede cambiarla.
export const PASSWORD_INICIAL_PERSONAL = "1234";

// Nombre visible del usuario: el del expediente, en MAYÚSCULAS y sin espacios repetidos.
export function usuarioDesdeNombre(nombre: string): string {
  return String(nombre).replace(/\s+/g, " ").trim().toUpperCase();
}

// Clave de comparación al iniciar sesión: MAYÚSCULAS y sin acentos (así "HERNANDEZ" también entra si no ponen el acento).
export function claveUsuario(texto: string): string {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
