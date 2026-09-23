"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ExpedienteFormModal, { ExpedienteData, Curso } from "@/components/ExpedienteFormModal";
import { useSesion } from "@/lib/useSesion";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Documento = { nombre: string; archivo: string; fecha: string };
type Nota = { texto: string; fecha: string };
type CampoExtra = { label: string; valor: string };
type CursoAsignado = { capacitacion_id: number; titulo: string };
type CapacitacionCatalogo = { id: number; titulo: string };

type ExpedienteCompleto = ExpedienteData & {
  id: number;
  fecha_ingreso: string | null;
  documentos: Documento[];
  notas: Nota[];
  campos_extra: Record<string, CampoExtra[]>;
  cursos_asignados: CursoAsignado[];
};

function formatoFechaLarga(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}
function calcularDiasLaborando(iso: string | null): number | null {
  if (!iso) return null;
  const inicio = new Date(iso);
  if (isNaN(inicio.getTime())) return null;
  const hoy = new Date();
  const dias = Math.floor((hoy.getTime() - inicio.getTime()) / 86400000);
  return dias >= 0 ? dias : null;
}
function formatoFechaCorta(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
function descargarArchivo(dataUrl: string, nombreArchivo: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function leerArchivoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function IconoSeccion({ path, viewBox = "0 0 24 24" }: { path: React.ReactNode; viewBox?: string }) {
  return (
    <div className="w-[42px] h-[42px] rounded-full bg-[var(--blue-light)] flex items-center justify-center shrink-0">
      <svg width="19" height="19" viewBox={viewBox} fill="none" stroke="#2f6fed" strokeWidth="2">
        {path}
      </svg>
    </div>
  );
}
function Seccion({ icono, titulo, subtitulo, accion, children }: { icono: React.ReactNode; titulo: string; subtitulo?: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          {icono}
          <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">{titulo}</h3>
        </div>
        {accion}
      </div>
      {subtitulo && <p className="text-[12.5px] text-[var(--gray-400)] m-0 mb-3.5 ml-[54px]">{subtitulo}</p>}
      {!subtitulo && <div className="mb-3.5" />}
      {children}
    </div>
  );
}

export default function DetalleExpedientePage() {
  const sesion = useSesion();
  const esSoloConsulta = sesion.rol === "supervisor_tms";
  const [registro, setRegistro] = useState<ExpedienteCompleto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [subiendoDocumento, setSubiendoDocumento] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [catalogo, setCatalogo] = useState<CapacitacionCatalogo[]>([]);
  const [evaluacionesPersona, setEvaluacionesPersona] = useState<Record<string, { aciertos: number; fecha: string }>>({});
  const [asignarCursoAbierto, setAsignarCursoAbierto] = useState(false);

  const cargar = () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setError("Falta el identificador del expediente.");
      setCargando(false);
      return;
    }
    fetch(`/api/expedientes/get?id=${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "No se encontró el expediente.");
        const reg = { ...data.registro, documentos: data.registro.documentos || [], notas: data.registro.notas || [], cursos: data.registro.cursos || [], campos_extra: data.registro.campos_extra || {}, cursos_asignados: data.registro.cursos_asignados || [] };
        setRegistro(reg);
        fetch(`/api/capacitaciones/por-persona?nombre=${encodeURIComponent(reg.nombre)}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => setEvaluacionesPersona(d.porCapacitacion || {}))
          .catch(() => {});
      })
      .catch((err) => setError(err.message || "No se encontró el expediente."))
      .finally(() => setCargando(false));
  };
  useEffect(() => {
    cargar();
    fetch("/api/areas-personal", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAreas(d.areas || []))
      .catch(() => {});
    fetch("/api/capacitaciones/catalogo/list", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCatalogo((d.registros || []).map((c: any) => ({ id: c.id, titulo: c.titulo }))))
      .catch(() => {});
  }, []);

  const cambiarTipoPersonal = async (tipo: "administrativo" | "operador") => {
    if (!registro) return;
    setRegistro({ ...registro, tipo_personal: tipo });
    try {
      const res = await fetch("/api/expedientes/tipo-personal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id, tipo_personal: tipo }) });
      if (!res.ok) throw new Error();
    } catch {
      alert("No se pudo actualizar el tipo de personal.");
      cargar();
    }
  };

  const cambiarArea = async (area: string) => {
    if (!registro) return;
    setRegistro({ ...registro, area });
    try {
      const res = await fetch("/api/expedientes/area", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id, area }) });
      if (!res.ok) throw new Error();
    } catch {
      alert("No se pudo actualizar el área.");
      cargar();
    }
  };

  const asignarCurso = async (capacitacion: CapacitacionCatalogo) => {
    if (!registro) return;
    if (registro.cursos_asignados.some((c) => c.capacitacion_id === capacitacion.id)) {
      setAsignarCursoAbierto(false);
      return;
    }
    const nuevos = [...registro.cursos_asignados, { capacitacion_id: capacitacion.id, titulo: capacitacion.titulo }];
    setRegistro({ ...registro, cursos_asignados: nuevos });
    setAsignarCursoAbierto(false);
    try {
      await fetch("/api/expedientes/cursos-asignados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id, cursos_asignados: nuevos }) });
    } catch {
      cargar();
    }
  };
  const quitarCursoAsignado = async (idx: number) => {
    if (!registro) return;
    const nuevos = registro.cursos_asignados.filter((_, i) => i !== idx);
    setRegistro({ ...registro, cursos_asignados: nuevos });
    try {
      await fetch("/api/expedientes/cursos-asignados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id, cursos_asignados: nuevos }) });
    } catch {
      cargar();
    }
  };

  const eliminar = async () => {
    if (!registro || !confirm(`¿Eliminar el expediente de ${registro.nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await fetch("/api/expedientes/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id }) });
      window.location.href = "/personas/expedientes";
    } catch {
      alert("No se pudo eliminar el expediente.");
    }
  };

  const subirDocumento = async (file: File | undefined) => {
    if (!file || !registro) return;
    const nombre = window.prompt("Nombre del documento:", file.name.replace(/\.pdf$/i, ""));
    if (nombre === null) return;
    setSubiendoDocumento(true);
    try {
      const archivo = await leerArchivoBase64(file);
      const nuevoDoc: Documento = { nombre: nombre.trim() || file.name, archivo, fecha: new Date().toISOString() };
      const nuevosDocumentos = [...registro.documentos, nuevoDoc];
      const res = await fetch("/api/expedientes/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: registro.id, documentos: nuevosDocumentos }),
      });
      if (!res.ok) throw new Error();
      setRegistro({ ...registro, documentos: nuevosDocumentos });
    } catch {
      alert("No se pudo subir el documento.");
    } finally {
      setSubiendoDocumento(false);
    }
  };
  const eliminarDocumento = async (idx: number) => {
    if (!registro || !confirm("¿Eliminar este documento?")) return;
    const nuevosDocumentos = registro.documentos.filter((_, i) => i !== idx);
    setRegistro({ ...registro, documentos: nuevosDocumentos });
    try {
      await fetch("/api/expedientes/documentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id, documentos: nuevosDocumentos }) });
    } catch {
      cargar();
    }
  };

  const agregarNota = async () => {
    if (!registro) return;
    const texto = window.prompt("Escribe la nota:");
    if (!texto || !texto.trim()) return;
    const nuevasNotas = [{ texto: texto.trim(), fecha: new Date().toISOString() }, ...registro.notas];
    setRegistro({ ...registro, notas: nuevasNotas });
    try {
      await fetch("/api/expedientes/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id, notas: nuevasNotas }) });
    } catch {
      cargar();
    }
  };
  const eliminarNota = async (idx: number) => {
    if (!registro) return;
    const nuevasNotas = registro.notas.filter((_, i) => i !== idx);
    setRegistro({ ...registro, notas: nuevasNotas });
    try {
      await fetch("/api/expedientes/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id, notas: nuevasNotas }) });
    } catch {
      cargar();
    }
  };

  const guardarCamposExtra = async (campos_extra: Record<string, CampoExtra[]>) => {
    if (!registro) return;
    setRegistro({ ...registro, campos_extra });
    try {
      await fetch("/api/expedientes/campos-extra", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id, campos_extra }) });
    } catch {
      cargar();
    }
  };
  const agregarCampoExtra = (seccion: string) => {
    if (!registro) return;
    const label = window.prompt("Nombre del campo (ej. Supervisor, Equipo, Estado civil):");
    if (!label || !label.trim()) return;
    const valor = window.prompt(`Valor de "${label.trim()}":`) || "";
    const actuales = registro.campos_extra[seccion] || [];
    guardarCamposExtra({ ...registro.campos_extra, [seccion]: [...actuales, { label: label.trim(), valor: valor.trim() }] });
  };
  const eliminarCampoExtra = (seccion: string, idx: number) => {
    if (!registro) return;
    const actuales = (registro.campos_extra[seccion] || []).filter((_, i) => i !== idx);
    guardarCamposExtra({ ...registro.campos_extra, [seccion]: actuales });
  };

  const filaCampo = (label: string, valor: string | undefined | null, icono?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--gray-100)] last:border-0">
      <span className="text-[12.5px] text-[var(--gray-400)] shrink-0">{label}</span>
      <span className="text-[13px] font-semibold text-[var(--navy)] text-right flex items-center gap-1.5 justify-end">
        {icono}
        {valor || "—"}
      </span>
    </div>
  );

  const bloqueCamposExtra = (seccion: string) => {
    if (!registro) return null;
    const campos = registro.campos_extra[seccion] || [];
    return (
      <>
        {campos.map((c, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--gray-100)] last:border-0 group">
            <span className="text-[12.5px] text-[var(--gray-400)] shrink-0">{c.label}</span>
            <span className="text-[13px] font-semibold text-[var(--navy)] text-right flex items-center gap-2 justify-end">
              {c.valor || "—"}
              {!esSoloConsulta && (
                <span onClick={() => eliminarCampoExtra(seccion, i)} className="text-[var(--red)] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </span>
              )}
            </span>
          </div>
        ))}
        {!esSoloConsulta && (
          <button type="button" onClick={() => agregarCampoExtra(seccion)} className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--blue)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
            Agregar información
          </button>
        )}
      </>
    );
  };

  const diasLaborando = registro ? calcularDiasLaborando(registro.fecha_ingreso) : null;

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10">
        <PageHeader
          titulo="Expediente"
          subtitulo="Consulta, descarga o edita la información del colaborador."
          backHref="/personas/expedientes"
          backLabel="Expedientes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
        />

        {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-16">Cargando...</p>}
        {error && <p className="text-center text-[var(--red)] text-[13px] py-16">{error}</p>}

        {registro && (
          <>
            {/* Encabezado del colaborador */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-4">
              <div className="flex items-start gap-4 flex-wrap">
                {registro.fotografia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={registro.fotografia} alt={registro.nombre} className="w-[92px] h-[92px] rounded-2xl object-cover border border-[var(--gray-200)] shrink-0" />
                ) : (
                  <div className="w-[92px] h-[92px] rounded-2xl bg-[var(--blue-light)] flex items-center justify-center shrink-0">
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                  </div>
                )}
                <div className="flex-1 min-w-[200px]">
                  <h2 className="text-[21px] font-bold text-[var(--navy)] m-0 mb-0.5 uppercase leading-tight">{registro.nombre}</h2>
                  {registro.puesto && <p className="text-[13px] font-semibold text-[var(--blue)] m-0 mb-1.5">{registro.puesto}</p>}
                  <p className="text-[12.5px] text-[var(--gray-400)] m-0 mb-3">
                    Fecha de ingreso: {formatoFechaLarga(registro.fecha_ingreso)}
                    {diasLaborando !== null && <span className="font-semibold text-[var(--navy)]"> · {diasLaborando} día{diasLaborando === 1 ? "" : "s"} laborando</span>}
                  </p>
                  <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                    <select
                      value={registro.tipo_personal || "operador"}
                      onChange={(e) => cambiarTipoPersonal(e.target.value as "administrativo" | "operador")}
                      disabled={esSoloConsulta}
                      className="border border-[var(--gray-200)] rounded-lg px-3 py-1.5 text-[12px] font-bold text-[var(--navy)] bg-white disabled:opacity-60"
                    >
                      <option value="operador">Operador</option>
                      <option value="administrativo">Administrativo</option>
                    </select>
                    <select
                      value={registro.area || ""}
                      onChange={(e) => cambiarArea(e.target.value)}
                      disabled={esSoloConsulta}
                      className="border border-[var(--gray-200)] rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--navy)] bg-white disabled:opacity-60"
                    >
                      <option value="">Sin área</option>
                      {areas.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    {!esSoloConsulta && (
                      <>
                        <button type="button" onClick={() => setEditando(true)} className="flex items-center gap-1.5 bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                          Editar
                        </button>
                        <button type="button" onClick={eliminar} className="flex items-center gap-1.5 bg-white text-[var(--red)] border border-[var(--gray-200)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Datos personales + Información laboral, en la misma línea */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Seccion icono={<IconoSeccion path={<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></>} />} titulo="Datos personales">
                <div className="border border-[var(--gray-200)] rounded-xl px-4">
                  {filaCampo("RFC", registro.rfc)}
                  {filaCampo("CURP", registro.curp)}
                  {filaCampo("NSS", registro.nss)}
                  {bloqueCamposExtra("datos_personales")}
                </div>
              </Seccion>

              <Seccion icono={<IconoSeccion path={<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></>} />} titulo="Información laboral">
                <div className="border border-[var(--gray-200)] rounded-xl px-4">
                  {registro.tipo_personal !== "administrativo" && filaCampo("Cuenta", registro.cuenta)}
                  {!esSoloConsulta && filaCampo("Sueldo ofertado", registro.sueldo_ofertado)}
                  {filaCampo("Radio asignado", registro.radio_asignado)}
                  {bloqueCamposExtra("informacion_laboral")}
                </div>
              </Seccion>
            </div>

            {/* Licencia y operación */}
            {registro.tipo_personal !== "administrativo" && (
              <Seccion
                icono={<IconoSeccion path={<><circle cx="12" cy="12" r="9" /><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /></>} />}
                titulo="Licencia y operación"
              >
                <div className="border border-[var(--gray-200)] rounded-xl px-4">
                  {filaCampo("Tipo de licencia", registro.tipo_licencia)}
                  {filaCampo("Categoría", registro.categoria)}
                  {filaCampo("Puesto", registro.puesto)}
                  {filaCampo("Unidad que maneja", registro.unidad_maneja)}
                  {bloqueCamposExtra("licencia")}
                </div>
              </Seccion>
            )}

            {/* Cursos */}
            <Seccion
              icono={<IconoSeccion path={<><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></>} />}
              titulo="Cursos"
              subtitulo="Cursos de capacitación del colaborador."
              accion={
                !esSoloConsulta && (
                  <button type="button" onClick={() => setAsignarCursoAbierto(true)} className="flex items-center gap-1.5 bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-3.5 py-2 text-[12.5px] font-bold shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                    Asignar curso
                  </button>
                )
              }
            >
              {registro.cursos_asignados.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  {registro.cursos_asignados.map((c, i) => {
                    const evalua = evaluacionesPersona[c.titulo];
                    return (
                      <div key={i} className="relative border border-[var(--gray-200)] rounded-xl p-3.5 text-center">
                        {!esSoloConsulta && (
                          <span onClick={() => quitarCursoAsignado(i)} className="absolute top-2 right-2 text-[var(--gray-400)] hover:text-[var(--red)] cursor-pointer">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </span>
                        )}
                        <p className="text-[12.5px] font-bold text-[var(--navy)] m-0 mb-1.5">{c.titulo}</p>
                        {evalua ? (
                          <>
                            <p className={`text-[22px] font-bold m-0 mb-2.5 ${evalua.aciertos >= 80 ? "text-[var(--green)]" : evalua.aciertos >= 60 ? "text-[var(--amber)]" : "text-[var(--red)]"}`}>{Math.round(evalua.aciertos)}%</p>
                            <span className="inline-block w-full rounded-lg py-2 text-[12px] font-bold border border-[var(--gray-200)] text-[var(--gray-400)]">Evaluación completada</span>
                          </>
                        ) : (
                          <a
                            href={`/personas/capacitaciones/tomar?id=${c.capacitacion_id}&nombre=${encodeURIComponent(registro.nombre)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block w-full rounded-lg py-2 text-[12px] font-bold no-underline bg-[var(--blue)] text-white"
                          >
                            Iniciar Evaluación
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {registro.cursos.length === 0 && registro.cursos_asignados.length === 0 ? (
                <p className="text-[12.5px] text-[var(--gray-400)] m-0">Sin cursos registrados.</p>
              ) : (
                registro.cursos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {registro.cursos.map((c: Curso, i: number) => (
                      <div key={i} className="border border-[var(--gray-200)] rounded-xl p-3.5 text-center">
                        <p className="text-[12.5px] font-bold text-[var(--navy)] m-0 mb-1.5">{c.nombre}</p>
                        <p className="text-[22px] font-bold text-[var(--navy)] m-0 mb-2.5">{c.resultado || "—"}</p>
                        {c.enlace ? (
                          <a
                            href={c.enlace}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-block w-full rounded-lg py-2 text-[12px] font-bold no-underline ${
                              /no iniciad/i.test(c.resultado) ? "bg-[var(--blue)] text-white" : "border border-[var(--blue)] text-[var(--blue)]"
                            }`}
                          >
                            {/no iniciad/i.test(c.resultado) ? "Iniciar curso" : "Ver resultados"}
                          </a>
                        ) : (
                          <span className="inline-block w-full rounded-lg py-2 text-[12px] font-bold border border-[var(--gray-200)] text-[var(--gray-400)]">Sin enlace</span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
              <div className="mt-2 pt-1 border-t border-[var(--gray-100)]">{bloqueCamposExtra("cursos")}</div>
            </Seccion>

            {/* Indicadores de desempeño */}
            <Seccion
              icono={<IconoSeccion path={<path d="M3 3v18h18M8 17V9M13 17V5M18 17v-7" />} />}
              titulo="Indicadores de desempeño"
              subtitulo="Resumen del desempeño del colaborador."
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Asistencia", registro.indicador_asistencia],
                  ["Puntualidad", registro.indicador_puntualidad],
                  ["Rendimiento de combustible", registro.indicador_combustible],
                  ["Incidencias con clientes", registro.indicador_incidencias],
                ].map(([label, valor]) => (
                  <div key={label} className="border border-[var(--gray-200)] rounded-xl p-3.5 text-center">
                    <p className="text-[11px] text-[var(--gray-400)] m-0 mb-1.5 leading-tight">{label}</p>
                    <p className="text-[19px] font-bold text-[var(--navy)] m-0">{valor || "—"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-1 border-t border-[var(--gray-100)]">{bloqueCamposExtra("indicadores")}</div>
            </Seccion>

            {/* Documentos */}
            <Seccion
              icono={<IconoSeccion path={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></>} />}
              titulo="Documentos"
              subtitulo="Consulta, descarga o administra los documentos del colaborador."
              accion={
                <label className="cursor-pointer shrink-0">
                  <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => subirDocumento(e.target.files?.[0])} />
                  <span className="flex items-center gap-1.5 bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-3.5 py-2 text-[12.5px] font-bold">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                    {subiendoDocumento ? "Subiendo..." : "Subir documento"}
                  </span>
                </label>
              }
            >
              {registro.documentos.length === 0 ? (
                <p className="text-[12.5px] text-[var(--gray-400)] m-0">Sin documentos adjuntos.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {registro.documentos.map((d, i) => (
                    <div key={i} className="border border-[var(--gray-200)] rounded-xl p-3 flex items-center gap-3">
                      <div className="w-[38px] h-[38px] rounded-lg bg-[var(--red)] flex items-center justify-center shrink-0">
                        <span className="text-white text-[9px] font-bold">PDF</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-bold text-[var(--navy)] m-0 truncate">{d.nombre}</p>
                        <p className="text-[10.5px] text-[var(--gray-400)] m-0">Subido el {formatoFechaCorta(d.fecha)}</p>
                      </div>
                      <span onClick={() => window.open(d.archivo, "_blank")} className="text-[var(--gray-400)] cursor-pointer shrink-0" title="Previsualizar">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
                      </span>
                      <span onClick={() => descargarArchivo(d.archivo, d.nombre.endsWith(".pdf") ? d.nombre : `${d.nombre}.pdf`)} className="text-[var(--navy)] cursor-pointer shrink-0" title="Descargar">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                      </span>
                      <span onClick={() => eliminarDocumento(i)} className="text-[var(--red)] cursor-pointer shrink-0" title="Eliminar">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 pt-1 border-t border-[var(--gray-100)]">{bloqueCamposExtra("documentos")}</div>
            </Seccion>

            {/* Notas adicionales */}
            <Seccion
              icono={<IconoSeccion path={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>} />}
              titulo="Notas adicionales"
              subtitulo="Información relevante sobre el colaborador."
            >
              {registro.notas.length === 0 ? (
                <div className="bg-[var(--gray-100)] rounded-lg p-3.5 mb-3">
                  <p className="text-[12.5px] text-[var(--gray-400)] m-0">Sin notas registradas.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mb-3">
                  {registro.notas.map((n, i) => (
                    <div key={i} className="bg-[var(--gray-100)] rounded-lg p-3.5 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] text-[var(--text)] m-0 mb-1 whitespace-pre-line">{n.texto}</p>
                        <p className="text-[10.5px] text-[var(--gray-400)] m-0">{formatoFechaCorta(n.fecha)}</p>
                      </div>
                      <span onClick={() => eliminarNota(i)} className="text-[var(--red)] cursor-pointer shrink-0" title="Eliminar nota">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={agregarNota} className="w-full border border-[var(--blue-light)] bg-[var(--blue-light)] text-[var(--blue)] rounded-lg py-2.5 text-[12.5px] font-bold flex items-center justify-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                Agregar nota
              </button>
            </Seccion>
          </>
        )}
      </div>

      {editando && registro && (
        <ExpedienteFormModal
          inicial={{ ...registro, fecha_ingreso: registro.fecha_ingreso ? registro.fecha_ingreso.slice(0, 10) : "", tipo_personal: registro.tipo_personal || "operador", area: registro.area || "" }}
          onCancelar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            setCargando(true);
            cargar();
          }}
        />
      )}

      {asignarCursoAbierto && registro && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setAsignarCursoAbierto(false)}>
          <div className="bg-white rounded-2xl w-[420px] max-w-full max-h-[80vh] flex flex-col shadow-[0_1px_3px_rgba(22,33,92,0.06)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gray-200)]">
              <h3 className="text-[15px] font-bold text-[var(--navy)] m-0">Asignar curso</h3>
              <span onClick={() => setAsignarCursoAbierto(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">✕</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {catalogo.length === 0 && <p className="text-[12.5px] text-[var(--gray-400)] text-center py-6">No hay capacitaciones en el catálogo.</p>}
              {catalogo.map((c) => {
                const yaAsignado = registro.cursos_asignados.some((a) => a.capacitacion_id === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => asignarCurso(c)}
                    disabled={yaAsignado}
                    className="w-full text-left px-3.5 py-3 rounded-lg text-[13px] font-semibold text-[var(--navy)] hover:bg-[var(--gray-100)] disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                  >
                    {c.titulo}
                    {yaAsignado && <span className="text-[10px] font-bold text-[var(--gray-400)] uppercase shrink-0">Asignado</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
