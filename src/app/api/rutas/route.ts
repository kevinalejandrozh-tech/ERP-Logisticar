import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, sesionAsistencia } from "@/lib/asistenciaDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Catálogo de rutas con bono por ruta (lo usan Control de viajes, Asistencia y Nómina).
function err(e: unknown, m: string) {
  const msg = e instanceof Error ? e.message : m;
  return NextResponse.json({ error: /unique|duplicate/i.test(msg) ? "Ya existe una ruta con ese nombre." : msg }, { status: /unique|duplicate/i.test(msg) ? 409 : 500 });
}

function leer(b: Record<string, unknown>) {
  return {
    nombre: String(b.nombre || "").trim().slice(0, 120),
    estado: b.estado_destino ? String(b.estado_destino).slice(0, 60) : null,
    bono: Math.max(0, Number(b.bono) || 0),
    activa: b.activa !== false,
    notas: b.notas ? String(b.notas).slice(0, 300) : null,
  };
}

export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureAsistenciaSchema();
    const r = await getPool().query(`SELECT id, nombre, estado_destino, bono, activa, notas FROM rutas ORDER BY activa DESC, nombre ASC`);
    return NextResponse.json({ ok: true, rutas: r.rows.map((x) => ({ ...x, bono: Number(x.bono) || 0 })) });
  } catch (e) {
    return err(e, "Error al leer las rutas.");
  }
}

export async function POST(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const d = leer(await req.json());
    if (!d.nombre) return NextResponse.json({ error: "Indica el nombre de la ruta." }, { status: 400 });
    await ensureAsistenciaSchema();
    const r = await getPool().query(
      `INSERT INTO rutas (nombre, estado_destino, bono, activa, notas) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [d.nombre, d.estado, d.bono, d.activa, d.notas]
    );
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    return err(e, "Error al guardar la ruta.");
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.id);
    const d = leer(b);
    if (!id || !d.nombre) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(
      `UPDATE rutas SET nombre = $2, estado_destino = $3, bono = $4, activa = $5, notas = $6, updated_at = now() WHERE id = $1`,
      [id, d.nombre, d.estado, d.bono, d.activa, d.notas]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e, "Error al guardar la ruta.");
  }
}

export async function DELETE(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta la ruta." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(`DELETE FROM rutas WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e, "Error al eliminar la ruta.");
  }
}
