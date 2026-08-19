"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import { compressImage } from "@/lib/imageUtils";

type Comparativo = { id: number; titulo: string; descripcion: string; fotoAntes: string; fotoDespues: string };

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

export default function ComparativoPage() {
  const [comparativos, setComparativos] = useState<Comparativo[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    try {
      const res = await fetch("/api/comparativos/list", { cache: "no-store" });
      const data = await res.json();
      setComparativos(data.registros || []);
    } catch {
      // se reintenta al recuperar el foco
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => {
    cargar();
  }, []);
  useRefrescarAlEnfocar(cargar);

  // ---- Formulario Nuevo comparativo ----
  const [modalAbierto, setModalAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fotoAntes, setFotoAntes] = useState("");
  const [fotoDespues, setFotoDespues] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrirModal = () => {
    setTitulo("");
    setDescripcion("");
    setFotoAntes("");
    setFotoDespues("");
    setModalAbierto(true);
  };

  const capturarFoto = async (e: React.ChangeEvent<HTMLInputElement>, destino: "antes" | "despues") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      if (destino === "antes") setFotoAntes(dataUrl);
      else setFotoDespues(dataUrl);
    } catch {
      alert("No se pudo procesar la foto.");
    }
  };

  const guardarComparativo = async () => {
    if (!titulo.trim()) {
      alert("Captura un título para el comparativo.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/comparativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: titulo.trim(), descripcion: descripcion.trim(), fotoAntes, fotoDespues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el comparativo.");
      setModalAbierto(false);
      await cargar();
    } catch (err: any) {
      alert(err.message || "No se pudo guardar el comparativo.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarComparativo = async (id: number) => {
    if (!confirm("¿Eliminar este comparativo?")) return;
    setComparativos((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch("/api/comparativos/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargar();
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Generar comparativo"
          subtitulo="Documenta el antes y después de unidades, mantenimientos o cualquier trabajo realizado."
          backHref="/"
          backLabel="Inicio"
          icono={
            <svg width="24" height="24" viewBox="0 0 24 24" {...sw}>
              <rect x="2" y="4" width="9" height="9" rx="1.5" />
              <rect x="13" y="4" width="9" height="9" rx="1.5" />
              <path d="M2 17h9M13 17h9" />
            </svg>
          }
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap gap-2.5 md:gap-3 mb-5">
            <button type="button" onClick={abrirModal} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Nuevo comparativo
            </button>
          </div>

          {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando...</p>}

          {!cargando && comparativos.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Aún no hay comparativos. Crea el primero con &quot;Nuevo comparativo&quot;.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {comparativos.map((c) => (
              <div key={c.id} className="bg-[var(--gray-100)] rounded-2xl overflow-hidden border border-[var(--gray-200)]">
                <div className="grid grid-cols-2">
                  <div className="relative aspect-square bg-[#dfe3ea]">
                    {c.fotoAntes ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={c.fotoAntes} alt="Antes" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--gray-400)] text-[11px]">Sin foto</div>
                    )}
                    <span className="absolute top-2 left-2 bg-[var(--red)] text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">Antes</span>
                  </div>
                  <div className="relative aspect-square bg-[#dfe3ea] border-l-2 border-white">
                    {c.fotoDespues ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={c.fotoDespues} alt="Después" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--gray-400)] text-[11px]">Sin foto</div>
                    )}
                    <span className="absolute top-2 right-2 bg-[var(--blue)] text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">Después</span>
                  </div>
                </div>
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-bold text-[var(--navy)] text-[13.5px] m-0">{c.titulo}</h3>
                    <span onClick={() => eliminarComparativo(c.id)} className="text-[var(--red)] cursor-pointer shrink-0" title="Eliminar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </span>
                  </div>
                  {c.descripcion && <p className="text-[12px] text-[var(--gray-400)] mt-1 mb-0">{c.descripcion}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <PageFooter />
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[460px] max-w-[92%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Nuevo comparativo</h3>
              <span onClick={() => setModalAbierto(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Título</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Unidad ECO 42 — Lavado de motor" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13px]" />
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Descripción (opcional)</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="w-full border border-[var(--gray-200)] rounded-lg p-3 text-[13px]" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-[11px] font-bold text-[var(--red)] uppercase mb-1.5 text-center">Antes</label>
                <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[var(--gray-200)] rounded-lg aspect-square cursor-pointer overflow-hidden bg-[var(--gray-100)]">
                  {fotoAntes ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={fotoAntes} alt="Antes" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#9aa1b0" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                      <span className="text-[11px] font-bold text-[var(--gray-400)]">Agregar foto</span>
                    </>
                  )}
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => capturarFoto(e, "antes")} className="hidden" />
                </label>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--blue)] uppercase mb-1.5 text-center">Después</label>
                <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[var(--gray-200)] rounded-lg aspect-square cursor-pointer overflow-hidden bg-[var(--gray-100)]">
                  {fotoDespues ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={fotoDespues} alt="Después" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#9aa1b0" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                      <span className="text-[11px] font-bold text-[var(--gray-400)]">Agregar foto</span>
                    </>
                  )}
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => capturarFoto(e, "despues")} className="hidden" />
                </label>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarComparativo} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
