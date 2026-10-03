"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { compressImage } from "@/lib/imageUtils";
import { CATALOGOS, ESTADOS_MX, TIPOS_UNIDAD_CASETA, type CampoCat } from "@/lib/catalogosRutaData";

type Registro = { id: number; nombre: string; datos: Record<string, unknown>; tiene_adjunto: boolean; adjunto_nombre: string | null; activo: boolean };
type Edicion = { original?: string | null; id: number | null; nombre: string; datos: Record<string, unknown>; activo: boolean; adjunto: string | null; adjunto_nombre: string | null; quitar: boolean; tiene_adjunto: boolean };

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";
const moneda = (v: unknown) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v) || 0);
const MAX_DOC = 4_400_000;

function leerArchivo(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(f);
  });
}

function mostrar(c: CampoCat, v: unknown): string {
  if (c.tipo === "si_no") return v ? "Sí" : "No";
  if (c.tipo === "numero") return v == null || v === "" ? "—" : moneda(v);
  if (c.tipo === "costos_unidad") {
    const m = (v || {}) as Record<string, number>;
    return TIPOS_UNIDAD_CASETA.filter((t) => m[t]).map((t) => `${t}: ${moneda(m[t])}`).join(" · ") || "—";
  }
  return String(v ?? "") || "—";
}

