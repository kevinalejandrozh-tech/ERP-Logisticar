"use client";
import { useEffect, useRef, useState } from "react";

const OPCIONES_CATEGORIA = ["Administrativo", "Operación"];

type Fila = {
  id: number;
  categoria: string | null;
  puesto: string | null;
  area: string | null;
  jefe_directo: string | null;
  subordinacion: string | null;
  descripcion_puesto: string | null;
  actividades_diarias: string | null;
  archivo_nombre?: string | null;
  archivo_mime?: string | null;
};

const ACEPTA_ARCHIVO = ".pdf,.doc,.docx,.xls,.xlsx";
const MIME_POR_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const MAX_BYTES = 4_400_000;

type Previa = { nombre: string; mime: string; contenido: string; tipo: "pdf" | "html" | "sin-vista"; html?: string; blobUrl?: string };

function dataUriABlob(dataUri: string, mime: string): Blob {
  const b64 = dataUri.slice(dataUri.indexOf(",") + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function etiquetaTipo(mime?: string | null) {
  if (!mime) return "";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word")) return "Word";
  if (mime.includes("excel") || mime.includes("spreadsheet")) return "Excel";
  return "";
}

export default function CuadroBasicoModal({ onCerrar }: { onCerrar: () => void }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [areas, setAreas] = useState<string[]>([]);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [subiendoId, setSubiendoId] = useState<number | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [abriendoId, setAbriendoId] = useState<number | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const filaArchivo = useRef<number | null>(null);

  const elegirArchivo = (id: number) => {
    filaArchivo.current = id;
    inputArchivo.current?.click();
  };

  const subirArchivo = async (archivo: File) => {
    const id = filaArchivo.current;
    if (!id) return;
    const ext = archivo.name.split(".").pop()?.toLowerCase() || "";
    const mime = MIME_POR_EXT[ext];
    if (!mime) return alert("Solo se permiten archivos Word, PDF o Excel.");
    if (archivo.size > MAX_BYTES) return alert("El archivo es demasiado grande (máx. ~4 MB).");
    setSubiendoId(id);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] || "");
        r.onerror = () => rej(new Error("No se pudo leer el archivo."));
        r.readAsDataURL(archivo);
      });
      const res = await fetch("/api/cuadro-basico/archivo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, nombreArchivo: archivo.name, contenido: `data:${mime};base64,${b64}` }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir el archivo.");
      setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, archivo_nombre: archivo.name, archivo_mime: mime } : f)));
    } catch (e: any) {
      alert(e.message || "Error al subir el archivo.");
    } finally {
      setSubiendoId(null);
      filaArchivo.current = null;
    }
  };

  const obtenerArchivo = async (id: number) => {
    const res = await fetch(`/api/cuadro-basico/archivo?id=${id}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo abrir el archivo.");
    return data as { nombreArchivo: string; mime: string; contenido: string };
  };

  const descargar = (nombre: string, mime: string, contenido: string) => {
    const url = URL.createObjectURL(dataUriABlob(contenido, mime));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre || "archivo";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const previsualizar = async (id: number) => {
    setAbriendoId(id);
    try {
      const { nombreArchivo, mime, contenido } = await obtenerArchivo(id);
      const base = { nombre: nombreArchivo, mime, contenido };
      if (mime === "application/pdf") {
        setPrevia({ ...base, tipo: "pdf", blobUrl: URL.createObjectURL(dataUriABlob(contenido, mime)) });
      } else if (mime.includes("wordprocessingml")) {
        const mammoth = await import("mammoth");
        const buf = await dataUriABlob(contenido, mime).arrayBuffer();
        const r = await mammoth.convertToHtml({ arrayBuffer: buf });
        setPrevia({ ...base, tipo: "html", html: r.value || "<p>(Documento vacío)</p>" });
      } else if (mime.includes("excel") || mime.includes("spreadsheet")) {
        const XLSX = await import("xlsx");
        const libro = XLSX.read(contenido.slice(contenido.indexOf(",") + 1), { type: "base64" });
        const html = libro.SheetNames.map((h) => `<h4>${h.replace(/</g, "&lt;")}</h4>` + XLSX.utils.sheet_to_html(libro.Sheets[h], { header: "", footer: "" })).join("");
        setPrevia({ ...base, tipo: "html", html });
      } else {
        setPrevia({ ...base, tipo: "sin-vista" });
      }
    } catch (e: any) {
      alert(e.message || "No se pudo previsualizar el archivo.");
    } finally {
      setAbriendoId(null);
    }
  };

  const cerrarPrevia = () => {
    if (previa?.blobUrl) URL.revokeObjectURL(previa.blobUrl);
    setPrevia(null);
  };

  const quitarArchivo = async (id: number) => {
    if (!confirm("¿Quitar el archivo de esta fila?")) return;
    try {
      const res = await fetch(`/api/cuadro-basico/archivo?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Error al quitar el archivo.");
      setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, archivo_nombre: null, archivo_mime: null } : f)));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const cargar = () => {
    fetch("/api/cuadro-basico", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setFilas(d.filas || []))
      .catch(() => {})
      .finally(() => setCargando(false));
  };
  useEffect(() => {
    cargar();
    fetch("/api/areas-personal", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAreas(d.areas || []))
      .catch(() => {});
  }, []);

  const resumen = filas.reduce((acc: Record<string, number>, f) => {
    const clave = f.puesto?.trim() || "Sin puesto";
    acc[clave] = (acc[clave] || 0) + 1;
    return acc;
  }, {});

  const guardarFila = async (fila: Fila) => {
    setGuardandoId(fila.id);
    try {
      await fetch("/api/cuadro-basico/fila", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fila) });
    } catch {
      // se reintenta al cerrar/reabrir
    } finally {
      setGuardandoId(null);
    }
  };
  const actualizarCampo = (id: number, campo: keyof Fila, valor: string) => {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  };
  const guardarConDebounce = (fila: Fila) => {
    guardarFila(fila);
  };

  const agregarFila = async () => {
    const res = await fetch("/api/cuadro-basico/fila", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoria: "Operación", puesto: "", area: "", jefe_directo: "", subordinacion: "", descripcion_puesto: "", actividades_diarias: "" }) });
    const data = await res.json();
    setFilas((prev) => [...prev, { id: data.id, categoria: "Operación", puesto: "", area: "", jefe_directo: "", subordinacion: "", descripcion_puesto: "", actividades_diarias: "" }]);
  };

  const eliminarFila = async (id: number) => {
    if (!confirm("¿Eliminar esta fila del cuadro básico?")) return;
    setFilas((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch("/api/cuadro-basico/eliminar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      cargar();
    }
  };

  const columnas: { key: keyof Fila; label: string; ancho: string }[] = [
    { key: "categoria", label: "Categoría", ancho: "w-[130px]" },
    { key: "puesto", label: "Puesto", ancho: "w-[140px]" },
    { key: "area", label: "Área", ancho: "w-[160px]" },
    { key: "jefe_directo", label: "Jefe directo", ancho: "w-[140px]" },
    { key: "archivo_nombre", label: "Archivo", ancho: "w-[170px]" },
    { key: "subordinacion", label: "Subordinación", ancho: "w-[140px]" },
    { key: "descripcion_puesto", label: "Descripción del puesto", ancho: "w-[220px]" },
    { key: "actividades_diarias", label: "Actividades diarias", ancho: "w-[220px]" },
  ];

  return (
    <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <input
        ref={inputArchivo}
        type="file"
        accept={ACEPTA_ARCHIVO}
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          if (archivo) subirArchivo(archivo);
        }}
      />
      {previa && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.55)] flex items-center justify-center p-4 z-[60]" onClick={(e) => { e.stopPropagation(); cerrarPrevia(); }}>
          <div className="bg-white rounded-2xl w-full max-w-[1000px] h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--gray-200)]">
              <h3 className="text-[14px] font-bold text-[var(--navy)] m-0 truncate">Previsualización — {previa.nombre}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => descargar(previa.nombre, previa.mime, previa.contenido)} className="bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-3 py-1.5 text-[12px] font-bold">Descargar</button>
                <span onClick={cerrarPrevia} className="text-[var(--gray-400)] cursor-pointer text-xl leading-none">✕</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {previa.tipo === "pdf" && <iframe src={previa.blobUrl} title={previa.nombre} className="w-full h-full border-0" />}
              {previa.tipo === "html" && (
                <div
                  className="p-5 text-[13px] text-[var(--text)] [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--gray-200)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_h4]:font-bold [&_h4]:text-[var(--navy)] [&_h4]:my-3 [&_p]:mb-2 [&_img]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: previa.html || "" }}
                />
              )}
              {previa.tipo === "sin-vista" && (
                <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-[13px] text-[var(--gray-400)] m-0">Este formato (Word .doc antiguo) no se puede previsualizar en el navegador. Descárgalo para abrirlo.</p>
                  <button type="button" onClick={() => descargar(previa.nombre, previa.mime, previa.contenido)} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2 text-[12.5px] font-bold">Descargar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl w-full max-w-[1200px] h-[88vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--gray-200)]">
          <h2 className="text-[16px] font-bold text-[var(--navy)] m-0">Cuadro Básico</h2>
          <span onClick={onCerrar} className="text-[var(--gray-400)] cursor-pointer text-xl leading-none">✕</span>
        </div>

        <div className="px-6 py-4 border-b border-[var(--gray-200)]">
          {cargando ? (
            <p className="text-[12.5px] text-[var(--gray-400)] m-0">Cargando resumen...</p>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {Object.entries(resumen).map(([puesto, cantidad]) => (
                <span key={puesto} className="text-[12.5px] text-[var(--text)]">
                  <b className="text-[var(--navy)]">{puesto}</b> {cantidad}
                </span>
              ))}
              <span className="text-[12.5px] font-bold text-[var(--blue)]">Total: {filas.length}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {!cargando && (
            <table className="w-full border-collapse min-w-[1470px]">
              <thead>
                <tr>
                  {columnas.map((c) => (
                    <th key={c.key} className={`sticky top-0 bg-[var(--navy)] text-white text-left text-[10px] uppercase tracking-wide px-2.5 py-2.5 ${c.ancho}`}>
                      {c.label}
                    </th>
                  ))}
                  <th className="sticky top-0 bg-[var(--navy)] w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--gray-200)]">
                    {columnas.map((c) => (
                      <td key={c.key} className="p-1 align-top">
                        {c.key === "archivo_nombre" ? (
                          <CeldaArchivo
                            fila={f}
                            subiendo={subiendoId === f.id}
                            abriendo={abriendoId === f.id}
                            onCargar={() => elegirArchivo(f.id)}
                            onVer={() => previsualizar(f.id)}
                            onDescargar={async () => {
                              try {
                                const d = await obtenerArchivo(f.id);
                                descargar(d.nombreArchivo, d.mime, d.contenido);
                              } catch (e: any) {
                                alert(e.message);
                              }
                            }}
                            onQuitar={() => quitarArchivo(f.id)}
                          />
                        ) : c.key === "categoria" ? (
                          <select
                            value={f.categoria || ""}
                            onChange={(e) => {
                              actualizarCampo(f.id, "categoria", e.target.value);
                              guardarConDebounce({ ...f, categoria: e.target.value });
                            }}
                            className="w-full border border-transparent hover:border-[var(--gray-200)] focus:border-[var(--blue)] rounded-md px-2 py-1.5 text-[12px] bg-transparent"
                          >
                            {OPCIONES_CATEGORIA.map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        ) : c.key === "area" ? (
                          <select
                            value={f.area || ""}
                            onChange={(e) => {
                              actualizarCampo(f.id, "area", e.target.value);
                              guardarConDebounce({ ...f, area: e.target.value });
                            }}
                            className="w-full border border-transparent hover:border-[var(--gray-200)] focus:border-[var(--blue)] rounded-md px-2 py-1.5 text-[12px] bg-transparent"
                          >
                            <option value="">—</option>
                            {areas.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={f[c.key] || ""}
                            onChange={(e) => actualizarCampo(f.id, c.key, e.target.value)}
                            onBlur={() => guardarConDebounce(filas.find((x) => x.id === f.id)!)}
                            className="w-full border border-transparent hover:border-[var(--gray-200)] focus:border-[var(--blue)] rounded-md px-2 py-1.5 text-[12px]"
                          />
                        )}
                      </td>
                    ))}
                    <td className="p-1 align-top text-center">
                      <span onClick={() => eliminarFila(f.id)} className="text-[var(--red)] cursor-pointer inline-block pt-1.5" title="Eliminar fila">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--gray-200)] flex items-center justify-between">
          <button type="button" onClick={agregarFila} className="flex items-center gap-1.5 bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            Agregar fila
          </button>
          {guardandoId !== null && <span className="text-[11px] text-[var(--gray-400)]">Guardando...</span>}
          <button type="button" onClick={onCerrar} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function CeldaArchivo({
  fila,
  subiendo,
  abriendo,
  onCargar,
  onVer,
  onDescargar,
  onQuitar,
}: {
  fila: Fila;
  subiendo: boolean;
  abriendo: boolean;
  onCargar: () => void;
  onVer: () => void;
  onDescargar: () => void;
  onQuitar: () => void;
}) {
  if (subiendo) return <span className="text-[11px] text-[var(--gray-400)] px-2 py-1.5 inline-block">Subiendo...</span>;
  if (!fila.archivo_nombre) {
    return (
      <button type="button" onClick={onCargar} className="flex items-center gap-1 text-[var(--blue)] text-[11.5px] font-bold px-2 py-1.5 rounded-md hover:bg-[var(--blue-light)]" title="Cargar Word, PDF o Excel">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16" /></svg>
        Cargar archivo
      </button>
    );
  }
  return (
    <div className="px-1 py-1">
      <div className="text-[11px] text-[var(--text)] truncate max-w-[160px]" title={fila.archivo_nombre}>
        <b className="text-[var(--navy)]">{etiquetaTipo(fila.archivo_mime)}</b> {fila.archivo_nombre}
      </div>
      <div className="flex items-center gap-2 mt-1 text-[10.5px] font-bold">
        <span onClick={onVer} className="text-[var(--blue)] cursor-pointer">{abriendo ? "Abriendo..." : "Ver"}</span>
        <span onClick={onDescargar} className="text-[var(--blue)] cursor-pointer">Descargar</span>
        <span onClick={onCargar} className="text-[var(--gray-400)] cursor-pointer" title="Reemplazar archivo">Cambiar</span>
        <span onClick={onQuitar} className="text-[var(--red)] cursor-pointer">Quitar</span>
      </div>
    </div>
  );
}
