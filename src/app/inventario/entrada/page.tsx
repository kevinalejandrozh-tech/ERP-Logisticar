"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

type Fila = { key: string; cantidad: string; articulo: string; categoria: string; tipo: "Inventario" | "Bienes"; precio: string; fechaCompra: string; proveedor: string; ubicacion: string; ocFolio?: string; ocIndice?: number; max?: number };
type OC = { folio: string; fecha: string; estado: string; referencia: string; recibible: boolean; items: { indice: number; articulo: string; pendiente: number; precioUnitario: number; proveedor: string }[] };

const hoyIso = () => new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10);
const nueva = (): Fila => ({ key: `${Date.now()}-${Math.random()}`, cantidad: "1", articulo: "", categoria: "", tipo: "Inventario", precio: "", fechaCompra: hoyIso(), proveedor: "", ubicacion: "" });
const cel = "w-full border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] bg-white";
const moneda = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v || 0);

export default function EntradaPage() {
  const [modo, setModo] = useState<"directo" | "oc">("directo");
  const [filas, setFilas] = useState<Fila[]>([nueva()]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [ubicaciones, setUbicaciones] = useState<string[]>([]);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [ocs, setOcs] = useState<OC[]>([]);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [paso, setPaso] = useState<"lista" | "tabla">("lista");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setModo(new URLSearchParams(window.location.search).get("modo") === "oc" ? "oc" : "directo");
    fetch("/api/inventario/categorias", { cache: "no-store" }).then((r) => r.json()).then((d) => setCategorias((d.registros || []).map((c: { nombre: string }) => c.nombre))).catch(() => {});
    fetch("/api/inventario/almacen/ubicaciones", { cache: "no-store" }).then((r) => r.json()).then((d) => setUbicaciones((d.ubicaciones || []).map((u: { codigo: string }) => u.codigo))).catch(() => {});
    fetch("/api/compras/proveedores", { cache: "no-store" }).then((r) => r.json()).then((d) => setProveedores((d.proveedores || []).map((p: { nombre: string }) => p.nombre))).catch(() => {});
    fetch("/api/inventario/almacen/ocs", { cache: "no-store" }).then((r) => r.json()).then((d) => setOcs(d.ocs || [])).catch(() => {});
  }, []);

  const set = (key: string, campo: keyof Fila, v: string) => setFilas((p) => p.map((f) => (f.key === key ? { ...f, [campo]: v } : f)));
  const completa = useMemo(
    () => filas.length > 0 && filas.every((f) => Number(f.cantidad) > 0 && (!f.max || Number(f.cantidad) <= f.max) && f.articulo.trim() && f.categoria && f.ubicacion && f.fechaCompra && f.proveedor.trim() && f.precio !== ""),
    [filas]
  );
  const total = filas.reduce((a, f) => a + (Number(f.cantidad) || 0) * (Number(f.precio) || 0), 0);

  const continuarOC = () => {
    const nuevas: Fila[] = [];
    for (const oc of ocs.filter((o) => elegidas.includes(o.folio))) {
      for (const it of oc.items.filter((i) => i.pendiente > 0)) {
        nuevas.push({ ...nueva(), cantidad: String(it.pendiente), max: it.pendiente, articulo: it.articulo, precio: String(it.precioUnitario), proveedor: it.proveedor, fechaCompra: String(oc.fecha).slice(0, 10), ocFolio: oc.folio, ocIndice: it.indice });
      }
    }
    if (!nuevas.length) return alert("Las OC elegidas no tienen artículos pendientes por recibir.");
    setFilas(nuevas);
    setPaso("tabla");
  };

  const generar = async () => {
    setError("");
    setGuardando(true);
    try {
      const res = await fetch("/api/inventario/almacen/entrada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origen: modo === "oc" ? "OC" : "Directo", items: filas.map((f) => ({ ...f, cantidad: Number(f.cantidad), precio: Number(f.precio) || 0 })) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo generar la entrada.");
      alert(`Entrada generada. Folio de recibo: ${d.folio}`);
      window.location.href = "/inventario/movimientos";
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la entrada.");
    } finally {
      setGuardando(false);
    }
  };

  const tabla = (
    <>
      <datalist id="prov-entrada">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
      <div className="overflow-x-auto border border-[var(--gray-200)] rounded-lg">
        <table className="w-full text-left text-[12.5px] border-collapse min-w-[1100px]">
          <thead className="bg-[#f8fafc] text-[var(--navy)] font-bold border-b border-[var(--gray-200)]">
            <tr>
              <th className="p-2.5 w-[80px]">Cant.</th>
              <th className="p-2.5 min-w-[190px]">Nombre del artículo</th>
              <th className="p-2.5 w-[150px]">Categoría</th>
              <th className="p-2.5 w-[120px]">Tipo</th>
              <th className="p-2.5 w-[110px]">Precio unit.</th>
              <th className="p-2.5 w-[140px]">Fecha de compra</th>
              <th className="p-2.5 min-w-[150px]">Proveedor</th>
              <th className="p-2.5 w-[140px]">Ubicación</th>
              <th className="p-2.5 w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.key} className="border-b border-[var(--gray-200)] align-top">
                <td className="p-2">
                  <input type="number" min={1} max={f.max} value={f.cantidad} onChange={(e) => set(f.key, "cantidad", e.target.value)} className={cel} />
                  {f.ocFolio && <span className="block text-[10.5px] text-[var(--gray-500)] mt-0.5">{f.ocFolio} · pend. {f.max}</span>}
                </td>
                <td className="p-2"><input value={f.articulo} onChange={(e) => set(f.key, "articulo", e.target.value)} className={cel} /></td>
                <td className="p-2">
                  <select value={f.categoria} onChange={(e) => set(f.key, "categoria", e.target.value)} className={cel}>
                    <option value="">Elegir…</option>
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  <select value={f.tipo} onChange={(e) => set(f.key, "tipo", e.target.value)} className={cel}>
                    <option value="Inventario">Inventario</option>
                    <option value="Bienes">Bienes</option>
                  </select>
                </td>
                <td className="p-2"><input type="number" min={0} step="0.01" value={f.precio} onChange={(e) => set(f.key, "precio", e.target.value)} className={cel} /></td>
                <td className="p-2"><input type="date" value={f.fechaCompra} onChange={(e) => set(f.key, "fechaCompra", e.target.value)} className={cel} /></td>
                <td className="p-2"><input list="prov-entrada" value={f.proveedor} onChange={(e) => set(f.key, "proveedor", e.target.value)} className={cel} /></td>
                <td className="p-2">
                  <select value={f.ubicacion} onChange={(e) => set(f.key, "ubicacion", e.target.value)} className={cel}>
                    <option value="">Elegir…</option>
                    {ubicaciones.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="p-2 text-center"><button type="button" className="text-[var(--red)]" onClick={() => setFilas((p) => (p.length > 1 ? p.filter((x) => x.key !== f.key) : p))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        {modo === "directo" && <button type="button" onClick={() => setFilas((p) => [...p, nueva()])} className="text-[12.5px] font-bold text-[var(--blue)]">+ Agregar artículo</button>}
        {ubicaciones.length === 0 && <span className="text-[12px] text-[var(--red)]">No hay ubicaciones. <Link href="/inventario/ubicaciones">Crea una</Link>.</span>}
        <span className="ml-auto text-[13px]">Total: <b>{moneda(total)}</b></span>
      </div>
      {error && <p className="text-[12.5px] text-[var(--red)] mt-3 mb-0">{error}</p>}
      <div className="flex justify-end mt-4">
        <button type="button" disabled={!completa || guardando} onClick={generar} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold disabled:opacity-40" title={completa ? "" : "Completa todas las columnas"}>
          {guardando ? "Generando…" : "Generar entrada"}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10 pb-10">
        <PageHeader titulo={modo === "oc" ? "Entrada · Recibir OC" : "Entrada · Directo"} subtitulo="Ingreso de artículos al almacén con folio de recibo." backHref="/inventario" backLabel="Control de inventario" />
        <div className="flex gap-2 mb-4">
          {(["directo", "oc"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setModo(m); setFilas([nueva()]); setPaso("lista"); setElegidas([]); }} className={`px-4 py-2 rounded-lg text-[13px] font-bold ${modo === m ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--navy)] border border-[var(--gray-200)]"}`}>
              {m === "directo" ? "Directo" : "Recibir OC"}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[var(--gray-200)]">
          {modo === "oc" && paso === "lista" ? (
            <>
              <p className="text-[12.5px] text-[var(--gray-500)] m-0 mb-3">Selecciona una o más OC. Solo se pueden recibir las autorizadas o parcialmente recibidas.</p>
              <div className="overflow-x-auto border border-[var(--gray-200)] rounded-lg">
                <table className="w-full text-[12.5px] border-collapse min-w-[640px]">
                  <thead className="bg-[#f8fafc] text-[var(--navy)] text-left">
                    <tr><th className="p-2.5 w-[40px]" /><th className="p-2.5">Folio</th><th className="p-2.5">Referencia</th><th className="p-2.5">Estatus</th><th className="p-2.5 text-right">Pendientes</th></tr>
                  </thead>
                  <tbody>
                    {ocs.map((o) => {
                      const pend = o.items.reduce((a, i) => a + i.pendiente, 0);
                      const ok = o.recibible && pend > 0;
                      return (
                        <tr key={o.folio} className={`border-t border-[var(--gray-200)] ${ok ? "" : "text-[var(--gray-400)]"}`}>
                          <td className="p-2.5"><input type="checkbox" disabled={!ok} checked={elegidas.includes(o.folio)} onChange={(e) => setElegidas((p) => (e.target.checked ? [...p, o.folio] : p.filter((x) => x !== o.folio)))} /></td>
                          <td className="p-2.5 font-medium">{o.folio}</td>
                          <td className="p-2.5">{o.referencia || "—"}</td>
                          <td className="p-2.5">{o.estado}</td>
                          <td className="p-2.5 text-right">{pend}</td>
                        </tr>
                      );
                    })}
                    {ocs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-[var(--gray-400)]">No hay órdenes de compra.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button type="button" disabled={!elegidas.length} onClick={continuarOC} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold disabled:opacity-40">Continuar ({elegidas.length})</button>
              </div>
            </>
          ) : (
            tabla
          )}
        </div>
      </div>
    </div>
  );
}
