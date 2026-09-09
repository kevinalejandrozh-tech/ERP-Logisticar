"use client";
import { useState } from "react";
import { compressImage } from "@/lib/imageUtils";

export type Curso = { nombre: string; resultado: string; enlace: string };

export type ExpedienteData = {
  id?: number;
  nombre: string;
  rfc: string;
  curp: string;
  nss: string;
  categoria: string;
  puesto: string;
  unidad_maneja: string;
  tipo_viajes: string;
  tipo_licencia: string;
  fecha_ingreso: string;
  cuenta: string;
  sueldo_ofertado: string;
  radio_asignado: string;
  fotografia: string;
  cursos: Curso[];
  indicador_asistencia: string;
  indicador_puntualidad: string;
  indicador_combustible: string;
  indicador_incidencias: string;
};

export const EXPEDIENTE_VACIO: ExpedienteData = {
  nombre: "",
  rfc: "",
  curp: "",
  nss: "",
  categoria: "",
  puesto: "",
  unidad_maneja: "",
  tipo_viajes: "",
  tipo_licencia: "",
  fecha_ingreso: "",
  cuenta: "",
  sueldo_ofertado: "",
  radio_asignado: "",
  fotografia: "",
  cursos: [],
  indicador_asistencia: "",
  indicador_puntualidad: "",
  indicador_combustible: "",
  indicador_incidencias: "",
};

const OPCIONES_UNIDAD = ["1.5 a 3.5 TON", "TOR / RAB"];
const OPCIONES_CUENTA = ["TMS", "KN"];

