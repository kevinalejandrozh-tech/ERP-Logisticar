// Formato imprimible de requisición de almacén: media hoja carta (2 por hoja: original y copia),
// mismo estilo que el recibo de nómina.
type ItemReq = { articulo: string; categoria?: string | null; tipo?: string; ubicacion: string; cantidad: number; costo: number; importe: number; queda_ubicacion: number; queda_total: number };
export type Requisicion = { folio: string; referencia: string; items: ItemReq[]; total: number | string; usuario: string | null; created_at: string; estado?: string; aprobado_por?: string | null; motivo_rechazo?: string | null };

const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const moneda = (v: number | string) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v) || 0);

function bloque(r: Requisicion, copia: string) {
  const fecha = new Date(r.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
  const piezas = r.items.reduce((a, i) => a + Number(i.cantidad), 0);
  return `<section class="recibo">
  <header class="cab"><div><h1>TRANSPORTES LOGISTICAR</h1><p>Requisición de almacén · ${esc(copia)}</p></div><div class="folio">Folio<b>${esc(r.folio)}</b></div></header>
  <div class="datos">
    <div><span>Referencia / OT / concepto</span><b>${esc(r.referencia)}</b></div>
    <div><span>Fecha y hora</span><b>${esc(fecha)}</b></div>
    <div><span>Solicitó y recibió</span><b>${esc(r.usuario || "—")}</b></div>
    <div><span>Piezas</span><b>${piezas}</b></div>
  </div>
  <table><thead><tr><th>Artículo</th><th>Categoría</th><th>Ubicación</th><th class="num">Cant.</th><th class="num">Costo</th><th class="num">Importe</th><th class="num">Queda ubic.</th><th class="num">Queda total</th></tr></thead>
  <tbody>${r.items
    .map((i) => `<tr><td>${esc(i.articulo)}</td><td>${esc(i.categoria || "—")}</td><td>${esc(i.ubicacion)}</td><td class="num">${i.cantidad}</td><td class="num">${moneda(i.costo)}</td><td class="num">${moneda(i.importe)}</td><td class="num">${i.queda_ubicacion}</td><td class="num">${i.queda_total}</td></tr>`)
    .join("")}</tbody>
  <tfoot><tr><td colspan="5">Valor total de la requisición</td><td class="num">${moneda(r.total)}</td><td colspan="2"></td></tr></tfoot></table>
  <div class="firmas"><div><i></i>Entregó · Almacén</div><div><i></i>Recibió · ${esc(r.usuario || "")}</div></div>
  <p class="leyenda">Documento interno de salida de almacén.</p>
</section>`;
}

export function imprimirRequisicion(r: Requisicion) {
  const v = window.open("", "_blank", "width=900,height=760");
  if (!v) return alert("Permite las ventanas emergentes para imprimir la requisición.");
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /><title>Requisición ${esc(r.folio)}</title>
<style>
  @page { size: letter; margin: 0.3in; }
  * { box-sizing: border-box; }
  body { font-family: Roboto, "Segoe UI", Arial, sans-serif; margin: 0; background: #f5f6f8; color: #1f2937; font-size: 9.5px; }
  .hoja { width: 7.9in; height: 10.35in; margin: 14px auto; background: #fff; display: flex; flex-direction: column; }
  .recibo { height: calc((10.35in - 0.24in) / 2); padding: 0.14in 0.18in; overflow: hidden; display: flex; flex-direction: column; gap: 6px; }
  .corte { height: 0.24in; border-top: 1px dashed #9aa1b0; position: relative; }
  .corte span { position: absolute; top: -7px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 6px; color: #9aa1b0; font-size: 8.5px; }
  .cab { background: #16215c; color: #fff; padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
  .cab h1 { font-size: 12px; font-weight: 500; margin: 0; } .cab p { margin: 1px 0 0; color: #b9c8f2; font-size: 9px; }
  .folio { text-align: right; color: #b9c8f2; font-size: 8.5px; } .folio b { display: block; color: #fff; font-weight: 500; font-size: 11px; }
  .datos { display: grid; grid-template-columns: 1.6fr 1.2fr 1.2fr .6fr; gap: 4px 10px; }
  .datos span { display: block; color: #6b7280; font-size: 7.8px; text-transform: uppercase; letter-spacing: .03em; } .datos b { font-weight: 500; color: #16215c; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 500; color: #6b7280; font-size: 8px; text-transform: uppercase; border-bottom: 1px solid #cfd5df; padding: 2px 3px; }
  td { padding: 2px 3px; border-bottom: 1px solid #eef0f4; } .num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 500; color: #16215c; border-top: 1px solid #cfd5df; border-bottom: 0; font-size: 10px; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; padding: 18px 20px 0; margin-top: auto; text-align: center; color: #4b5563; font-size: 8.5px; }
  .firmas i { display: block; border-top: 1px solid #6b7280; margin-bottom: 3px; }
  .leyenda { text-align: center; color: #8a91a0; font-size: 7.5px; margin: 0; }
  .barra { text-align: center; padding: 6px 0 24px; }
  .barra button { font: 500 13px Roboto, "Segoe UI", Arial, sans-serif; background: #16215c; color: #fff; border: 0; border-radius: 6px; padding: 10px 22px; cursor: pointer; }
  @media print { body { background: #fff; } .hoja { margin: 0; } .barra { display: none; } .cab { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="hoja">${bloque(r, "Original")}<div class="corte"><span>✂ cortar aquí</span></div>${bloque(r, "Copia almacén")}</div>
<div class="barra"><button id="btnImprimir">Imprimir / Guardar PDF</button></div>
<script>document.getElementById("btnImprimir").addEventListener("click", function () { window.print(); });</script>
</body></html>`;
  v.document.open();
  v.document.write(html);
  v.document.close();
}
