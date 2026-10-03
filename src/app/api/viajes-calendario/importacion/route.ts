import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, sesionAsistencia } from "@/lib/asistenciaDB";
import { REGISTRADO_POR_SEED, normalizar, sincronizarAsistenciaViajes } from "@/lib/viajesSemana40Seed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Conciliación de la importación de la Semana 40: ECO que no existen en Unidades y operadores sin expediente,
// con sugerencias de relación. El usuario confirma y se aplican (POST).

const digitos = (s: string) => (s.match(/\d+/g) || []).join("").replace(/^0+/, "");

function sugerirEco(eco: string, ecos: string[]): string[] {
  const d = digitos(eco);
  if (!d) return [];
  return ecos.filter((e) => digitos(e) === d).slice(0, 5);
}

function sugerirPersona(nombre: string, personas: { id: number; nombre: string; n: string }[]) {
  const t = normalizar(nombre).split(" ");
  return personas
    .map((p) => {
      const pt = new Set(p.n.split(" "));
      const comunes = t.filter((x) => pt.has(x)).length;
      return { id: p.id, nombre: p.nombre, puntaje: comunes / Math.max(t.length, 1) };
    })
    .filter((x) => x.puntaje >= 0.5)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, 4);
}

export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureAsistenciaSchema();
    const p = getPool();
    const marca = await p.query(`SELECT aplicado_en, detalle FROM seeds_aplicados WHERE clave = 'viajes_semana_40_2026'`).catch(() => ({ rows: [] as any[] }));
    const viajes = await p.query(
      `SELECT v.id, v.eco, to_char(v.fecha, 'YYYY-MM-DD') AS fecha, v.operador_id, v.datos->>'OPERADOR' AS operador, (u.eco IS NOT NULL) AS eco_existe
       FROM viajes_calendario v LEFT JOIN unidades u ON u.eco = v.eco WHERE v.registrado_por = $1 ORDER BY v.fecha, v.id`,
      [REGISTRADO_POR_SEED]
    );
    const ecos = (await p.query(`SELECT eco FROM unidades ORDER BY eco`)).rows.map((r) => String(r.eco));
    const personas = (await p.query(`SELECT id, nombre FROM expedientes WHERE COALESCE(estatus_laboral, 'Activo') != 'Baja' ORDER BY nombre`)).rows.map((r) => ({
      id: Number(r.id),
      nombre: String(r.nombre),
      n: normalizar(String(r.nombre || "")),
    }));

    const ecoMap = new Map<string, number>();
    const opMap = new Map<string, number>();
    for (const v of viajes.rows) {
      if (!v.eco_existe) ecoMap.set(v.eco, (ecoMap.get(v.eco) || 0) + 1);
      if (!v.operador_id && v.operador) opMap.set(v.operador, (opMap.get(v.operador) || 0) + 1);
    }
    return NextResponse.json({
      ok: true,
      aplicado: marca.rows[0]?.aplicado_en || null,
      totalImportados: viajes.rows.length,
      ecosFaltantes: [...ecoMap].map(([eco, viajes]) => ({ eco, viajes, sugerencias: sugerirEco(eco, ecos) })),
      operadoresFaltantes: [...opMap].map(([nombre, viajes]) => ({ nombre, viajes, sugerencias: sugerirPersona(nombre, personas) })),
      ecos,
      personas: personas.map(({ id, nombre }) => ({ id, nombre })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer la importación." }, { status: 500 });
  }
}

// POST { ecos: { "L-71": "71" }, operadores: { "NOMBRE PDF": 12 } }
export async function POST(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => ({}));
  const ecos: Record<string, string> = b?.ecos && typeof b.ecos === "object" ? b.ecos : {};
  const operadores: Record<string, number> = b?.operadores && typeof b.operadores === "object" ? b.operadores : {};
  await ensureAsistenciaSchema();
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const afectados = new Set<number>();
    for (const [origen, destino] of Object.entries(ecos)) {
      if (!destino) continue;
      const u = await c.query(`SELECT 1 FROM unidades WHERE eco = $1`, [destino]);
      if (!u.rowCount) throw new Error(`La unidad ${destino} no existe.`);
      const r = await c.query(
        `UPDATE viajes_calendario SET eco = $2, datos = jsonb_set(datos, '{ECO}', to_jsonb($2::text)), updated_at = now()
         WHERE registrado_por = $3 AND eco = $1 RETURNING id`,
        [origen, destino, REGISTRADO_POR_SEED]
      );
      r.rows.forEach((x) => afectados.add(Number(x.id)));
    }
    for (const [nombre, id] of Object.entries(operadores)) {
      const pid = Number(id);
      if (!pid) continue;
      const e = await c.query(`SELECT nombre FROM expedientes WHERE id = $1`, [pid]);
      if (!e.rowCount) throw new Error("El operador elegido no existe.");
      const r = await c.query(
        `UPDATE viajes_calendario SET operador_id = $2, datos = jsonb_set(datos, '{OPERADOR}', to_jsonb($3::text)), updated_at = now()
         WHERE registrado_por = $4 AND operador_id IS NULL AND datos->>'OPERADOR' = $1 RETURNING id`,
        [nombre, pid, e.rows[0].nombre, REGISTRADO_POR_SEED]
      );
      r.rows.forEach((x) => afectados.add(Number(x.id)));
    }
    await sincronizarAsistenciaViajes(c, [...afectados]);
    await c.query("COMMIT");
    return NextResponse.json({ ok: true, actualizados: afectados.size });
  } catch (e) {
    await c.query("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al aplicar la conciliación." }, { status: 500 });
  } finally {
    c.release();
  }
}
