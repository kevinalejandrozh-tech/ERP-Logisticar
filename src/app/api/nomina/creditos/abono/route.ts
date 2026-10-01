import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, recalcularSaldoCredito, sesionNomina } from "@/lib/nominaDB";
import { aNumero } from "@/lib/nominaCalculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Abono extraordinario a un crédito (se muestra en el recibo de la semana de su fecha).
export async function POST(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.prestamo_id);
    const importe = aNumero(b.importe);
    const fecha = String(b.fecha || "");
    if (!id || importe <= 0 || !FECHA.test(fecha)) return NextResponse.json({ error: "Indica fecha e importe." }, { status: 400 });
    await ensureNominaSchema();
    const pool = getPool();
    const c = await pool.query(
      `SELECT monto_total - COALESCE((SELECT SUM(importe) FROM nomina_prestamo_abonos WHERE prestamo_id = $1), 0) AS saldo FROM nomina_prestamos WHERE id = $1`,
      [id]
    );
    if (!c.rows[0]) return NextResponse.json({ error: "El crédito no existe." }, { status: 404 });
    if (importe > aNumero(c.rows[0].saldo) + 0.001) return NextResponse.json({ error: "El abono supera el saldo pendiente." }, { status: 400 });
    await pool.query(
      `INSERT INTO nomina_prestamo_abonos (prestamo_id, importe, fecha, tipo, notas, registrado_por) VALUES ($1, $2, $3, 'Extraordinario', $4, $5)`,
      [id, importe, fecha, b.notas ? String(b.notas).slice(0, 300) : null, s.nombre]
    );
    await recalcularSaldoCredito(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al registrar el abono.");
  }
}

export async function DELETE(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta el abono." }, { status: 400 });
    await ensureNominaSchema();
    const r = await getPool().query(`DELETE FROM nomina_prestamo_abonos WHERE id = $1 AND tipo = 'Extraordinario' RETURNING prestamo_id`, [id]);
    if (!r.rows[0]) return NextResponse.json({ error: "Solo se pueden eliminar abonos extraordinarios." }, { status: 409 });
    await recalcularSaldoCredito(r.rows[0].prestamo_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al eliminar el abono.");
  }
}
