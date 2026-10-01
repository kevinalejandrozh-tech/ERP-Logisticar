// Recibos de nómina imprimibles: 2 recibos por hoja carta (para imprimir y cortar a la mitad).
// Recibo interno de pago — no es un CFDI timbrado.
import { CreditoEstado, NominaConfig, NominaPeriodo, NominaRegistro, fechaCorta, moneda } from "./nominaCalculo";

export type ExtrasRecibo = { creditos: Record<number, CreditoEstado[]>; caja: Record<number, number> };

function esc(t: unknown): string {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function fila(concepto: string, importe: number, detalle = ""): string {
  if (!importe) return "";
  return `<tr><td>${esc(concepto)}${detalle ? ` <span class="det">${esc(detalle)}</span>` : ""}</td><td class="num">${moneda(importe)}</td></tr>`;
}

function bloqueCreditos(r: NominaRegistro, lista: CreditoEstado[]): string {
  const relevantes = lista.filter((c) => c.abono_semana > 0 || c.extraordinarios.length || c.saldo_corte > 0);
  if (!relevantes.length) return "";
  return `<table class="cred"><thead><tr><th>Crédito</th><th>Inicio</th><th>Total</th><th>Abono</th><th>Pagado</th><th>Pagos</th><th>Saldo</th><th>Término est.</th></tr></thead><tbody>
${relevantes
  .map(
    (c) => `<tr><td>${esc(c.concepto)}</td><td>${fechaCorta(c.fecha_inicio)}</td><td>${moneda(c.monto_total)}</td><td>${moneda(c.abono_semana)}</td>
<td>${moneda(c.pagado)}</td><td>${c.pagos}</td><td>${moneda(c.saldo_corte)}</td><td>${esc(c.termino_semana || "—")}</td></tr>${c.extraordinarios
      .map((x) => `<tr class="extra"><td colspan="8">Abono extraordinario ${fechaCorta(x.fecha)}: <b>${moneda(x.importe)}</b>${x.notas ? ` · ${esc(x.notas)}` : ""}</td></tr>`)
      .join("")}`
  )
  .join("")}</tbody></table>`;
}

function reciboHtml(r: NominaRegistro, p: NominaPeriodo, cfg: NominaConfig, extras: ExtrasRecibo): string {
  // Percepciones: los bonos se separan en bono por ruta (viajes foráneos) y bonos adicionales.
  const bonoRuta = Math.min(Math.max(0, r.bonos_ruta || 0), Math.max(0, r.bonos || 0));
  const bonoAdicional = Math.max(0, (r.bonos || 0) - bonoRuta);
  const percepciones =
    fila("Sueldo ofertado", r.sueldo_semanal) +
    fila("Bono por ruta", bonoRuta) +
    fila("Bonos adicionales", bonoAdicional, r.incentivos_detalle) +
    fila("Otros incentivos", r.otros_incentivos);
  // Deducciones: cada préstamo (personal / licencia federal) aparece con su propio renglón.
  const lineasCreditos =
    r.creditos && r.creditos.length
      ? r.creditos.map((c) => fila(c.concepto, c.abono)).join("")
      : fila("Licencia federal", r.licencia_federal) + fila("Préstamo personal", r.prestamo);
  const deducciones =
    fila("Faltas y retardos", r.descuento_faltas, `${r.faltas} F · ${r.retardos} R`) +
    fila("IMSS", r.imss) +
    fila("Caja de ahorro", r.caja_ahorro) +
    fila("Fonacot", r.fonacot) +
    fila("Infonavit", r.infonavit) +
    lineasCreditos +
    fila("Otros descuentos", r.otros_descuentos, r.otros_descuentos_detalle);
  const vacio = `<tr><td colspan="2" class="vacio">Sin conceptos</td></tr>`;
  const caja = extras.caja[r.expediente_id];
  return `<section class="recibo">
  <header class="cab">
    <div><h1>${esc(cfg.empresa)}</h1><p>Recibo de nómina · Semana ${p.semana} · ${fechaCorta(p.fecha_inicio)} al ${fechaCorta(p.fecha_fin)}</p></div>
    <div class="folio">Folio<b>${esc(r.folio)}</b></div>
  </header>
  <div class="datos">
    <div><span>Empleado</span><b>${esc(r.nombre)}</b></div>
    <div><span>Puesto</span><b>${esc(r.puesto || "—")}</b></div>
    <div><span>Días trabajados</span><b>${r.dias_asistidos}</b></div>
    <div><span>Caja de ahorro (abonos capturados)</span><b>${caja ? moneda(caja) : "—"}</b></div>
  </div>
  <div class="cols">
    <table><thead><tr><th colspan="2">Percepciones</th></tr></thead><tbody>${percepciones || vacio}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${moneda(r.total_percepciones)}</td></tr></tfoot></table>
    <table><thead><tr><th colspan="2">Deducciones</th></tr></thead><tbody>${deducciones || vacio}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${moneda(r.total_deducciones)}</td></tr></tfoot></table>
  </div>
  ${bloqueCreditos(r, extras.creditos[r.expediente_id] || [])}
  <div class="pago">
    <div><span>Depósito BBVA</span><b>${moneda(r.deposito_bbva)}</b></div>
    <div><span>Depósito de viáticos</span><b>${moneda(r.deposito_viaticos)}</b></div>
    <div class="neto"><span>Neto a pagar</span><b>${moneda(r.neto)}</b></div>
  </div>
  ${r.observaciones ? `<p class="obs"><b>Obs.:</b> ${esc(r.observaciones)}</p>` : ""}
  <div class="firmas"><div><i></i>Recibí de conformidad · ${esc(r.nombre)}</div><div><i></i>Elaboró · Recursos Humanos</div></div>
  <p class="leyenda">Documento interno de pago. No es un comprobante fiscal digital (CFDI).</p>
</section>`;
}

export function imprimirRecibos(registros: NominaRegistro[], periodo: NominaPeriodo, cfg: NominaConfig, extras: ExtrasRecibo) {
  const ventana = window.open("", "_blank", "width=900,height=760");
  if (!ventana) {
    alert("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.");
    return;
  }
  const titulo = registros.length === 1 ? `Recibo ${registros[0].folio}` : `Recibos de nómina · Semana ${periodo.semana} ${periodo.anio}`;
  const paginas: string[] = [];
  for (let i = 0; i < registros.length; i += 2) {
    const par = registros.slice(i, i + 2).map((r) => reciboHtml(r, periodo, cfg, extras));
    paginas.push(`<div class="hoja">${par.join('<div class="corte"><span>✂ cortar aquí</span></div>')}</div>`);
  }
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" /><title>${esc(titulo)}</title>
<style>
  @page { size: letter; margin: 0.3in; }
  * { box-sizing: border-box; }
  body { font-family: Roboto, "Segoe UI", Arial, sans-serif; margin: 0; background: #f5f6f8; color: #1f2937; font-size: 9.5px; }
  .hoja { width: 7.9in; height: 10.35in; margin: 14px auto; background: #fff; display: flex; flex-direction: column; page-break-after: always; }
  .hoja:last-of-type { page-break-after: auto; }
  .recibo { height: calc((10.35in - 0.24in) / 2); padding: 0.14in 0.18in; overflow: hidden; display: flex; flex-direction: column; gap: 5px; }
  .corte { height: 0.24in; border-top: 1px dashed #9aa1b0; position: relative; }
  .corte span { position: absolute; top: -7px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 6px; color: #9aa1b0; font-size: 8.5px; }
  .cab { background: #16215c; color: #fff; padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
  .cab h1 { font-size: 12px; font-weight: 500; margin: 0; } .cab p { margin: 1px 0 0; color: #b9c8f2; font-size: 9px; }
  .folio { text-align: right; color: #b9c8f2; font-size: 8.5px; } .folio b { display: block; color: #fff; font-weight: 500; font-size: 10px; }
  .datos { display: grid; grid-template-columns: 1.6fr 1.2fr .8fr 1fr; gap: 4px 10px; }
  .datos span { display: block; color: #6b7280; font-size: 7.8px; text-transform: uppercase; letter-spacing: .03em; } .datos b { font-weight: 500; color: #16215c; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 500; color: #6b7280; font-size: 8px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #cfd5df; padding: 2px 0; }
  td { padding: 2px 0; border-bottom: 1px solid #eef0f4; } td.num { text-align: right; white-space: nowrap; }
  .det { color: #8a91a0; font-size: 8px; } .vacio { color: #8a91a0; text-align: center; }
  tfoot td { font-weight: 500; color: #16215c; border-bottom: 0; border-top: 1px solid #cfd5df; }
  .cred th, .cred td { font-size: 8px; padding: 1.5px 3px 1.5px 0; } .cred .extra td { color: #0f766e; }
  .pago { display: grid; grid-template-columns: 1fr 1fr 1.1fr; gap: 6px; margin-top: auto; }
  .pago div { border: 1px solid #e3e6eb; border-radius: 4px; padding: 4px 8px; } .pago span { display: block; color: #6b7280; font-size: 8px; }
  .pago b { font-size: 11px; color: #16215c; } .pago .neto { background: #eef3fd; border-color: #c9d8fa; } .pago .neto b { font-size: 13px; }
  .obs { margin: 0; color: #4b5563; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; padding: 14px 20px 0; text-align: center; color: #4b5563; font-size: 8.5px; }
  .firmas i { display: block; border-top: 1px solid #6b7280; margin-bottom: 3px; }
  .leyenda { text-align: center; color: #8a91a0; font-size: 7.5px; margin: 0; }
  .barra { text-align: center; padding: 6px 0 24px; }
  .barra button { font: 500 13px Roboto, "Segoe UI", Arial, sans-serif; background: #16215c; color: #fff; border: 0; border-radius: 6px; padding: 10px 22px; cursor: pointer; }
  @media print { body { background: #fff; } .hoja { margin: 0; } .barra { display: none; }
    .cab, .pago .neto { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
${paginas.join("\n")}
<div class="barra"><button id="btnImprimir">Imprimir / Guardar PDF</button></div>
<script>document.getElementById("btnImprimir").addEventListener("click", function () { window.print(); });</script>
</body></html>`;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}
