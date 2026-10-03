import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAMPOS = "id, nombre, contacto, telefono, notas, maps_url, tiempo_traslado, a_domicilio, catalogo, costos, pagos_saldos, creditos, foto_mapa";
const MAX_FOTO = 1_000_000;

// GET: catálogo (con ?fotos=1 incluye la foto del mapa, para imprimir la OC).
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const conFotos = req.nextUrl.searchParams.get("fotos") === "1";
    const r = await getPool().query(
      `SELECT ${conFotos ? CAMPOS : CAMPOS.replace(", foto_mapa", ", (foto_mapa IS NOT NULL) AS tiene_foto")} FROM proveedores WHERE COALESCE(nombre, '') <> '' ORDER BY nombre`
    );
    return NextResponse.json({ ok: true, proveedores: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer proveedores." }, { status: 500 });
  }
}

// POST: alta de proveedor.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const nombre = t(b?.nombre);
    if (!nombre) return NextResponse.json({ error: "El nombre del negocio es obligatorio." }, { status: 400 });
    const foto = t(b?.foto_mapa);
    if (foto && (!foto.startsWith("data:image/") || foto.length > MAX_FOTO)) {
      return NextResponse.json({ error: "La foto del mapa no es válida o es muy pesada." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const existe = await pool.query(`SELECT 1 FROM proveedores WHERE lower(trim(nombre)) = lower($1)`, [nombre]);
    if (existe.rowCount) return NextResponse.json({ error: "Ya existe un proveedor con ese nombre." }, { status: 409 });
    const r = await pool.query(
      `INSERT INTO proveedores (nombre, contacto, telefono, notas, maps_url, tiempo_traslado, a_domicilio, catalogo, costos, pagos_saldos, creditos, foto_mapa)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [nombre, t(b.contacto), t(b.telefono), t(b.notas), t(b.maps_url), t(b.tiempo_traslado), b.a_domicilio === true, t(b.catalogo), t(b.costos), t(b.pagos_saldos), t(b.creditos), foto]
    );
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al dar de alta el proveedor." }, { status: 500 });
  }
}
