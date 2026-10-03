"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import PageHeader from "@/components/PageHeader";

type Ubic = { id: number; codigo: string; nombre: string | null; tipo: string | null; descripcion: string | null; total_piezas: number; articulos: number; ultimo_movimiento: string | null };
type Detalle = {
  ubicacion: Ubic;
  existencias: { id: number; nombre: string; tipo: string; categoria: string | null; cantidad: string; proveedores: string | null }[];
  movimientos: { tipo: string; folio: string; articulo: string; cantidad: string; proveedor: string | null; referencia: string | null; oc_folio: string | null; usuario: string | null; ubicacion: string; ubicacion_destino: string | null; created_at: string }[];
};
const TIPOS = ["Almacén", "Zona", "Estante", "Cajón", "Caja", "Otro"];
const fh = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: "America/Mexico_City" }) : "—");

export default function UbicacionesPage() {
  const [lista, setLista] = useState<Ubic[]>([]);
  const [nueva, setNueva] = useState({ codigo: "", nombre: "", tipo: "Almacén", descripcion: "" });
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [qr, setQr] = useState<{ codigo: string; img: string } | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const r = await fetch("/api/inventario/almacen/ubicaciones", { cache: "no-store" }).then((x) => x.json());
    setLista(r.ubicaciones || []);
  }, []);
  const abrir = useCallback(async (codigo: string) => {
    const r = await fetch(`/api/inventario/almacen/ubicaciones?codigo=${encodeURIComponent(codigo)}`, { cache: "no-store" }).then((x) => x.json());
    if (r.ok) setDetalle(r);
    else alert(r.error || "No se encontró la ubicación.");
  }, []);
  useEffect(() => {
    cargar();
    const u = new URLSearchParams(window.location.search).get("u");
    if (u) abrir(u);
  }, [cargar, abrir]);

  const crear = async () => {
    setError("");
    const res = await fetch("/api/inventario/almacen/ubicaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nueva) });
    const d = await res.json();
    if (!res.ok) return setError(d.error || "No se pudo crear.");
    setNueva({ codigo: "", nombre: "", tipo: nueva.tipo, descripcion: "" });
    cargar();
  };

  // El QR abre esta misma página con la ubicación (trazabilidad + "Consumir del Almacén").
  const verQr = async (codigo: string) => {
    const url = `${window.location.origin}/inventario/ubicaciones?u=${encodeURIComponent(codigo)}`;
    setQr({ codigo, img: await QRCode.toDataURL(url, { margin: 1, width: 260 }) });
  };

  const cel = "border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13px] bg-white";
  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10 pb-10">
        <PageHeader titulo="Ubicaciones" subtitulo="Almacenes, zonas, estantes, cajones y cajas con su código QR." backHref="/inventario" backLabel="Control de inventario" />
        <div className="bg-white rounded-xl border border-[var(--gray-200)] p-4 mb-5 grid grid-cols-1 md:grid-cols-[160px_1fr_150px_1.5fr_auto] gap-2 items-end">
          <label className="block"><span className="block text-[12px] font-medium mb-1">Código *</span><input value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value })} className={`${cel} w-full`} placeholder="Ej. ALM1-E3-C2" /></label>
          <label className="block"><span className="block text-[12px] font-medium mb-1">Nombre</span><input value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} className={`${cel} w-full`} /></label>
          <label className="block"><span className="block text-[12px] font-medium mb-1">Tipo</span><select value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })} className={`${cel} w-full`}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="block"><span className="block text-[12px] font-medium mb-1">Descripción</span><input value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} className={`${cel} w-full`} /></label>
          <button type="button" onClick={crear} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">Crear ubicación</button>
          {error && <p className="text-[12.5px] text-[var(--red)] m-0 md:col-span-5">{error}</p>}
        </div>

        <div className="bg-white rounded-xl border border-[var(--gray-200)] overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[760px]">
            <thead className="bg-[#f8fafc] text-[var(--navy)] text-left">
              <tr><th className="p-2.5">Código</th><th className="p-2.5">Nombre</th><th className="p-2.5">Tipo</th><th className="p-2.5 text-right">Artículos</th><th className="p-2.5 text-right">Piezas</th><th className="p-2.5">Último movimiento</th><th className="p-2.5 text-center">QR</th></tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id} className="border-t border-[var(--gray-200)]">
                  <td className="p-2.5"><button type="button" className="font-bold text-[var(--blue)] hover:underline" onClick={() => abrir(u.codigo)}>{u.codigo}</button></td>
                  <td className="p-2.5">{u.nombre || "—"}</td>
                  <td className="p-2.5">{u.tipo || "—"}</td>
                  <td className="p-2.5 text-right">{u.articulos}</td>
                  <td className="p-2.5 text-right font-bold">{u.total_piezas}</td>
                  <td className="p-2.5">{fh(u.ultimo_movimiento)}</td>
                  <td className="p-2.5 text-center">
                    <button type="button" title="Ver código QR" onClick={() => verQr(u.codigo)} className="text-[var(--navy)]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v7M14 20h3" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-[var(--gray-400)]">Aún no hay ubicaciones.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {qr && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setQr(null)}>
          <div className="bg-white rounded-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold text-[var(--navy)] m-0 mb-1">{qr.codigo}</p>
            <p className="text-[11.5px] text-[var(--gray-400)] m-0 mb-3">Escanea para ver la ubicación y consumir del almacén</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.img} alt={`QR ${qr.codigo}`} className="w-[230px] h-[230px] mx-auto" />
            <div className="flex justify-center gap-2 mt-4">
              <a href={qr.img} download={`QR-${qr.codigo}.png`} className="bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-4 py-2 text-[13px] font-bold no-underline">Descargar</a>
              <button type="button" onClick={() => setQr(null)} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2 text-[13px] font-bold">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-[900px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-[17px] font-bold text-[var(--navy)] m-0">{detalle.ubicacion.codigo}</h3>
                <p className="text-[12px] text-[var(--gray-500)] m-0">{[detalle.ubicacion.tipo, detalle.ubicacion.nombre, detalle.ubicacion.descripcion].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/inventario/requisicion?ubicacion=${encodeURIComponent(detalle.ubicacion.codigo)}`} className="bg-[var(--green)] text-white rounded-lg px-4 py-2 text-[13px] font-bold no-underline">Consumir del Almacén</Link>
                <button type="button" onClick={() => verQr(detalle.ubicacion.codigo)} className="bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-4 py-2 text-[13px] font-bold">QR</button>
                <button type="button" onClick={() => setDetalle(null)} className="text-[var(--gray-400)] text-xl px-2">✕</button>
              </div>
            </div>
            <p className="text-[12.5px] font-bold text-[var(--navy)] mb-1.5">
              Existencias · {detalle.existencias.length} artículo(s) · {detalle.existencias.reduce((a, x) => a + Number(x.cantidad), 0)} pieza(s)
            </p>
            <table className="w-full text-[12.5px] border-collapse mb-4">
              <thead className="text-left bg-[#f8fafc] text-[var(--navy)]"><tr><th className="p-2">Artículo</th><th className="p-2">Tipo</th><th className="p-2">Categoría</th><th className="p-2">Proveedores</th><th className="p-2 text-right">Cantidad</th></tr></thead>
              <tbody>
                {detalle.existencias.map((x) => (
                  <tr key={x.id} className="border-t border-[var(--gray-200)]"><td className="p-2">{x.nombre}</td><td className="p-2">{x.tipo}</td><td className="p-2">{x.categoria || "—"}</td><td className="p-2">{x.proveedores || "—"}</td><td className="p-2 text-right font-bold">{Number(x.cantidad)}</td></tr>
                ))}
                {detalle.existencias.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-[var(--gray-400)]">Vacía.</td></tr>}
              </tbody>
            </table>
            <p className="text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Trazabilidad (últimos 50 movimientos)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] border-collapse min-w-[720px]">
                <thead className="text-left bg-[#f8fafc] text-[var(--navy)]"><tr><th className="p-2">Fecha</th><th className="p-2">Tipo</th><th className="p-2">Folio</th><th className="p-2">Artículo</th><th className="p-2 text-right">Cant.</th><th className="p-2">Proveedor / Ref.</th><th className="p-2">Usuario</th></tr></thead>
                <tbody>
                  {detalle.movimientos.map((m, i) => (
                    <tr key={i} className="border-t border-[var(--gray-200)]">
                      <td className="p-2">{fh(m.created_at)}</td><td className="p-2">{m.tipo}</td><td className="p-2">{m.folio}</td><td className="p-2">{m.articulo}</td>
                      <td className="p-2 text-right">{Number(m.cantidad)}</td><td className="p-2">{[m.proveedor, m.oc_folio ? `OC ${m.oc_folio}` : "", m.referencia].filter(Boolean).join(" · ")}</td><td className="p-2">{m.usuario || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
