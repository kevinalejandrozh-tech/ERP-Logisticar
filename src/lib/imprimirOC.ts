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
  // Fotos de referencia de los artículos (no viajan en el listado): se piden aparte.
  let fotos: (string | null)[] = [];
  if (productos.some((p) => p.tieneFoto)) {
    try {
      const r = await fetch(`/api/compras/fotos?folio=${encodeURIComponent(orden.folio)}`, { cache: "no-store" }).then((x) => x.json());
      fotos = r.fotos || [];
    } catch {
      /* se imprime sin fotos */
    }
  }
  const fotoDe = new Map(productos.map((p, i) => [p, fotos[i] || ""]));
  const catalogo = new Map(proveedores.map((p) => [p.nombre.trim().toLowerCase(), p]));
  const buscar = (n: string) => catalogo.get(n.trim().toLowerCase());

  // Orden de ruta definido en la captura; los demás al final.
  const nombres = [...new Set(autorizados.map(proveedorDe))];
  const ruta = [...(datos.rutaProveedores || []).filter((n) => nombres.includes(n)), ...nombres.filter((n) => !(datos.rutaProveedores || []).includes(n))];
  const referencias = [...new Set(productos.map((p) => (p.referencia || "").trim()).filter(Boolean))];

  const fechaOC = new Date(orden.fecha || orden.created_at || Date.now()).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Una sección por proveedor (en el orden de la ruta): encabezado tipo "PROVEEDOR" y su tabla de artículos.
  const secciones = ruta
    .map((nombre, i) => {
      const prov = buscar(nombre);
      const filas = autorizados.filter((p) => proveedorDe(p) === nombre);
      const subtotal = filas.reduce((a, p) => a + (Number(p.totalProducto) || 0), 0);
      const unica = filas.some((p) => p.compraUnica);
      const datosProv = [
        prov?.contacto ? `Contacto: ${esc(prov.contacto)}` : "",
        prov?.telefono ? `Teléfono: ${esc(prov.telefono)}` : "",
        prov ? (prov.a_domicilio ? "Servicio a domicilio" : `Recoger en tienda · ${esc(prov.tiempo_traslado || "tiempo no registrado")}`) : unica ? "Compra única" : "",
      ].filter(Boolean);
      const vacias = Math.max(0, 3 - filas.length);
      return `
      <div class="seccion">
        <div class="barra"><span>${ruta.length > 1 ? `PARADA ${i + 1} · ` : ""}PROVEEDOR</span><span>${esc((nombre || "Sin proveedor").toUpperCase())}</span></div>
        ${datosProv.length ? `<div class="prov-datos">${datosProv.join(" &nbsp;|&nbsp; ")}</div>` : ""}
        <table class="items">
          <thead><tr><th style="width:8%">#</th><th>Descripción</th><th style="width:16%">Referencia</th><th class="c" style="width:8%">Cant.</th><th class="r" style="width:13%">P/U</th><th class="r tot" style="width:14%">Total</th></tr></thead>
          <tbody>${filas
            .map((p, k) => `<tr><td>${k + 1}</td><td>${esc(p.articulo)}</td><td>${esc(p.referencia || "")}${fotoDe.get(p) ? `<br /><img class="rf" src="${fotoDe.get(p)}" alt="Referencia" />` : ""}</td><td class="c">${esc(p.cantidad)}</td><td class="r">${moneda(p.precioUnitario)}</td><td class="r tot">${moneda(p.totalProducto)}</td></tr>`)
            .join("")}${Array.from({ length: vacias }).map(() => `<tr class="vacia"><td></td><td></td><td></td><td></td><td></td><td class="tot r">-</td></tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="5" class="r">Subtotal ${esc(nombre)}</td><td class="r tot">${moneda(subtotal)}</td></tr></tfoot>
        </table>
      </div>`;
    })
    .join("");

  const tablaNoAut = noAutorizados.length
    ? `<div class="seccion"><div class="barra gris"><span>ARTÍCULOS NO AUTORIZADOS / PROGRAMADOS</span><span></span></div>
       <table class="items"><thead><tr><th class="c" style="width:8%">Cant.</th><th>Descripción</th><th>Proveedor</th><th style="width:14%">Estatus</th><th>Detalle</th></tr></thead>
       <tbody>${noAutorizados
         .map(
           (p) =>
             `<tr><td class="c">${esc(p.cantidad)}</td><td>${esc(p.articulo)}</td><td>${esc(proveedorDe(p))}</td><td>${p.decision === "programado" ? "Programado" : "Rechazado"}</td><td>${
               p.decision === "programado" ? `${esc(p.fechaProgramada || "")} · ${esc(p.indicaciones || "")}` : esc(p.razon || "")
             }</td></tr>`
         )
         .join("")}</tbody></table></div>`
    : "";

  // Tarjetas de ruta: proveedores del catálogo sin servicio a domicilio (las compras únicas no tienen mapa).
  const sinDomicilio = ruta.map((n) => ({ n, p: buscar(n) })).filter((x) => x.p && !x.p.a_domicilio);
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

  // Diseño inspirado en el formato clásico de orden de compra: empresa a la izquierda, título grande a la derecha
  // con FECHA / OC # en recuadros, barras azul marino, tabla con columna de total sombreada y totales abajo a la derecha.
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>OC ${esc(orden.folio)}</title>
<style>
  @page { size: letter; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1e1e1e; font-size: 10.5px; margin: 0; }
  .cab { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  .empresa { display: flex; gap: 10px; align-items: flex-start; }
  .empresa img { width: 40px; height: 40px; }
  .empresa b { display: block; font-size: 15px; color: #16215c; letter-spacing: .3px; }
  .empresa span { display: block; color: #555; font-size: 10px; line-height: 1.45; }
  .titulo { text-align: right; }
  .titulo h1 { margin: 0 0 6px; font-size: 26px; color: #4a5f9b; letter-spacing: 1px; }
  .kv { display: grid; grid-template-columns: auto 120px; gap: 3px 8px; justify-content: end; align-items: center; font-size: 10px; }
  .kv span { text-align: right; font-weight: bold; color: #444; }
  .kv div { border: 1px solid #9aa3b8; padding: 2px 6px; text-align: center; }
  .kv .ref { background: #eef1f8; font-weight: bold; color: #16215c; }
  .info { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .info th { background: #1d4ed8; color: #fff; font-size: 9.5px; padding: 4px 6px; text-transform: uppercase; border: 1px solid #1d4ed8; }
  .info td { border: 1px solid #9aa3b8; padding: 5px 6px; text-align: center; }
  .seccion { margin-bottom: 12px; break-inside: avoid; }
  .barra { display: flex; justify-content: space-between; background: #16215c; color: #fff; font-weight: bold; padding: 4px 8px; font-size: 10.5px; }
  .barra.gris { background: #8a8f9c; }
  .prov-datos { border: 1px solid #9aa3b8; border-top: 0; padding: 4px 8px; font-size: 9.5px; color: #444; }
  table.items { width: 100%; border-collapse: collapse; }
  .items th { background: #1d4ed8; color: #fff; font-size: 9.5px; text-transform: uppercase; padding: 4px 6px; border: 1px solid #1d4ed8; text-align: left; }
  .rf { width: 44px; height: 44px; object-fit: cover; margin-top: 3px; border: 1px solid #9aa3b8; }
  .items td { border-left: 1px solid #9aa3b8; border-right: 1px solid #9aa3b8; border-bottom: 1px solid #dfe3ec; padding: 4px 6px; height: 18px; vertical-align: top; }
  .items tbody tr:last-child td { border-bottom: 1px solid #9aa3b8; }
  .items .tot { background: #eef1f8; }
  .items tfoot td { border: 1px solid #9aa3b8; font-weight: bold; }
  .c { text-align: center !important; } .r { text-align: right !important; }
  .pie { display: flex; gap: 14px; align-items: flex-start; margin-top: 4px; break-inside: avoid; }
  .comentarios { flex: 1; border: 1px solid #9aa3b8; }
  .comentarios .enc { background: #c9ced9; font-weight: bold; padding: 4px 8px; }
  .comentarios .cuerpo { padding: 8px; min-height: 70px; line-height: 1.5; }
  .totales { width: 240px; border-collapse: collapse; }
  .totales td { padding: 3px 6px; }
  .totales td:first-child { font-weight: bold; color: #444; text-transform: uppercase; font-size: 9.5px; }
  .totales td:last-child { text-align: right; border: 1px solid #c9ced9; }
  .totales tr.gran td { border-top: 2px solid #16215c; font-size: 12px; color: #16215c; }
  .totales tr.gran td:last-child { background: #c7d2ee; font-weight: bold; }
  .ruta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; padding-left: 2ch; break-inside: avoid; } /* sangría de 2 espacios */
  .bloque { border: 1px solid #9aa3b8; min-width: 210px; }
  .bloque .enc { background: #16215c; color: #fff; font-weight: bold; padding: 4px 8px; font-size: 9.5px; text-transform: uppercase; }
  .linea { display: flex; justify-content: space-between; gap: 10px; padding: 3px 8px; border-bottom: 1px solid #eef0f4; }
  .mapa { width: 210px; border: 1px solid #9aa3b8; padding: 6px; text-align: center; }
  .mapa-nombre { font-weight: bold; color: #16215c; margin: 0 0 4px; }
  .mapa-img { width: 100%; height: 129px; object-fit: cover; display: block; }
  .mapa-img.vacio { background: #f2f4f8; color: #999; display: flex; align-items: center; justify-content: center; font-size: 9px; }
  .mapa-tiempo { margin: 4px 0; font-size: 9px; }
  .qr { width: 72px; height: 72px; }
  .qr-txt { margin: 0; font-size: 8px; color: #777; }
  .firma { margin-top: 26px; text-align: center; break-inside: avoid; }
  .firma .raya { width: 240px; border-top: 1px solid #1e1e1e; margin: 0 auto 4px; }
  .firma small { color: #555; }
  .nota { text-align: center; color: #555; font-size: 9.5px; margin-top: 18px; }
</style></head><body>
  <div class="cab">
    <div class="empresa">${logo ? `<img src="${logo}" alt="" />` : ""}<div><b>TRANSPORTES LOGISTICAR</b><span>Departamento de Compras</span>${orden.solicitado_por ? `<span>Solicitó: ${esc(orden.solicitado_por)}</span>` : ""}</div></div>
    <div class="titulo">
      <h1>ORDEN DE COMPRA</h1>
      <div class="kv">
        <span>FECHA</span><div>${esc(fechaOC)}</div>
        <span>OC #</span><div>${esc(orden.folio)}</div>
        <span>REFERENCIA</span><div class="ref">${esc(referencias.join(", ") || "—")}</div>
      </div>
    </div>
  </div>

  <table class="info">
    <thead><tr><th>Vehículo</th><th>Consumo promedio de ruta</th><th>Combustible autorizado</th><th>Tiempo estimado de regreso</th><th>Proveedores</th></tr></thead>
    <tbody><tr><td>${esc(datos.vehiculo || "—")}</td><td>${esc(datos.consumoPromedio || "—")}</td><td>${moneda(combustible)}</td><td>${esc(datos.tiempoRegreso || "—")}</td><td>${ruta.length}</td></tr></tbody>
  </table>

  ${secciones}
  ${tablaNoAut}

  <div class="pie">
    <div class="comentarios">
      <div class="enc">Justificación de la compra / instrucciones especiales</div>
      <div class="cuerpo">${esc(datos.justificacion || "")}</div>
    </div>
    <table class="totales">
      <tr><td>Subtotal artículos</td><td>${moneda(totalArticulos)}</td></tr>
      <tr><td>Combustible</td><td>${moneda(combustible)}</td></tr>
      ${viaticos.map((v) => `<tr><td>${esc(v.concepto || "Viático")}</td><td>${moneda(v.monto)}</td></tr>`).join("") || `<tr><td>Viáticos</td><td>${moneda(0)}</td></tr>`}
      <tr class="gran"><td>Total</td><td>${moneda(granTotal)}</td></tr>
    </table>
  </div>

  ${tarjetas ? `<div class="ruta">${tarjetas}</div>` : ""}

  <div class="firma">
    <div class="raya"></div>
    <b>${esc(orden.autorizado_por || "—")}</b><br />
    <small>Autorizó · ${esc(fechaHora(orden.autorizado_en))}</small>
  </div>
  <p class="nota">Si tiene alguna pregunta sobre esta orden de compra, comuníquese con ${esc(orden.solicitado_por || "el Departamento de Compras")}.</p>
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
