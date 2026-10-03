import QRCode from "qrcode";
import { DatosOC, OrdenCompra, Proveedor, moneda, productosDe, proveedorDe } from "./comprasData";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const fechaHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" }) : "—";

// Formato imprimible de la OC autorizada, con el estilo de la responsiva de mochila COVID
// (logo + TRANSPORTES LOGISTICAR, fecha en azul, línea gris y títulos en azul marino).
export async function imprimirOC(orden: OrdenCompra, proveedores: Proveedor[]) {
  const ventana = window.open("", "_blank");
  if (!ventana) {
    alert("Permite las ventanas emergentes para imprimir la OC.");
    return;
  }
  ventana.document.write("<p style='font-family:sans-serif;padding:24px'>Preparando formato…</p>");

  const datos: DatosOC = orden.datos || {};
  const productos = productosDe(orden);
  const autorizados = productos.filter((p) => p.autorizado !== false);
  const noAutorizados = productos.filter((p) => p.autorizado === false);
  const catalogo = new Map(proveedores.map((p) => [p.nombre.trim().toLowerCase(), p]));
  const buscar = (n: string) => catalogo.get(n.trim().toLowerCase());

  // Orden de ruta definido en la captura; los demás al final.
  const nombres = [...new Set(autorizados.map(proveedorDe))];
  const ruta = [...(datos.rutaProveedores || []).filter((n) => nombres.includes(n)), ...nombres.filter((n) => !(datos.rutaProveedores || []).includes(n))];
  const referencias = [...new Set(productos.map((p) => (p.referencia || "").trim()).filter(Boolean))];

  const tablas = ruta
    .map((nombre, i) => {
      const prov = buscar(nombre);
      const filas = autorizados.filter((p) => proveedorDe(p) === nombre);
      const subtotal = filas.reduce((a, p) => a + (Number(p.totalProducto) || 0), 0);
      const contacto = [prov?.contacto, prov?.telefono].filter(Boolean).join(" · ");
      return `
      <div class="tabla">
        <div class="tabla-titulo"><span>${ruta.length > 1 ? `${i + 1}. ` : ""}${esc(nombre || "Sin proveedor")}</span>${contacto ? `<small>Contacto: ${esc(contacto)}</small>` : ""}</div>
        <table>
          <thead><tr><th class="c">Cant.</th><th>Artículo</th><th>Referencia</th><th class="r">P. unitario</th><th class="r">Importe</th></tr></thead>
          <tbody>${filas
            .map((p) => `<tr><td class="c">${esc(p.cantidad)}</td><td>${esc(p.articulo)}</td><td>${esc(p.referencia || "")}</td><td class="r">${moneda(p.precioUnitario)}</td><td class="r">${moneda(p.totalProducto)}</td></tr>`)
            .join("")}</tbody>
          <tfoot><tr><td colspan="4" class="r">Subtotal</td><td class="r">${moneda(subtotal)}</td></tr></tfoot>
        </table>
      </div>`;
    })
    .join("");

  const tablaNoAut = noAutorizados.length
    ? `<div class="tabla"><div class="tabla-titulo gris"><span>Artículos no autorizados / programados</span></div>
       <table><thead><tr><th class="c">Cant.</th><th>Artículo</th><th>Proveedor</th><th>Estatus</th><th>Detalle</th></tr></thead>
       <tbody>${noAutorizados
         .map(
           (p) =>
             `<tr><td class="c">${esc(p.cantidad)}</td><td>${esc(p.articulo)}</td><td>${esc(proveedorDe(p))}</td><td>${p.decision === "programado" ? "Programado" : "Rechazado"}</td><td>${
               p.decision === "programado" ? `${esc(p.fechaProgramada || "")} · ${esc(p.indicaciones || "")}` : esc(p.razon || "")
             }</td></tr>`
         )
         .join("")}</tbody></table></div>`
    : "";

  // Tarjetas de ruta: solo proveedores sin servicio a domicilio, en el orden de la ruta.
  const sinDomicilio = ruta.map((n) => ({ n, p: buscar(n) })).filter((x) => !x.p?.a_domicilio);
  const tarjetas = (
    await Promise.all(
      sinDomicilio.map(async ({ n, p }) => {
        const qr = p?.maps_url ? await QRCode.toDataURL(p.maps_url, { margin: 1, width: 140 }).catch(() => "") : "";
        return `<div class="mapa">
          <p class="mapa-nombre">${esc(n)}</p>
          ${p?.foto_mapa ? `<img class="mapa-img" src="${p.foto_mapa}" alt="Mapa ${esc(n)}" />` : `<div class="mapa-img vacio">Sin imagen de mapa</div>`}
          <p class="mapa-tiempo">Tiempo estimado: <b>${esc(p?.tiempo_traslado || "—")}</b></p>
          ${qr ? `<img class="qr" src="${qr}" alt="QR Maps" /><p class="qr-txt">Escanea para abrir en Maps</p>` : ""}
        </div>`;
      })
    )
  ).join("");

  const totalArticulos = autorizados.reduce((a, p) => a + (Number(p.totalProducto) || 0), 0);
  const combustible = Number(datos.combustible) || 0;
  const viaticos = (datos.viaticos || []).filter((v) => v.concepto || Number(v.monto));
  const totalViaticos = viaticos.reduce((a, v) => a + (Number(v.monto) || 0), 0);
  const granTotal = totalArticulos + combustible + totalViaticos;

  let logo = "";
  try {
    const b = await fetch("/logo-icono.png").then((r) => r.blob());
    logo = await new Promise<string>((res) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.readAsDataURL(b);
    });
  } catch {
    /* sin logo */
  }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>OC ${esc(orden.folio)}</title>
