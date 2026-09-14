import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { SECCIONES } from "@/lib/checklistData";
import * as XLSX from "xlsx";
import JSZip from "jszip";
function semanaDelAnio(fecha: Date): number {
const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
const diaSemana = d.getUTCDay() || 7;
d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
return Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
}
// Detecta puntos con el mismo nombre en mas de una seccion para evitar choques de columna
const frecuenciaPuntos: Record<string, number> = {};
SECCIONES.forEach((sec) => {
sec.puntos.forEach((p) => {
frecuenciaPuntos[p] = (frecuenciaPuntos[p] || 0) + 1;
});
});
function nombreColumna(sec: { key: string; titulo: string }, punto: string): string {
return frecuenciaPuntos[punto] > 1 ? `${punto} (${sec.titulo})` : punto;
}
function valorPunto(checklist: any, seccionKey: string, punto: string): string {
const item = checklist?.[`${seccionKey}__${punto}`];
if (!item || !item.valor) return "";
const base = item.valor === "si" ? "Sí" : "No";
return item.comentario ? `${base} (${item.comentario})` : base;
}
export async function GET() {
try {
await ensureSchema();
const pool = getPool();
const result = await pool.query(
`SELECT * FROM checklist_unidades ORDER BY fecha_hora DESC`
);
const registros = result.rows;
if (registros.length === 0) {
return NextResponse.json(
{ error: "No hay registros para exportar." },
{ status: 400 }
);
}
const filas = registros.map((r) => {
const fila: Record<string, any> = {
Folio: r.folio,
"ECO Unidad": r.eco_unidad,
"Descripción de unidad": r.descripcion_unidad,
Placas: r.placas,
"Fecha y hora": new Date(r.fecha_hora).toLocaleString("es-MX"),
"Kilometraje actual": r.kilometraje_actual,
"% Llenado": r.porcentaje_llenado,
"Dictamen llantas": r.estado_llantas?.dictamen || "",
"Comentario llantas": r.estado_llantas?.comentario || "",
"Nivel aceite": r.niveles?.aceite?.nivel || "",
"Litros aceite": r.niveles?.aceite?.litros || "",
"Obs. aceite": r.niveles?.aceite?.observaciones || "",
"Nivel líquido de frenos": r.niveles?.frenos?.nivel || "",
"Litros frenos": r.niveles?.frenos?.litros || "",
"Obs. frenos": r.niveles?.frenos?.observaciones || "",
"Nivel fluido de dirección": r.niveles?.direccion?.nivel || "",
"Litros dirección": r.niveles?.direccion?.litros || "",
"Obs. dirección": r.niveles?.direccion?.observaciones || "",
"Nivel anticongelante": r.niveles?.anticongelante?.nivel || "",
"Litros anticongelante": r.niveles?.anticongelante?.litros || "",
"Obs. anticongelante": r.niveles?.anticongelante?.observaciones || "",
"Nivel agua limpiaparabrisas": r.niveles?.limpiaparabrisas?.nivel || "",
"Litros limpiaparabrisas": r.niveles?.limpiaparabrisas?.litros || "",
"Obs. limpiaparabrisas": r.niveles?.limpiaparabrisas?.observaciones || "",
};
SECCIONES.forEach((sec) => {
sec.puntos.forEach((p) => {
fila[nombreColumna(sec, p)] = valorPunto(r.checklist, sec.key, p);
});
});
return fila;
});
const hoja = XLSX.utils.json_to_sheet(filas);
const libro = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(libro, hoja, "Checklist Unidades");
const excelBuffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
const zip = new JSZip();
zip.file("Checklist_Unidades.xlsx", excelBuffer);
const guardarFotoBase64 = (dataUrl: string, ruta: string) => {
const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
if (!match) return;
const ext = match[1].split("/")[1] || "jpg";
zip.file(`${ruta}.${ext}`, Buffer.from(match[2], "base64"));
};
for (const r of registros) {
const semana = semanaDelAnio(new Date(r.fecha_hora));
const carpeta = `${r.eco_unidad} Check List. Semana ${semana}`;
const fotos = r.fotos_evidencia || {};
Object.entries(fotos).forEach(([nombre, dataUrl]) => {
if (typeof dataUrl === "string" && dataUrl) {
guardarFotoBase64(dataUrl, `${carpeta}/${r.eco_unidad} ${nombre}`);
}
});
const fotosLlantas = r.estado_llantas?.fotos;
if (Array.isArray(fotosLlantas)) {
fotosLlantas.forEach((dataUrl: string, i: number) => {
if (typeof dataUrl === "string" && dataUrl) {
const sufijo = fotosLlantas.length > 1 ? ` ${i + 1}` : "";
guardarFotoBase64(dataUrl, `${carpeta}/${r.eco_unidad} OBSERVACION EN NEUMATICO${sufijo}`);
}
});
}
const fotosLibres = r.fotos_libres;
if (Array.isArray(fotosLibres)) {
fotosLibres.forEach((dataUrl: string, i: number) => {
if (typeof dataUrl === "string" && dataUrl) {
guardarFotoBase64(dataUrl, `${carpeta}/${r.eco_unidad} Detalle ${i + 1}`);
}
});
}
}
const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
return new NextResponse(new Uint8Array(zipBuffer), {
headers: {
"Content-Type": "application/zip",
"Content-Disposition": `attachment; filename="Checklist_Unidades_${new Date()
.toISOString()
.slice(0, 10)}.zip"`,
},
});
} catch (err: any) {
return NextResponse.json(
{ error: err.message || "Error al exportar." },
{ status: 500 }
);
}
}
