"use client";
import { useEffect, useMemo, useState } from "react";
import { OrdenCompra, ProductoOC, Proveedor, esAutorizada, esRechazada, moneda, productosDe, proveedorDe } from "@/lib/comprasData";
import { imprimirOC } from "@/lib/imprimirOC";

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-2.5 py-1.5 text-[12.5px] bg-white";

// Detalle de la OC: autorización por artículo (casillas marcadas por defecto) e impresión cuando está autorizada.
export default function DetalleOCModal({
  orden,
  puedeAutorizar,
  onCerrar,
  onActualizada,
}: {
  orden: OrdenCompra;
  puedeAutorizar: boolean;
  onCerrar: () => void;
  onActualizada: () => void;
}) {
  const autorizada = esAutorizada(orden.estado);
  const rechazada = esRechazada(orden.estado);
  const editable = puedeAutorizar && !autorizada && !rechazada;
  const [fotos, setFotos] = useState<(string | null)[]>([]);
  const [fotoGrande, setFotoGrande] = useState<string | null>(null);
  // Las fotos de referencia se piden aparte (no viajan en el listado).
  useEffect(() => {
    if (!productosDe(orden).some((p) => p.tieneFoto)) return;
    fetch(`/api/compras/fotos?folio=${encodeURIComponent(orden.folio)}`, { cache: "no-store" }).then((r) => r.json()).then((d) => d.ok && setFotos(d.fotos || [])).catch(() => {});
  }, [orden]);
  const [items, setItems] = useState<ProductoOC[]>(() => productosDe(orden).map((p) => ({ ...p, autorizado: p.autorizado !== false })));
  const [guardando, setGuardando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [error, setError] = useState("");
  const datos = orden.datos || {};

  const totalAutorizado = useMemo(() => items.filter((p) => p.autorizado).reduce((a, p) => a + (Number(p.totalProducto) || 0), 0), [items]);
  const totalSolicitado = useMemo(() => items.reduce((a, p) => a + (Number(p.totalProducto) || 0), 0), [items]);
  const viaticos = (datos.viaticos || []).reduce((a, v) => a + (Number(v.monto) || 0), 0);
  const cambiar = (i: number, cambio: Partial<ProductoOC>) => setItems((prev) => prev.map((p, k) => (k === i ? { ...p, ...cambio } : p)));

  const autorizar = async () => {
    setError("");
    for (const p of items) {
      if (p.autorizado) continue;
      if (!p.decision) return setError(`Indica si "${p.articulo}" se rechaza o se programa.`);
      if (p.decision === "rechazado" && !p.razon?.trim()) return setError(`Agrega la razón del rechazo de "${p.articulo}".`);
      if (p.decision === "programado" && (!p.indicaciones?.trim() || !p.fechaProgramada)) return setError(`Agrega indicaciones y fecha programada de "${p.articulo}".`);
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/compras/autorizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folio: orden.folio, productos: items }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo autorizar.");
      onActualizada();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo autorizar.");
    } finally {
      setGuardando(false);
    }
  };

  const imprimir = async () => {
    setImprimiendo(true);
    try {
      const r = await fetch("/api/compras/proveedores?fotos=1", { cache: "no-store" }).then((x) => x.json());
      await imprimirOC(orden, r.proveedores || []);
    } catch {
      alert("No se pudo preparar el formato.");
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-center justify-center p-4 z-[60]" onClick={onCerrar}>
      <div className="bg-white rounded-xl w-full max-w-[980px] max-h-[90vh] overflow-y-auto shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Orden de compra {orden.folio}</h3>
            <p className="text-[12px] text-[var(--gray-500)] m-0">
              Estatus: <b className={autorizada ? "text-[var(--green)]" : rechazada ? "text-[var(--red)]" : "text-[#b7791f]"}>{orden.estado || "—"}</b>
              {orden.solicitado_por && <> · Solicitó: {orden.solicitado_por}</>}
              {rechazada && orden.autorizado_por && <> · Rechazó: {orden.autorizado_por}</>}
              {autorizada && orden.autorizado_por && <> · Autorizó: {orden.autorizado_por} ({new Date(orden.autorizado_en || "").toLocaleString("es-MX", { timeZone: "America/Mexico_City" })})</>}
            </p>
          </div>
          <span onClick={onCerrar} className="text-[var(--gray-400)] cursor-pointer text-xl leading-none">✕</span>
        </div>

        {editable && <p className="text-[12px] text-[var(--gray-500)] m-0 mb-2">Quita la palomita de los artículos que no autorizas e indica si se rechazan o se programan para otro día.</p>}
        <div className="overflow-x-auto border border-[var(--gray-200)] rounded-lg">
          <table className="w-full text-[12.5px] border-collapse min-w-[760px]">
            <thead className="bg-[#f8fafc] text-[var(--navy)]">
              <tr>
                <th className="p-2 w-[40px] text-center">✓</th>
                <th className="p-2 text-left w-[60px]">Cant.</th>
                <th className="p-2 text-left">Artículo</th>
                <th className="p-2 text-left">Referencia</th>
                <th className="p-2 text-left">Proveedor</th>
                <th className="p-2 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p, i) => (
                <tr key={i} className={`border-t border-[var(--gray-200)] align-top ${p.autorizado ? "" : "bg-[#fdf3f2]"}`}>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={!!p.autorizado} disabled={!editable} onChange={(e) => cambiar(i, { autorizado: e.target.checked, ...(e.target.checked ? { decision: null } : {}) })} className="w-4 h-4" />
                  </td>
                  <td className="p-2">{p.cantidad}</td>
                  <td className="p-2">
                    <span className={p.autorizado ? "" : "line-through text-[var(--gray-500)]"}>{p.articulo}</span>
                    {!p.autorizado && (
                      <div className="mt-2 grid gap-1.5">
                        {editable ? (
                          <>
                            <div className="flex gap-3 text-[12px]">
                              <label className="flex items-center gap-1"><input type="radio" checked={p.decision === "rechazado"} onChange={() => cambiar(i, { decision: "rechazado" })} /> Rechazar</label>
                              <label className="flex items-center gap-1"><input type="radio" checked={p.decision === "programado"} onChange={() => cambiar(i, { decision: "programado" })} /> Programar para otro día</label>
                            </div>
                            {p.decision === "rechazado" && <input value={p.razon || ""} onChange={(e) => cambiar(i, { razon: e.target.value })} placeholder="Razón del rechazo" className={inputCls} />}
                            {p.decision === "programado" && (
                              <div className="grid grid-cols-[150px_1fr] gap-1.5">
                                <input type="date" value={p.fechaProgramada || ""} onChange={(e) => cambiar(i, { fechaProgramada: e.target.value })} className={inputCls} />
                                <input value={p.indicaciones || ""} onChange={(e) => cambiar(i, { indicaciones: e.target.value })} placeholder="Indicaciones" className={inputCls} />
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-[11.5px] text-[var(--red)]">
                            {p.decision === "programado" ? `Programado ${p.fechaProgramada || ""} · ${p.indicaciones || ""}` : `Rechazado: ${p.razon || ""}`}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    {p.referencia || (fotos[i] ? "" : "—")}
                    {fotos[i] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fotos[i]!} alt="Foto de referencia" onClick={() => setFotoGrande(fotos[i])} className="mt-1 w-12 h-12 object-cover rounded-md border border-[var(--gray-200)] cursor-zoom-in block" />
                    )}
                  </td>
                  <td className="p-2">{proveedorDe(p) || "—"}</td>
                  <td className={`p-2 text-right ${p.autorizado ? "" : "line-through text-[var(--gray-500)]"}`}>{moneda(p.totalProducto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4 text-[12.5px]">
          <div className="border border-[var(--gray-200)] rounded-lg p-3">
            <p className="font-bold text-[var(--navy)] m-0 mb-1.5">Ruta y gastos</p>
            <p className="m-0">Vehículo: <b>{datos.vehiculo || "—"}</b> · Consumo promedio: <b>{datos.consumoPromedio || "—"}</b></p>
            <p className="m-0">Combustible: <b>{moneda(datos.combustible)}</b> · Regreso estimado: <b>{datos.tiempoRegreso || "—"}</b></p>
            <p className="m-0">Viáticos: <b>{moneda(viaticos)}</b></p>
            {datos.justificacion && <p className="m-0 mt-1.5 text-[var(--gray-500)]">Justificación: {datos.justificacion}</p>}
          </div>
          <div className="border border-[var(--gray-200)] rounded-lg p-3 text-right">
            <p className="m-0">Solicitado: {moneda(totalSolicitado)}</p>
            <p className="m-0 text-[15px] font-bold text-[var(--navy)]">Total autorizado: {moneda(totalAutorizado + (Number(datos.combustible) || 0) + viaticos)}</p>
            <p className="m-0 text-[11.5px] text-[var(--gray-500)]">Artículos {moneda(totalAutorizado)} + combustible y viáticos</p>
          </div>
        </div>

        {error && <p className="text-[12.5px] text-[var(--red)] mt-3 mb-0">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn btn-secundario py-1.5" onClick={onCerrar}>Cerrar</button>
          {editable && <button type="button" className="btn btn-primario py-1.5" disabled={guardando} onClick={autorizar}>{guardando ? "Autorizando…" : "Autorizar OC"}</button>}
          {autorizada && <button type="button" className="btn btn-primario py-1.5" disabled={imprimiendo} onClick={imprimir}>{imprimiendo ? "Preparando…" : "Imprimir OC"}</button>}
        </div>
        {fotoGrande && (
          <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={() => setFotoGrande(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoGrande} alt="Foto de referencia" className="max-w-full max-h-full rounded-lg" />
          </div>
        )}
        {!autorizada && !rechazada && !puedeAutorizar && <p className="text-[11.5px] text-[var(--gray-500)] text-right mt-2 mb-0">Pendiente de autorización por un usuario autorizado.</p>}
      </div>
    </div>
  );
}
