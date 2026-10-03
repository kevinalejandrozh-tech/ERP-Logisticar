"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import type { ArticuloAlmacen } from "@/components/almacen/ExistenciasAlmacen";
import { imprimirRequisicion, type Requisicion } from "@/lib/imprimirRequisicion";

type ItemCarrito = { articulo_id: number; nombre: string; ubicacion_id: number; codigo: string; cantidad: number; disponible: number; costo: number };
const moneda = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v || 0);

function Foto({ id, tiene }: { id: number; tiene: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!tiene) return;
    fetch(`/api/inventario/almacen/articulos?imagen=${id}`).then((r) => r.json()).then((d) => setSrc(d.imagen)).catch(() => {});
  }, [id, tiene]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="w-full h-[140px] object-cover rounded-lg" />
  ) : (
    <div className="w-full h-[140px] rounded-lg bg-[var(--gray-100)] flex items-center justify-center text-[var(--gray-400)] text-[11px]">Sin foto</div>
  );
}

// Requisición de almacén: catálogo con fotos y existencias, carrito y confirmación de surtido.
export default function RequisicionPage() {
  const [articulos, setArticulos] = useState<ArticuloAlmacen[]>([]);
  const [ubicFiltro, setUbicFiltro] = useState("");
  const [q, setQ] = useState("");
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [referencia, setReferencia] = useState("");
  const [eleccion, setEleccion] = useState<Record<number, { ubic: string; cant: string }>>({});
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<Requisicion[]>([]);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/inventario/almacen/articulos", { cache: "no-store" }).then((x) => x.json());
    setArticulos(r.articulos || []);
    const h = await fetch("/api/inventario/almacen/requisicion", { cache: "no-store" }).then((x) => x.json());
    setHistorial(h.requisiciones || []);
  }, []);
  useEffect(() => {
    setUbicFiltro(new URLSearchParams(window.location.search).get("ubicacion") || "");
    cargar();
  }, [cargar]);

  const enCarrito = (aid: number, uid: number) => carrito.filter((c) => c.articulo_id === aid && c.ubicacion_id === uid).reduce((a, c) => a + c.cantidad, 0);
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return articulos.filter(
      (a) => a.total > 0 && (!ubicFiltro || a.ubicaciones.some((u) => u.codigo.toLowerCase() === ubicFiltro.toLowerCase())) && (!t || `${a.nombre} ${a.categoria || ""}`.toLowerCase().includes(t))
    );
  }, [articulos, q, ubicFiltro]);

  const agregar = (a: ArticuloAlmacen) => {
    const e = eleccion[a.id] || { ubic: "", cant: "1" };
    const ub = a.ubicaciones.find((u) => u.codigo === (e.ubic || (ubicFiltro && a.ubicaciones.find((x) => x.codigo.toLowerCase() === ubicFiltro.toLowerCase())?.codigo) || a.ubicaciones[0]?.codigo));
    if (!ub) return;
    const cant = Number(e.cant) || 0;
    const libre = ub.cantidad - enCarrito(a.id, ub.ubicacion_id);
    if (cant <= 0 || cant > libre) return alert(`Cantidad no válida. Disponible en ${ub.codigo}: ${libre}.`);
    setCarrito((p) => {
      const i = p.findIndex((c) => c.articulo_id === a.id && c.ubicacion_id === ub.ubicacion_id);
      if (i >= 0) return p.map((c, k) => (k === i ? { ...c, cantidad: c.cantidad + cant } : c));
      return [...p, { articulo_id: a.id, nombre: a.nombre, ubicacion_id: ub.ubicacion_id, codigo: ub.codigo, cantidad: cant, disponible: ub.cantidad, costo: a.costo }];
    });
  };

  const total = carrito.reduce((a, c) => a + c.cantidad * c.costo, 0);

  const confirmar = async () => {
    if (!referencia.trim()) return alert("Agrega el folio de orden de trabajo, concepto o referencia del consumo.");
    setGuardando(true);
    try {
      const res = await fetch("/api/inventario/almacen/requisicion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referencia, items: carrito.map((c) => ({ articulo_id: c.articulo_id, ubicacion_id: c.ubicacion_id, cantidad: c.cantidad })) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo surtir la requisición.");
      imprimirRequisicion(d.requisicion);
      setCarrito([]);
      setReferencia("");
      cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo surtir la requisición.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10 pb-10">
        <PageHeader titulo="Requisición de Almacén" subtitulo="Elige artículos del catálogo, agrégalos al carrito y confirma el surtido." backHref="/inventario" backLabel="Control de inventario" />
        <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artículo o categoría" className="flex-1 border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] bg-white" />
              {ubicFiltro && (
                <button type="button" onClick={() => setUbicFiltro("")} className="bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-3 py-2 text-[12.5px] font-bold">Ubicación: {ubicFiltro} ✕</button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibles.map((a) => {
                const e = eleccion[a.id] || { ubic: "", cant: "1" };
                return (
                  <div key={a.id} className="bg-white rounded-xl border border-[var(--gray-200)] p-3 flex flex-col gap-2">
                    <Foto id={a.id} tiene={a.tiene_imagen} />
                    <p className="text-[14px] font-bold text-[var(--navy)] m-0">{a.nombre}</p>
                    <p className="text-[11.5px] text-[var(--gray-500)] m-0">{[a.tipo, a.categoria].filter(Boolean).join(" · ")} · {moneda(a.costo)}</p>
                    <p className="text-[12.5px] m-0">Disponible: <b className="text-[var(--green)]">{a.total}</b></p>
                    <div className="grid grid-cols-[1fr_70px] gap-2">
                      <select value={e.ubic} onChange={(ev) => setEleccion((p) => ({ ...p, [a.id]: { ...e, ubic: ev.target.value } }))} className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12px] bg-white">
                        <option value="">{ubicFiltro || a.ubicaciones[0]?.codigo} ({(a.ubicaciones.find((u) => u.codigo.toLowerCase() === (ubicFiltro || "").toLowerCase()) || a.ubicaciones[0])?.cantidad})</option>
                        {a.ubicaciones.map((u) => <option key={u.ubicacion_id} value={u.codigo}>{u.codigo} ({u.cantidad})</option>)}
                      </select>
                      <input type="number" min={1} value={e.cant} onChange={(ev) => setEleccion((p) => ({ ...p, [a.id]: { ...e, cant: ev.target.value } }))} className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12px]" />
                    </div>
                    <button type="button" onClick={() => agregar(a)} className="bg-[var(--navy)] text-white rounded-lg py-2 text-[12.5px] font-bold">Agregar al carrito</button>
                  </div>
                );
              })}
              {visibles.length === 0 && <p className="text-[13px] text-[var(--gray-400)] col-span-full text-center py-10">Sin artículos con existencia.</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--gray-200)] p-4 lg:sticky lg:top-4">
            <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-3">Carrito ({carrito.length})</h3>
            {carrito.length === 0 && <p className="text-[12.5px] text-[var(--gray-400)]">Agrega artículos del catálogo.</p>}
            {carrito.map((c, i) => (
              <div key={`${c.articulo_id}-${c.ubicacion_id}`} className="flex items-center gap-2 py-1.5 border-b border-[var(--gray-100)] text-[12.5px]">
                <span className="flex-1">{c.nombre} <span className="text-[var(--gray-500)]">· {c.codigo}</span></span>
                <b>{c.cantidad}</b>
                <button type="button" className="text-[var(--red)]" onClick={() => setCarrito((p) => p.filter((_, k) => k !== i))}>✕</button>
              </div>
            ))}
            <p className="text-[13px] text-right mt-2">Total: <b>{moneda(total)}</b></p>
            <label className="block mt-3">
              <span className="block text-[12px] font-medium mb-1">Folio de OT, concepto o referencia del consumo *</span>
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className="w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13px]" />
            </label>
            <button type="button" disabled={!carrito.length || guardando} onClick={confirmar} className="mt-3 w-full bg-[var(--green)] text-white rounded-lg py-2.5 text-[13px] font-bold disabled:opacity-40">
              {guardando ? "Surtiendo…" : "Confirmar surtido de requisición"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--gray-200)] p-4 mt-6">
          <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-3">Requisiciones surtidas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse min-w-[620px]">
              <thead className="text-left text-[var(--navy)] bg-[#f8fafc]"><tr><th className="p-2">Folio</th><th className="p-2">Fecha</th><th className="p-2">Referencia</th><th className="p-2">Usuario</th><th className="p-2 text-right">Total</th><th className="p-2" /></tr></thead>
              <tbody>
                {historial.map((r) => (
                  <tr key={r.folio} className="border-t border-[var(--gray-200)]">
                    <td className="p-2 font-medium">{r.folio}</td>
                    <td className="p-2">{new Date(r.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</td>
                    <td className="p-2">{r.referencia}</td>
                    <td className="p-2">{r.usuario || "—"}</td>
                    <td className="p-2 text-right">{moneda(Number(r.total))}</td>
                    <td className="p-2 text-right"><button type="button" className="text-[var(--blue)] font-bold" onClick={() => imprimirRequisicion(r)}>Imprimir</button></td>
                  </tr>
                ))}
                {historial.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-[var(--gray-400)]">Sin requisiciones.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
