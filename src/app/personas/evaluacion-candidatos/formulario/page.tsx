"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import {
  PREGUNTAS_ESTRATEGICAS,
  PREGUNTAS_CONOCIMIENTO,
  PREGUNTAS_MECANICA,
  OPCIONES_VIVIENDA,
  OPCIONES_TIEMPO,
  OPCIONES_TRANSPORTE,
  OPCIONES_ESTADO_CIVIL,
  OPCIONES_LICENCIA,
  OPCIONES_UNIDAD,
  OPCIONES_RUTAS,
  OPCIONES_PSICOFISICO,
  OPCIONES_CREDITO,
  OPCIONES_ESCOLARIDAD,
  OPCIONES_MODUS,
  type PreguntaOpcion,
} from "@/lib/evaluacionCandidatosData";

// Página PÚBLICA: la abre el candidato desde el link o QR (sin cuenta).
// No muestra calificaciones ni enlaces a otras secciones del sistema.

const CAMPOS = [
  "nombre", "edad", "telefono", "correo", "fecha_nacimiento", "lugar_nacimiento", "escolaridad", "estado_civil", "hijos",
  "personas_vive", "dependientes", "otro_ingreso",
  "calle_numero", "colonia", "municipio", "estado", "cp", "tipo_vivienda", "familiar", "pago_vivienda", "tiempo_domicilio_actual",
  "domicilio_anterior", "tiempo_domicilio_anterior", "renta_anterior",
  "tiene_transporte", "tipo_transporte", "vehiculo_modelo", "vehiculo_valor", "vehiculo_pagado",
  "gastos_mensuales", "sueldo_esperado", "traslado", "creditos",
  "primer_empleo", "autoriza_referencias",
  "licencia_tipo", "licencia_vigencia", "psicofisico", "anios_experiencia",
  "condicion_salud", "salud_detalle", "proceso_legal", "legal_detalle", "accidentes", "accidentes_detalle",
  "robo_ruta", "robo_veces", "robo_fecha_lugar", "robo_modus", "robo_relato", "robo_observacion", "robo_reaccion", "robo_aviso",
  "carta_antecedentes",
] as const;
type Campo = (typeof CAMPOS)[number];
type Datos = Record<Campo, string>;
const DATOS_VACIOS = Object.fromEntries(CAMPOS.map((c) => [c, ""])) as Datos;

type Empleo = { empresa: string; direccion: string; puesto: string; inicio: string; fin: string; actual: boolean; sueldo: string; motivo: string; ref_nombre: string; ref_telefono: string };
const EMPLEO_VACIO: Empleo = { empresa: "", direccion: "", puesto: "", inicio: "", fin: "", actual: false, sueldo: "", motivo: "", ref_nombre: "", ref_telefono: "" };
type Credito = { tipo: string; pago_mensual: string; saldo: string };

const SECCIONES = ["Bienvenida", "Conozcámonos", "Experiencia laboral", "Licencia y salud", "Tu día a día", "Mecánica", "Rutas"];
const inputCls = "w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] bg-white";
const labelCls = "block text-[13px] font-bold text-[var(--navy)] mb-1.5";
const chip = (activo: boolean) =>
  `flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] cursor-pointer ${activo ? "border-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--gray-200)] bg-white"}`;

// Reduce la foto a ~480 px en JPEG para que viaje ligera.
const comprimirFoto = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => reject(new Error("No se pudo leer la foto."));
    img.src = url;
  });

