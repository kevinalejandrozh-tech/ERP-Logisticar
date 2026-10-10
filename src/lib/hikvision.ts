// Cliente ISAPI para el reloj checador Hikvision (solo servidor, red local).
// Autenticación HTTP Digest (MD5, qop=auth). Credenciales desde variables de entorno:
//   BIOMETRICO_IP, BIOMETRICO_USUARIO (por defecto "admin"), BIOMETRICO_PASSWORD
import { createHash, randomBytes } from "crypto";

export type CredencialesReloj = { ip: string; usuario: string; password: string };

export function credencialesReloj(): CredencialesReloj | null {
  const ip = (process.env.BIOMETRICO_IP || "").trim();
  const password = process.env.BIOMETRICO_PASSWORD || "";
  if (!ip || !password) return null;
  return { ip, usuario: (process.env.BIOMETRICO_USUARIO || "admin").trim(), password };
}

export class ErrorReloj extends Error {
  constructor(message: string, public status = 0, public detalle?: unknown) {
    super(message);
  }
}

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

function parsearDigest(header: string): Record<string, string> {
  const r: Record<string, string> = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]*))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header))) r[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
  return r;
}

function encabezadoDigest(cred: CredencialesReloj, metodo: string, uri: string, reto: Record<string, string>): string {
  const ha1 = md5(`${cred.usuario}:${reto.realm}:${cred.password}`);
  const ha2 = md5(`${metodo}:${uri}`);
  const nc = "00000001";
  const cnonce = randomBytes(8).toString("hex");
  const qop = (reto.qop || "").split(",").map((q) => q.trim()).includes("auth") ? "auth" : "";
  const response = qop ? md5(`${ha1}:${reto.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${reto.nonce}:${ha2}`);
  const partes = [
    `username="${cred.usuario}"`,
    `realm="${reto.realm}"`,
    `nonce="${reto.nonce}"`,
    `uri="${uri}"`,
    `algorithm=MD5`,
    `response="${response}"`,
  ];
  if (reto.opaque) partes.push(`opaque="${reto.opaque}"`);
  if (qop) partes.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return `Digest ${partes.join(", ")}`;
}

// Petición ISAPI con Digest. Devuelve el JSON (o texto) de la respuesta.
export async function isapi<T = unknown>(metodo: "GET" | "POST" | "PUT" | "DELETE", ruta: string, cuerpo?: unknown, cred = credencialesReloj()): Promise<T> {
  if (!cred) throw new ErrorReloj("El reloj checador no está configurado en el servidor (faltan BIOMETRICO_IP / BIOMETRICO_PASSWORD).");
  const url = `http://${cred.ip}${ruta}`;
  const body = cuerpo === undefined ? undefined : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = typeof cuerpo === "string" ? "application/xml" : "application/json";

  const intentar = (extra: Record<string, string> = {}) =>
    fetch(url, { method: metodo, body, headers: { ...headers, ...extra }, cache: "no-store", signal: AbortSignal.timeout(10000) });

  let res: Response;
  try {
    res = await intentar();
    if (res.status === 401) {
      const reto = parsearDigest(res.headers.get("www-authenticate") || "");
      await res.text().catch(() => "");
      if (!reto.nonce) throw new ErrorReloj("El reloj no aceptó la autenticación.", 401);
      res = await intentar({ Authorization: encabezadoDigest(cred, metodo, ruta, reto) });
    }
  } catch (e) {
    if (e instanceof ErrorReloj) throw e;
    throw new ErrorReloj(`No se pudo conectar con el reloj (${cred.ip}). Verifica que esté encendido y en la red.`);
  }

  const texto = await res.text();
  let datos: unknown = texto;
  try {
    datos = JSON.parse(texto);
  } catch {
    /* respuesta XML o vacía */
  }
  if (res.status === 401) {
    // No se reintenta: varios intentos fallidos bloquean al usuario admin del reloj.
    throw new ErrorReloj("Usuario o contraseña del reloj incorrectos. Revisa BIOMETRICO_PASSWORD en el servidor.", 401, datos);
  }
  if (!res.ok) {
    const d = datos as { subStatusCode?: string; errorMsg?: string; statusString?: string };
    throw new ErrorReloj(`El reloj respondió con error (${res.status}${d?.subStatusCode ? ` · ${d.subStatusCode}` : ""}).`, res.status, datos);
  }
  return datos as T;
}

// ---------- Usuarios del reloj ----------

export type UsuarioReloj = {
  employeeNo: string;
  name: string;
  userType?: string;
  numOfFace?: number;
  numOfFP?: number;
  numOfCard?: number;
};

export async function infoDispositivo(): Promise<{ modelo: string | null; serie: string | null; firmware: string | null }> {
  const xml = await isapi<string>("GET", "/ISAPI/System/deviceInfo");
  const tag = (t: string) => new RegExp(`<${t}>([^<]*)</${t}>`).exec(String(xml))?.[1] || null;
  return { modelo: tag("model"), serie: tag("serialNumber"), firmware: tag("firmwareVersion") };
}

export async function listarUsuariosReloj(): Promise<UsuarioReloj[]> {
  const todos: UsuarioReloj[] = [];
  const searchID = randomBytes(6).toString("hex");
  for (let pos = 0; pos < 5000; ) {
    const r = await isapi<{ UserInfoSearch?: { responseStatusStrg?: string; numOfMatches?: number; UserInfo?: UsuarioReloj[] } }>(
      "POST",
      "/ISAPI/AccessControl/UserInfo/Search?format=json",
      { UserInfoSearchCond: { searchID, searchResultPosition: pos, maxResults: 30 } }
    );
    const s = r.UserInfoSearch;
    const lote = s?.UserInfo || [];
    todos.push(...lote);
    pos += lote.length;
    if (!lote.length || s?.responseStatusStrg !== "MORE") break;
  }
  return todos;
}

// Alta o actualización (SetUp = crea si no existe, modifica si ya existe).
export async function guardarUsuarioReloj(employeeNo: string, nombre: string): Promise<void> {
  await isapi("PUT", "/ISAPI/AccessControl/UserInfo/SetUp?format=json", {
    UserInfo: {
      employeeNo,
      name: nombre.slice(0, 64),
      userType: "normal",
      Valid: { enable: true, beginTime: "2020-01-01T00:00:00", endTime: "2037-12-31T23:59:59", timeType: "local" },
      doorRight: "1",
      RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
    },
  });
}

// Elimina usuarios (con su rostro y huellas) del reloj. Máximo 30 por petición.
export async function eliminarUsuariosReloj(employeeNos: string[]): Promise<void> {
  for (let i = 0; i < employeeNos.length; i += 30) {
    const lote = employeeNos.slice(i, i + 30).map((employeeNo) => ({ employeeNo }));
    await isapi("PUT", "/ISAPI/AccessControl/UserInfo/Delete?format=json", { UserInfoDelCond: { EmployeeNoList: lote } });
  }
}
