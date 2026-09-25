import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureInventarioSchema } from "@/lib/inventarioDB";
import { CAMPOS_GENERALES, type CampoInventario, type EquipoPublico, type EstadoInventario } from "@/lib/inventarioData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Formato de folio: 2 a 5 letras, guion y números (ej. LAP-0001).
const FORMATO_FOLIO = /^[A-Z]{2,5}-\d{4,}$/;

interface FilaConsulta {
  folio: string;
  estado: EstadoInventario;
  datos: Record<string, string>;
  categoria_nombre: string;
  categoria_campos: CampoInventario[];
}

// GET /api/inventario/consulta?folio=LAP-0001
// Ruta PÚBLICA (la usa la página que se abre al escanear el QR).
// Devuelve solo la ficha del equipo: nunca ids internos, notas ni otros equipos.
export async function GET(req: Request) {
  try {
    const folio = (new URL(req.url).searchParams.get("folio") || "").trim().toUpperCase();
    if (!FORMATO_FOLIO.test(folio)) {
      return NextResponse.json({ error: "Folio inválido." }, { status: 400 });
    }

    await ensureInventarioSchema();
    const result = await getPool().query<FilaConsulta>(
      `SELECT e.folio, e.estado, e.datos, c.nombre AS categoria_nombre, c.campos AS categoria_campos
       FROM inventario_equipos e
       JOIN inventario_categorias c ON c.clave = e.categoria_clave
       WHERE e.folio = $1`,
      [folio]
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "No se encontró ningún equipo con ese folio." }, { status: 404 });
    }

    const f = result.rows[0];
    const datos = f.datos || {};
    const camposCategoria = Array.isArray(f.categoria_campos) ? f.categoria_campos : [];

    // Solo se muestran los campos que tienen valor. El nombre va aparte como título.
    const campos = [...CAMPOS_GENERALES.filter((c) => c.clave !== "nombre"), ...camposCategoria]
      .filter((c) => datos[c.clave])
      .map((c) => ({ etiqueta: c.etiqueta, valor: datos[c.clave] }));

    const equipo: EquipoPublico = {
      folio: f.folio,
      estado: f.estado,
      categoria: f.categoria_nombre,
      nombre: datos.nombre || f.folio,
      campos,
    };

    return NextResponse.json({ ok: true, equipo }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // No se exponen detalles internos en una ruta pública.
    return NextResponse.json({ error: "No se pudo consultar el equipo." }, { status: 500 });
  }
}