// Página genérica de catálogo: lista, alta, edición y eliminación.
export default function CatalogoPage() {
  const { tipo } = useParams<{ tipo: string }>();
  const def = CATALOGOS[tipo];
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [ed, setEd] = useState<Edicion | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/catalogos-ruta?tipo=${tipo}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo cargar el catálogo.");
      setRegistros(d.registros || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(false);
    }
  }, [tipo]);
  useEffect(() => {
    if (def) cargar();
  }, [def, cargar]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? registros.filter((r) => `${r.nombre} ${Object.values(r.datos).map((v) => (typeof v === "object" ? "" : String(v ?? ""))).join(" ")}`.toLowerCase().includes(t)) : registros;
  }, [registros, q]);

  if (!def) return <div className="p-10 text-[13px]">Catálogo no encontrado.</div>;
  const columnas = def.campos.filter((c) => def.columnas.includes(c.clave));

  const nuevo = () => setEd({ id: null, nombre: "", datos: {}, activo: true, adjunto: null, adjunto_nombre: null, quitar: false, tiene_adjunto: false });
  const editar = async (r: Registro) => {
    let adjunto: string | null = null;
    if (r.tiene_adjunto) {
      const d = await fetch(`/api/catalogos-ruta?tipo=${tipo}&id=${r.id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      adjunto = d?.registro?.adjunto || null;
    }
    setEd({ original: adjunto, id: r.id, nombre: r.nombre, datos: { ...r.datos }, activo: r.activo, adjunto, adjunto_nombre: r.adjunto_nombre, quitar: false, tiene_adjunto: r.tiene_adjunto });
  };

  const guardar = async () => {
    if (!ed) return;
    setOcupado(true);
    try {
      const res = await fetch("/api/catalogos-ruta", {
        method: ed.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: ed.id, nombre: ed.nombre, datos: ed.datos, activo: ed.activo, adjunto: ed.adjunto && ed.adjunto !== ed.original ? ed.adjunto : null, adjunto_nombre: ed.adjunto_nombre, quitar_adjunto: ed.quitar }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo guardar.");
      setEd(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async (r: Registro) => {
    if (!confirm(`¿Eliminar "${r.nombre}"? Si está en alguna ruta, deja de aparecer ahí.`)) return;
    await fetch(`/api/catalogos-ruta?tipo=${tipo}&id=${r.id}`, { method: "DELETE" });
    cargar();
  };

  const cargarAdjunto = async (f?: File) => {
    if (!f || !ed || !def.adjunto) return;
    try {
      const esImg = f.type.startsWith("image/");
      if (def.adjunto.tipo === "imagen" && !esImg) return alert("Elige una imagen.");
      const contenido = esImg ? await compressImage(f, 1100, 0.7, 900000) : await leerArchivo(f);
      if (contenido.length > MAX_DOC * 1.37) return alert("El archivo es demasiado grande (máx. ~4 MB).");
      setEd({ ...ed, adjunto: contenido, adjunto_nombre: f.name, quitar: false });
    } catch {
      alert("No se pudo leer el archivo.");
    }
  };

  const abrirAdjunto = (data: string) => {
    const mime = /^data:([^;,]+);/.exec(data)?.[1] || "application/octet-stream";
    const bin = atob(data.slice(data.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    window.open(URL.createObjectURL(new Blob([bytes], { type: mime })), "_blank");
  };

  const setDato = (clave: string, v: unknown) => setEd((p) => (p ? { ...p, datos: { ...p.datos, [clave]: v } } : p));

  const campo = (c: CampoCat) => {
    if (!ed) return null;
    const v = ed.datos[c.clave];
    const span = c.ancho === "completo" || c.tipo === "costos_unidad" ? "sm:col-span-2" : "";
    let control: React.ReactNode;
    if (c.tipo === "area") control = <textarea rows={c.clave === "pasos" ? 7 : 3} value={String(v ?? "")} onChange={(e) => setDato(c.clave, e.target.value)} className={inputCls} />;
    else if (c.tipo === "numero") control = <input type="number" min={0} step="0.01" value={v == null ? "" : String(v)} onChange={(e) => setDato(c.clave, e.target.value)} className={inputCls} />;
    else if (c.tipo === "si_no")
      control = (
        <select value={v ? "si" : "no"} onChange={(e) => setDato(c.clave, e.target.value === "si")} className={inputCls}>
          <option value="no">No</option>
          <option value="si">Sí</option>
        </select>
      );
    else if (c.tipo === "seleccion" || c.tipo === "estado")
      control = (
        <select value={String(v ?? "")} onChange={(e) => setDato(c.clave, e.target.value)} className={inputCls}>
          <option value="">Selecciona</option>
          {(c.tipo === "estado" ? [...ESTADOS_MX] : c.opciones || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    else if (c.tipo === "costos_unidad")
      control = (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIPOS_UNIDAD_CASETA.map((t) => (
            <label key={t} className="block text-[11.5px] text-[var(--gray-500)]">
              {t}
              <input type="number" min={0} step="0.01" value={String(((v || {}) as Record<string, number>)[t] ?? "")} onChange={(e) => setDato(c.clave, { ...((v || {}) as Record<string, number>), [t]: e.target.value })} className={inputCls} />
            </label>
          ))}
        </div>
      );
    else control = <input value={String(v ?? "")} onChange={(e) => setDato(c.clave, e.target.value)} placeholder={c.ayuda || ""} className={inputCls} />;
    return (
      <div key={c.clave} className={span}>
        <label className={labelCls}>{c.etiqueta}{c.requerido && " *"}</label>
        {control}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pb-10">
        <PageHeader titulo={def.titulo} subtitulo={def.descripcion} backHref="/catalogos-ruta" backLabel="Catálogos de ruta" />
        <div className="flex flex-wrap gap-3 mb-4">
          <button type="button" className="btn btn-primario" onClick={nuevo}>+ Nuevo {def.singular}</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13px] bg-white w-[240px]" />
        </div>
        <div className="bg-white border border-[var(--gray-200)] rounded-lg overflow-x-auto">
          {error && <p className="m-4 text-[13px] text-[var(--red)]">{error}</p>}
          {cargando ? (
            <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
          ) : (
            <table className="w-full text-[13px] min-w-[640px]">
              <thead>
                <tr className="text-left text-[11.5px] text-[var(--gray-500)] uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">{def.campoNombre}</th>
                  {columnas.map((c) => <th key={c.clave} className="px-4 py-3 font-medium">{c.etiqueta.replace(/ \(\$\)/, "")}</th>)}
                  {def.adjunto && <th className="px-4 py-3 font-medium">Archivo</th>}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <tr key={r.id} className={`border-t border-[var(--gray-200)] hover:bg-[var(--gray-50)] ${r.activo ? "" : "opacity-50"}`}>
                    <td className="px-4 py-2.5 font-medium text-[var(--navy)]">{r.nombre}{!r.activo && <span className="ml-2 text-[11px] text-[var(--gray-500)]">(inactivo)</span>}</td>
                    {columnas.map((c) => <td key={c.clave} className="px-4 py-2.5 text-[var(--gray-500)]">{mostrar(c, r.datos[c.clave])}</td>)}
                    {def.adjunto && <td className="px-4 py-2.5 text-[12px]">{r.tiene_adjunto ? "📎 " + (r.adjunto_nombre || "Sí") : "—"}</td>}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button type="button" className="btn btn-secundario py-1.5" onClick={() => editar(r)}>Editar</button>
                      <button type="button" className="ml-3 text-[12.5px] text-[var(--red)] hover:underline" onClick={() => eliminar(r)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && <tr><td colSpan={columnas.length + 3} className="px-4 py-8 text-center text-[var(--gray-500)]">{registros.length ? "Sin resultados." : `Aún no hay registros. Agrega el primero con “Nuevo ${def.singular}”.`}</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {ed && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-12 z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[680px] p-6 shadow-xl max-h-[calc(100vh-3rem)] overflow-y-auto">
            <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-4">{ed.id ? "Editar" : "Nuevo"} {def.singular}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>{def.campoNombre} *</label>
                <input value={ed.nombre} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} className={inputCls} />
              </div>
              {def.campos.map(campo)}
              {def.adjunto && (
                <div className="sm:col-span-2 border border-[var(--gray-200)] rounded-lg p-3">
                  <label className={labelCls}>{def.adjunto.etiqueta}</label>
                  <input type="file" accept={def.adjunto.tipo === "imagen" ? "image/*" : "image/*,.pdf,.doc,.docx,.xls,.xlsx"} onChange={(e) => { cargarAdjunto(e.target.files?.[0]); e.target.value = ""; }} className="text-[12.5px]" />
                  {ed.adjunto && !ed.quitar && (
                    <div className="mt-2 flex items-center gap-3">
                      {ed.adjunto.startsWith("data:image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ed.adjunto} alt="" className="max-h-[120px] rounded-md border border-[var(--gray-200)]" />
                      ) : (
                        <button type="button" className="text-[12.5px] text-[var(--blue)] underline" onClick={() => abrirAdjunto(ed.adjunto!)}>📄 {ed.adjunto_nombre || "Ver archivo"}</button>
                      )}
                      <button type="button" className="text-[12px] text-[var(--red)]" onClick={() => setEd({ ...ed, adjunto: null, adjunto_nombre: null, quitar: true })}>Quitar</button>
                    </div>
                  )}
                </div>
              )}
              <label className="sm:col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={ed.activo} onChange={(e) => setEd({ ...ed, activo: e.target.checked })} className="w-4 h-4 accent-[var(--navy)]" />Activo</label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn btn-secundario" onClick={() => setEd(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={ocupado || !ed.nombre.trim()} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
