"use client";
import { useState } from "react";
import { compressImage } from "@/lib/imageUtils";

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

// Formulario de alta de proveedor (se abre cuando el valor capturado no está en el catálogo).
export default function AltaProveedorModal({ nombreInicial, onCerrar, onAlta }: { nombreInicial: string; onCerrar: () => void; onAlta: (nombre: string) => void }) {
  const [f, setF] = useState({
    nombre: nombreInicial,
    maps_url: "",
    telefono: "",
    contacto: "",
    tiempo_traslado: "",
    a_domicilio: false,
    catalogo: "",
    costos: "",
    pagos_saldos: "",
    creditos: "",
    notas: "",
    foto_mapa: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const cargarFoto = async (file?: File) => {
    if (!file) return;
    try {
      set("foto_mapa", await compressImage(file, 900, 0.65, 700000));
    } catch {
      setError("No se pudo leer la imagen.");
    }
  };

  const guardar = async () => {
    setError("");
    if (!f.nombre.trim()) return setError("El nombre del negocio es obligatorio.");
    setGuardando(true);
    try {
      const res = await fetch("/api/compras/proveedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo dar de alta.");
      onAlta(f.nombre.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo dar de alta.");
    } finally {
      setGuardando(false);
    }
  };

  const campo = (k: keyof typeof f, etiqueta: string, ph = "", area = false) => (
    <label className="block">
      <span className={labelCls}>{etiqueta}</span>
      {area ? (
        <textarea rows={2} value={String(f[k])} onChange={(e) => set(k, e.target.value)} placeholder={ph} className={inputCls} />
      ) : (
        <input value={String(f[k])} onChange={(e) => set(k, e.target.value)} placeholder={ph} className={inputCls} />
      )}
    </label>
  );

  return (
    <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-center justify-center p-4 z-[70]" onClick={onCerrar}>
      <div className="bg-white rounded-xl w-full max-w-[680px] max-h-[90vh] overflow-y-auto shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-1">Alta de proveedor</h3>
        <p className="text-[12px] text-[var(--gray-500)] m-0 mb-4">“{nombreInicial}” no está en el catálogo. Completa sus datos para darlo de alta.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campo("nombre", "Nombre del negocio *")}
          {campo("maps_url", "Link de la dirección (Maps)", "https://maps.app.goo.gl/…")}
          {campo("contacto", "Nombre del contacto")}
          {campo("telefono", "Teléfono del contacto")}
          {campo("tiempo_traslado", "Tiempo de Logisticar al proveedor", "Ej. 35 min")}
          <label className="block">
            <span className={labelCls}>¿Tiene servicio a domicilio?</span>
            <select value={f.a_domicilio ? "si" : "no"} onChange={(e) => set("a_domicilio", e.target.value === "si")} className={inputCls}>
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </label>
          {campo("catalogo", "Catálogo de productos", "", true)}
          {campo("costos", "Costos", "", true)}
          {campo("pagos_saldos", "Pagos y saldos", "", true)}
          {campo("creditos", "Créditos", "", true)}
          <label className="block sm:col-span-2">
            <span className={labelCls}>Foto de Maps (referencia)</span>
            <input type="file" accept="image/*" onChange={(e) => cargarFoto(e.target.files?.[0])} className="text-[12.5px]" />
            {f.foto_mapa && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.foto_mapa} alt="Mapa" className="mt-2 max-h-[140px] rounded-md border border-[var(--gray-200)]" />
            )}
          </label>
          <div className="sm:col-span-2">{campo("notas", "Nota de referencia", "Ej. entrada por calle lateral", true)}</div>
        </div>
        {error && <p className="text-[12.5px] text-[var(--red)] mt-3 mb-0">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn btn-secundario py-1.5" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn btn-primario py-1.5" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Dar de alta al proveedor"}</button>
        </div>
      </div>
    </div>
  );
}
