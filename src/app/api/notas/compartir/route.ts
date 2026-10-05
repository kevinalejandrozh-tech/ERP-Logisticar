import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNotasSchema, sesionNotas } from "@/lib/notasDB";
import { todosLosRoles } from "@/lib/permisosDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET — usuarios con acceso a Notas con quienes se puede compartir (excluye al propio usuario).
export async function GET(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    const roles = (await todosLosRoles()).filter((r) => r.rol === "sysadmin" || (Array.isArray(r.secciones) && r.secciones.includes("notas"))).map((r) => r.rol);
    const r = await getPool().query(`SELECT id, nombre FROM usuarios WHERE rol = ANY($1::text[]) AND id <> $2 ORDER BY nombre`, [roles, s.userId]);
    return NextResponse.json({ ok: true, usuarios: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer usuarios." }, { status: 500 });
  }
}

// POST { nota_id, usuarios: number[] } — define con quién se comparte la nota (solo el dueño). [] = dejar de compartir.
export async function POST(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const notaId = Number(b?.nota_id);
    await ensureNotasSchema();
    const p = getPool();
    const dueno = await p.query(`SELECT 1 FROM notas WHERE id = $1 AND usuario_id = $2`, [notaId, s.userId]);
    if (!dueno.rowCount) return NextResponse.json({ error: "Solo el dueño de la nota puede compartirla." }, { status: 403 });
    const ids = Array.from(new Set((Array.isArray(b?.usuarios) ? b.usuarios : []).map(Number).filter((n: number) => n > 0 && n !== s.userId)));
    await p.query(`DELETE FROM notas_compartidas WHERE nota_id = $1`, [notaId]);
    if (ids.length) {
      await p.query(`INSERT INTO notas_compartidas (nota_id, usuario_id) SELECT $1, id FROM usuarios WHERE id = ANY($2::int[]) ON CONFLICT DO NOTHING`, [notaId, ids]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al compartir." }, { status: 500 });
  }
}
