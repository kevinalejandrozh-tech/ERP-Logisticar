"use client";
import { useState } from "react";

export type OpcionLetra = "A" | "B" | "C" | "D";
export type Pregunta = { pregunta: string; opciones: Record<OpcionLetra, string>; correcta: OpcionLetra };
export type CapacitacionData = { id?: number; titulo: string; descripcion: string; preguntas: Pregunta[] };

const LETRAS: OpcionLetra[] = ["A", "B", "C", "D"];
const PREGUNTA_VACIA = (): Pregunta => ({ pregunta: "", opciones: { A: "", B: "", C: "", D: "" }, correcta: "A" });

export default function CapacitacionFormModal({
  inicial,
  onGuardado,
  onCancelar,
}: {
  inicial?: CapacitacionData;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo || "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion || "");
  const [preguntas, setPreguntas] = useState<Pregunta[]>(inicial?.preguntas || []);
  const [expandida, setExpandida] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const agregarPregunta = () => {
    setPreguntas((prev) => [...prev, PREGUNTA_VACIA()]);
    setExpandida(preguntas.length);
  };
  const actualizarPregunta = (idx: number, campo: "pregunta", valor: string) =>
    setPreguntas((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  const actualizarOpcion = (idx: number, letra: OpcionLetra, valor: string) =>
    setPreguntas((prev) => prev.map((p, i) => (i === idx ? { ...p, opciones: { ...p.opciones, [letra]: valor } } : p)));
  const actualizarCorrecta = (idx: number, letra: OpcionLetra) =>
    setPreguntas((prev) => prev.map((p, i) => (i === idx ? { ...p, correcta: letra } : p)));
  const quitarPregunta = (idx: number) => {
    setPreguntas((prev) => prev.filter((_, i) => i !== idx));
    setExpandida(null);
  };

  const guardar = async () => {
    if (!titulo.trim()) {
      setError("Captura el título de la capacitación.");
      return;
    }
    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      if (!p.pregunta.trim() || !p.opciones.A.trim() || !p.opciones.B.trim() || !p.opciones.C.trim() || !p.opciones.D.trim()) {
        setError(`Completa el texto y las 4 opciones de la pregunta ${i + 1}.`);
        setExpandida(i);
        return;
      }
    }
    setError("");
    setGuardando(true);
    try {
      const res = await fetch("/api/capacitaciones/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inicial?.id, titulo: titulo.trim(), descripcion: descripcion.trim(), preguntas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar la capacitación.");
      onGuardado();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar la capacitación.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50">
      <div className="bg-white rounded-2xl w-[680px] max-w-[95%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
        <h3 className="text-[17px] font-bold text-[var(--navy)] mb-5">{inicial ? "Editar capacitación" : "Agregar capacitación"}</h3>

        <div className="mb-4">
          <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">Título de la capacitación</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
        </div>
        <div className="mb-5">
          <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] resize-none"
          />
        </div>

        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[12.5px] font-bold text-[var(--navy)] m-0">Preguntas ({preguntas.length})</p>
          <button type="button" onClick={agregarPregunta} className="text-[12px] font-bold text-[var(--blue)]">
            + Agregar pregunta
          </button>
        </div>

        {preguntas.length === 0 && <p className="text-[12.5px] text-[var(--gray-400)] mb-4">Aún no hay preguntas. Usa &quot;+ Agregar pregunta&quot;.</p>}

        <div className="flex flex-col gap-2 mb-6 max-h-[46vh] overflow-y-auto pr-1">
          {preguntas.map((p, idx) => {
            const abierta = expandida === idx;
            return (
              <div key={idx} className="border border-[var(--gray-200)] rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer bg-[var(--gray-100)]" onClick={() => setExpandida(abierta ? null : idx)}>
                  <span className="text-[11.5px] font-bold text-[var(--navy)] shrink-0">{idx + 1}.</span>
                  <span className="flex-1 text-[12.5px] text-[var(--text)] truncate">{p.pregunta || "(sin texto todavía)"}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      quitarPregunta(idx);
                    }}
                    className="text-[var(--red)] shrink-0"
                    title="Quitar pregunta"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2.2" className={`shrink-0 transition-transform ${abierta ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
                {abierta && (
                  <div className="p-3.5">
                    <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Pregunta</label>
                    <input
                      value={p.pregunta}
                      onChange={(e) => actualizarPregunta(idx, "pregunta", e.target.value)}
                      className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] mb-3"
                    />
                    <div className="flex flex-col gap-2">
                      {LETRAS.map((letra) => (
                        <div key={letra} className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 shrink-0" title="Marcar como respuesta correcta">
                            <input type="radio" checked={p.correcta === letra} onChange={() => actualizarCorrecta(idx, letra)} className="accent-[var(--green)]" />
                            <span className="text-[11px] font-bold text-[var(--gray-400)] w-4">{letra}</span>
                          </label>
                          <input
                            value={p.opciones[letra]}
                            onChange={(e) => actualizarOpcion(idx, letra, e.target.value)}
                            placeholder={`Opción ${letra}`}
                            className={`flex-1 border rounded-lg px-3 py-2 text-[13px] ${p.correcta === letra ? "border-[var(--green)] bg-[rgba(33,168,102,0.08)]" : "border-[var(--gray-200)]"}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-[12.5px] text-[var(--red)] font-semibold mb-3">{error}</p>}

        <div className="flex gap-2.5 justify-end">
          <button type="button" onClick={onCancelar} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
