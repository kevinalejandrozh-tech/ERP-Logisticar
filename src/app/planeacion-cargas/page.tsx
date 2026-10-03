"use client";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";

type Viaje = { id: number; eco: string; fecha: string; datos: Record<string, string> };
const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const fh = (v?: string) => (v ? v.replace("T", " ") : "—");

// Monitoreo de Rutas: captura manual de la ubicación actual de los viajes en curso.
export default function MonitoreoRutasPage() {
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [borrador, setBorrador] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/planeacion-cargas/ubicacion", { cache: "no-store" }).then((x) => x.json());
      setViajes(r.viajes || []);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async (id: number) => {
    setGuardando(id);
    try {
      const res = await fetch("/api/planeacion-cargas/ubicacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ubicacion: borrador[id] || "" }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo guardar.");
      setViajes((p) => p.map((v) => (v.id === id ? { ...v, datos: d.datos } : v)));
      setBorrador((p) => ({ ...p, [id]: "" }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10 pb-10">
        <PageHeader
          titulo="Monitoreo de Rutas"
          subtitulo="Registra la ubicación actual de los viajes en curso."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
        />
        <div className="bg-white rounded-[20px] shadow-[0_4px_18px_rgba(22,33,92,0.09)] overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[980px]">
            <thead className="bg-[#f8fafc] text-[var(--navy)] text-left">
              <tr>
                <th className="p-3">ECO</th><th className="p-3">Inicio</th><th className="p-3">Cuenta · Destino</th><th className="p-3">Embarque</th><th className="p-3">Operador</th>
                <th className="p-3">Ubicación actual</th><th className="p-3 w-[300px]">Nueva ubicación</th>
              </tr>
            </thead>
            <tbody>
              {viajes.map((v) => (
                <tr key={v.id} className="border-t border-[var(--gray-200)] align-top">
                  <td className="p-3 font-bold text-[var(--navy)]">{v.eco}</td>
                  <td className="p-3">{fh(v.datos["INICIO DE RUTA"] || v.fecha)}</td>
                  <td className="p-3">{[v.datos["NOMBRE CUENTA"], v.datos["ESTADO DESTINO"], v.datos["RUTA O DESTINO"]].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="p-3">{v.datos["No EMBARQUE"] || v.datos["PROYECTO DELL"] || "—"}</td>
                  <td className="p-3">{v.datos["OPERADOR"] || "—"}</td>
                  <td className="p-3">
                    <b>{v.datos["UBICACION ACTUAL"] || "Sin registro"}</b>
                    {v.datos["UBICACION ACTUALIZADA"] && <span className="block text-[11px] text-[var(--gray-500)]">{fh(v.datos["UBICACION ACTUALIZADA"])} · {v.datos["UBICACION USUARIO"]}</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <input value={borrador[v.id] || ""} onChange={(e) => setBorrador((p) => ({ ...p, [v.id]: e.target.value }))} placeholder="Ej. Km 120 México–Querétaro" className="flex-1 border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px]" />
                      <button type="button" disabled={!borrador[v.id]?.trim() || guardando === v.id} onClick={() => guardar(v.id)} className="bg-[var(--navy)] text-white rounded-md px-3 text-[12px] font-bold disabled:opacity-40">Guardar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!cargando && viajes.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-[var(--gray-400)]">No hay viajes en curso en los últimos 14 días.</td></tr>}
              {cargando && <tr><td colSpan={7} className="p-10 text-center text-[var(--gray-400)]">Cargando…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
