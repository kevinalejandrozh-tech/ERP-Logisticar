"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { compressImage } from "@/lib/imageUtils";

type FotoDesc = { foto: string; descripcion: string };
type Unidad = { ECO: string; Unidad?: string; [k: string]: string | undefined };
type Operador = { nombre: string };

export default function ReportarFallaPage() {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [operadores, setOperadores] = useState<string[]>([]);
  const [ecoUnidad, setEcoUnidad] = useState("");
  const [nombre, setNombre] = useState("");
  const [reporteFalla, setReporteFalla] = useState("");
  const [fotos, setFotos] = useState<FotoDesc[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ folio: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/unidades/list")
      .then((r) => r.json())
      .then((d) => setUnidades(d.registros || []))
      .catch(() => {});
    fetch("/api/operadores/list")
      .then((r) => r.json())
      .then((d) => setOperadores((d.registros || []).map((o: Operador) => o.nombre)))
      .catch(() => {});
  }, []);

  const agregarFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const nuevas: FotoDesc[] = [];
    for (const file of files) {
      try {
        const dataUrl = await compressImage(file);
        nuevas.push({ foto: dataUrl, descripcion: "" });
      } catch {
        // se omite si falla la compresion
      }
    }
    setFotos((prev) => [...prev, ...nuevas]);
    e.target.value = "";
  };
  const actualizarDescripcion = (idx: number, descripcion: string) => {
    setFotos((prev) => prev.map((f, i) => (i === idx ? { ...f, descripcion } : f)));
  };
  const eliminarFoto = (idx: number) => setFotos((prev) => prev.filter((_, i) => i !== idx));

  const enviar = async () => {
    if (!ecoUnidad || !nombre || !reporteFalla.trim()) {
      setError("Completa el ECO, tu nombre y el reporte de falla.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      const unidad = unidades.find((u) => u.ECO === ecoUnidad);
      const res = await fetch("/api/historial-mantenimientos/reportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ecoUnidad,
          unidad: unidad?.Unidad || "",
          reportadoPor: nombre,
          reporteFalla: reporteFalla.trim(),
          evidencias: fotos,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar el reporte.");
      setResultado({ folio: data.folio });
    } catch (err: any) {
      setError(err.message || "Error al enviar el reporte.");
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <div className="min-h-screen flex justify-center bg-[#dcdfe6] py-10 px-4">
        <div className="w-full max-w-[430px] bg-white rounded-2xl shadow-xl p-7 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--green)]/15 flex items-center justify-center mx-auto mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h1 className="font-display font-extrabold text-[var(--navy)] text-lg mb-1.5">Reporte enviado</h1>
          <p className="text-sm text-[var(--gray-400)] mb-1">Tu reporte fue enviado a mantenimiento correctamente.</p>
          <p className="text-sm text-[var(--navy)] font-bold mb-6">Folio: {resultado.folio}</p>
          <button
            type="button"
            onClick={() => {
              setResultado(null);
              setEcoUnidad("");
              setNombre("");
              setReporteFalla("");
              setFotos([]);
            }}
            className="w-full bg-[var(--navy)] text-white font-display font-bold rounded-lg py-3 text-sm"
          >
            Enviar otro reporte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex justify-center bg-[#dcdfe6] py-6 px-4">
      <div className="w-full max-w-[430px] bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-[var(--gray-200)] flex items-center gap-2.5">
          <Logo size={32} />
          <div className="leading-tight">
            <p className="font-display font-extrabold text-[var(--red)] text-[12px]">TRANSPORTES</p>
            <p className="font-display font-extrabold text-[var(--red)] text-[12px]">LOGISTICAR</p>
          </div>
        </div>
        <div className="text-center py-3 border-b border-[var(--gray-200)]">
          <h1 className="font-display font-extrabold text-[var(--navy)] text-base uppercase tracking-wide">Reportar falla a mantenimiento</h1>
        </div>
        <div className="px-5 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">ECO. Unidad</label>
            <select value={ecoUnidad} onChange={(e) => setEcoUnidad(e.target.value)} className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm">
              <option value="">Selecciona...</option>
              {unidades.map((u) => (
                <option key={u.ECO} value={u.ECO}>
                  {u.ECO} {u.Unidad ? `— ${u.Unidad}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Nombre</label>
            <select value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm">
              <option value="">Selecciona...</option>
              {operadores.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Reporte de falla</label>
            <textarea
              value={reporteFalla}
              onChange={(e) => setReporteFalla(e.target.value)}
              rows={4}
              placeholder="Describe la falla..."
              className="w-full bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md p-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Fotos de evidencia</label>
            <div className="flex flex-col gap-2.5">
              {fotos.map((f, i) => (
                <div key={i} className="flex gap-2.5 items-start border border-[var(--gray-200)] rounded-lg p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.foto} alt={`Foto ${i + 1}`} className="w-16 h-16 rounded-md object-cover shrink-0" />
                  <input
                    value={f.descripcion}
                    onChange={(e) => actualizarDescripcion(i, e.target.value)}
                    placeholder="Descripción de la foto..."
                    className="flex-1 border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px]"
                  />
                  <span onClick={() => eliminarFoto(i)} className="text-[var(--red)] cursor-pointer shrink-0 mt-1.5" title="Quitar foto">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </span>
                </div>
              ))}
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--gray-200)] rounded-lg py-3 cursor-pointer text-[var(--navy)]">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-[12.5px] font-bold">Tomar / agregar foto</span>
                <input type="file" accept="image/*" capture="environment" multiple onChange={agregarFotos} className="hidden" />
              </label>
            </div>
          </div>
          {error && <p className="text-[12.5px] text-[var(--red)]">{error}</p>}
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="w-full bg-[var(--navy)] disabled:opacity-60 text-white font-display font-bold rounded-lg py-3 text-sm mt-1"
          >
            {enviando ? "Enviando..." : "Enviar reporte a mantenimiento"}
          </button>
        </div>
      </div>
    </div>
  );
}
