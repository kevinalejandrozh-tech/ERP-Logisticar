import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, sesionNomina } from "@/lib/nominaDB";
import { aNumero, redondear } from "@/lib/nominaCalculo";
import { ahoraMx } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Dashboard de finanzas de nómina: solo cuenta capturas guardadas.
export async function GET(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureNominaSchema();
    const anio = Number(req.nextUrl.searchParams.get("anio")) || Number(ahoraMx().fecha.slice(0, 4));
    const pool = getPool();
    const sem = await pool.query(
      `SELECT p.id, p.semana, to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, to_char(p.fecha_fin, 'YYYY-MM-DD') AS fecha_fin, p.estado,
              COUNT(r.id)::int AS empleados,
              COALESCE(SUM(r.total_percepciones), 0) AS percepciones, COALESCE(SUM(r.total_deducciones), 0) AS deducciones,
              COALESCE(SUM(r.neto), 0) AS neto, COALESCE(SUM(r.deposito_bbva), 0) AS bbva, COALESCE(SUM(r.deposito_viaticos), 0) AS viaticos
       FROM nomina_periodos p LEFT JOIN nomina_registros r ON r.periodo_id = p.id
       WHERE p.anio = $1 GROUP BY p.id ORDER BY p.semana`,
      [anio]
    );
    const con = await pool.query(
      `SELECT COALESCE(SUM(r.sueldo_semanal), 0) AS sueldo, COALESCE(SUM(LEAST(r.bonos_ruta, r.bonos)), 0) AS bono_ruta,
              COALESCE(SUM(r.bonos - LEAST(r.bonos_ruta, r.bonos)), 0) AS bonos_adicionales, COALESCE(SUM(r.otros_incentivos), 0) AS otros_incentivos,
              COALESCE(SUM(r.descuento_faltas), 0) AS faltas, COALESCE(SUM(r.imss), 0) AS imss, COALESCE(SUM(r.caja_ahorro), 0) AS caja_ahorro,
              COALESCE(SUM(r.fonacot), 0) AS fonacot, COALESCE(SUM(r.infonavit), 0) AS infonavit, COALESCE(SUM(r.licencia_federal), 0) AS licencia_federal,
              COALESCE(SUM(r.prestamo), 0) AS prestamo, COALESCE(SUM(r.otros_descuentos), 0) AS otros_descuentos
       FROM nomina_registros r JOIN nomina_periodos p ON p.id = r.periodo_id WHERE p.anio = $1`,
      [anio]
    );
    const top = await pool.query(
      `SELECT r.expediente_id, MAX(r.nombre) AS nombre, COUNT(*)::int AS semanas, COALESCE(SUM(r.neto), 0) AS neto
       FROM nomina_registros r JOIN nomina_periodos p ON p.id = r.periodo_id WHERE p.anio = $1
       GROUP BY r.expediente_id ORDER BY SUM(r.neto) DESC LIMIT 8`,
      [anio]
    );
    const cred = await pool.query(
      `SELECT concepto, COUNT(*)::int AS activos, COALESCE(SUM(saldo), 0) AS saldo FROM nomina_prestamos WHERE estado = 'Activo' GROUP BY concepto`
    );
    const caja = await pool.query(`SELECT COALESCE(SUM(caja_ahorro), 0) AS total, COUNT(DISTINCT expediente_id) FILTER (WHERE caja_ahorro > 0)::int AS personas FROM nomina_registros`);
    const anios = await pool.query(`SELECT DISTINCT anio FROM nomina_periodos ORDER BY anio DESC`);

    const semanas = sem.rows.map((x) => ({
      id: x.id, semana: x.semana, fecha_inicio: x.fecha_inicio, fecha_fin: x.fecha_fin, estado: x.estado, empleados: x.empleados,
      percepciones: aNumero(x.percepciones), deducciones: aNumero(x.deducciones), neto: aNumero(x.neto), bbva: aNumero(x.bbva), viaticos: aNumero(x.viaticos),
    }));
    const conCaptura = semanas.filter((x) => x.empleados > 0);
    const sumar = (k: "percepciones" | "deducciones" | "neto" | "bbva" | "viaticos") => redondear(semanas.reduce((a, x) => a + x[k], 0));
    const c = con.rows[0] || {};
    const num = (k: string) => redondear(aNumero(c[k]));
    return NextResponse.json({
      ok: true,
      anio,
      anios: anios.rows.map((x) => x.anio),
      semanas,
      totales: {
        percepciones: sumar("percepciones"),
        deducciones: sumar("deducciones"),
        neto: sumar("neto"),
        bbva: sumar("bbva"),
        viaticos: sumar("viaticos"),
        semanas_capturadas: conCaptura.length,
        promedio_semanal: conCaptura.length ? redondear(sumar("neto") / conCaptura.length) : 0,
        ultima: conCaptura.length ? conCaptura[conCaptura.length - 1] : null,
      },
      percepciones: [
        { concepto: "Sueldo ofertado", monto: num("sueldo") },
        { concepto: "Bono por ruta", monto: num("bono_ruta") },
        { concepto: "Bonos adicionales", monto: num("bonos_adicionales") },
        { concepto: "Otros incentivos", monto: num("otros_incentivos") },
      ],
      deducciones: [
        { concepto: "Faltas y retardos", monto: num("faltas") },
        { concepto: "IMSS", monto: num("imss") },
        { concepto: "Caja de ahorro", monto: num("caja_ahorro") },
        { concepto: "Fonacot", monto: num("fonacot") },
        { concepto: "Infonavit", monto: num("infonavit") },
        { concepto: "Licencia federal", monto: num("licencia_federal") },
        { concepto: "Préstamos personales", monto: num("prestamo") },
        { concepto: "Otros descuentos", monto: num("otros_descuentos") },
      ],
      top: top.rows.map((x) => ({ expediente_id: x.expediente_id, nombre: x.nombre, semanas: x.semanas, neto: redondear(aNumero(x.neto)) })),
      creditos: cred.rows.map((x) => ({ concepto: x.concepto, activos: x.activos, saldo: redondear(aNumero(x.saldo)) })),
      caja: { total: redondear(aNumero(caja.rows[0]?.total)), personas: caja.rows[0]?.personas || 0 },
    });
  } catch (err) {
    return errorJson(err, "Error al leer el dashboard de nómina.");
  }
}
