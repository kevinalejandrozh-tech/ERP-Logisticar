"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import {
  PREGUNTAS_ESTRATEGICAS,
  PREGUNTAS_CONOCIMIENTO,
  OPCIONES_VIVIENDA,
  OPCIONES_TIEMPO,
  OPCIONES_TRANSPORTE,
  VIDEO_MAX_BYTES,
  VIDEO_TAM_PARTE,
  type PreguntaOpcion,
} from "@/lib/evaluacionCandidatosData";

type Datos = {
  nombre: string;
  edad: string;
  telefono: string;
  domicilio_actual: string;
  tipo_vivienda: string;
  familiar: string;
  pago_vivienda: string;
  tiempo_domicilio_actual: string;
  domicilio_anterior: string;
  tiempo_domicilio_anterior: string;
  renta_anterior: string;
  tiene_transporte: string;
  tipo_transporte: string;
};
const DATOS_VACIOS: Datos = {
  nombre: "",
  edad: "",
  telefono: "",
  domicilio_actual: "",
  tipo_vivienda: "",
  familiar: "",
  pago_vivienda: "",
  tiempo_domicilio_actual: "",
  domicilio_anterior: "",
  tiempo_domicilio_anterior: "",
  renta_anterior: "",
  tiene_transporte: "",
  tipo_transporte: "",
};

const SECCIONES = ["Conozcámonos", "Tu forma de trabajar", "Rutas y manejo"];
const inputCls = "w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] bg-white";
const labelCls = "block text-[13px] font-bold text-[var(--navy)] mb-1.5";

const leerComoBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("No se pudo leer el video."));
    r.readAsDataURL(file);
  });

