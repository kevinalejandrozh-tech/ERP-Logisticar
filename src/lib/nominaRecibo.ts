// Genera el/los recibo(s) de nómina en una ventana imprimible (Imprimir / Guardar PDF).
// Recibo interno de pago — no es un CFDI timbrado.
import { NominaConfig, NominaPeriodo, NominaRegistro, fechaCorta, moneda } from "./nominaCalculo";

function esc(t: unknown): string {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function fila(concepto: string, importe: number, detalle = ""): string {
  if (!importe) return "";
  return `<tr><td>${esc(concepto)}${detalle ? `<span class="det">${esc(detalle)}</span>` : ""}</td><td class="num">${moneda(importe)}</td></tr>`;
}

function reciboHtml(r: NominaRegistro, p: NominaPeriodo, cfg: NominaConfig): string {
  const percepciones =
    fila("Sueldo semanal", r.sueldo_semanal) + fila("Bonos", r.bonos, r.incentivos_detalle) + fila("Otros incentivos", r.otros_incentivos);
  const deducciones =
    fila(
      "Faltas y retardos",
      r.descuento_faltas,
      `${r.faltas} falta(s), ${r.retardos} retardo(s) · ${r.faltas_equivalentes} día(s) a ${moneda(r.salario_diario)}`
    ) +
    fila("Licencia federal", r.licencia_federal) +
    fila("IMSS", r.imss) +
    fila("Caja de ahorro", r.caja_ahorro) +
    fila("Préstamo personal", r.prestamo) +
    fila("Otros descuentos", r.otros_descuentos, r.otros_descuentos_detalle);
  const vacio = `<tr><td colspan="2" class="vacio">Sin conceptos</td></tr>`;
  return `<section class="recibo">
  <header class="cab">
    <div><h1>${esc(cfg.empresa)}</h1><p>Recibo de nómina semanal</p></div>
    <div class="folio"><span>Folio</span><b>${esc(r.folio)}</b></div>
  </header>
  <div class="datos">
    <div><span>Empleado</span><b>${esc(r.nombre)}</b></div>
    <div><span>Puesto</span><b>${esc(r.puesto || "—")}</b></div>
    <div><span>Periodo</span><b>Semana ${p.semana} · ${fechaCorta(p.fecha_inicio)} al ${fechaCorta(p.fecha_fin)}</b></div>
    <div><span>Días asistidos</span><b>${r.dias_asistidos}</b></div>
  </div>
  <div class="cols">
    <div><h2>Percepciones</h2><table><tbody>${percepciones || vacio}</tbody><tfoot><tr><td>Total percepciones</td><td class="num">${moneda(r.total_percepciones)}</td></tr></tfoot></table></div>
    <div><h2>Deducciones</h2><table><tbody>${deducciones || vacio}</tbody><tfoot><tr><td>Total deducciones</td><td class="num">${moneda(r.total_deducciones)}</td></tr></tfoot></table></div>
  </div>
  <div class="neto"><span>Neto a pagar</span><b>${moneda(r.neto)}</b></div>
  ${r.observaciones ? `<p class="obs"><b>Observaciones:</b> ${esc(r.observaciones)}</p>` : ""}
  <div class="firmas">
    <div><i></i><span>Recibí de conformidad<br/>${esc(r.nombre)}</span></div>
    <div><i></i><span>Elaboró<br/>Recursos Humanos</span></div>
  </div>
  <p class="leyenda">Documento interno de pago. No es un comprobante fiscal digital (CFDI).</p>
</section>`;
}

export function imprimirRecibos(registros: NominaRegistro[], periodo: NominaPeriodo, cfg: NominaConfig) {
  const ventana = window.open("", "_blank", "width=860,height=720");
  if (!ventana) {
    alert("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.");
    return;
  }
  const titulo = registros.length === 1 ? `Recibo ${registros[0].folio}` : `Recibos de nómina · Semana ${periodo.semana} ${periodo.anio}`;
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" /><title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Roboto, "Segoe UI", Arial, sans-serif; margin: 0; background: #f5f6f8; color: #1f2937; font-size: 12.5px; }
  .recibo { max-width: 760px; margin: 20px auto; background: #fff; border: 1px solid #e3e6eb; border-radius: 8px; overflow: hidden; page-break-after: always; }
  .recibo:last-of-type { page-break-after: auto; }
  .cab { background: #16215c; color: #fff; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; }
  .cab h1 { font-size: 17px; font-weight: 500; margin: 0 0 2px; }
  .cab p { margin: 0; color: #b9c8f2; font-size: 12px; }
  .folio { text-align: right; } .folio span { display: block; color: #b9c8f2; font-size: 10.5px; } .folio b { font-weight: 500; font-size: 13px; }
  .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; padding: 16px 22px; border-bottom: 1px solid #e3e6eb; }
  .datos span { display: block; color: #6b7280; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; }
  .datos b { font-weight: 500; color: #16215c; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; padding: 16px 22px; }
  h2 { font-size: 11px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 0; border-bottom: 1px solid #eef0f4; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; padding-left: 10px; }
  .det { display: block; color: #8a91a0; font-size: 10.5px; }
  tfoot td { font-weight: 500; color: #16215c; border-bottom: 0; border-top: 1px solid #cfd5df; }
  .vacio { color: #8a91a0; text-align: center; }
  .neto { margin: 0 22px; background: #eef3fd; border-radius: 6px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
  .neto span { color: #16215c; font-weight: 500; } .neto b { font-size: 18px; color: #16215c; font-weight: 700; }
  .obs { margin: 12px 22px 0; color: #4b5563; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding: 46px 40px 10px; text-align: center; }
  .firmas i { display: block; border-top: 1px solid #6b7280; margin-bottom: 6px; } .firmas span { color: #4b5563; font-size: 11px; }
  .leyenda { text-align: center; color: #8a91a0; font-size: 10px; margin: 8px 0 14px; }
  .barra { text-align: center; padding: 6px 0 24px; }
  .barra button { font: 500 13px Roboto, "Segoe UI", Arial, sans-serif; background: #16215c; color: #fff; border: 0; border-radius: 6px; padding: 10px 22px; cursor: pointer; }
  @media print { body { background: #fff; } .recibo { margin: 0 auto; border: 0; border-radius: 0; } .barra { display: none; }
    .cab, .neto { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
${registros.map((r) => reciboHtml(r, periodo, cfg)).join("\n")}
<div class="barra"><button id="btnImprimir">Imprimir / Guardar PDF</button></div>
<script>document.getElementById("btnImprimir").addEventListener("click", function () { window.print(); });</script>
</body></html>`;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}
