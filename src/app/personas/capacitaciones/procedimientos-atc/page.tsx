"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import {
  PREGUNTAS_PROCEDIMIENTOS_ATC,
  PREGUNTAS_POR_PAGINA_ATC,
  TOTAL_PREGUNTAS_ATC,
  TOTAL_PAGINAS_ATC,
  type OpcionLetra,
} from "@/lib/procedimientosAtcData";

const NOMBRE_CAPACITACION = "Procedimientos ATC";
const LETRAS: OpcionLetra[] = ["A", "B", "C", "D"];

type Fase = "intro" | "examen" | "confirmar" | "enviando";

function formatoTiempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")} min`;
}

export default function ProcedimientosAtcPage() {
  const router = useRouter();

  const [fase, setFase] = useState<Fase>("intro");
  const [nombre, setNombre] = useState("");
  const [respuestas, setRespuestas] = useState<Record<number, OpcionLetra>>({});
  const [pagina, setPagina] = useState(0);
  const [inicio, setInicio] = useState<number | null>(null);
  const [tiempoFinalSeg, setTiempoFinalSeg] = useState(0);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const contestadas = Object.keys(respuestas).length;
  const correctasHastaAhora = useMemo(
    () => PREGUNTAS_PROCEDIMIENTOS_ATC.filter((p) => respuestas[p.numero] === p.correcta).length,
    [respuestas]
  );
  const aciertosPorcentaje = Math.round((correctasHastaAhora / TOTAL_PREGUNTAS_ATC) * 100);

  const preguntasPagina = PREGUNTAS_PROCEDIMIENTOS_ATC.slice(pagina * PREGUNTAS_POR_PAGINA_ATC, pagina * PREGUNTAS_POR_PAGINA_ATC + PREGUNTAS_POR_PAGINA_ATC);
  const esUltimaPagina = pagina === TOTAL_PAGINAS_ATC - 1;
  const progresoPct = Math.round(((pagina + 1) / TOTAL_PAGINAS_ATC) * 100);

  const comenzar = () => {
    if (!nombre.trim()) return;
    setInicio(Date.now());
    setPagina(0);
    setFase("examen");
  };

  const seleccionar = (numero: number, letra: OpcionLetra) => {
    setRespuestas((prev) => ({ ...prev, [numero]: letra }));
  };

  const siguiente = () => {
    if (esUltimaPagina) {
      setTiempoFinalSeg(inicio ? Math.round((Date.now() - inicio) / 1000) : 0);
      setFase("confirmar");
    } else {
      setPagina((p) => p + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const anterior = () => {
    setPagina((p) => Math.max(0, p - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finalizarYGuardar = async () => {
    setEnviando(true);
    setError("");
    const tiempoEvaluacion = tiempoFinalSeg;
    const respuestasDetalle = PREGUNTAS_PROCEDIMIENTOS_ATC.map((p) => {
      const seleccionada = respuestas[p.numero] ?? null;
      return {
        numero: p.numero,
        seccion: p.seccion,
        pregunta: p.pregunta,
        opciones: p.opciones,
        seleccionada,
        correcta: p.correcta,
        esCorrecta: seleccionada === p.correcta,
      };
    });
    const correctas = respuestasDetalle.filter((r) => r.esCorrecta).length;
    const aciertos = Math.round((correctas / TOTAL_PREGUNTAS_ATC) * 100);

    try {
      const res = await fetch("/api/capacitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacitacion: NOMBRE_CAPACITACION,
          nombre: nombre.trim(),
          totalPreguntas: TOTAL_PREGUNTAS_ATC,
          correctas,
          aciertos,
          tiempoEvaluacion,
          respuestas: respuestasDetalle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la evaluación.");
      router.push("/personas/capacitaciones");
    } catch (e: any) {
      setError(e.message || "Ocurrió un error al guardar la evaluación.");
      setEnviando(false);
      setFase("confirmar");
    }
  };

  // ---------- Encabezado común (logo + nombre + aciertos en vivo) ----------
  const encabezado = (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
      <div className="flex items-center gap-2.5">
        <Logo size={34} />
        <div>
          <h1 className="font-display text-[15px] md:text-[17px] font-bold text-[var(--navy)] m-0">{NOMBRE_CAPACITACION}</h1>
          <p className="text-[11px] md:text-[12px] text-[var(--gray-400)] m-0">Evaluación de conocimientos</p>
        </div>
      </div>
      {fase !== "intro" && (
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-wide text-[var(--gray-400)] m-0">Evaluado</p>
            <p className="text-[13px] font-bold text-[var(--navy)] m-0">{nombre}</p>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-wide text-[var(--gray-400)] m-0">Aciertos</p>
            <p className="text-[18px] font-bold text-[var(--blue)] m-0">{aciertosPorcentaje}%</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-8 pt-6 md:pt-10 pb-16">
        <Link href="/personas/capacitaciones" className="inline-flex items-center gap-1.5 text-[var(--blue)] text-[13px] font-semibold no-underline mb-4">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Capacitaciones
        </Link>

        {encabezado}

        {/* ---------- INTRO ---------- */}
        {fase === "intro" && (
          <div className="bg-white rounded-[18px] p-6 md:p-10 shadow-[0_1px_3px_rgba(22,33,92,0.06)] text-center">
            <div className="w-[62px] h-[62px] rounded-full bg-[var(--blue-light)] flex items-center justify-center mx-auto mb-5">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" />
              </svg>
            </div>
            <h2 className="text-[19px] md:text-[22px] font-bold text-[var(--navy)] mb-2">Evaluación: Procedimientos ATC</h2>
            <p className="text-[13px] md:text-[13.5px] text-[var(--gray-400)] max-w-[440px] mx-auto mb-7">
              {TOTAL_PREGUNTAS_ATC} preguntas de opción múltiple sobre el procedimiento de Atención a Clientes: clientes y
              almacenes, validación de rutas, análisis de evidencias, rol de actividades y empate de evidencias con
              Khuene + Nagel y Geodis. Se mostrarán {PREGUNTAS_POR_PAGINA_ATC} preguntas por pantalla hasta cubrir todo el tema.
            </p>

            <div className="max-w-[320px] mx-auto text-left mb-5">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Nombre del evaluado</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Escribe el nombre completo"
                className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]"
                autoFocus
              />
            </div>

            <div className="max-w-[320px] mx-auto bg-[var(--gray-100)] rounded-xl px-5 py-3.5 mb-7 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-[var(--navy)]">Porcentaje de aciertos</span>
              <span className="text-[20px] font-bold text-[var(--blue)]">0%</span>
            </div>

            <button
              type="button"
              onClick={comenzar}
              disabled={!nombre.trim()}
              className="bg-[var(--navy)] text-white rounded-lg px-7 py-3 text-[13.5px] font-bold disabled:opacity-40"
            >
              Comenzar evaluación
            </button>
          </div>
        )}

        {/* ---------- EXAMEN ---------- */}
        {fase === "examen" && (
          <>
            <div className="mb-5">
              <div className="flex items-center justify-between text-[11.5px] text-[var(--gray-400)] mb-1.5">
                <span>
                  Página {pagina + 1} de {TOTAL_PAGINAS_ATC}
                </span>
                <span>
                  {contestadas} de {TOTAL_PREGUNTAS_ATC} respondidas
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--gray-200)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--blue)] rounded-full transition-all" style={{ width: `${progresoPct}%` }} />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {preguntasPagina.map((p) => (
                <div key={p.numero} className="bg-white rounded-[16px] p-5 md:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
                  <p className="text-[10.5px] uppercase tracking-wide text-[var(--blue)] font-bold mb-1.5">{p.seccion}</p>
                  <p className="text-[14px] md:text-[14.5px] font-semibold text-[var(--navy)] mb-4 leading-snug">
                    {p.numero}. {p.pregunta}
                  </p>
                  <div className="flex flex-col gap-2">
                    {LETRAS.map((letra) => {
                      const seleccionada = respuestas[p.numero] === letra;
                      return (
                        <button
                          key={letra}
                          type="button"
                          onClick={() => seleccionar(p.numero, letra)}
                          className={`text-left flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] transition-colors ${
                            seleccionada
                              ? "border-[var(--blue)] bg-[var(--blue-light)] text-[var(--navy)] font-semibold"
                              : "border-[var(--gray-200)] text-[var(--text)] hover:bg-[var(--gray-100)]"
                          }`}
                        >
                          <span
                            className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10.5px] font-bold ${
                              seleccionada ? "bg-[var(--blue)] border-[var(--blue)] text-white" : "border-[var(--gray-400)] text-[var(--gray-400)]"
                            }`}
                          >
                            {letra}
                          </span>
                          <span>{p.opciones[letra]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6">
              <button
                type="button"
                onClick={anterior}
                disabled={pagina === 0}
                className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold disabled:opacity-40"
              >
                Anterior
              </button>
              <button type="button" onClick={siguiente} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold">
                {esUltimaPagina ? "Finalizar evaluación" : "Siguiente"}
              </button>
            </div>
          </>
        )}

        {/* ---------- CONFIRMAR / RESUMEN FINAL ---------- */}
        {(fase === "confirmar" || fase === "enviando") && (
          <div className="bg-white rounded-[18px] p-6 md:p-10 shadow-[0_1px_3px_rgba(22,33,92,0.06)] text-center">
            <div className="w-[62px] h-[62px] rounded-full bg-[var(--blue-light)] flex items-center justify-center mx-auto mb-5">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <h2 className="text-[19px] md:text-[22px] font-bold text-[var(--navy)] mb-2">Evaluación completada</h2>
            <p className="text-[13px] text-[var(--gray-400)] mb-6">{nombre}</p>

            <div className="flex items-center justify-center gap-8 mb-7">
              <div>
                <p className="text-[26px] font-bold text-[var(--blue)] m-0">{aciertosPorcentaje}%</p>
                <p className="text-[11px] text-[var(--gray-400)] m-0">Aciertos</p>
              </div>
              <div>
                <p className="text-[26px] font-bold text-[var(--navy)] m-0">
                  {correctasHastaAhora}/{TOTAL_PREGUNTAS_ATC}
                </p>
                <p className="text-[11px] text-[var(--gray-400)] m-0">Respuestas correctas</p>
              </div>
              <div>
                <p className="text-[26px] font-bold text-[var(--navy)] m-0">{contestadas}</p>
                <p className="text-[11px] text-[var(--gray-400)] m-0">Preguntas respondidas</p>
              </div>
              <div>
                <p className="text-[26px] font-bold text-[var(--navy)] m-0">{formatoTiempo(tiempoFinalSeg)}</p>
                <p className="text-[11px] text-[var(--gray-400)] m-0">Tiempo</p>
              </div>
            </div>

            {contestadas < TOTAL_PREGUNTAS_ATC && (
              <p className="text-[12.5px] text-[var(--red)] mb-5">
                Faltan {TOTAL_PREGUNTAS_ATC - contestadas} preguntas sin responder. Se guardarán como incorrectas si finalizas ahora.
              </p>
            )}
            {error && <p className="text-[12.5px] text-[var(--red)] mb-5">{error}</p>}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setFase("examen")}
                disabled={enviando}
                className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold disabled:opacity-40"
              >
                Volver a revisar
              </button>
              <button
                type="button"
                onClick={finalizarYGuardar}
                disabled={enviando}
                className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold disabled:opacity-60"
              >
                {enviando ? "Guardando…" : "Confirmar y guardar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
