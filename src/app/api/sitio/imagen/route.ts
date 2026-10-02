import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureSitioSchema, errorSitio, sesionSysadmin } from "@/lib/sitioDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RE_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_BYTES = 2_500_000; // tamaño de la imagen ya comprimida en el navegador

// Público: devuelve una imagen subida. Cada id es inmutable (reemplazar = subir una nueva), así que se cachea.
export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Imagen no válida." }, { status: 400 });
  try {
    await ensureSitioSchema();
    const r = await getPool().query(`SELECT mime, datos FROM sitio_imagenes WHERE id = $1`, [id]);
    if (!r.rows[0]) return NextResponse.json({ error: "La imagen no existe." }, { status: 404 });
    const buffer = Buffer.from(r.rows[0].datos as string, "base64");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": r.rows[0].mime as string,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return errorSitio(err, "No se pudo leer la imagen.");
  }
}

// Solo sysadmin: recibe una imagen (data URL ya comprimida) y devuelve la ruta para usarla en el contenido.
export async function POST(req: NextRequest) {
  const s = await sesionSysadmin(req);
  if (s instanceof NextResponse) return s;
  try {
    const cuerpo = (await req.json().catch(() => null)) as { dataUrl?: unknown } | null;
    const m = typeof cuerpo?.dataUrl === "string" ? RE_DATA_URL.exec(cuerpo.dataUrl) : null;
    if (!m) return NextResponse.json({ error: "El archivo debe ser una imagen JPG, PNG o WEBP." }, { status: 400 });
    if (m[2].length * 0.75 > MAX_BYTES) return NextResponse.json({ error: "La imagen es demasiado grande. Usa una de menor resolución." }, { status: 413 });
    await ensureSitioSchema();
    const r = await getPool().query(`INSERT INTO sitio_imagenes (mime, datos) VALUES ($1, $2) RETURNING id`, [m[1], m[2]]);
    return NextResponse.json({ ok: true, url: `/api/sitio/imagen?id=${r.rows[0].id}` });
  } catch (err) {
    return errorSitio(err, "No se pudo guardar la imagen.");
  }
}
