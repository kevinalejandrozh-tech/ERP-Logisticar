"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import {
  PREGUNTAS_ESTRATEGICAS,
  PREGUNTAS_CONOCIMIENTO,
  OPCIONES_VIVIENDA,
  OPCIONES_TIEMPO,
  OPCIONES_TRANSPORTE,
  OPCIONES_ESTADO_CIVIL,
  OPCIONES_LICENCIA,
  OPCIONES_UNIDAD,
  OPCIONES_RUTAS,
  OPCIONES_EMPLEOS,
  OPCIONES_PSICOFISICO,
  type PreguntaOpcion,
} from "@/lib/evaluacionCandidatosData";

// Página PÚBLICA: la abre el candidato desde el link o QR (sin cuenta).
// No muestra calificaciones ni enlaces a otras secciones del sistema.

const CAMPOS = [
  "nombre", "edad", "telefono", "estado_civil", "personas_vive", "dependientes", "otro_ingreso",
  "domicilio_actual", "tipo_vivienda", "familiar", "pago_vivienda", "tiempo_domicilio_actual",
  "domicilio_anterior", "tiempo_domicilio_anterior", "renta_anterior", "tiene_transporte", "tipo_transporte",
  "creditos", "creditos_detalle", "licencia_tipo", "licencia_vigencia", "psicofisico", "anios_experiencia",
  "ultimo_empleo", "tiempo_ultimo_empleo", "motivo_salida", "empleos_3_anios",
  "condicion_salud", "salud_detalle", "proceso_legal", "legal_detalle", "accidentes", "accidentes_detalle",
  "robo_ruta", "robo_detalle", "carta_antecedentes",
] as const;
type Campo = (typeof CAMPOS)[number];
type Datos = Record<Campo, string>;
const DATOS_VACIOS = Object.fromEntries(CAMPOS.map((c) => [c, ""])) as Datos;

const SECCIONES = ["Bienvenida", "Conozcámonos", "Tu experiencia", "Tu día a día", "Rutas"];
const inputCls = "w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] bg-white";
const labelCls = "block text-[13px] font-bold text-[var(--navy)] mb-1.5";
const chip = (activo: boolean) =>
  `flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] cursor-pointer ${activo ? "border-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--gray-200)] bg-white"}`;

