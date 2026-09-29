import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIPOS_DOCUMENTO = ["tarjeta_circulacion", "poliza_seguro", "verificacion"] as const;

function mensajeError(err: unknown, porDefecto: string) {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

// GET /api/unidades/documentos/descargar?eco=ECO-15&tipo=tarjeta_circulacion
// → { ok: true, nombreArchivo, contenido } — contenido es el data URI completo en base64.
// Se pide aparte de /api/unidades/documentos (que solo da metadatos) para no bajar el PDF
// completo hasta que el usuario realmente da clic en "Descargar".
export async function GET(req: NextRequest) {
  try {
    const eco = req.nextUrl.searchParams.get("eco")?.trim();
    const tipo = req.nextUrl.searchParams.get("tipo")?.trim();
    if (!eco || !tipo || !(TIPOS_DOCUMENTO as readonly string[]).includes(tipo)) {
      return NextResponse.json({ error: "Faltan parámetros válidos (eco, tipo)." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT nombre_archivo, contenido FROM unidades_documentos WHERE eco = $1 AND tipo = $2`, [eco, tipo]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Ese documento no existe." }, { status: 404 });
    }
    const fila = result.rows[0];
    return NextResponse.json(
      { ok: true, nombreArchivo: fila.nombre_archivo || "documento.pdf", contenido: fila.contenido },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    return NextResponse.json({ error: mensajeError(err, "Error al descargar el documento.") }, { status: 500 });
  }
}