function formatoContable(valor: string): string {
  const n = parseFloat(valor.replace(/[$,]/g, ""));
  if (isNaN(n)) return valor;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExpedienteFormModal({
  inicial,
  onGuardado,
  onCancelar,
}: {
  inicial?: ExpedienteData;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const [datos, setDatos] = useState<ExpedienteData>(inicial || EXPEDIENTE_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [cargandoFoto, setCargandoFoto] = useState(false);

  const set = <K extends keyof ExpedienteData>(campo: K, valor: ExpedienteData[K]) => setDatos((prev) => ({ ...prev, [campo]: valor }));

  const subirFoto = async (file: File | undefined) => {
    if (!file) return;
    setCargandoFoto(true);
    try {
      const base64 = await compressImage(file, 700, 0.7);
      set("fotografia", base64);
    } catch {
      alert("No se pudo cargar la fotografía.");
    } finally {
      setCargandoFoto(false);
    }
  };

  const agregarCurso = () => set("cursos", [...datos.cursos, { nombre: "", resultado: "", enlace: "" }]);
  const actualizarCurso = (idx: number, campo: keyof Curso, valor: string) =>
    set("cursos", datos.cursos.map((c, i) => (i === idx ? { ...c, [campo]: valor } : c)));
  const quitarCurso = (idx: number) => set("cursos", datos.cursos.filter((_, i) => i !== idx));

  const guardar = async () => {
    if (!datos.nombre.trim()) {
      alert("Captura el nombre del colaborador.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/expedientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el expediente.");
      onGuardado();
    } catch (err: any) {
      alert(err.message || "No se pudo guardar el expediente.");
    } finally {
      setGuardando(false);
    }
  };

  const campoTexto = (campo: keyof ExpedienteData, etiqueta: string, tipo: string = "text") => (
    <div>
      <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">{etiqueta}</label>
      <input
        type={tipo}
        value={datos[campo] as string}
        onChange={(e) => set(campo, e.target.value as any)}
        className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50">
      <div className="bg-white rounded-2xl w-[720px] max-w-[95%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
        <h3 className="text-[17px] font-bold text-[var(--navy)] mb-5">{inicial ? "Editar expediente" : "Agregar expediente"}</h3>

        <div className="flex gap-4 mb-6">
          <label className="cursor-pointer shrink-0">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => subirFoto(e.target.files?.[0])} />
            <div className="w-[90px] h-[90px] rounded-xl bg-[var(--gray-100)] border border-[var(--gray-200)] overflow-hidden flex flex-col items-center justify-center gap-1">
              {cargandoFoto ? (
                <span className="text-[10px] text-[var(--gray-400)] font-bold">Cargando...</span>
              ) : datos.fotografia ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={datos.fotografia} alt="Fotografía" className="w-full h-full object-cover" />
              ) : (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  <span className="text-[9.5px] font-bold text-[var(--gray-400)]">Fotografía</span>
                </>
              )}
            </div>
          </label>
          <div className="flex-1">{campoTexto("nombre", "Nombre completo")}</div>
        </div>

        <p className="text-[11px] font-bold text-[var(--blue)] uppercase tracking-wide mb-2.5">Datos personales</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {campoTexto("rfc", "RFC")}
          {campoTexto("curp", "CURP")}
          {campoTexto("nss", "NSS")}
        </div>

        <p className="text-[11px] font-bold text-[var(--blue)] uppercase tracking-wide mb-2.5">Licencia y operación</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {campoTexto("tipo_licencia", "Tipo de licencia")}
          {campoTexto("categoria", "Categoría")}
          {campoTexto("puesto", "Puesto")}
          <div>
            <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">Unidad que maneja</label>
            <select value={datos.unidad_maneja} onChange={(e) => set("unidad_maneja", e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]">
              <option value=""></option>
              {OPCIONES_UNIDAD.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
          {campoTexto("tipo_viajes", "Tipo de viajes")}
          {campoTexto("fecha_ingreso", "Fecha de ingreso", "date")}
        </div>

        <p className="text-[11px] font-bold text-[var(--blue)] uppercase tracking-wide mb-2.5">Información laboral</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">Cuenta</label>
            <select value={datos.cuenta} onChange={(e) => set("cuenta", e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]">
              <option value=""></option>
              {OPCIONES_CUENTA.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">Sueldo ofertado</label>
            <input
              value={datos.sueldo_ofertado}
              onFocus={(e) => set("sueldo_ofertado", e.target.value.replace(/[$,]/g, ""))}
              onChange={(e) => set("sueldo_ofertado", e.target.value)}
              onBlur={(e) => set("sueldo_ofertado", formatoContable(e.target.value))}
              placeholder="0.00"
              className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]"
            />
          </div>
          {campoTexto("radio_asignado", "Radio asignado")}
        </div>

        <p className="text-[11px] font-bold text-[var(--blue)] uppercase tracking-wide mb-2.5">Cursos</p>
        <div className="flex flex-col gap-2 mb-2">
          {datos.cursos.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input value={c.nombre} onChange={(e) => actualizarCurso(idx, "nombre", e.target.value)} placeholder="Nombre del curso" className="flex-1 border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              <input value={c.resultado} onChange={(e) => actualizarCurso(idx, "resultado", e.target.value)} placeholder="65% / No iniciado" className="w-[130px] border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              <input value={c.enlace} onChange={(e) => actualizarCurso(idx, "enlace", e.target.value)} placeholder="Enlace (opcional)" className="w-[150px] border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              <span onClick={() => quitarCurso(idx)} className="text-[var(--red)] cursor-pointer shrink-0" title="Quitar curso">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </span>
            </div>
          ))}
        </div>
        <button type="button" onClick={agregarCurso} className="text-[12px] font-bold text-[var(--blue)] mb-5">
          + Agregar curso
        </button>

        <p className="text-[11px] font-bold text-[var(--blue)] uppercase tracking-wide mb-2.5">Indicadores de desempeño</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
          {campoTexto("indicador_asistencia", "Asistencia")}
          {campoTexto("indicador_puntualidad", "Puntualidad")}
          {campoTexto("indicador_combustible", "Rend. de combustible")}
          {campoTexto("indicador_incidencias", "Incidencias con clientes")}
        </div>

        <div className="flex gap-2.5 justify-end mt-6">
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
