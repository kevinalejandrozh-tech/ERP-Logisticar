"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";

type OpcionLetra = "A" | "B" | "C" | "D";
const LETRAS: OpcionLetra[] = ["A", "B", "C", "D"];
const PREGUNTAS_POR_PAGINA = 5;

type Pregunta = { pregunta: string; opciones: Record<OpcionLetra, string>; correcta: OpcionLetra };
type Capacitacion = { id: number; titulo: string; descripcion: string | null; preguntas: Pregunta[] };

type Fase = "cargando" | "error" | "intro" | "examen" | "confirmar" | "enviando";

function formatoTiempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")} min`;
}

export default function TomarCapacitacionPage() {
  const router = useRouter();
  const [cap, setCap] = useState<Capacitacion | null>(null);
  const [fase, setFase] = useState<Fase>("cargando");
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState("");
  const [respuestas, setRespuestas] = useState<Record<number, OpcionLetra>>({});
  const [pagina, setPagina] = useState(0);
  const [inicio, setInicio] = useState<number | null>(null);
  const [tiempoFinalSeg, setTiempoFinalSeg] = useState(0);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setError("Falta el identificador de la capacitación.");
      setFase("error");
      return;
    }
    fetch(`/api/capacitaciones/catalogo/get?id=${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "No se encontró la capacitación.");
        if (!data.registro.preguntas || data.registro.preguntas.length === 0) {
          throw new Error("Esta capacitación todavía no tiene preguntas.");
        }
        setCap(data.registro);
        setFase("intro");
      })
      .catch((err) => {
        setError(err.message || "No se encontró la capacitación.");
        setFase("error");
      });
  }, []);

  const totalPreguntas = cap?.preguntas.length || 0;
  const totalPaginas = Math.ceil(totalPreguntas / PREGUNTAS_POR_PAGINA);
  const contestadas = Object.keys(respuestas).length;
  const correctasHastaAhora = useMemo(
    () => (cap ? cap.preguntas.filter((p, i) => respuestas[i] === p.correcta).length : 0),
    [respuestas, cap]
  );
  const aciertosPorcentaje = totalPreguntas > 0 ? Math.round((correctasHastaAhora / totalPreguntas) * 100) : 0;
  const preguntasPagina = cap ? cap.preguntas.slice(pagina * PREGUNTAS_POR_PAGINA, pagina * PREGUNTAS_POR_PAGINA + PREGUNTAS_POR_PAGINA) : [];
  const esUltimaPagina = pagina === totalPaginas - 1;
  const progresoPct = totalPaginas > 0 ? Math.round(((pagina + 1) / totalPaginas) * 100) : 0;

  const comenzar = () => {
    if (!nombre.trim()) return;
    setInicio(Date.now());
    setPagina(0);
    setFase("examen");
  };

  const seleccionar = (idx: number, letra: OpcionLetra) => {
    setRespuestas((prev) => {
      if (prev[idx]) return prev; // ya respondida: no se puede editar
      return { ...prev, [idx]: letra };
    });
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
    if (!cap) return;
    setEnviando(true);
    setError("");
    const respuestasDetalle = cap.preguntas.map((p, idx) => {
      const seleccionada = respuestas[idx] ?? null;
      return {
        numero: idx + 1,
        pregunta: p.pregunta,
        opciones: p.opciones,
        seleccionada,
        correcta: p.correcta,
        esCorrecta: seleccionada === p.correcta,
      };
    });
    const correctas = respuestasDetalle.filter((r) => r.esCorrecta).length;
    const aciertos = Math.round((correctas / totalPreguntas) * 100);

    try {
      const res = await fetch("/api/capacitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacitacion: cap.titulo,
          nombre: nombre.trim(),
          totalPreguntas,
          correctas,
          aciertos,
          tiempoEvaluacion: tiempoFinalSeg,
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

  const encabezado = (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
      <div className="flex items-center gap-2.5">
        <Logo size={34} />
        <div>
          <h1 className="font-display text-[15px] md:text-[17px] font-bold text-[var(--navy)] m-0">{cap?.titulo || "Capacitación"}</h1>
          <p className="text-[11px] md:text-[12px] text-[var(--gray-400)] m-0">Evaluación de conocimientos</p>
        </div>
      </div>
      {fase !== "intro" && fase !== "cargando" && fase !== "error" && (
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

        {fase === "cargando" && <p className="text-center text-[var(--gray-400)] text-[13px] py-16">Cargando...</p>}
        {fase === "error" && <p className="text-center text-[var(--red)] text-[13px] py-16">{error}</p>}

        {fase === "intro" && cap && (
          <div className="bg-white rounded-[18px] p-6 md:p-10 shadow-[0_1px_3px_rgba(22,33,92,0.06)] text-center">
            <div className="w-[62px] h-[62px] rounded-full bg-[var(--blue-light)] flex items-center justify-center mx-auto mb-5">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" />
              </svg>
            </div>
            <h2 className="text-[19px] md:text-[22px] font-bold text-[var(--navy)] mb-2">Evaluación: {cap.titulo}</h2>
            <p className="text-[13px] md:text-[13.5px] text-[var(--gray-400)] max-w-[440px] mx-auto mb-7">
              {cap.descripcion ? `${cap.descripcion} ` : ""}
              {totalPreguntas} preguntas de opción múltiple. Se mostrarán {PREGUNTAS_POR_PAGINA} preguntas por pantalla hasta cubrir todo el tema.
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

        {fase === "examen" && cap && (
          <>
            <div className="mb-5">
              <div className="flex items-center justify-between text-[11.5px] text-[var(--gray-400)] mb-1.5">
                <span>
                  Página {pagina + 1} de {totalPaginas}
                </span>
                <span>
                  {contestadas} de {totalPreguntas} respondidas
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--gray-200)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--blue)] rounded-full transition-all" style={{ width: `${progresoPct}%` }} />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {preguntasPagina.map((p, iLocal) => {
                const idx = pagina * PREGUNTAS_POR_PAGINA + iLocal;
                return (
                  <div key={idx} className="bg-white rounded-[16px] p-5 md:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
                    <p className="text-[14px] md:text-[14.5px] font-semibold text-[var(--navy)] mb-4 leading-snug">
                      {idx + 1}. {p.pregunta}
                    </p>
                    <div className="flex flex-col gap-2">
                      {LETRAS.map((letra) => {
                        const yaRespondida = respuestas[idx] !== undefined;
                        const seleccionada = respuestas[idx] === letra;
                        const esLaCorrecta = letra === p.correcta;
                        let estiloBoton = "border-[var(--gray-200)] text-[var(--text)] hover:bg-[var(--gray-100)]";
                        let estiloCirculo = "border-[var(--gray-400)] text-[var(--gray-400)]";
                        if (yaRespondida) {
                          if (seleccionada && esLaCorrecta) {
                            estiloBoton = "border-[var(--green)] bg-[rgba(33,168,102,0.14)] text-[var(--navy)] font-semibold";
                            estiloCirculo = "bg-[var(--green)] border-[var(--green)] text-white";
                          } else if (seleccionada && !esLaCorrecta) {
                            estiloBoton = "border-[var(--red)] bg-[rgba(226,65,44,0.14)] text-[var(--navy)] font-semibold";
                            estiloCirculo = "bg-[var(--red)] border-[var(--red)] text-white";
                          } else if (!seleccionada && esLaCorrecta) {
                            estiloBoton = "border-[var(--green)] bg-[rgba(33,168,102,0.14)] text-[var(--navy)] font-semibold";
                            estiloCirculo = "bg-[var(--green)] border-[var(--green)] text-white";
                          } else {
                            estiloBoton = "border-[var(--gray-200)] text-[var(--gray-400)] opacity-60";
                          }
                        }
                        return (
                          <button
                            key={letra}
                            type="button"
                            onClick={() => seleccionar(idx, letra)}
                            disabled={yaRespondida}
                            className={`text-left flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] transition-colors ${estiloBoton} ${yaRespondida ? "cursor-default" : ""}`}
                          >
                            <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10.5px] font-bold ${estiloCirculo}`}>{letra}</span>
                            <span className="flex-1">{p.opciones[letra]}</span>
                            {yaRespondida && esLaCorrecta && <span className="shrink-0 text-[10.5px] font-bold text-[var(--green)] uppercase">Correcta</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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

        {(fase === "confirmar" || fase === "enviando") && cap && (
          <div className="bg-white rounded-[18px] p-6 md:p-10 shadow-[0_1px_3px_rgba(22,33,92,0.06)] text-center">
            <div className="w-[62px] h-[62px] rounded-full bg-[var(--blue-light)] flex items-center justify-center mx-auto mb-5">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <h2 className="text-[19px] md:text-[22px] font-bold text-[var(--navy)] mb-2">Evaluación completada</h2>
            <p className="text-[13px] text-[var(--gray-400)] mb-6">{nombre}</p>

            <div className="flex items-center justify-center gap-8 mb-7 flex-wrap">
              <div>
                <p className="text-[26px] font-bold text-[var(--blue)] m-0">{aciertosPorcentaje}%</p>
                <p className="text-[11px] text-[var(--gray-400)] m-0">Aciertos</p>
              </div>
              <div>
                <p className="text-[26px] font-bold text-[var(--navy)] m-0">
                  {correctasHastaAhora}/{totalPreguntas}
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

            {contestadas < totalPreguntas && (
              <p className="text-[12.5px] text-[var(--red)] mb-5">
                Faltan {totalPreguntas - contestadas} preguntas sin responder. Se guardarán como incorrectas si finalizas ahora.
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