<style>
  @page { size: letter; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1e1e1e; font-size: 11px; margin: 0; }
  .cab { display: flex; justify-content: space-between; align-items: flex-start; }
  .marca { display: flex; align-items: center; gap: 10px; }
  .marca img { width: 34px; height: 34px; }
  .marca b { font-size: 14px; letter-spacing: .3px; }
  .der { text-align: right; }
  .ref { font-size: 12px; font-weight: bold; color: #16215c; }
  .fecha { color: #2f6fed; font-size: 10.5px; margin-top: 2px; }
  .folio { font-size: 10.5px; color: #555; margin-top: 2px; }
  hr { border: 0; border-top: 1px solid #e5e8ee; margin: 12px 0 14px; }
  h1 { font-size: 13px; color: #16215c; margin: 0 0 12px; }
  .tabla { margin-bottom: 12px; break-inside: avoid; }
  .tabla-titulo { display: flex; justify-content: space-between; align-items: baseline; background: #16215c; color: #fff; padding: 5px 8px; border-radius: 4px 4px 0 0; font-weight: bold; font-size: 11.5px; }
  .tabla-titulo small { font-weight: normal; font-size: 9.5px; opacity: .9; }
  .tabla-titulo.gris { background: #8a8f9c; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f2f4f8; color: #5a5a5a; font-size: 9.5px; text-transform: uppercase; text-align: left; padding: 5px 6px; border: 1px solid #e5e8ee; }
  td { padding: 5px 6px; border: 1px solid #e5e8ee; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fafbfd; }
  tfoot td { font-weight: bold; background: #f7f9ff; }
  .c { text-align: center; } .r { text-align: right; }
  .inferior { display: flex; gap: 14px; align-items: flex-start; margin-top: 6px; break-inside: avoid; }
  .izq { flex: 1; display: flex; flex-wrap: wrap; gap: 10px; }
  .mapa { width: 160px; border: 1px solid #e5e8ee; border-radius: 6px; padding: 6px; text-align: center; }
  .mapa-nombre { font-weight: bold; color: #16215c; margin: 0 0 4px; }
  .mapa-img { width: 100%; height: 100px; object-fit: cover; border-radius: 4px; display: block; }
  .mapa-img.vacio { background: #f2f4f8; color: #999; display: flex; align-items: center; justify-content: center; font-size: 9px; }
  .mapa-tiempo { margin: 4px 0; font-size: 9.5px; }
  .qr { width: 78px; height: 78px; }
  .qr-txt { margin: 0; font-size: 8px; color: #777; }
  .bloque { border: 1px solid #e5e8ee; border-radius: 6px; padding: 8px; min-width: 190px; }
  .bloque h3 { margin: 0 0 6px; font-size: 10.5px; color: #16215c; text-transform: uppercase; }
  .linea { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; }
  .total { border-top: 1px solid #16215c; margin-top: 4px; padding-top: 4px; font-weight: bold; color: #16215c; font-size: 12px; }
  .resumen { width: 230px; margin-left: auto; }
  .just { text-align: center; margin: 16px auto 0; max-width: 80%; break-inside: avoid; }
  .just h3 { font-size: 10.5px; color: #16215c; text-transform: uppercase; margin: 0 0 4px; }
  .firma { margin-top: 28px; text-align: center; break-inside: avoid; }
  .firma .raya { width: 240px; border-top: 1px solid #1e1e1e; margin: 0 auto 4px; }
  .firma small { color: #555; }
</style></head><body>
  <div class="cab">
    <div class="marca">${logo ? `<img src="${logo}" alt="" />` : ""}<b>TRANSPORTES LOGISTICAR</b></div>
    <div class="der">
      <div class="ref">${referencias.length ? `Referencia: ${esc(referencias.join(", "))}` : "Sin referencia"}</div>
      <div class="folio">Folio ${esc(orden.folio)}</div>
      <div class="fecha">${esc(new Date(orden.fecha || orden.created_at || Date.now()).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }))}</div>
    </div>
  </div>
  <hr />
  <h1>Orden de compra autorizada</h1>
  ${tablas}
  ${tablaNoAut}
  <div class="inferior">
    <div class="izq">
      ${tarjetas}
      <div class="bloque">
        <h3>Ruta</h3>
        <div class="linea"><span>Vehículo</span><b>${esc(datos.vehiculo || "—")}</b></div>
        <div class="linea"><span>Consumo promedio de ruta</span><b>${esc(datos.consumoPromedio || "—")}</b></div>
        <div class="linea"><span>Combustible autorizado</span><b>${moneda(combustible)}</b></div>
        <div class="linea"><span>Tiempo estimado de regreso</span><b>${esc(datos.tiempoRegreso || "—")}</b></div>
        ${viaticos.length ? `<h3 style="margin-top:8px">Viáticos adicionales</h3>${viaticos.map((v) => `<div class="linea"><span>${esc(v.concepto || "Viático")}</span><b>${moneda(v.monto)}</b></div>`).join("")}` : ""}
      </div>
    </div>
    <div class="bloque resumen">
      <h3>Resumen de gastos</h3>
      <div class="linea"><span>Artículos autorizados</span><b>${moneda(totalArticulos)}</b></div>
      <div class="linea"><span>Combustible</span><b>${moneda(combustible)}</b></div>
      <div class="linea"><span>Viáticos</span><b>${moneda(totalViaticos)}</b></div>
      <div class="linea total"><span>Total</span><span>${moneda(granTotal)}</span></div>
    </div>
  </div>
  ${datos.justificacion ? `<div class="just"><h3>Justificación de la compra</h3><p>${esc(datos.justificacion)}</p></div>` : ""}
  <div class="firma">
    <div class="raya"></div>
    <b>${esc(orden.autorizado_por || "—")}</b><br />
    <small>Autorizó · ${esc(fechaHora(orden.autorizado_en))}</small>
  </div>
</body></html>`;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  // Imprime cuando terminan de cargar las imágenes (mapas, QR y logo).
  const imgs = Array.from(ventana.document.images);
  await Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = r; }))));
  ventana.focus();
  ventana.print();
}
