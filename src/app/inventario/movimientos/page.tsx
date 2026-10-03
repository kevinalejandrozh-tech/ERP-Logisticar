"use client";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import type { ArticuloAlmacen } from "@/components/almacen/ExistenciasAlmacen";

type Mov = { id: number; tipo: string; folio: string; articulo: string; ubicacion: string; ubicacion_destino: string | null; cantidad: number; costo_unitario: number; proveedor: string | null; referencia: string | null; oc_folio: string | null; usuario: string | null; created_at: string };
const TIPOS = ["Entrada", "Salida", "Cambio de ubicación"];
const moneda = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v || 0);
const color: Record<string, string> = { Entrada: "text-[var(--green)]", Salida: "text-[var(--red)]", "Cambio de ubicación": "text-[var(--blue)]" };

// Movimientos de almacén: entradas (directas y por OC), salidas (requisiciones) y cambios de ubicación.
export default function MovimientosPage() {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [f, setF] = useState({ tipo: "", desde: "", hasta: "", q: "" });
  const [articulos, setArticulos] = useState<ArticuloAlmacen[]>([]);
  const [ubicaciones, setUbicaciones] = useState<string[]>([]);
  const [tr, setTr] = useState({ articulo_id: "", origen: "", destino: "", cantidad: "1" });
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    const r = await fetch(`/api/inventario/almacen/movimientos?${qs}`, { cache: "no-store" }).then((x) => x.json());
    setMovs(r.movimientos || []);
  }, [f]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    fetch("/api/inventario/almacen/articulos", { cache: "no-store" }).then((r) => r.json()).then((d) => setArticulos(d.articulos || [])).catch(() => {});
    fetch("/api/inventario/almacen/ubicaciones", { cache: "no-store" }).then((r) => r.json()).then((d) => setUbicaciones((d.ubicaciones || []).map((u: { codigo: string }) => u.codigo))).catch(() => {});
  }, []);

  const art = articulos.find((a) => String(a.id) === tr.articulo_id);
  const trasladar = async () => {
    const res = await fetch("/api/inventario/almacen/traslado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...tr, articulo_id: Number(tr.articulo_id), cantidad: Number(tr.cantidad) }) });
    const d = await res.json();
    if (!res.ok) return alert(d.error || "No se pudo mover.");
    setAbierto(false);
    setTr({ articulo_id: "", origen: "", destino: "", cantidad: "1" });
    cargar();
    fetch("/api/inventario/almacen/articulos", { cache: "no-store" }).then((r) => r.json()).then((x) => setArticulos(x.articulos || []));
  };

  const cel = "border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13px] bg-white";
  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10 pb-10">
        <PageHeader titulo="Movimientos de almacén" subtitulo="Entradas, salidas por requisición, cambios de ubicación y recepciones de OC." backHref="/inventario" backLabel="Control de inventario" />
        <div className="bg-white rounded-xl border border-[var(--gray-200)] p-4 mb-4 flex flex-wrap gap-2 items-end">
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className={cel}><option value="">Todos los tipos</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
          <input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} className={cel} />
          <input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} className={cel} />
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Artículo, folio, OC, referencia o ubicación" className={`${cel} flex-1 min-w-[220px]`} />
          <button type="button" onClick={() => setAbierto(true)} className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[13px] font-bold">Cambio de ubicación</button>
        </div>
        <div className="bg-white rounded-xl border border-[var(--gray-200)] overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[1000px]">
            <thead className="bg-[#f8fafc] text-[var(--navy)] text-left">
              <tr><th className="p-2.5">Fecha</th><th className="p-2.5">Tipo</th><th className="p-2.5">Folio</th><th className="p-2.5">Artículo</th><th className="p-2.5">Ubicación</th><th className="p-2.5 text-right">Cant.</th><th className="p-2.5 text-right">Importe</th><th className="p-2.5">Proveedor / OC / Referencia</th><th className="p-2.5">Usuario</th></tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id} className="border-t border-[var(--gray-200)]">
                  <td className="p-2.5 whitespace-nowrap">{new Date(m.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: "America/Mexico_City" })}</td>
                  <td className={`p-2.5 font-bold ${color[m.tipo] || ""}`}>{m.tipo}</td>
                  <td className="p-2.5">{m.folio}</td>
                  <td className="p-2.5">{m.articulo}</td>
                  <td className="p-2.5">{m.ubicacion}{m.ubicacion_destino ? ` → ${m.ubicacion_destino}` : ""}</td>
                  <td className="p-2.5 text-right">{m.tipo === "Salida" ? "-" : ""}{m.cantidad}</td>
                  <td className="p-2.5 text-right">{moneda(m.cantidad * m.costo_unitario)}</td>
                  <td className="p-2.5">{[m.proveedor, m.oc_folio ? `OC ${m.oc_folio}` : "", m.referencia].filter(Boolean).join(" · ")}</td>
                  <td className="p-2.5">{m.usuario || "—"}</td>
                </tr>
              ))}
              {movs.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-[var(--gray-400)]">Sin movimientos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {abierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setAbierto(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-[440px] grid gap-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Cambio de ubicación</h3>
            <select value={tr.articulo_id} onChange={(e) => setTr({ ...tr, articulo_id: e.target.value, origen: "" })} className={cel}>
              <option value="">Artículo…</option>
              {articulos.filter((a) => a.total > 0).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            <select value={tr.origen} onChange={(e) => setTr({ ...tr, origen: e.target.value })} className={cel} disabled={!art}>
              <option value="">Desde…</option>
              {art?.ubicaciones.map((u) => <option key={u.codigo} value={u.codigo}>{u.codigo} ({u.cantidad})</option>)}
            </select>
            <select value={tr.destino} onChange={(e) => setTr({ ...tr, destino: e.target.value })} className={cel}>
              <option value="">Hacia…</option>
              {ubicaciones.filter((u) => u !== tr.origen).map((u) => <option key={u}>{u}</option>)}
            </select>
            <input type="number" min={1} value={tr.cantidad} onChange={(e) => setTr({ ...tr, cantidad: e.target.value })} className={cel} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAbierto(false)} className="btn btn-secundario py-1.5">Cancelar</button>
              <button type="button" disabled={!tr.articulo_id || !tr.origen || !tr.destino} onClick={trasladar} className="btn btn-primario py-1.5">Mover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
