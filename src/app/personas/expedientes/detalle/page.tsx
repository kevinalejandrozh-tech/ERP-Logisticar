"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ExpedienteFormModal, { ExpedienteData, Curso } from "@/components/ExpedienteFormModal";
import { useSesion } from "@/lib/useSesion";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Documento = { nombre: string; archivo: string; fecha: string };
type Nota = { texto: string; fecha: string };

type ExpedienteCompleto = ExpedienteData & {
  id: number;
  fecha_ingreso: string | null;
  documentos: Documento[];
  notas: Nota[];
};

function formatoFechaLarga(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
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
        setRegistro({ ...data.registro, documentos: data.registro.documentos || [], notas: data.registro.notas || [], cursos: data.registro.cursos || [] });
      })
      .catch((err) => setError(err.message || "No se encontró el expediente."))
      .finally(() => setCargando(false));
  };
  useEffect(() => {
    cargar();
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

  const campoBox = (label: string, valor: string | undefined | null) => (
    <div className="flex-1 min-w-[110px]">
      <p className="text-[10px] font-bold text-[var(--gray-400)] uppercase tracking-wide m-0 mb-1">{label}</p>
      <p className="text-[14.5px] text-[var(--navy)] font-bold m-0">{valor || "—"}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10">
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
                  <img src={registro.fotografia} alt={registro.nombre} className="w-[92px] h-[92px] rounded-full object-cover border border-[var(--gray-200)] shrink-0" />
                ) : (
                  <div className="w-[92px] h-[92px] rounded-full bg-[var(--blue-light)] flex items-center justify-center shrink-0">
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                  </div>
                )}
                <div className="flex-1 min-w-[200px]">
                  <h2 className="text-[21px] font-bold text-[var(--navy)] m-0 mb-1 uppercase leading-tight">{registro.nombre}</h2>
                  <p className="text-[12.5px] text-[var(--gray-400)] m-0 mb-2.5">Fecha de ingreso: {formatoFechaLarga(registro.fecha_ingreso)}</p>
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
                    {registro.tipo_personal === "administrativo" && registro.puesto && (
                      <span className="text-[12.5px] font-semibold text-[var(--blue)]">{registro.puesto}</span>
                    )}
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

            {/* Datos personales */}
            <Seccion icono={<IconoSeccion path={<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></>} />} titulo="Datos personales">
              <div className="border border-[var(--gray-200)] rounded-xl p-4 flex flex-wrap">
                <div className="pl-0 pr-4">{campoBox("RFC", registro.rfc)}</div>
                <div className="pl-4 border-l border-[var(--gray-200)]">{campoBox("CURP", registro.curp)}</div>
                <div className="pl-4 border-l border-[var(--gray-200)]">{campoBox("NSS", registro.nss)}</div>
              </div>
            </Seccion>

            {/* Licencia y operación */}
            {registro.tipo_personal !== "administrativo" && (
              <Seccion
                icono={<IconoSeccion path={<><circle cx="12" cy="12" r="9" /><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /></>} />}
                titulo="Licencia y operación"
              >
                <div className="border border-[var(--gray-200)] rounded-xl p-4 flex flex-wrap">
                  <div className="pl-0 pr-4">{campoBox("Tipo de licencia", registro.tipo_licencia)}</div>
                  <div className="pl-4 border-l border-[var(--gray-200)]">{campoBox("Categoría", registro.categoria)}</div>
                  <div className="pl-4 border-l border-[var(--gray-200)]">{campoBox("Puesto", registro.puesto)}</div>
                  <div className="pl-4 border-l border-[var(--gray-200)]">{campoBox("Unidad que maneja", registro.unidad_maneja)}</div>
                </div>
              </Seccion>
            )}

            {/* Información laboral */}
            <Seccion icono={<IconoSeccion path={<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></>} />} titulo="Información laboral">
              <div className="border border-[var(--gray-200)] rounded-xl p-4 flex flex-wrap">
                {registro.tipo_personal !== "administrativo" && <div className="pl-0 pr-4">{campoBox("Cuenta", registro.cuenta)}</div>}
                {!esSoloConsulta && <div className="pl-4 border-l border-[var(--gray-200)] first:border-l-0 first:pl-0">{campoBox("Sueldo ofertado", registro.sueldo_ofertado)}</div>}
                <div className="pl-4 border-l border-[var(--gray-200)] first:border-l-0 first:pl-0">{campoBox("Radio asignado", registro.radio_asignado)}</div>
              </div>
            </Seccion>

            {/* Cursos */}
            <Seccion
              icono={<IconoSeccion path={<><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></>} />}
              titulo="Cursos"
              subtitulo="Cursos de capacitación del colaborador."
            >
              {registro.cursos.length === 0 ? (
                <p className="text-[12.5px] text-[var(--gray-400)] m-0">Sin cursos registrados.</p>
              ) : (
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
              )}
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
          inicial={{ ...registro, fecha_ingreso: registro.fecha_ingreso ? registro.fecha_ingreso.slice(0, 10) : "", tipo_personal: registro.tipo_personal || "operador" }}
          onCancelar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            setCargando(true);
            cargar();
          }}
        />
      )}
    </div>
  );
}