export default function FormularioEvaluacionPage() {
  const [puesto, setPuesto] = useState("");
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [rutas, setRutas] = useState<string[]>([]);
  const [empleos, setEmpleos] = useState<Empleo[]>([{ ...EMPLEO_VACIO }]);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [foto, setFoto] = useState<string | null>(null);
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
  const setEmpleo = (i: number, cambios: Partial<Empleo>) => setEmpleos((l) => l.map((e, n) => (n === i ? { ...e, ...cambios } : e)));
  const alternarCredito = (tipo: string) =>
    setCreditos((l) => (l.some((c) => c.tipo === tipo) ? l.filter((c) => c.tipo !== tipo) : [...l, { tipo, pago_mensual: "", saldo: "" }]));
  const setCredito = (tipo: string, cambios: Partial<Credito>) => setCreditos((l) => l.map((c) => (c.tipo === tipo ? { ...c, ...cambios } : c)));
  const esFamiliar = datos.tipo_vivienda === OPCIONES_VIVIENDA[2];
  const tieneLicencia = !!datos.licencia_tipo && datos.licencia_tipo !== "No tengo licencia";
  const tieneVehiculo = datos.tiene_transporte === "Sí" && ["Automóvil", "Motocicleta"].includes(datos.tipo_transporte);
  const primerEmpleo = datos.primer_empleo === "Sí";

  const elegirFoto = async (f: File | null) => {
    if (!f) return;
    try {
      setFoto(await comprimirFoto(f));
    } catch (e: any) {
      setError(e.message);
    }
  };

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
  const select = (campo: Campo, opciones: string[]) => (
    <select className={inputCls} value={datos[campo]} onChange={(e) => set(campo, e.target.value)}>
      <option value="">Selecciona…</option>
      {opciones.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
  const campo = (c: Campo, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={labelCls}>{etiqueta}</label>
      <input className={inputCls} value={datos[c]} onChange={(e) => set(c, e.target.value)} maxLength={150} {...props} />
    </div>
  );

  const validarPaso = (): string => {
    const d = datos;
    if (paso === 0) return aceptaAviso ? "" : "Para continuar, confirma que leíste el aviso del proceso.";
    if (paso === 1) {
      if (!d.nombre.trim()) return "Por favor escribe tu nombre completo.";
      const edad = Number(d.edad);
      if (!Number.isInteger(edad) || edad < 16 || edad > 99) return "Por favor escribe una edad válida.";
      if (!d.telefono.trim()) return "Por favor escribe un teléfono de contacto.";
      if (!d.escolaridad || !d.estado_civil) return "Selecciona tu escolaridad y estado civil.";
      if (d.hijos === "" || d.personas_vive === "" || d.dependientes === "") return "Cuéntanos sobre tu familia (hijos, con cuántas personas vives y dependientes).";
      if (!d.otro_ingreso) return "Cuéntanos si alguien más aporta al gasto de tu casa.";
      if (!d.calle_numero.trim() || !d.colonia.trim() || !d.municipio.trim() || !d.estado.trim()) return "Completa tu domicilio actual (calle, colonia, municipio y estado).";
      if (!d.tipo_vivienda) return "Cuéntanos si rentas, es propia o vives con un familiar.";
      if (esFamiliar && !d.familiar.trim()) return "Cuéntanos con qué familiar vives.";
      if (!d.pago_vivienda.trim()) return "Indica cuánto pagas de renta o con cuánto apoyas (puedes escribir 0).";
      if (!d.tiempo_domicilio_actual) return "Indica cuánto tiempo llevas en tu domicilio actual.";
      if (!d.tiene_transporte) return "Indica si cuentas con medio de transporte.";
      if (d.tiene_transporte === "Sí" && !d.tipo_transporte) return "Indica qué tipo de transporte tienes.";
      if (tieneVehiculo && (!d.vehiculo_modelo.trim() || !d.vehiculo_valor.trim() || !d.vehiculo_pagado)) return "Completa los datos de tu vehículo.";
      if (!d.gastos_mensuales.trim()) return "Indica aproximadamente tus gastos mensuales.";
      if (!d.creditos) return "Indica si actualmente pagas algún crédito.";
      if (d.creditos === "Sí") {
        if (!creditos.length) return "Selecciona qué créditos pagas.";
        if (creditos.some((c) => !c.pago_mensual.trim())) return "Indica el pago mensual de cada crédito.";
      }
      return "";
    }
    if (paso === 2) {
      if (!primerEmpleo) {
        const validos = empleos.filter((e) => e.empresa.trim());
        if (!validos.length) return "Agrega al menos un empleo anterior (o marca que sería tu primer empleo).";
        for (const e of validos) {
          if (!e.puesto.trim() || !e.inicio || (!e.actual && !e.fin)) return `Completa puesto y fechas del empleo en ${e.empresa}.`;
          if (!e.actual && !e.motivo.trim()) return `Indica el motivo de salida de ${e.empresa}.`;
          if (!e.sueldo.trim()) return `Indica el sueldo mensual aproximado en ${e.empresa}.`;
        }
      }
      if (!d.autoriza_referencias) return "Indica si autorizas que pidamos referencias a tus empleos anteriores.";
      if (!d.sueldo_esperado.trim()) return "Indica el sueldo mensual que esperas.";
      return "";
    }
    if (paso === 3) {
      if (!d.licencia_tipo) return "Indica qué licencia tienes.";
      if (tieneLicencia && !d.licencia_vigencia) return "Indica la fecha de vigencia de tu licencia.";
      if (!d.psicofisico) return "Indica si tienes examen psicofísico vigente.";
      if (d.anios_experiencia === "" || Number(d.anios_experiencia) < 0) return "Indica tus años de experiencia manejando.";
      if (!unidades.length) return "Selecciona al menos un tipo de unidad que hayas manejado.";
      for (const c of ["condicion_salud", "proceso_legal", "accidentes", "robo_ruta", "carta_antecedentes"] as Campo[]) {
        if (!d[c]) return "Responde todas las preguntas de esta sección.";
      }
      if (d.robo_ruta === "Sí" && (!d.robo_relato.trim() || !d.robo_reaccion.trim() || !d.robo_observacion.trim() || !d.robo_modus || !d.robo_aviso)) {
        return "Cuéntanos con más detalle lo que viviste en el robo.";
      }
      return "";
    }
    const lista = paso === 4 ? PREGUNTAS_ESTRATEGICAS : paso === 5 ? PREGUNTAS_MECANICA : PREGUNTAS_CONOCIMIENTO;
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
        body: JSON.stringify({
          puesto,
          foto,
          respuestas,
          datos: {
            ...datos,
            unidades,
            rutas_conocidas: rutas,
            empleos: primerEmpleo ? [] : empleos.filter((x) => x.empresa.trim()),
            creditos_lista: creditos,
            acepta_aviso: aceptaAviso,
          },
        }),
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
  const subtitulo = (t: string) => <h3 className="text-[14px] font-bold text-[var(--navy)] border-b border-[var(--gray-200)] pb-1.5 mt-2 mb-0">{t}</h3>;

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
                    ¡Bienvenido(a)! Gracias por tu interés en formar parte de <b>Transportes Logisticar</b>. Somos una línea de transporte en crecimiento y comprometida con la
                    seguridad: la de nuestros operadores, la de la mercancía que nos confían y la de todos en carretera. Te tomará unos 25 minutos; responde con calma y
                    sinceridad. Tu información se maneja de forma confidencial.
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
                    Por nuestro compromiso con la seguridad y por requisito de las cuentas clientes con las que trabajamos, nuestro proceso de selección es más completo que el de
                    otras empresas: incluye verificación de datos y referencias laborales, una <b>prueba antidoping</b> y una <b>evaluación médica</b>.
                  </p>
                  <p className="m-0 mb-1.5">
                    La prueba antidoping y la evaluación médica son <b>pagadas por la empresa</b>, sin costo para ti.
                  </p>
                  <p className="m-0">Toda la información que compartas será tratada de manera confidencial, únicamente para fines del proceso de selección.</p>
                  <label className="flex items-center gap-2 mt-3 font-semibold cursor-pointer">
                    <input type="checkbox" checked={aceptaAviso} onChange={(e) => setAceptaAviso(e.target.checked)} />
                    He leído el aviso y estoy de acuerdo.
                  </label>
                </div>
              </div>
            )}

            {paso === 1 && (
              <div className="grid gap-4">
                <div className="flex items-center gap-4">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt="Tu foto" className="w-20 h-20 rounded-full object-cover border border-[var(--gray-200)]" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[var(--gray-100)] flex items-center justify-center text-[28px]">🙂</div>
                  )}
                  <div>
                    <label className={labelCls}>Tómate una foto (opcional)</label>
                    <div className="flex gap-2 flex-wrap">
                      <label className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold cursor-pointer">
                        {foto ? "Cambiar foto" : "Tomar foto"}
                        <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { elegirFoto(e.target.files?.[0] || null); e.target.value = ""; }} />
                      </label>
                      {foto && (
                        <button type="button" onClick={() => setFoto(null)} className="text-[12.5px] text-[var(--red)] font-bold">
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {subtitulo("Datos personales")}
                <div className="grid sm:grid-cols-[1fr_130px] gap-4">
                  {campo("nombre", "¿Cuál es tu nombre completo?")}
                  {campo("edad", "¿Qué edad tienes?", { type: "number", min: 16, max: 99 })}
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {campo("fecha_nacimiento", "Fecha de nacimiento", { type: "date" })}
                  {campo("lugar_nacimiento", "Lugar de nacimiento")}
                  <div>
                    <label className={labelCls}>Escolaridad</label>
                    {select("escolaridad", OPCIONES_ESCOLARIDAD)}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {campo("telefono", "¿A qué número podemos contactarte?", { type: "tel", maxLength: 30 })}
                  {campo("correo", "Correo electrónico (opcional)", { type: "email" })}
                </div>

                {subtitulo("Tu familia")}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Estado civil</label>
                    {select("estado_civil", OPCIONES_ESTADO_CIVIL)}
                  </div>
                  {campo("hijos", "¿Cuántos hijos tienes?", { type: "number", min: 0, max: 20 })}
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {campo("personas_vive", "¿Con cuántas personas vives?", { type: "number", min: 0, max: 30 })}
                  {campo("dependientes", "¿Cuántas dependen de ti?", { type: "number", min: 0, max: 30 })}
                  <div>
                    <label className={labelCls}>¿Alguien más aporta en casa?</label>
                    {siNo("otro_ingreso")}
                  </div>
                </div>

                {subtitulo("Tu domicilio")}
                <div className="grid sm:grid-cols-2 gap-4">
                  {campo("calle_numero", "Calle y número")}
                  {campo("colonia", "Colonia")}
                </div>
                <div className="grid sm:grid-cols-[1fr_1fr_120px] gap-4">
                  {campo("municipio", "Municipio o alcaldía")}
                  {campo("estado", "Estado")}
                  {campo("cp", "C.P.", { inputMode: "numeric", maxLength: 5 })}
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
                {esFamiliar && campo("familiar", "¿Con qué familiar vives o de quién es el domicilio?", { placeholder: "Ej. Mis papás, mi tía Rosa…" })}
                <div className="grid sm:grid-cols-2 gap-4">
                  {campo("pago_vivienda", "¿Cuánto pagas de renta o con cuánto apoyas en casa al mes?", { placeholder: "$ mensual", inputMode: "decimal" })}
                  <div>
                    <label className={labelCls}>¿Cuánto tiempo llevas viviendo ahí?</label>
                    {select("tiempo_domicilio_actual", OPCIONES_TIEMPO)}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>¿Cuál era la dirección de tu domicilio anterior? (opcional)</label>
                  <textarea className={inputCls} rows={2} value={datos.domicilio_anterior} onChange={(e) => set("domicilio_anterior", e.target.value)} maxLength={300} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Cuánto tiempo viviste ahí? (opcional)</label>
                    {select("tiempo_domicilio_anterior", OPCIONES_TIEMPO)}
                  </div>
                  {campo("renta_anterior", "¿Cuánto pagabas de renta ahí? (opcional)", { placeholder: "$ mensual", inputMode: "decimal" })}
                </div>

                {subtitulo("Transporte y gastos")}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Cuentas con medio de transporte propio?</label>
                    {siNo("tiene_transporte", () => setDatos((d) => ({ ...d, tipo_transporte: "", vehiculo_modelo: "", vehiculo_valor: "", vehiculo_pagado: "" })))}
                  </div>
                  {datos.tiene_transporte === "Sí" && (
                    <div>
                      <label className={labelCls}>¿Qué tipo de transporte tienes?</label>
                      {select("tipo_transporte", OPCIONES_TRANSPORTE)}
                    </div>
                  )}
                </div>
                {tieneVehiculo && (
                  <div className="grid sm:grid-cols-3 gap-4">
                    {campo("vehiculo_modelo", "Marca, modelo y año", { placeholder: "Ej. Nissan Versa 2018" })}
                    {campo("vehiculo_valor", "Valor aproximado", { placeholder: "$", inputMode: "decimal" })}
                    <div>
                      <label className={labelCls}>¿Está pagado o a crédito?</label>
                      {select("vehiculo_pagado", ["Pagado", "A crédito"])}
                    </div>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  {campo("gastos_mensuales", "¿Cuánto gastas al mes aproximadamente en tu hogar?", { placeholder: "$ mensual", inputMode: "decimal" })}
                  {campo("traslado", "¿Cómo llegarías a nuestras instalaciones y en cuánto tiempo?", { placeholder: "Ej. En transporte público, 40 min" })}
                </div>
                <div>
                  <label className={labelCls}>¿Actualmente pagas algún crédito o préstamo?</label>
                  <div className="sm:w-1/2">{siNo("creditos", () => setCreditos([]))}</div>
                </div>
                {datos.creditos === "Sí" && (
                  <div className="grid gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {OPCIONES_CREDITO.map((o) => (
                        <label key={o} className={chip(creditos.some((c) => c.tipo === o))}>
                          <input type="checkbox" checked={creditos.some((c) => c.tipo === o)} onChange={() => alternarCredito(o)} />
                          {o}
                        </label>
                      ))}
                    </div>
                    {creditos.map((c) => (
                      <div key={c.tipo} className="grid sm:grid-cols-[1fr_160px_160px] gap-3 items-end border border-[var(--gray-200)] rounded-lg p-3">
                        <b className="text-[13px] text-[var(--navy)]">{c.tipo}</b>
                        <div>
                          <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Pago mensual</label>
                          <input className={inputCls} value={c.pago_mensual} onChange={(e) => setCredito(c.tipo, { pago_mensual: e.target.value })} placeholder="$" inputMode="decimal" maxLength={30} />
                        </div>
                        <div>
                          <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Saldo pendiente</label>
                          <input className={inputCls} value={c.saldo} onChange={(e) => setCredito(c.tipo, { saldo: e.target.value })} placeholder="$ (aprox.)" inputMode="decimal" maxLength={30} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {paso === 2 && (
              <div className="grid gap-4">
                {nota("Cuéntanos sobre tus empleos anteriores, empezando por el más reciente. Esta información nos ayuda a conocer tu trayectoria.")}
                <label className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer">
                  <input type="checkbox" checked={primerEmpleo} onChange={(e) => set("primer_empleo", e.target.checked ? "Sí" : "")} />
                  Este sería mi primer empleo
                </label>
                {!primerEmpleo &&
                  empleos.map((e, i) => (
                    <div key={i} className="border border-[var(--gray-200)] rounded-xl p-4 grid gap-3">
                      <div className="flex justify-between items-center">
                        <b className="text-[13.5px] text-[var(--navy)]">Empleo {i + 1}</b>
                        {empleos.length > 1 && (
                          <button type="button" onClick={() => setEmpleos((l) => l.filter((_, n) => n !== i))} className="text-[12px] text-[var(--red)] font-bold">
                            Quitar
                          </button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Empresa</label>
                          <input className={inputCls} value={e.empresa} onChange={(ev) => setEmpleo(i, { empresa: ev.target.value })} maxLength={150} />
                        </div>
                        <div>
                          <label className={labelCls}>Puesto</label>
                          <input className={inputCls} value={e.puesto} onChange={(ev) => setEmpleo(i, { puesto: ev.target.value })} maxLength={100} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Dirección de la empresa</label>
                        <input className={inputCls} value={e.direccion} onChange={(ev) => setEmpleo(i, { direccion: ev.target.value })} maxLength={200} placeholder="Calle, colonia, municipio" />
                      </div>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>Fecha de inicio</label>
                          <input className={inputCls} type="month" value={e.inicio} onChange={(ev) => setEmpleo(i, { inicio: ev.target.value })} />
                        </div>
                        <div>
                          <label className={labelCls}>Fecha de fin</label>
                          <input className={inputCls} type="month" value={e.fin} disabled={e.actual} onChange={(ev) => setEmpleo(i, { fin: ev.target.value })} />
                          <label className="flex items-center gap-1.5 text-[12px] mt-1 cursor-pointer">
                            <input type="checkbox" checked={e.actual} onChange={(ev) => setEmpleo(i, { actual: ev.target.checked, fin: "" })} />
                            Trabajo aquí actualmente
                          </label>
                        </div>
                        <div>
                          <label className={labelCls}>Sueldo mensual</label>
                          <input className={inputCls} value={e.sueldo} onChange={(ev) => setEmpleo(i, { sueldo: ev.target.value })} placeholder="$ aprox." inputMode="decimal" maxLength={30} />
                        </div>
                      </div>
                      {!e.actual && (
                        <div>
                          <label className={labelCls}>Motivo de salida</label>
                          <input className={inputCls} value={e.motivo} onChange={(ev) => setEmpleo(i, { motivo: ev.target.value })} maxLength={300} />
                        </div>
                      )}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Referencia laboral (nombre y puesto)</label>
                          <input className={inputCls} value={e.ref_nombre} onChange={(ev) => setEmpleo(i, { ref_nombre: ev.target.value })} maxLength={120} placeholder="Ej. Juan Pérez, jefe de tráfico" />
                        </div>
                        <div>
                          <label className={labelCls}>Teléfono de la referencia</label>
                          <input className={inputCls} type="tel" value={e.ref_telefono} onChange={(ev) => setEmpleo(i, { ref_telefono: ev.target.value })} maxLength={30} />
                        </div>
                      </div>
                    </div>
                  ))}
                {!primerEmpleo && empleos.length < 10 && (
                  <button type="button" onClick={() => setEmpleos((l) => [...l, { ...EMPLEO_VACIO }])} className="border-2 border-dashed border-[var(--gray-200)] rounded-xl py-3 text-[13px] font-bold text-[var(--blue)]">
                    + Agregar otro empleo
                  </button>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Nos autorizas a solicitar información y referencias sobre ti en las empresas donde has trabajado?</label>
                    {siNo("autoriza_referencias")}
                  </div>
                  {campo("sueldo_esperado", "¿Qué sueldo mensual esperas?", { placeholder: "$ mensual", inputMode: "decimal" })}
                </div>
              </div>
            )}

            {paso === 3 && (
              <div className="grid gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Qué licencia de conducir tienes?</label>
                    {select("licencia_tipo", OPCIONES_LICENCIA)}
                  </div>
                  {tieneLicencia && campo("licencia_vigencia", "¿Hasta cuándo está vigente?", { type: "date" })}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>¿Tienes examen psicofísico (apto médico)?</label>
                    {select("psicofisico", OPCIONES_PSICOFISICO)}
                  </div>
                  {campo("anios_experiencia", "¿Cuántos años de experiencia tienes manejando unidades?", { type: "number", min: 0, max: 60 })}
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

                {nota("Para cuidar tu seguridad y la de todos en carretera, nos gustaría saber lo siguiente:")}
                {(
                  [
                    ["condicion_salud", "salud_detalle", "¿Tienes alguna condición de salud que requiera tratamiento o que debamos tomar en cuenta al asignarte viajes?", "¿Cuál?"],
                    ["proceso_legal", "legal_detalle", "¿Tienes algún asunto legal o trámite pendiente ante alguna autoridad?", "Cuéntanos brevemente"],
                    ["accidentes", "accidentes_detalle", "¿Has estado involucrado en algún accidente o percance vial en los últimos 3 años?", "¿Qué ocurrió?"],
                  ] as [Campo, Campo, string, string][]
                ).map(([c, detalle, pregunta, ph]) => (
                  <div key={c} className="grid sm:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className={labelCls}>{pregunta}</label>
                      {siNo(c, () => set(detalle, ""))}
                    </div>
                    {datos[c] === "Sí" && <input className={inputCls} value={datos[detalle]} onChange={(e) => set(detalle, e.target.value)} maxLength={300} placeholder={ph} />}
                  </div>
                ))}

                <div className="sm:w-1/2">
                  <label className={labelCls}>¿Te ha tocado vivir un robo o intento de robo en ruta?</label>
                  {siNo("robo_ruta", () =>
                    setDatos((d) => ({ ...d, robo_veces: "", robo_fecha_lugar: "", robo_modus: "", robo_relato: "", robo_observacion: "", robo_reaccion: "", robo_aviso: "" }))
                  )}
                </div>
                {datos.robo_ruta === "Sí" && (
                  <div className="grid gap-3 border border-[var(--gray-200)] rounded-xl p-4 bg-[#fafbfd]">
                    <p className="text-[12.5px] text-[var(--gray-400)] m-0">Sabemos que no es fácil recordarlo. Tu experiencia nos ayuda a prevenir estas situaciones.</p>
                    <div className="grid sm:grid-cols-[140px_1fr] gap-3">
                      {campo("robo_veces", "¿Cuántas veces?", { type: "number", min: 1, max: 20 })}
                      {campo("robo_fecha_lugar", "¿Cuándo y dónde fue? (año aproximado, carretera o tramo, hora)")}
                    </div>
                    <div>
                      <label className={labelCls}>¿Cómo ocurrió?</label>
                      {select("robo_modus", OPCIONES_MODUS)}
                    </div>
                    <div>
                      <label className={labelCls}>Cuéntanos la historia: ¿qué pasó, paso a paso?</label>
                      <textarea className={inputCls} rows={3} value={datos.robo_relato} onChange={(e) => set("robo_relato", e.target.value)} maxLength={800} />
                    </div>
                    <div>
                      <label className={labelCls}>¿Qué detalles recuerdas? (cuántas personas, vehículos, vestimenta, señas, qué notaste antes)</label>
                      <textarea className={inputCls} rows={3} value={datos.robo_observacion} onChange={(e) => set("robo_observacion", e.target.value)} maxLength={600} />
                    </div>
                    <div>
                      <label className={labelCls}>¿Cómo reaccionaste en ese momento y qué hiciste después?</label>
                      <textarea className={inputCls} rows={3} value={datos.robo_reaccion} onChange={(e) => set("robo_reaccion", e.target.value)} maxLength={600} />
                    </div>
                    <div className="sm:w-1/2">
                      <label className={labelCls}>¿Avisaste a tu empresa y se presentó la denuncia?</label>
                      {siNo("robo_aviso")}
                    </div>
                  </div>
                )}

                <div className="sm:w-1/2">
                  <label className={labelCls}>Si te la solicitamos, ¿podrías tramitar tu carta de no antecedentes penales?</label>
                  {siNo("carta_antecedentes")}
                </div>
              </div>
            )}

            {paso === 4 && (
              <div className="grid gap-3.5">
                {nota("Ahora cuéntanos cómo sueles actuar en tu día a día. Elige la opción que más se parezca a lo que harías; no hay una sola forma de trabajar.")}
                {renderPreguntas(PREGUNTAS_ESTRATEGICAS, 0)}
              </div>
            )}

            {paso === 5 && (
              <div className="grid gap-3.5">
                {nota("Algunas situaciones de mecánica básica que suelen presentarse en ruta.")}
                {renderPreguntas(PREGUNTAS_MECANICA, PREGUNTAS_ESTRATEGICAS.length)}
              </div>
            )}

            {paso === 6 && (
              <div className="grid gap-3.5">
                {nota("¡Último paso! Algunas preguntas sobre las rutas en las que trabajamos y tu experiencia al volante.")}
                {renderPreguntas(PREGUNTAS_CONOCIMIENTO, PREGUNTAS_ESTRATEGICAS.length + PREGUNTAS_MECANICA.length)}
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
