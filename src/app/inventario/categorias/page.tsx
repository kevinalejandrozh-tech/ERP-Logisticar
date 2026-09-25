"use client";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { CAMPOS_GENERALES, TIPOS_CAMPO, validarCategoria, type CategoriaInventarioBD, type TipoCampo } from "@/lib/inventarioData";

// Administración de categorías del inventario: crear categorías nuevas y definir sus campos.

interface CampoEditor {
  uid: string;
  clave?: string; // solo los campos ya guardados tienen clave (no se puede cambiar)
  etiqueta: string;
  tipo: TipoCampo;
  opcionesTexto: string; // opciones separadas por coma
  requerido: boolean;
  activo: boolean;
}

interface CategoriaEditor {
  id?: number;
  nombre: string;
  prefijo: string;
  activa: boolean;
  totalEquipos: number;
  campos: CampoEditor[];
}

let contadorUid = 0;
const nuevoUid = () => `c${++contadorUid}`;

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const claseInput = "w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-[var(--blue)] disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-400)]";

async function obtenerCategorias(): Promise<CategoriaInventarioBD[]> {
  const res = await fetch("/api/inventario/categorias?todas=1", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || "No se pudieron cargar las categorías.");
  return data.registros;
}

function aEditor(c?: CategoriaInventarioBD): CategoriaEditor {
  if (!c) return { nombre: "", prefijo: "", activa: true, totalEquipos: 0, campos: [] };
  return {
    id: c.id,
    nombre: c.nombre,
    prefijo: c.prefijo,
    activa: c.activa,
    totalEquipos: c.total_equipos || 0,
    campos: c.campos.map((campo) => ({
      uid: nuevoUid(),
      clave: campo.clave,
      etiqueta: campo.etiqueta,
      tipo: campo.tipo,
      opcionesTexto: (campo.opciones || []).join(", "),
      requerido: campo.requerido === true,
      activo: campo.activo !== false,
    })),
  };
}

function aPayload(e: CategoriaEditor) {
  return {
    id: e.id,
    nombre: e.nombre,
    prefijo: e.prefijo,
    activa: e.activa,
    campos: e.campos.map((c) => ({
      clave: c.clave,
      etiqueta: c.etiqueta,
      tipo: c.tipo,
      opciones: c.tipo === "select" ? c.opcionesTexto.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
      requerido: c.requerido,
      activo: c.activo,
    })),
  };
}

