import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, estadoCreditos, recalcularSaldoCredito, sesionNomina } from "@/lib/nominaDB";
import { CONCEPTO_LICENCIA, CONCEPTO_PRESTAMO, aNumero } from "@/lib/nominaCalculo";
import { ahoraMx, lunesDe, sumarDiasIso } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONCEPTOS = [CONCEPTO_LICENCIA, CONCEPTO_PRESTAMO];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Créditos de una persona (licencia federal y préstamos personales) con su historial de abonos.
export async function GET(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("expediente_id"));
    if (!id) return NextResponse.json({ error: "Falta el expediente." }, { status: 400 });
    await ensureNominaSchema();
    const hoy = ahoraMx().fecha;
    const lunes = lunesDe(hoy);
    const estados = await estadoCreditos([id], { periodo_id: null, desde: lunes, hasta: sumarDiasIso(lunes, 6) });
    const ab = await getPool().query(
      `SELECT a.id, a.prestamo_id, a.tipo, a.importe, a.notas, to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
              p.semana, p.anio
       FROM nomina_prestamo_abonos a JOIN nomina_prestamos c ON c.id = a.prestamo_id
       LEFT JOIN nomina_periodos p ON p.id = a.periodo_id
       WHERE c.expediente_id = $1 ORDER BY a.fecha DESC, a.id DESC`,
      [id]
    );
    const creditos = (estados.get(id) || []).map((c) => ({
      ...c,
      // en el expediente se muestra el estado actual (sin proponer el abono de la semana en curso)
      pagado: c.pagado - c.abono_semana,
      pagos: c.pagos - (c.abono_semana > 0 ? 1 : 0),
      saldo_corte: c.saldo_corte + c.abono_semana,
      abonos: ab.rows.filter((a) => a.prestamo_id === c.id).map((a) => ({ ...a, importe: aNumero(a.importe) })),
    }));
    return NextResponse.json({ ok: true, creditos });
  } catch (err) {
    return errorJson(err, "Error al leer los créditos.");
  }
}

export async function POST(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.expediente_id);
    const concepto = String(b.concepto || "");
    const monto = aNumero(b.monto_total);
    const abono = aNumero(b.abono_semanal);
    const inicio = String(b.fecha_inicio || ahoraMx().fecha);
    if (!id || !CONCEPTOS.includes(concepto)) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    if (monto <= 0 || abono <= 0) return NextResponse.json({ error: "Indica el monto total y el abono semanal." }, { status: 400 });
    if (abono > monto) return NextResponse.json({ error: "El abono no puede ser mayor al monto total." }, { status: 400 });
    if (!FECHA.test(inicio)) return NextResponse.json({ error: "Fecha de inicio inválida." }, { status: 400 });
    await ensureNominaSchema();
    const r = await getPool().query(
      `INSERT INTO nomina_prestamos (expediente_id, concepto, monto_total, abono_semanal, saldo, fecha_inicio, estado, notas)
       VALUES ($1, $2, $3, $4, $3, $5, 'Activo', $6) RETURNING id`,
      [id, concepto, monto, abono, inicio, b.notas ? String(b.notas).slice(0, 300) : null]
    );
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    return errorJson(err, "Error al registrar el crédito.");
  }
}

// Modifica monto, abono semanal, fecha de inicio, notas o cancela un crédito.
export async function PATCH(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.id);
    if (!id) return NextResponse.json({ error: "Falta el crédito." }, { status: 400 });
    await ensureNominaSchema();
    const pool = getPool();
    const actual = (await pool.query(`SELECT * FROM nomina_prestamos WHERE id = $1`, [id])).rows[0];
    if (!actual) return NextResponse.json({ error: "El crédito no existe." }, { status: 404 });
    const monto = b.monto_total !== undefined ? aNumero(b.monto_total) : aNumero(actual.monto_total);
    const abono = b.abono_semanal !== undefined ? aNumero(b.abono_semanal) : aNumero(actual.abono_semanal);
    const inicio = b.fecha_inicio && FECHA.test(String(b.fecha_inicio)) ? String(b.fecha_inicio) : actual.fecha_inicio;
    if (monto <= 0 || abono <= 0) return NextResponse.json({ error: "Monto y abono deben ser mayores a 0." }, { status: 400 });
    const estado = b.cancelar === true ? "Cancelado" : b.reactivar === true ? "Activo" : actual.estado;
    await pool.query(
      `UPDATE nomina_prestamos SET monto_total = $2, abono_semanal = $3, fecha_inicio = $4, notas = $5, estado = $6, updated_at = now() WHERE id = $1`,
      [id, monto, abono, inicio, b.notas !== undefined ? (b.notas ? String(b.notas).slice(0, 300) : null) : actual.notas, estado]
    );
    await recalcularSaldoCredito(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al actualizar el crédito.");
  }
}

// Solo se elimina un crédito sin abonos (si ya tiene abonos, se cancela).
export async function DELETE(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta el crédito." }, { status: 400 });
    await ensureNominaSchema();
    const pool = getPool();
    const n = await pool.query(`SELECT COUNT(*)::int AS n FROM nomina_prestamo_abonos WHERE prestamo_id = $1`, [id]);
    if (n.rows[0].n > 0) return NextResponse.json({ error: "El crédito ya tiene abonos; usa “Cancelar” en lugar de eliminar." }, { status: 409 });
    await pool.query(`DELETE FROM nomina_prestamos WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al eliminar el crédito.");
  }
}
