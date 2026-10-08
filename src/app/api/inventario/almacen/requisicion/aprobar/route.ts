import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAlmacenSchema, procesarRequisicion, type ItemSolicitado } from "@/lib/almacenDB";
import { puedeAutorizarOC, sesionCompras } from "@/lib/comprasDB";

export const dynamic = "force-dynamic";

// POST { folio, accion: "aprobar" | "rechazar", motivo? }
// Aprobar: descuenta existencias, registra las salidas y deja la requisición "Aprobada".
// Rechazar: no toca existencias. Solo el sysadmin y los roles que autorizan OC.
export async function POST(req: NextRequest) {
  const sesion = await sesionCompras(req).catch(() => null);
  if (!sesion || !(await puedeAutorizarOC(sesion.rol))) {
    return NextResponse.json({ error: "No tienes permiso para aprobar requisiciones." }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const folio = String(b?.folio || "").trim();
  const accion = b?.accion === "rechazar" ? "rechazar" : b?.accion === "aprobar" ? "aprobar" : "";
  const motivo = String(b?.motivo || "").trim().slice(0, 300);
  if (!folio || !accion) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  if (accion === "rechazar" && !motivo) return NextResponse.json({ error: "Indica el motivo del rechazo." }, { status: 400 });

  await ensureAlmacenSchema();
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(`SELECT * FROM alm_requisiciones WHERE folio = $1 FOR UPDATE`, [folio]);
    if (!r.rowCount) throw new Error("La requisición no existe.");
    const req0 = r.rows[0];
    if (req0.estado !== "Pendiente de aprobación") throw new Error(`La requisición ya fue atendida (${req0.estado}).`);
    const quien = sesion.nombre || sesion.rol || null;

    if (accion === "rechazar") {
      const u = await c.query(
        `UPDATE alm_requisiciones SET estado = 'Rechazada', aprobado_por = $2, aprobado_at = now(), motivo_rechazo = $3 WHERE folio = $1 RETURNING *`,
        [folio, quien, motivo]
      );
      await c.query("COMMIT");
      return NextResponse.json({ ok: true, requisicion: u.rows[0] });
    }

    const items: ItemSolicitado[] = (Array.isArray(req0.items) ? req0.items : []).map((i: any) => ({
      articulo_id: Number(i.articulo_id),
      ubicacion_id: Number(i.ubicacion_id),
      cantidad: Number(i.cantidad),
    }));
    const { detalle, total } = await procesarRequisicion(c, items, { descontar: true, folio, referencia: req0.referencia, usuario: req0.usuario });
    const u = await c.query(
      `UPDATE alm_requisiciones SET estado = 'Aprobada', items = $2, total = $3, aprobado_por = $4, aprobado_at = now() WHERE folio = $1 RETURNING *`,
      [folio, JSON.stringify(detalle), total, quien]
    );
    await c.query("COMMIT");
    return NextResponse.json({ ok: true, requisicion: u.rows[0] });
  } catch (e) {
    await c.query("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al atender la requisición." }, { status: 400 });
  } finally {
    c.release();
  }
}
