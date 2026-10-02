import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, sesionNomina } from "@/lib/nominaDB";
import { DEFAULTS_EMPLEADO, aNumero, redondear } from "@/lib/nominaCalculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Conceptos de nómina por persona. Si la persona aún no está configurada se usan los valores por defecto
// (sueldo base $2,310, IMSS $75, caja de ahorro $100, Fonacot $0, Infonavit $0) y su sueldo ofertado del expediente.
const SELECT = `
  SELECT e.id, e.nombre, e.puesto, e.sueldo_ofertado, to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
         n.sueldo_semanal, n.sueldo_base, n.imss, n.caja_ahorro, n.fonacot, n.infonavit,
         COALESCE(n.incluir, true) AS incluir, n.notas, (n.expediente_id IS NOT NULL) AS configurado
  FROM expedientes e LEFT JOIN nomina_empleados n ON n.expediente_id = e.id`;

function mapear(f: Record<string, unknown>) {
  const conf = !!f.configurado;
  return {
    expediente_id: f.id as number,
    nombre: f.nombre as string,
    puesto: f.puesto as string | null,
    fecha_ingreso: f.fecha_ingreso as string | null,
    sueldo_ofertado: f.sueldo_ofertado as string | null,
    sueldo_semanal: conf ? aNumero(f.sueldo_semanal) : aNumero(f.sueldo_ofertado),
    sueldo_base: conf ? aNumero(f.sueldo_base) : DEFAULTS_EMPLEADO.sueldo_base,
    imss: conf ? aNumero(f.imss) : DEFAULTS_EMPLEADO.imss,
    caja_ahorro: conf ? aNumero(f.caja_ahorro) : DEFAULTS_EMPLEADO.caja_ahorro,
    fonacot: conf ? aNumero(f.fonacot) : DEFAULTS_EMPLEADO.fonacot,
    infonavit: conf ? aNumero(f.infonavit) : DEFAULTS_EMPLEADO.infonavit,
    incluir: f.incluir as boolean,
    notas: f.notas as string | null,
    configurado: conf,
  };
}

// Caja de ahorro acumulada: suma de los abonos (deducción) capturados en las nóminas guardadas.
async function cajaAcumulada(expedienteId: number): Promise<{ semanas: number; acumulado: number }> {
  const r = await getPool().query(
    `SELECT COUNT(*) FILTER (WHERE caja_ahorro > 0)::int AS semanas, COALESCE(SUM(caja_ahorro), 0) AS total FROM nomina_registros WHERE expediente_id = $1`,
    [expedienteId]
  );
  return { semanas: r.rows[0]?.semanas || 0, acumulado: redondear(aNumero(r.rows[0]?.total)) };
}

export async function GET(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureNominaSchema();
    const id = Number(req.nextUrl.searchParams.get("expediente_id"));
    if (id) {
      const r = await getPool().query(`${SELECT} WHERE e.id = $1`, [id]);
      if (!r.rows[0]) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
      const emp = mapear(r.rows[0]);
      return NextResponse.json({ ok: true, empleado: emp, caja: await cajaAcumulada(id) });
    }
    const r = await getPool().query(`${SELECT} WHERE COALESCE(e.estatus_laboral, 'Activo') != 'Baja' ORDER BY e.nombre ASC`);
    return NextResponse.json({ ok: true, empleados: r.rows.map(mapear) });
  } catch (err) {
    return errorJson(err, "Error al leer el personal de nómina.");
  }
}

function formatoMoneda(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function PUT(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.expediente_id);
    if (!id) return NextResponse.json({ error: "Falta el empleado." }, { status: 400 });
    const v = (k: keyof typeof DEFAULTS_EMPLEADO) => (b[k] === undefined || b[k] === null || b[k] === "" ? DEFAULTS_EMPLEADO[k] : Math.max(0, aNumero(b[k])));
    const sueldo = Math.max(0, aNumero(b.sueldo_semanal));
    await ensureNominaSchema();
    const pool = getPool();
    await pool.query(
      `INSERT INTO nomina_empleados (expediente_id, sueldo_semanal, sueldo_base, imss, caja_ahorro, fonacot, infonavit, incluir, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (expediente_id) DO UPDATE SET sueldo_semanal = $2, sueldo_base = $3, imss = $4, caja_ahorro = $5, fonacot = $6,
         infonavit = $7, incluir = $8, notas = $9, updated_at = now()`,
      [id, sueldo, v("sueldo_base"), v("imss"), v("caja_ahorro"), v("fonacot"), v("infonavit"), b.incluir !== false, b.notas ? String(b.notas).slice(0, 300) : null]
    );
    // El sueldo ofertado vive ahora en la sección Nómina; se refleja en el expediente para no tener dos valores distintos.
    await pool.query(`UPDATE expedientes SET sueldo_ofertado = $2 WHERE id = $1`, [id, formatoMoneda(sueldo)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al guardar los conceptos de nómina.");
  }
}
