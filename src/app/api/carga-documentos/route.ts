import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ensureSchema, getPool } from "@/lib/db";
import { documentosRequeridos, DOC_MAX_ARCHIVOS, DOC_MAX_BYTES_PDF } from "@/lib/evaluacionCandidatosData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// API PÚBLICA del enlace general de documentos de candidatos.
// - POST { accion: "registrar", nombre, operador } → crea el registro y devuelve su token.
// - Con el token: ver sus propios archivos (sin contenido), subir y quitar. Nunca lista otros registros.
const TOKEN = /^[a-f0-9]{48}$/;
const MIMES = ["application/pdf", "image/jpeg", "image/png"];
const BASE64 = /^[A-Za-z0-9+/=]+$/;
const MAX_CHARS = Math.ceil((DOC_MAX_BYTES_PDF * 4) / 3) + 8;
const PUESTO_OPERADOR = "Operador";
const PUESTO_OTRO = "Otro puesto";

async function registroPorToken(t: unknown) {
  if (typeof t !== "string" || !TOKEN.test(t)) return null;
  const r = await getPool().query(`SELECT id, nombre, puesto FROM candidato_registros WHERE token = $1`, [t]);
  return r.rows[0] || null;
}

// GET ?t=token → { nombre, puesto, requeridos, archivos }
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const reg = await registroPorToken(req.nextUrl.searchParams.get("t"));
    if (!reg) return NextResponse.json({ error: "El enlace no es válido o ya no está disponible." }, { status: 404 });
    const a = await getPool().query(`SELECT id, tipo, nombre, mime FROM candidato_registro_documentos WHERE registro_id = $1 ORDER BY id`, [reg.id]);
    return NextResponse.json({ ok: true, nombre: String(reg.nombre).split(" ")[0], puesto: reg.puesto, requeridos: documentosRequeridos(reg.puesto), archivos: a.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la documentación." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const b = await req.json();
    const pool = getPool();

    if (b.accion === "registrar") {
      const nombre = typeof b.nombre === "string" ? b.nombre.replace(/\s+/g, " ").trim() : "";
      if (nombre.length < 5 || nombre.length > 120 || !nombre.includes(" ")) {
        return NextResponse.json({ error: "Escribe tu nombre completo (nombre y apellidos)." }, { status: 400 });
      }
      const token = randomBytes(24).toString("hex");
      await pool.query(`INSERT INTO candidato_registros (nombre, puesto, token) VALUES ($1, $2, $3)`, [nombre, b.operador ? PUESTO_OPERADOR : PUESTO_OTRO, token]);
      return NextResponse.json({ ok: true, token });
    }

    const reg = await registroPorToken(b.t);
    if (!reg) return NextResponse.json({ error: "El enlace no es válido o ya no está disponible." }, { status: 404 });

    if (b.accion === "eliminar") {
      await pool.query(`DELETE FROM candidato_registro_documentos WHERE id = $1 AND registro_id = $2`, [Number(b.archivoId), reg.id]);
      return NextResponse.json({ ok: true });
    }

    const tipo = String(b.tipo || "");
    if (!documentosRequeridos(reg.puesto).some((d) => d.id === tipo)) return NextResponse.json({ error: "Documento no válido." }, { status: 400 });
    if (!MIMES.includes(b.mime)) return NextResponse.json({ error: "Solo se aceptan archivos PDF o fotografías." }, { status: 400 });
    if (typeof b.contenido !== "string" || !b.contenido || b.contenido.length > MAX_CHARS || !BASE64.test(b.contenido)) {
      return NextResponse.json({ error: "El archivo no es válido o es demasiado grande (máximo 3 MB)." }, { status: 400 });
    }
    const n = await pool.query(`SELECT COUNT(*)::int AS n FROM candidato_registro_documentos WHERE registro_id = $1 AND tipo = $2`, [reg.id, tipo]);
    if (n.rows[0].n >= DOC_MAX_ARCHIVOS) return NextResponse.json({ error: `Máximo ${DOC_MAX_ARCHIVOS} archivos por documento.` }, { status: 400 });
    const r = await pool.query(
      `INSERT INTO candidato_registro_documentos (registro_id, tipo, nombre, mime, contenido) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [reg.id, tipo, typeof b.nombre === "string" ? b.nombre.slice(0, 150) : null, b.mime, b.contenido]
    );
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo guardar el archivo." }, { status: 500 });
  }
}