export default function FormularioEvaluacionPage() {
  const [puesto, setPuesto] = useState("");
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [video, setVideo] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progresoVideo, setProgresoVideo] = useState("");
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    setPuesto(new URLSearchParams(window.location.search).get("puesto") || "");
  }, []);

  const set = (campo: keyof Datos, valor: string) => setDatos((d) => ({ ...d, [campo]: valor }));
  const esFamiliar = datos.tipo_vivienda === OPCIONES_VIVIENDA[2];

  const elegirVideo = (f: File | null) => {
    setError("");
    if (!f) return setVideo(null);
    if (f.type !== "video/mp4" && !f.name.toLowerCase().endsWith(".mp4")) return setError("El video debe estar en formato MP4.");
    if (f.size > VIDEO_MAX_BYTES) return setError(`El video pesa ${(f.size / 1048576).toFixed(1)} MB; el máximo es ${VIDEO_MAX_BYTES / 1048576} MB.`);
    setVideo(f);
  };

  const validarPaso = (): string => {
    if (paso === 0) {
      if (!datos.nombre.trim()) return "Por favor escribe tu nombre completo.";
      const edad = Number(datos.edad);
      if (!Number.isInteger(edad) || edad < 16 || edad > 99) return "Por favor escribe una edad válida.";
      if (!datos.domicilio_actual.trim()) return "Por favor escribe tu domicilio actual.";
      if (!datos.tipo_vivienda) return "Cuéntanos si rentas, es propia o vives con un familiar.";
      if (esFamiliar && !datos.familiar.trim()) return "Cuéntanos con qué familiar vives.";
      if (!datos.pago_vivienda.trim()) return "Indica cuánto pagas de renta o con cuánto apoyas (puedes escribir 0).";
      if (!datos.tiempo_domicilio_actual) return "Indica cuánto tiempo llevas en tu domicilio actual.";
      if (!datos.tiene_transporte) return "Indica si cuentas con medio de transporte.";
      if (datos.tiene_transporte === "Sí" && !datos.tipo_transporte) return "Indica qué tipo de transporte tienes.";
      return "";
    }
    const lista = paso === 1 ? PREGUNTAS_ESTRATEGICAS : PREGUNTAS_CONOCIMIENTO;
    const faltan = lista.filter((p) => respuestas[p.id] === undefined).length;
    return faltan ? `Te falta responder ${faltan} pregunta(s) de esta sección.` : "";
  };

  const siguiente = () => {
    const e = validarPaso();
    setError(e);
    if (e) return;
    setPaso((p) => p + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const anterior = () => {
    setError("");
    setPaso((p) => p - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const enviar = async () => {
    const e = validarPaso();
    setError(e);
    if (e) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/evaluacion-candidatos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puesto, datos, respuestas }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo enviar la evaluación.");

      if (video) {
        const b64 = await leerComoBase64(video);
        const total = Math.ceil(b64.length / VIDEO_TAM_PARTE);
        for (let i = 0; i < total; i++) {
          setProgresoVideo(`Subiendo video ${Math.round(((i + 1) / total) * 100)}%`);
          const rv = await fetch("/api/evaluacion-candidatos/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: d.id, indice: i, total, nombre: video.name, contenido: b64.slice(i * VIDEO_TAM_PARTE, (i + 1) * VIDEO_TAM_PARTE) }),
          });
          if (!rv.ok) {
            const dv = await rv.json().catch(() => ({}));
            throw new Error(`La evaluación se guardó, pero el video no se pudo subir: ${dv.error || "error de red"}.`);
          }
        }
      }
      setEnviado(true);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setError(err.message || "No se pudo enviar la evaluación.");
    } finally {
      setEnviando(false);
      setProgresoVideo("");
    }
  };

  const reiniciar = () => {
    setDatos(DATOS_VACIOS);
    setRespuestas({});
    setVideo(null);
    setPaso(0);
    setEnviado(false);
    setError("");
  };

  const renderPreguntas = (lista: PreguntaOpcion[], offset: number) =>
    lista.map((p, n) => (
      <div key={p.id} className="border border-[var(--gray-200)] rounded-xl p-4 md:p-5">
        <p className="text-[13.5px] font-bold text-[var(--navy)] mb-3">
          {offset + n + 1}. {p.texto}
        </p>
        <div className="grid gap-2">
          {p.opciones.map((op, i) => {
            const activo = respuestas[p.id] === i;
            return (
              <label
                key={i}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] cursor-pointer ${activo ? "border-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--gray-200)] bg-white"}`}
              >
                <input type="radio" name={p.id} checked={activo} onChange={() => setRespuestas((r) => ({ ...r, [p.id]: i }))} className="mt-0.5" />
                <span>{op}</span>
              </label>
            );
          })}
        </div>
      </div>
    ));

  const icono = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#eef1f6] pb-12">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10">
        <PageHeader titulo="Evaluación de candidatos" subtitulo={puesto ? `Puesto: ${puesto}` : "Selecciona un puesto desde Personas."} backHref="/personas" backLabel="Personas" icono={icono} />

        {!puesto ? (
          <div className="bg-white rounded-[18px] p-6 text-[13.5px]">
            No se indicó el puesto. <Link href="/personas" className="text-[var(--blue)] font-bold">Regresa a Personas</Link> y elige un puesto en “Evaluación Candidatos”.
          </div>
        ) : enviado ? (
          <div className="bg-white rounded-[18px] p-8 text-center shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="w-14 h-14 rounded-full bg-[#e3f6ec] mx-auto flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#21a866" strokeWidth="2.6"><path d="M5 12l5 5 9-10" /></svg>
            </div>
            <h2 className="text-[18px] font-bold text-[var(--navy)] mb-2">¡Gracias, {datos.nombre.split(" ")[0]}!</h2>
            <p className="text-[13.5px] text-[var(--gray-400)] mb-6">Tu evaluación se envió correctamente. Nuestro equipo la revisará y se pondrá en contacto contigo.</p>
            <div className="flex gap-2.5 justify-center flex-wrap">
              <button type="button" onClick={reiniciar} className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Nueva evaluación
              </button>
              <Link href="/personas/evaluaciones-candidatos" className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Ver evaluaciones enviadas
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            {/* Progreso */}
            <div className="flex gap-2 mb-2">
              {SECCIONES.map((s, i) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= paso ? "bg-[var(--blue)]" : "bg-[var(--gray-200)]"}`} />
              ))}
            </div>
            <p className="text-[12px] text-[var(--gray-400)] mb-5">
              Sección {paso + 1} de {SECCIONES.length} · <b className="text-[var(--navy)]">{SECCIONES[paso]}</b>
            </p>

            {paso === 0 && (
              <div className="grid gap-4">
                <div className="bg-[var(--blue-light)] rounded-xl p-4 text-[13px] text-[var(--navy)]">
                  ¡Bienvenido(a)! Gracias por tu interés en formar parte de <b>Transportes Logisticar</b>. Estas preguntas nos ayudan a conocerte mejor; no hay
                  respuestas buenas ni malas en tus datos personales, solo responde con sinceridad. Tu información se maneja de forma confidencial.
                </div>

                <div>
                  <label className={labelCls}>Si lo deseas, comparte un video de presentación (opcional)</label>
                  <p className="text-[12px] text-[var(--gray-400)] mb-2">Cuéntanos quién eres y por qué te interesa el puesto. Formato MP4, máximo {VIDEO_MAX_BYTES / 1048576} MB.</p>
                  <input type="file" accept="video/mp4,.mp4" onChange={(e) => elegirVideo(e.target.files?.[0] || null)} className="text-[13px]" />
                  {video && <p className="text-[12px] text-[var(--green)] mt-1.5">✓ {video.name} ({(video.size / 1048576).toFixed(1)} MB)</p>}
                </div>

                <div className="grid sm:grid-cols-[1fr_140px] gap-4">
                  <div>
                    <label className={labelCls}>¿Cuál es tu nombre completo?</label>
                    <input className={inputCls} value={datos.nombre} onChange={(e) => set("nombre", e.target.value)} maxLength={150} />
                  </div>
                  <div>
                    <label className={labelCls}>¿Qué edad tienes?</label>
                    <input className={inputCls} type="number" min={16} max={99} value={datos.edad} onChange={(e) => set("edad", e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>¿A qué número podemos contactarte? (opcional)</label>
                  <input className={inputCls} type="tel" value={datos.telefono} onChange={(e) => set("telefono", e.target.value)} maxLength={30} />
                </div>

                <div>
                  <label className={labelCls}>¿Cuál es tu domicilio actual?</label>
                  <textarea className={inputCls} rows={2} value={datos.domicilio_actual} onChange={(e) => set("domicilio_actual", e.target.value)} maxLength={300} placeholder="Calle, número, colonia, municipio" />
                </div>

                <div>
                  <label className={labelCls}>Tu domicilio actual: ¿rentas, es propio o vives con un familiar?</label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {OPCIONES_VIVIENDA.map((op) => (
                      <label key={op} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] cursor-pointer ${datos.tipo_vivienda === op ? "border-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--gray-200)]"}`}>
                        <input type="radio" name="vivienda" checked={datos.tipo_vivienda === op} onChange={() => set("tipo_vivienda", op)} />
                        {op}
                      </label>
                    ))}
                  </div>
                </div>

                {esFamiliar && (
                  <div>
                    <label className={labelCls}>¿Con qué familiar vives o de quién es el domicilio?</label>
                    <input className={inputCls} value={datos.familiar} onChange={(e) => set("familiar", e.target.value)} maxLength={150} placeholder="Ej. Mis papás, mi tía Rosa…" />
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Cuánto pagas de renta o con cuánto apoyas económicamente en casa?</label>
                    <input className={inputCls} value={datos.pago_vivienda} onChange={(e) => set("pago_vivienda", e.target.value)} maxLength={60} placeholder="$ mensual" />
                  </div>
                  <div>
                    <label className={labelCls}>¿Cuánto tiempo llevas viviendo en tu domicilio actual?</label>
                    <select className={inputCls} value={datos.tiempo_domicilio_actual} onChange={(e) => set("tiempo_domicilio_actual", e.target.value)}>
                      <option value="">Selecciona…</option>
                      {OPCIONES_TIEMPO.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>¿Cuál era la dirección de tu domicilio anterior?</label>
                  <textarea className={inputCls} rows={2} value={datos.domicilio_anterior} onChange={(e) => set("domicilio_anterior", e.target.value)} maxLength={300} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Cuánto tiempo viviste en tu domicilio anterior?</label>
                    <select className={inputCls} value={datos.tiempo_domicilio_anterior} onChange={(e) => set("tiempo_domicilio_anterior", e.target.value)}>
                      <option value="">Selecciona…</option>
                      {OPCIONES_TIEMPO.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>¿Cuánto pagabas de renta ahí?</label>
                    <input className={inputCls} value={datos.renta_anterior} onChange={(e) => set("renta_anterior", e.target.value)} maxLength={60} placeholder="$ mensual (0 si no pagabas)" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Cuentas con medio de transporte?</label>
                    <div className="flex gap-2">
                      {["Sí", "No"].map((op) => (
                        <label key={op} className={`flex-1 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] cursor-pointer ${datos.tiene_transporte === op ? "border-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--gray-200)]"}`}>
                          <input
                            type="radio"
                            name="transporte"
                            checked={datos.tiene_transporte === op}
                            onChange={() => setDatos((d) => ({ ...d, tiene_transporte: op, tipo_transporte: op === "No" ? "" : d.tipo_transporte }))}
                          />
                          {op}
                        </label>
                      ))}
                    </div>
                  </div>
                  {datos.tiene_transporte === "Sí" && (
                    <div>
                      <label className={labelCls}>¿Qué tipo de transporte tienes?</label>
                      <select className={inputCls} value={datos.tipo_transporte} onChange={(e) => set("tipo_transporte", e.target.value)}>
                        <option value="">Selecciona…</option>
                        {OPCIONES_TRANSPORTE.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {paso === 1 && (
              <div className="grid gap-3.5">
                <div className="bg-[var(--blue-light)] rounded-xl p-4 text-[13px] text-[var(--navy)]">
                  Somos una empresa en crecimiento y queremos conocer cómo te desenvuelves en el día a día. Elige la opción que más se parezca a lo que harías.
                </div>
                {renderPreguntas(PREGUNTAS_ESTRATEGICAS, 0)}
              </div>
            )}

            {paso === 2 && (
              <div className="grid gap-3.5">
                <div className="bg-[var(--blue-light)] rounded-xl p-4 text-[13px] text-[var(--navy)]">
                  ¡Ya casi terminamos! Estas preguntas son sobre rutas, casetas y manejo defensivo.
                </div>
                {renderPreguntas(PREGUNTAS_CONOCIMIENTO, PREGUNTAS_ESTRATEGICAS.length)}
              </div>
            )}

            {error && <p className="text-[13px] text-[var(--red)] font-semibold mt-5">{error}</p>}
            {progresoVideo && <p className="text-[13px] text-[var(--blue)] font-semibold mt-3">{progresoVideo}</p>}

            <div className="flex gap-2.5 justify-between mt-6">
              {paso > 0 ? (
                <button type="button" onClick={anterior} disabled={enviando} className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  Retroceder
                </button>
              ) : (
                <span />
              )}
              {paso < SECCIONES.length - 1 ? (
                <button type="button" onClick={siguiente} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold">
                  Siguiente
                </button>
              ) : (
                <button type="button" onClick={enviar} disabled={enviando} className="bg-[var(--green)] disabled:opacity-60 text-white rounded-lg px-6 py-2.5 text-[13px] font-bold">
                  {enviando ? "Enviando…" : "Enviar evaluación"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
