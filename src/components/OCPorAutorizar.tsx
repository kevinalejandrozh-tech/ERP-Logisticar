"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DISPERSIONES, MEDIOS_PAGO } from "@/lib/comprasData";

type OC = { titulo?: string; folio: string; fecha: string; total: number; solicitado_por: string | null; justificacion: string; articulos: { cantidad: number; articulo: string; proveedor: string; total: number }[] };
const moneda = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v || 0);

// Globo emergente (desde el icono de notificaciones) para quien puede autorizar OC: persiste hasta autorizar o rechazar cada una.
// Se revisa cada pocos segundos, así aparece al momento en que alguien pulsa "Solicitar autorización".
export default function OCPorAutorizar() {
  const ruta = usePathname();
  const [ordenes, setOrdenes] = useState<OC[]>([]);
  const [abierto, setAbierto] = useState(true);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [razon, setRazon] = useState("");
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [autorizando, setAutorizando] = useState<string | null>(null); // OC en la que se están eligiendo medio de pago y dispersión
  const [medio, setMedio] = useState("");
  const [dispersion, setDispersion] = useState("");
  const [error, setError] = useState("");
  const detenido = useRef(false);
  const antes = useRef(0);

  const consultar = useCallback(async () => {
    if (detenido.current || document.hidden) return;
    try {
      const r = await fetch("/api/compras/pendientes", { cache: "no-store" });
      if (r.status === 401 || r.status === 403) return void (detenido.current = true);
      if (!r.ok) return;
      const d = await r.json();
      if (!d.puede) return void (detenido.current = true);
      setOrdenes(d.ordenes || []);
      if ((d.ordenes?.length || 0) > antes.current) setAbierto(true); // llegó una nueva: se despliega sola
      antes.current = d.ordenes?.length || 0;
    } catch {
      /* sin conexión */
    }
  }, []);

  useEffect(() => {
    detenido.current = false;
    if (!ruta || ruta === "/login" || ruta.startsWith("/sitio")) return;
    consultar();
    const id = window.setInterval(consultar, 6000);
    const ya = () => consultar();
    window.addEventListener("compras-actualizadas", ya);
    document.addEventListener("visibilitychange", ya);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("compras-actualizadas", ya);
      document.removeEventListener("visibilitychange", ya);
    };
  }, [ruta, consultar]);

  const resolver = async (oc: OC, aceptar: boolean) => {
    setError("");
    if (!aceptar && !razon.trim()) return setError("Escribe la razón del rechazo.");
    if (aceptar && (!medio || !dispersion)) return setError("Selecciona el medio de pago y la dispersión de recursos.");
    setTrabajando(oc.folio);
    try {
      const res = await fetch(aceptar ? "/api/compras/autorizar" : "/api/compras/rechazar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aceptar ? { folio: oc.folio, productos: oc.articulos.map(() => ({ autorizado: true })), datos: { medioPago: medio, dispersion } } : { folio: oc.folio, razon }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo completar la acción.");
      setOrdenes((l) => l.filter((x) => x.folio !== oc.folio));
      antes.current = Math.max(0, antes.current - 1);
      setRechazando(null);
      setAutorizando(null);
      setRazon("");
      window.dispatchEvent(new Event("notas-avisos")); // refresca la campana
      window.dispatchEvent(new Event("compras-actualizadas"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      consultar();
    } finally {
      setTrabajando(null);
    }
  };

  if (!ordenes.length) return null;
  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="print:hidden fixed top-[100px] right-3 z-[80] flex items-center gap-2 rounded-full bg-[var(--red)] text-white text-[12.5px] font-bold px-4 py-2 shadow-lg animate-pulse">
        🔔 {ordenes.length} OC por autorizar
      </button>
    );
  return (
    <div className="print:hidden fixed top-[100px] right-3 z-[80] w-[min(380px,calc(100vw-1.5rem))]">
      <span className="absolute -top-1.5 right-5 w-3 h-3 rotate-45 bg-white border-l border-t border-[var(--gray-200)]" aria-hidden />
      <div className="relative bg-white border border-[var(--gray-200)] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 bg-[var(--navy)] text-white px-4 py-2.5">
          <span className="text-[13px] font-bold flex-1">🔔 Autorización pendiente ({ordenes.length})</span>
          <button type="button" onClick={() => setAbierto(false)} className="text-[11.5px] opacity-80 hover:opacity-100" title="Contraer (la solicitud sigue pendiente)">Contraer</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--gray-100)]">
          {ordenes.map((oc) => (
            <div key={oc.folio} className="p-3.5 text-[12.5px]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="m-0 font-bold text-[var(--navy)]">{oc.folio}</p>
                  {oc.titulo && <p className="m-0 text-[12px] font-medium text-[var(--text)]">{oc.titulo}</p>}
                  <p className="m-0 text-[11.5px] text-[var(--gray-500)]">Solicitó: {oc.solicitado_por || "—"}</p>
                </div>
                <p className="m-0 text-[14px] font-bold text-[var(--navy)]">{moneda(oc.total)}</p>
              </div>
              <ul className="list-none m-0 mt-2 p-0 text-[12px] text-[var(--text)]">
                {oc.articulos.slice(0, 4).map((a, i) => (
                  <li key={i} className="truncate">{a.cantidad} × {a.articulo}{a.proveedor ? ` · ${a.proveedor}` : ""}</li>
                ))}
                {oc.articulos.length > 4 && <li className="text-[var(--gray-500)]">+ {oc.articulos.length - 4} más…</li>}
              </ul>
              {oc.justificacion && <p className="m-0 mt-1.5 text-[11.5px] text-[var(--gray-500)] line-clamp-2">Justificación: {oc.justificacion}</p>}
              {rechazando === oc.folio ? (
                <div className="mt-2.5">
                  <input autoFocus value={razon} onChange={(e) => setRazon(e.target.value)} placeholder="Razón del rechazo" className="w-full border border-[var(--gray-300)] rounded-md px-2.5 py-1.5 text-[12.5px]" />
                  <div className="flex gap-2 mt-2">
                    <button type="button" disabled={trabajando === oc.folio} onClick={() => resolver(oc, false)} className="flex-1 rounded-md bg-[var(--red)] text-white font-bold py-1.5 disabled:opacity-60">{trabajando === oc.folio ? "…" : "Confirmar rechazo"}</button>
                    <button type="button" onClick={() => { setRechazando(null); setRazon(""); setError(""); }} className="rounded-md border border-[var(--gray-300)] px-3 py-1.5 text-[var(--gray-500)]">Volver</button>
                  </div>
                </div>
              ) : autorizando === oc.folio ? (
                <div className="mt-2.5 grid gap-1.5">
                  <select value={medio} onChange={(e) => setMedio(e.target.value)} className="w-full border border-[var(--gray-300)] rounded-md px-2.5 py-1.5 text-[12.5px] bg-white">
                    <option value="">Medio de pago…</option>
                    {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={dispersion} onChange={(e) => setDispersion(e.target.value)} className="w-full border border-[var(--gray-300)] rounded-md px-2.5 py-1.5 text-[12.5px] bg-white">
                    <option value="">Dispersión de recursos…</option>
                    {DISPERSIONES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button type="button" disabled={trabajando === oc.folio} onClick={() => resolver(oc, true)} className="flex-1 rounded-md bg-[var(--green)] text-white font-bold py-1.5 disabled:opacity-60">{trabajando === oc.folio ? "…" : "Confirmar autorización"}</button>
                    <button type="button" onClick={() => { setAutorizando(null); setError(""); }} className="rounded-md border border-[var(--gray-300)] px-3 py-1.5 text-[var(--gray-500)]">Volver</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-2.5">
                  <button type="button" disabled={trabajando === oc.folio} onClick={() => { setAutorizando(oc.folio); setMedio(""); setDispersion(""); setError(""); }} className="flex-1 rounded-md bg-[var(--green)] text-white font-bold py-1.5 disabled:opacity-60">Autorizar</button>
                  <button type="button" disabled={trabajando === oc.folio} onClick={() => { setRechazando(oc.folio); setRazon(""); setError(""); }} className="flex-1 rounded-md border border-[var(--red)] text-[var(--red)] font-bold py-1.5 hover:bg-[#fdecea]">Rechazar</button>
                </div>
              )}
              <Link href={`/compras?oc=${encodeURIComponent(oc.folio)}`} onClick={(e) => { setAbierto(false); /* se contrae para dejar ver la ventana de la OC */ if (ruta === "/compras") { e.preventDefault(); window.dispatchEvent(new CustomEvent("compras-abrir", { detail: oc.folio })); } }} className="inline-block mt-2 text-[11.5px] font-bold text-[var(--blue)] no-underline hover:underline">Revisar por artículo →</Link>
            </div>
          ))}
        </div>
        {error && <p className="m-0 px-4 py-2 text-[12px] text-[var(--red)] border-t border-[var(--gray-100)]">{error}</p>}
        <p className="m-0 px-4 py-2 text-[10.5px] text-[var(--gray-400)] border-t border-[var(--gray-100)] bg-[#f8fafc]">Este aviso permanece hasta que autorices o rechaces cada orden.</p>
      </div>
    </div>
  );
}
