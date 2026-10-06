import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { NOTA_VISIBLE, ensureNotasSchema, sesionNotas } from "@/lib/notasDB";

export const dynamic = "force-dynamic";

// Organización personal de las notas (cada usuario tiene su propio orden y carpetas, incluso en notas compartidas).
// POST { orden: number[] }                 → guarda el orden manual (arrastrar y soltar)
// POST { nota_id, carpeta_id: number|null } → mueve la nota a una carpeta (null = sin carpeta)
export async function POST(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    await ensureNotasSchema();
    const p = getPool();
    if (Array.isArray(b?.orden)) {
      const ids = b.orden.map(Number).filter((n: number) => n > 0).slice(0, 2000);
      await p.query(
        `INSERT INTO notas_usuario (usuario_id, nota_id, orden)
         SELECT $1, n.id, t.ord::int FROM unnest($2::int[]) WITH ORDINALITY AS t(id, ord) JOIN notas n ON n.id = t.id WHERE ${NOTA_VISIBLE}
         ON CONFLICT (usuario_id, nota_id) DO UPDATE SET orden = EXCLUDED.orden`,
        [s.userId, ids]
      );
      return NextResponse.json({ ok: true });
    }
    if (Number(b?.nota_id)) {
      const carpeta = b?.carpeta_id === null || b?.carpeta_id === undefined ? null : Number(b.carpeta_id);
      if (carpeta !== null) {
        const f = await p.query(`SELECT 1 FROM notas_carpetas WHERE id = $1 AND usuario_id = $2`, [carpeta, s.userId]);
        if (!f.rowCount) return NextResponse.json({ error: "La carpeta no existe." }, { status: 404 });
      }
      const r = await p.query(
        `INSERT INTO notas_usuario (usuario_id, nota_id, carpeta_id)
         SELECT $1, n.id, $3 FROM notas n WHERE n.id = $2 AND ${NOTA_VISIBLE}
         ON CONFLICT (usuario_id, nota_id) DO UPDATE SET carpeta_id = EXCLUDED.carpeta_id`,
        [s.userId, Number(b.nota_id), carpeta]
      );
      if (!r.rowCount) return NextResponse.json({ error: "La nota no existe." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al organizar." }, { status: 500 });
  }
}
