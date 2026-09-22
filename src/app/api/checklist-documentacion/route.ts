import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { DOCUMENTOS_CHECK, MAX_FOTOS_DOC } from "@/lib/checkDocumentacionData";

function marcaFolio(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  const hora = g("hour") === "24" ? "00" : g("hour");
  return `${g("year")}${g("month")}${g("day")}-${hora}${g("minute")}${g("second")}`;
}

export async function POST(req: NextRequest) {
  try {
    const { eco_unidad, descripcion_unidad, placas, documentos } = await req.json();
    if (!eco_unidad) {
      return NextResponse.json({ error: "Falta el ECO de la unidad." }, { status: 400 });
    }
    const limpio: Record<string, { respuesta: string; fotos: string[] }> = {};
    for (const d of DOCUMENTOS_CHECK) {
      const item = documentos?.[d.key];
      if (item?.respuesta !== "si" && item?.respuesta !== "no") {
        return NextResponse.json({ error: `Falta responder: ${d.label}.` }, { status: 400 });
      }
      const fotos: string[] = Array.isArray(item.fotos) ? item.fotos.filter((f: unknown) => typeof f === "string") : [];
      if (fotos.length > MAX_FOTOS_DOC) {
        return NextResponse.json({ error: `Máximo ${MAX_FOTOS_DOC} fotos por documento (${d.label}).` }, { status: 400 });
      }
      limpio[d.key] = { respuesta: item.respuesta, fotos };
    }
    await ensureSchema();
    const pool = getPool();
    const folio = `DOC-${eco_unidad}-${marcaFolio(new Date())}`;
    const result = await pool.query(
      `INSERT INTO checklist_documentacion (folio, eco_unidad, descripcion_unidad, placas, documentos)
       VALUES ($1,$2,$3,$4,$5) RETURNING folio, fecha_hora`,
      [folio, eco_unidad, descripcion_unidad || null, placas || null, JSON.stringify(limpio)]
    );
    return NextResponse.json({ ok: true, ...result.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el check de documentación." }, { status: 500 });
  }
}
