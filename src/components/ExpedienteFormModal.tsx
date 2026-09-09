"use client";
import { useState } from "react";
import { compressImage } from "@/lib/imageUtils";

export type ExpedienteData = {
  id?: number;
  nombre: string;
  rfc: string;
  rfc_pdf: string;
  curp: string;
  curp_pdf: string;
  nss: string;
  nss_pdf: string;
  categoria: string;
  puesto: string;
  unidad_maneja: string;
  tipo_viajes: string;
  tipo_licencia: string;
  tipo_licencia_pdf: string;
  fecha_ingreso: string;
  cuenta: string;
  sueldo_ofertado: string;
  radio_asignado: string;
  resultados_evaluacion: string;
  fotografia: string;
};

export const EXPEDIENTE_VACIO: ExpedienteData = {
  nombre: "",
  rfc: "",
  rfc_pdf: "",
  curp: "",
  curp_pdf: "",
  nss: "",
  nss_pdf: "",
  categoria: "",
  puesto: "",
  unidad_maneja: "",
  tipo_viajes: "",
  tipo_licencia: "",
  tipo_licencia_pdf: "",
  fecha_ingreso: "",
  cuenta: "",
  sueldo_ofertado: "",
  radio_asignado: "",
  resultados_evaluacion: "",
  fotografia: "",
};

const OPCIONES_UNIDAD = ["1.5 a 3.5 TON", "TOR / RAB"];
const OPCIONES_CUENTA = ["TMS", "KN"];

function leerArchivoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

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
  const [cargandoArchivo, setCargandoArchivo] = useState<string | null>(null);

  const set = (campo: keyof ExpedienteData, valor: string) => setDatos((prev) => ({ ...prev, [campo]: valor }));

  const subirPdf = async (campo: keyof ExpedienteData, file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Solo se permiten archivos PDF.");
      return;
    }
    setCargandoArchivo(campo);
    try {
      const base64 = await leerArchivoBase64(file);
      set(campo, base64);
    } catch {
      alert("No se pudo cargar el archivo.");
    } finally {
      setCargandoArchivo(null);
    }
  };

  const subirFoto = async (file: File | undefined) => {
    if (!file) return;
    setCargandoArchivo("fotografia");
    try {
      const base64 = await compressImage(file, 700, 0.7);
      set("fotografia", base64);
    } catch {
      alert("No se pudo cargar la fotografía.");
    } finally {
      setCargandoArchivo(null);
    }
  };

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
        value={datos[campo]}
        onChange={(e) => set(campo, e.target.value)}
        className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]"
      />
    </div>
  );

  const campoPdf = (campo: keyof ExpedienteData, etiqueta: string) => (
    <div className="flex items-end gap-2">
      <label className="cursor-pointer shrink-0 mb-[1px]" title={`Adjuntar PDF de ${etiqueta}`}>
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => subirPdf(campo, e.target.files?.[0])} />
        <span
          className={`flex items-center justify-center w-[42px] h-[42px] rounded-lg border ${
            datos[campo] ? "bg-[rgba(33,168,102,0.14)] border-[var(--green)] text-[var(--green)]" : "bg-[var(--gray-100)] border-[var(--gray-200)] text-[var(--gray-400)]"
          }`}
        >
          {cargandoArchivo === campo ? (
            <span className="text-[10px] font-bold">...</span>
          ) : datos[campo] ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
          )}
        </span>
      </label>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50">
      <div className="bg-white rounded-2xl w-[720px] max-w-[95%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
        <h3 className="text-[17px] font-bold text-[var(--navy)] mb-5">{inicial ? "Editar expediente" : "Agregar expediente"}</h3>

        <div className="flex gap-4 mb-5">
          <label className="cursor-pointer shrink-0">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => subirFoto(e.target.files?.[0])} />
            <div className="w-[90px] h-[90px] rounded-xl bg-[var(--gray-100)] border border-[var(--gray-200)] overflow-hidden flex flex-col items-center justify-center gap-1">
              {cargandoArchivo === "fotografia" ? (
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">{campoTexto("rfc", "RFC")}</div>
            {campoPdf("rfc_pdf", "RFC")}
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">{campoTexto("curp", "CURP")}</div>
            {campoPdf("curp_pdf", "CURP")}
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">{campoTexto("nss", "NSS")}</div>
            {campoPdf("nss_pdf", "NSS")}
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">{campoTexto("tipo_licencia", "Tipo de licencia")}</div>
            {campoPdf("tipo_licencia_pdf", "Licencia")}
          </div>

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

        <div className="mb-6">
          <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">Resultados generales de evaluación</label>
          <textarea
            value={datos.resultados_evaluacion}
            onChange={(e) => set("resultados_evaluacion", e.target.value)}
            rows={3}
            className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] resize-none"
          />
        </div>

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