export default function FormularioEvaluacionPage() {
  const [puesto, setPuesto] = useState("");
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [rutas, setRutas] = useState<string[]>([]);
  const [aceptaAviso, setAceptaAviso] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Video de inducción
  const [videoPartes, setVideoPartes] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoProgreso, setVideoProgreso] = useState<number | null>(null);

  useEffect(() => {
    setPuesto(new URLSearchParams(window.location.search).get("puesto") || "");
    fetch("/api/evaluacion-candidatos/induccion/ver", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setVideoPartes(d.partes || 0))
      .catch(() => {});
  }, []);

  const verVideo = async () => {
    setVideoProgreso(0);
    try {
      let b64 = "";
      for (let i = 0; i < videoPartes; i++) {
        const r = await fetch(`/api/evaluacion-candidatos/induccion/ver?parte=${i}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        b64 += d.contenido;
        setVideoProgreso(Math.round(((i + 1) / videoPartes) * 100));
      }
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      setVideoUrl(URL.createObjectURL(new Blob([bytes], { type: "video/mp4" })));
    } catch {
      setError("No se pudo cargar el video. Puedes continuar con el cuestionario.");
    } finally {
      setVideoProgreso(null);
    }
  };

  const set = (campo: Campo, valor: string) => setDatos((d) => ({ ...d, [campo]: valor }));
  const alternar = (lista: string[], setLista: (v: string[]) => void, v: string) => setLista(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  const esFamiliar = datos.tipo_vivienda === OPCIONES_VIVIENDA[2];
  const tieneLicencia = !!datos.licencia_tipo && datos.licencia_tipo !== "No tengo licencia";

  const siNo = (campo: Campo, onNo?: () => void) => (
    <div className="flex gap-2">
      {["Sí", "No"].map((op) => (
        <label key={op} className={`flex-1 ${chip(datos[campo] === op)}`}>
          <input
            type="radio"
            name={campo}
            checked={datos[campo] === op}
            onChange={() => {
              set(campo, op);
              if (op === "No" && onNo) onNo();
            }}
          />
          {op}
        </label>
      ))}
    </div>
  );

  const validarPaso = (): string => {
    const d = datos;
    if (paso === 0) return aceptaAviso ? "" : "Para continuar, confirma que leíste el aviso del proceso.";
    if (paso === 1) {
      if (!d.nombre.trim()) return "Por favor escribe tu nombre completo.";
      const edad = Number(d.edad);
      if (!Number.isInteger(edad) || edad < 16 || edad > 99) return "Por favor escribe una edad válida.";
      if (!d.estado_civil) return "Selecciona tu estado civil.";
      if (d.personas_vive === "" || d.dependientes === "") return "Cuéntanos con cuántas personas vives y cuántas dependen de ti.";
      if (!d.otro_ingreso) return "Cuéntanos si alguien más aporta al gasto de tu casa.";
      if (!d.domicilio_actual.trim()) return "Por favor escribe tu domicilio actual.";
      if (!d.tipo_vivienda) return "Cuéntanos si rentas, es propia o vives con un familiar.";
      if (esFamiliar && !d.familiar.trim()) return "Cuéntanos con qué familiar vives.";
      if (!d.pago_vivienda.trim()) return "Indica cuánto pagas de renta o con cuánto apoyas (puedes escribir 0).";
      if (!d.tiempo_domicilio_actual) return "Indica cuánto tiempo llevas en tu domicilio actual.";
      if (!d.tiempo_domicilio_anterior) return "Indica cuánto tiempo viviste en tu domicilio anterior.";
      if (!d.tiene_transporte) return "Indica si cuentas con medio de transporte.";
      if (d.tiene_transporte === "Sí" && !d.tipo_transporte) return "Indica qué tipo de transporte tienes.";
      if (!d.creditos) return "Indica si actualmente pagas algún crédito.";
      return "";
    }
    if (paso === 2) {
      if (!d.licencia_tipo) return "Indica qué licencia tienes.";
      if (tieneLicencia && !d.licencia_vigencia) return "Indica la fecha de vigencia de tu licencia.";
      if (!d.psicofisico) return "Indica si tienes examen psicofísico vigente.";
      if (d.anios_experiencia === "" || Number(d.anios_experiencia) < 0) return "Indica tus años de experiencia manejando.";
      if (!unidades.length) return "Selecciona al menos un tipo de unidad que hayas manejado.";
      if (!d.tiempo_ultimo_empleo || !d.empleos_3_anios) return "Completa la información de tu último empleo.";
      for (const c of ["condicion_salud", "proceso_legal", "accidentes", "robo_ruta", "carta_antecedentes"] as Campo[]) {
        if (!d[c]) return "Responde todas las preguntas de esta sección.";
      }
      return "";
    }
    const lista = paso === 3 ? PREGUNTAS_ESTRATEGICAS : PREGUNTAS_CONOCIMIENTO;
    const faltan = lista.filter((p) => respuestas[p.id] === undefined).length;
    return faltan ? `Te falta responder ${faltan} pregunta(s) de esta sección.` : "";
  };

  const mover = (delta: number) => {
    if (delta > 0) {
      const e = validarPaso();
      setError(e);
      if (e) return;
    } else setError("");
    setPaso((p) => p + delta);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const enviar = async () => {
    const e = validarPaso();
    setError(e);
    if (e) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/evaluacion-candidatos/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puesto, datos: { ...datos, unidades, rutas_conocidas: rutas, acepta_aviso: aceptaAviso }, respuestas }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo enviar.");
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setEnviado(true);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setError(err.message || "No se pudo enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const renderPreguntas = (lista: PreguntaOpcion[], offset: number) =>
    lista.map((p, n) => (
      <div key={p.id} className="border border-[var(--gray-200)] rounded-xl p-4 md:p-5">
        <p className="text-[13.5px] font-bold text-[var(--navy)] mb-3">
          {offset + n + 1}. {p.texto}
        </p>
        <div className="grid gap-2">
          {p.opciones.map((op, i) => (
            <label key={i} className={`${chip(respuestas[p.id] === i)} items-start`}>
              <input type="radio" name={p.id} checked={respuestas[p.id] === i} onChange={() => setRespuestas((r) => ({ ...r, [p.id]: i }))} className="mt-0.5" />
              <span>{op}</span>
            </label>
          ))}
        </div>
      </div>
    ));

  const nota = (texto: React.ReactNode) => <div className="bg-[var(--blue-light)] rounded-xl p-4 text-[13px] text-[var(--navy)]">{texto}</div>;

  return (
    <div className="min-h-screen bg-[#eef1f6] pb-12">
      <header className="bg-white border-b border-[var(--gray-200)] shadow-sm mb-6">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <Logo size={36} enlace={false} />
          <div>
            <h1 className="font-display text-[16px] sm:text-[18px] font-bold text-[var(--navy)] m-0">Transportes Logisticar</h1>
            <p className="text-[11.5px] sm:text-[12px] text-[var(--gray-400)] m-0">Proceso de selección{puesto ? ` · ${puesto}` : ""}</p>
          </div>
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-4 sm:px-6">
        {!puesto ? (
          <div className="bg-white rounded-[18px] p-6 text-[13.5px]">El enlace no es válido. Solicita nuevamente el link o código QR a la persona que te contactó.</div>
        ) : enviado ? (
          <div className="bg-white rounded-[18px] p-8 text-center shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="w-14 h-14 rounded-full bg-[#e3f6ec] mx-auto flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#21a866" strokeWidth="2.6"><path d="M5 12l5 5 9-10" /></svg>
            </div>
            <h2 className="text-[18px] font-bold text-[var(--navy)] mb-2">¡Gracias, {datos.nombre.split(" ")[0]}!</h2>
            <p className="text-[13.5px] text-[var(--gray-400)] m-0">Recibimos tu información correctamente. Nuestro equipo la revisará y se pondrá en contacto contigo para los siguientes pasos. Ya puedes cerrar esta ventana.</p>
          </div>
        ) : (
          <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="flex gap-1.5 mb-2">
              {SECCIONES.map((s, i) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= paso ? "bg-[var(--blue)]" : "bg-[var(--gray-200)]"}`} />
              ))}
            </div>
            <p className="text-[12px] text-[var(--gray-400)] mb-5">
              Paso {paso + 1} de {SECCIONES.length} · <b className="text-[var(--navy)]">{SECCIONES[paso]}</b>
            </p>

            {paso === 0 && (
              <div className="grid gap-4">
                {nota(
                  <>
                    ¡Bienvenido(a)! Gracias por tu interés en formar parte de <b>Transportes Logisticar</b>. Somos una empresa en crecimiento y nos gustaría conocerte: te tomará unos
                    15 minutos. Responde con calma y sinceridad; tu información se maneja de forma confidencial.
                  </>
                )}

                {videoPartes > 0 && (
                  <div>
                    <label className={labelCls}>Conoce nuestra empresa</label>
                    {videoUrl ? (
                      <video src={videoUrl} controls playsInline className="w-full max-h-[420px] rounded-lg bg-black" />
                    ) : (
                      <button type="button" onClick={verVideo} disabled={videoProgreso !== null} className="w-full border-2 border-dashed border-[var(--blue)] rounded-xl py-8 text-[14px] font-bold text-[var(--blue)] bg-[var(--blue-light)]">
                        {videoProgreso !== null ? `Cargando video… ${videoProgreso}%` : "▶  Ver video de bienvenida"}
                      </button>
                    )}
                  </div>
                )}

                <div className="border border-[#f2d49a] bg-[#fff8e8] rounded-xl p-4 text-[13px] text-[var(--text)]">
                  <p className="font-bold text-[var(--navy)] m-0 mb-1.5">Aviso importante del proceso</p>
                  <p className="m-0 mb-1.5">
                    Como parte del proceso de contratación se realizará una <b>prueba antidoping</b> y una <b>evaluación médica</b>. Ambas son <b>pagadas por la empresa</b>, sin costo
                    para ti.
                  </p>
                  <p className="m-0">Toda la información que compartas será verificada y tratada de manera confidencial, únicamente para fines del proceso de selección.</p>
                  <label className="flex items-center gap-2 mt-3 font-semibold cursor-pointer">
                    <input type="checkbox" checked={aceptaAviso} onChange={(e) => setAceptaAviso(e.target.checked)} />
                    He leído el aviso y estoy de acuerdo.
                  </label>
                </div>
              </div>
            )}

            {paso === 1 && (
              <div className="grid gap-4">
                <div className="grid sm:grid-cols-[1fr_130px] gap-4">
                  <div>
                    <label className={labelCls}>¿Cuál es tu nombre completo?</label>
                    <input className={inputCls} value={datos.nombre} onChange={(e) => set("nombre", e.target.value)} maxLength={150} />
                  </div>
                  <div>
                    <label className={labelCls}>¿Qué edad tienes?</label>
                    <input className={inputCls} type="number" min={16} max={99} value={datos.edad} onChange={(e) => set("edad", e.target.value)} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿A qué número podemos contactarte?</label>
                    <input className={inputCls} type="tel" value={datos.telefono} onChange={(e) => set("telefono", e.target.value)} maxLength={30} />
                  </div>
                  <div>
                    <label className={labelCls}>Estado civil</label>
                    <select className={inputCls} value={datos.estado_civil} onChange={(e) => set("estado_civil", e.target.value)}>
                      <option value="">Selecciona…</option>
                      {OPCIONES_ESTADO_CIVIL.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>¿Con cuántas personas vives?</label>
                    <input className={inputCls} type="number" min={0} max={30} value={datos.personas_vive} onChange={(e) => set("personas_vive", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>¿Cuántas dependen de ti?</label>
                    <input className={inputCls} type="number" min={0} max={30} value={datos.dependientes} onChange={(e) => set("dependientes", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>¿Alguien más aporta en casa?</label>
                    {siNo("otro_ingreso")}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>¿Cuál es tu domicilio actual?</label>
                  <textarea className={inputCls} rows={2} value={datos.domicilio_actual} onChange={(e) => set("domicilio_actual", e.target.value)} maxLength={300} placeholder="Calle, número, colonia, municipio" />
                </div>
                <div>
                  <label className={labelCls}>En tu domicilio actual, ¿rentas, es propio o vives con un familiar?</label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {OPCIONES_VIVIENDA.map((op) => (
                      <label key={op} className={chip(datos.tipo_vivienda === op)}>
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
                    <label className={labelCls}>¿Cuánto pagas de renta o con cuánto apoyas en casa al mes?</label>
                    <input className={inputCls} value={datos.pago_vivienda} onChange={(e) => set("pago_vivienda", e.target.value)} maxLength={60} placeholder="$ mensual" />
                  </div>
                  <div>
                    <label className={labelCls}>¿Cuánto tiempo llevas viviendo ahí?</label>
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
                    <label className={labelCls}>¿Cuánto tiempo viviste ahí?</label>
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
                    <label className={labelCls}>¿Cuentas con medio de transporte propio?</label>
                    {siNo("tiene_transporte", () => set("tipo_transporte", ""))}
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
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Actualmente pagas algún crédito? (Infonavit, auto, tienda, préstamo…)</label>
                    {siNo("creditos", () => set("creditos_detalle", ""))}
                  </div>
                  {datos.creditos === "Sí" && (
                    <div>
                      <label className={labelCls}>¿Cuál y cuánto pagas al mes aproximadamente?</label>
                      <input className={inputCls} value={datos.creditos_detalle} onChange={(e) => set("creditos_detalle", e.target.value)} maxLength={200} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {paso === 2 && (
              <div className="grid gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Qué licencia de conducir tienes?</label>
                    <select className={inputCls} value={datos.licencia_tipo} onChange={(e) => set("licencia_tipo", e.target.value)}>
                      <option value="">Selecciona…</option>
                      {OPCIONES_LICENCIA.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  {tieneLicencia && (
                    <div>
                      <label className={labelCls}>¿Hasta cuándo está vigente?</label>
                      <input className={inputCls} type="date" value={datos.licencia_vigencia} onChange={(e) => set("licencia_vigencia", e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Tienes examen psicofísico (apto médico)?</label>
                    <select className={inputCls} value={datos.psicofisico} onChange={(e) => set("psicofisico", e.target.value)}>
                      <option value="">Selecciona…</option>
                      {OPCIONES_PSICOFISICO.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>¿Cuántos años de experiencia tienes manejando unidades?</label>
                    <input className={inputCls} type="number" min={0} max={60} value={datos.anios_experiencia} onChange={(e) => set("anios_experiencia", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>¿Qué tipo de unidades has manejado? (puedes elegir varias)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OPCIONES_UNIDAD.map((o) => (
                      <label key={o} className={chip(unidades.includes(o))}>
                        <input type="checkbox" checked={unidades.includes(o)} onChange={() => alternar(unidades, setUnidades, o)} />
                        {o}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>¿Qué rutas has recorrido? (opcional)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OPCIONES_RUTAS.map((o) => (
                      <label key={o} className={chip(rutas.includes(o))}>
                        <input type="checkbox" checked={rutas.includes(o)} onChange={() => alternar(rutas, setRutas, o)} />
                        {o}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿En qué empresa fue tu último empleo?</label>
                    <input className={inputCls} value={datos.ultimo_empleo} onChange={(e) => set("ultimo_empleo", e.target.value)} maxLength={150} />
                  </div>
                  <div>
                    <label className={labelCls}>¿Cuánto tiempo estuviste ahí?</label>
                    <select className={inputCls} value={datos.tiempo_ultimo_empleo} onChange={(e) => set("tiempo_ultimo_empleo", e.target.value)}>
                      <option value="">Selecciona…</option>
                      {OPCIONES_TIEMPO.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-[1fr_200px] gap-4">
                  <div>
                    <label className={labelCls}>¿Qué te hizo buscar un nuevo empleo?</label>
                    <input className={inputCls} value={datos.motivo_salida} onChange={(e) => set("motivo_salida", e.target.value)} maxLength={300} />
                  </div>
                  <div>
                    <label className={labelCls}>Empleos en los últimos 3 años</label>
                    <select className={inputCls} value={datos.empleos_3_anios} onChange={(e) => set("empleos_3_anios", e.target.value)}>
                      <option value="">Selecciona…</option>
                      {OPCIONES_EMPLEOS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                {nota("Para cuidar tu seguridad y la de todos en carretera, nos gustaría saber lo siguiente:")}
                {(
                  [
                    ["condicion_salud", "salud_detalle", "¿Tienes alguna condición de salud que requiera tratamiento o que debamos tomar en cuenta al asignarte viajes?", "¿Cuál?"],
                    ["proceso_legal", "legal_detalle", "¿Tienes algún asunto legal o trámite pendiente ante alguna autoridad?", "Cuéntanos brevemente"],
                    ["accidentes", "accidentes_detalle", "¿Has estado involucrado en algún accidente o percance vial en los últimos 3 años?", "¿Qué ocurrió?"],
                    ["robo_ruta", "robo_detalle", "¿Te ha tocado vivir un robo o intento de robo en ruta?", "¿Cómo lo manejaste?"],
                  ] as [Campo, Campo, string, string][]
                ).map(([campo, detalle, pregunta, ph]) => (
                  <div key={campo} className="grid sm:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className={labelCls}>{pregunta}</label>
                      {siNo(campo, () => set(detalle, ""))}
                    </div>
                    {datos[campo] === "Sí" && <input className={inputCls} value={datos[detalle]} onChange={(e) => set(detalle, e.target.value)} maxLength={300} placeholder={ph} />}
                  </div>
                ))}
                <div className="sm:w-1/2">
                  <label className={labelCls}>Si te la solicitamos, ¿podrías tramitar tu carta de no antecedentes penales?</label>
                  {siNo("carta_antecedentes")}
                </div>
              </div>
            )}

            {paso === 3 && (
              <div className="grid gap-3.5">
                {nota("Ahora cuéntanos cómo sueles actuar en tu día a día. Elige la opción que más se parezca a lo que harías; no hay una sola forma de trabajar.")}
                {renderPreguntas(PREGUNTAS_ESTRATEGICAS, 0)}
              </div>
            )}

            {paso === 4 && (
              <div className="grid gap-3.5">
                {nota("¡Último paso! Algunas preguntas sobre las rutas en las que trabajamos y tu experiencia al volante.")}
                {renderPreguntas(PREGUNTAS_CONOCIMIENTO, PREGUNTAS_ESTRATEGICAS.length)}
              </div>
            )}

            {error && <p className="text-[13px] text-[var(--red)] font-semibold mt-5">{error}</p>}

            <div className="flex gap-2.5 justify-between mt-6">
              {paso > 0 ? (
                <button type="button" onClick={() => mover(-1)} disabled={enviando} className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  Retroceder
                </button>
              ) : (
                <span />
              )}
              {paso < SECCIONES.length - 1 ? (
                <button type="button" onClick={() => mover(1)} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold">
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
