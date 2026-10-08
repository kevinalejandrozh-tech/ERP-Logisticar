import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { verificarTokenSesion, COOKIE_SESION } from "@/lib/sesion";
import { DOCUMENTOS } from "@/lib/evaluacionCandidatosData";
import { documentosConfigurados, estaCompleto, FECHA_VALIDA, HORA_VALIDA, URL_VALIDA, type ConfigDocumento } from "@/lib/candidatoDocumentos";
import { estadoRegistro, guardarConfigCarga, leerConfigCarga } from "@/lib/candidatoDocumentosDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Registros del enlace general de documentos — PRIVADO, solo sysadmin (además del middleware).
// GET              → lista de registros con avance
// GET ?id=X        → { registro, requeridos, archivos (sin contenido) }
// GET ?archivo=N   → { nombre, mime, contenido }
// GET ?folio=RLKA01 → { id }   (lo usa el QR de la cita)
// GET ?config=1    → configuración de la carga (obligatorios, textos con link, cita)
// POST { accion: "eliminar_archivo", archivoId } | { accion: "eliminar", id } | { accion: "config", documentos, cita_fecha, cita_hora }
async function esSysadmin(req: NextRequest) {
  const t = req.cookies.get(COOKIE_SESION)?.value;
  const s = t ? await verificarTokenSesion(t) : null;
  return s?.rol === "sysadmin";
}

export async function GET(req: NextRequest) {
  try {
    if (!(await esSysadmin(req))) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    await ensureSchema();
    const pool = getPool();
    const sp = req.nextUrl.searchParams;
    const archivo = sp.get("archivo");
    if (archivo !== null) {
      const r = await pool.query(`SELECT id, tipo, nombre, mime, contenido FROM candidato_registro_documentos WHERE id = $1`, [Number(archivo)]);
      if (!r.rows.length) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
      return NextResponse.json({ ok: true, ...r.rows[0] });
    }
    if (sp.get("config") !== null) return NextResponse.json({ ok: true, config: await leerConfigCarga() });
    const folio = sp.get("folio");
    if (folio !== null) {
      const f = await pool.query(`SELECT id FROM candidato_registros WHERE folio = $1`, [folio.trim().toUpperCase()]);
      if (!f.rows.length) return NextResponse.json({ error: `No existe el folio ${folio}.` }, { status: 404 });
      return NextResponse.json({ ok: true, id: f.rows[0].id });
    }
    const id = sp.get("id");
    if (id !== null) {
      const config = await leerConfigCarga();
      const est = await estadoRegistro(Number(id), config);
      const reg = await pool.query(`SELECT id, nombre, puesto, token, created_at FROM candidato_registros WHERE id = $1`, [Number(id)]);
      if (!reg.rows.length || !est) return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
      const a = await pool.query(`SELECT id, tipo, nombre, mime, created_at FROM candidato_registro_documentos WHERE registro_id = $1 ORDER BY id`, [Number(id)]);
      return NextResponse.json({ ok: true, registro: { ...reg.rows[0], ...est }, requeridos: documentosConfigurados(reg.rows[0].puesto, config), archivos: a.rows });
    }
    const config = await leerConfigCarga();
    const r = await pool.query(`
      SELECT c.id, c.nombre, c.puesto, c.created_at, c.folio, c.cita_fecha, c.cita_hora,
             COALESCE(array_agg(DISTINCT d.tipo) FILTER (WHERE d.tipo IS NOT NULL), '{}') AS tipos,
             MAX(d.created_at) AS ultima_carga
      FROM candidato_registros c
      LEFT JOIN candidato_registro_documentos d ON d.registro_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC`);
    const registros = [];
    for (const x of r.rows) {
      const docs = documentosConfigurados(x.puesto, config);
      const tipos = x.tipos as string[];
      const completo = estaCompleto(docs, tipos);
      let folio = x.folio as string | null;
      // Si cambió la configuración (p. ej. un documento dejó de ser obligatorio), se asigna el folio pendiente.
      if (completo && !folio) folio = (await estadoRegistro(x.id, config))?.folio || null;
      registros.push({
        id: x.id,
        nombre: x.nombre,
        puesto: x.puesto,
        created_at: x.created_at,
        ultima_carga: x.ultima_carga,
        cargados: docs.filter((d) => tipos.includes(d.id)).length,
        total: docs.length,
        completo,
        folio,
        cita_fecha: x.cita_fecha || config.cita_fecha,
        cita_hora: x.cita_hora || config.cita_hora,
      });
    }
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los registros." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await esSysadmin(req))) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    await ensureSchema();
    const b = await req.json();
    const pool = getPool();
    if (b.accion === "eliminar_archivo") {
      await pool.query(`DELETE FROM candidato_registro_documentos WHERE id = $1`, [Number(b.archivoId)]);
      return NextResponse.json({ ok: true });
    }
    if (b.accion === "eliminar") {
      await pool.query(`DELETE FROM candidato_registros WHERE id = $1`, [Number(b.id)]);
      return NextResponse.json({ ok: true });
    }
    if (b.accion === "config") {
      const documentos: Record<string, ConfigDocumento> = {};
      for (const d of DOCUMENTOS) {
        const c = b.documentos?.[d.id] || {};
        const url = typeof c.url === "string" ? c.url.trim() : "";
        if (url && !URL_VALIDA.test(url)) return NextResponse.json({ error: `El link de "${d.nombre}" debe iniciar con https://` }, { status: 400 });
        documentos[d.id] = { obligatorio: c.obligatorio !== false, texto: typeof c.texto === "string" ? c.texto.trim().slice(0, 300) : "", url };
      }
      const cita_fecha = typeof b.cita_fecha === "string" && FECHA_VALIDA.test(b.cita_fecha) ? b.cita_fecha : "";
      const cita_hora = typeof b.cita_hora === "string" && HORA_VALIDA.test(b.cita_hora) ? b.cita_hora : "";
      await guardarConfigCarga({ documentos, cita_fecha, cita_hora });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo completar la acción." }, { status: 500 });
  }
}