export default function CategoriasInventarioPage() {
  const [categorias, setCategorias] = useState<CategoriaInventarioBD[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [editor, setEditor] = useState<CategoriaEditor | null>(null);
  const [errorEditor, setErrorEditor] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    obtenerCategorias()
      .then((lista) => {
        setCategorias(lista);
        setErrorCarga(null);
      })
      .catch((err: unknown) => setErrorCarga(err instanceof Error ? err.message : "No se pudieron cargar las categorías."))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirEditor = (c?: CategoriaInventarioBD) => {
    setEditor(aEditor(c));
    setErrorEditor(null);
  };

  const actualizarCampo = (uid: string, cambios: Partial<CampoEditor>) => {
    setEditor((prev) => (prev ? { ...prev, campos: prev.campos.map((c) => (c.uid === uid ? { ...c, ...cambios } : c)) } : prev));
  };

  const agregarCampo = () => {
    setEditor((prev) =>
      prev ? { ...prev, campos: [...prev.campos, { uid: nuevoUid(), etiqueta: "", tipo: "texto", opcionesTexto: "", requerido: false, activo: true }] } : prev
    );
  };

  const quitarCampo = (uid: string) => {
    setEditor((prev) => (prev ? { ...prev, campos: prev.campos.filter((c) => c.uid !== uid) } : prev));
  };

  const moverCampo = (uid: string, direccion: -1 | 1) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const i = prev.campos.findIndex((c) => c.uid === uid);
      const j = i + direccion;
      if (i < 0 || j < 0 || j >= prev.campos.length) return prev;
      const campos = [...prev.campos];
      [campos[i], campos[j]] = [campos[j], campos[i]];
      return { ...prev, campos };
    });
  };

  const guardar = async () => {
    if (!editor) return;
    const payload = aPayload(editor);
    const validacion = validarCategoria(payload);
    if (!validacion.ok) return setErrorEditor(validacion.error);

    setGuardando(true);
    setErrorEditor(null);
    try {
      const res = await fetch("/api/inventario/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar la categoría.");
      setEditor(null);
      cargar();
    } catch (err) {
      setErrorEditor(err instanceof Error ? err.message : "No se pudo guardar la categoría.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6] flex flex-col">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10 flex-1">
        <PageHeader
          titulo="Categorías de inventario"
          subtitulo="Crea categorías y define qué campos se llenan en cada una."
          backHref="/inventario"
          backLabel="Control de inventario"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M4 6h16M4 12h16M4 18h10" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-[15px] font-bold text-[var(--navy)] m-0">Categorías ({categorias.length})</h3>
            <button type="button" onClick={() => abrirEditor()} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold whitespace-nowrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Nueva categoría
            </button>
          </div>

          {cargando ? (
            <p className="text-[13px] text-[var(--gray-400)] py-8 text-center">Cargando categorías…</p>
          ) : errorCarga ? (
            <div className="py-8 text-center">
              <p className="text-[13px] text-[var(--red)] font-semibold mb-3">{errorCarga}</p>
              <button type="button" onClick={() => cargar()} className="px-4 py-2 rounded-lg text-[12.5px] font-bold text-[var(--navy)] bg-[var(--gray-100)]">Reintentar</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-5">
              {categorias.map((c) => {
                const activos = c.campos.filter((campo) => campo.activo !== false);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => abrirEditor(c)}
                    className={`text-left bg-white border border-[var(--gray-200)] rounded-2xl p-4 hover:border-[var(--blue)] transition-colors ${c.activa ? "" : "opacity-60"}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-[14px] font-bold text-[var(--navy)] m-0">{c.nombre}</h4>
                      <span className="shrink-0 text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-[var(--blue-light)] text-[var(--blue)]">{c.prefijo}</span>
                    </div>
                    <p className="text-[11.5px] text-[var(--gray-400)] m-0 mb-2">
                      {c.total_equipos || 0} equipo(s) · {activos.length} campo(s){c.activa ? "" : " · Desactivada"}
                    </p>
                    <p className="text-[12px] text-[var(--text)] m-0 line-clamp-2">
                      {activos.length > 0 ? activos.map((campo) => campo.etiqueta).join(", ") : "Solo datos generales"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: crear / editar categoría */}
      {editor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={() => !guardando && setEditor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[820px] max-h-[92vh] overflow-y-auto p-5 md:p-7" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="text-[17px] font-bold text-[var(--navy)] m-0 mb-1">{editor.id ? "Editar categoría" : "Nueva categoría"}</h3>
            <p className="text-[12px] text-[var(--gray-400)] m-0 mb-5">
              Todos los equipos llevan los datos generales ({CAMPOS_GENERALES.map((c) => c.etiqueta).join(", ")}). Aquí defines solo los campos propios de esta categoría.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-3.5 mb-5 sm:items-end">
              <label className="block">
                <span className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Nombre <span className="text-[var(--red)]">*</span></span>
                <input value={editor.nombre} onChange={(e) => setEditor({ ...editor, nombre: e.target.value })} placeholder="Ej. Prenda de ropa" className={claseInput} />
              </label>
              <label className="block">
                <span className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Prefijo del folio <span className="text-[var(--red)]">*</span></span>
                <input
                  value={editor.prefijo}
                  onChange={(e) => setEditor({ ...editor, prefijo: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) })}
                  placeholder="Ej. ROP"
                  disabled={editor.totalEquipos > 0}
                  title={editor.totalEquipos > 0 ? "No se puede cambiar: la categoría ya tiene equipos registrados." : undefined}
                  className={claseInput}
                />
              </label>
              {editor.id && (
                <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--navy)] pb-2 cursor-pointer">
                  <input type="checkbox" checked={editor.activa} onChange={(e) => setEditor({ ...editor, activa: e.target.checked })} />
                  Categoría activa
                </label>
              )}
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wide font-bold text-[var(--gray-400)] m-0">Campos de la categoría</p>
              <button type="button" onClick={agregarCampo} className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--blue)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
                Agregar campo
              </button>
            </div>

            {editor.campos.length === 0 && (
              <p className="text-[12.5px] text-[var(--gray-400)] bg-[var(--gray-100)] rounded-lg p-3 mb-4">Sin campos propios: los equipos de esta categoría solo llevarán los datos generales.</p>
            )}

            <div className="flex flex-col gap-2.5 mb-5">
              {editor.campos.map((c, i) => (
                <div key={c.uid} className={`border border-[var(--gray-200)] rounded-xl p-3 ${c.activo ? "" : "bg-[var(--gray-100)]"}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-2.5">
                    <input value={c.etiqueta} onChange={(e) => actualizarCampo(c.uid, { etiqueta: e.target.value })} placeholder="Nombre del campo (ej. Talla)" className={claseInput} />
                    <select value={c.tipo} onChange={(e) => actualizarCampo(c.uid, { tipo: e.target.value as TipoCampo })} className={claseInput}>
                      {TIPOS_CAMPO.map((t) => (
                        <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                  {c.tipo === "select" && (
                    <input
                      value={c.opcionesTexto}
                      onChange={(e) => actualizarCampo(c.uid, { opcionesTexto: e.target.value })}
                      placeholder="Opciones separadas por coma (ej. CH, M, G, XG)"
                      className={`${claseInput} mt-2.5`}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2.5">
                    <label className="flex items-center gap-1.5 text-[12px] text-[var(--navy)] cursor-pointer">
                      <input type="checkbox" checked={c.requerido} onChange={(e) => actualizarCampo(c.uid, { requerido: e.target.checked })} />
                      Obligatorio
                    </label>
                    {c.clave && (
                      <label className="flex items-center gap-1.5 text-[12px] text-[var(--navy)] cursor-pointer" title="Un campo desactivado ya no se pide, pero se conserva lo capturado.">
                        <input type="checkbox" checked={c.activo} onChange={(e) => actualizarCampo(c.uid, { activo: e.target.checked })} />
                        Activo
                      </label>
                    )}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button type="button" onClick={() => moverCampo(c.uid, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-[var(--gray-100)] flex items-center justify-center disabled:opacity-30" title="Subir">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2.4"><path d="M18 15l-6-6-6 6" /></svg>
                      </button>
                      <button type="button" onClick={() => moverCampo(c.uid, 1)} disabled={i === editor.campos.length - 1} className="w-7 h-7 rounded-lg bg-[var(--gray-100)] flex items-center justify-center disabled:opacity-30" title="Bajar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2.4"><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                      {!c.clave && (
                        <button type="button" onClick={() => quitarCampo(c.uid)} className="w-7 h-7 rounded-lg bg-[var(--gray-100)] flex items-center justify-center" title="Quitar campo">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e2412c" strokeWidth="2.2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {errorEditor && <p className="text-[12.5px] text-[var(--red)] font-semibold mb-3">{errorEditor}</p>}

            <div className="flex justify-end gap-2.5">
              <button type="button" disabled={guardando} onClick={() => setEditor(null)} className="px-4 py-2 rounded-lg text-[13px] font-bold text-[var(--navy)] bg-[var(--gray-100)] disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={guardando} onClick={guardar} className="px-5 py-2 rounded-lg text-[13px] font-bold text-white bg-[var(--navy)] disabled:opacity-50">
                {guardando ? "Guardando…" : "Guardar categoría"}
              </button>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
}