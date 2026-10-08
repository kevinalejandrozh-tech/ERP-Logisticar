"use client";
import { useEffect, useState, type ReactNode } from "react";
import Logo from "@/components/Logo";
import CitaCandidato, { type CitaDatos } from "@/components/CitaCandidato";
import { DOC_MAX_ARCHIVOS, DOC_MAX_BYTES_PDF, type DocumentoRequerido } from "@/lib/evaluacionCandidatosData";

// texto/url: ayuda con link al portal oficial (solo el enlace general la envía).
type Requerido = DocumentoRequerido & { texto?: string; url?: string };
type Archivo = { id: number; tipo: string; nombre: string | null; mime: string };

const leerBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(blob);
  });

// Fotos: se reducen a máx. 2000 px en JPEG, suficiente para que se lean bien.
const comprimirImagen = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, 2000 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let calidad = 0.85;
      let data = c.toDataURL("image/jpeg", calidad);
      while (data.length > (DOC_MAX_BYTES_PDF * 4) / 3 && calidad > 0.4) {
        calidad -= 0.1;
        data = c.toDataURL("image/jpeg", calidad);
      }
      resolve(data.split(",")[1] || "");
    };
    img.onerror = () => reject(new Error("No se pudo leer la foto."));
    img.src = url;
  });

// UI de carga (compartida por el enlace de una evaluación y el enlace general de documentos).
// `api` recibe GET ?t=token y POST { t, ... } con el mismo formato en ambos casos.
export default function CargaDocumentosCandidato({ api, token, aviso }: { api: string; token: string; aviso?: ReactNode }) {
  const [nombre, setNombre] = useState("");
  const [requeridos, setRequeridos] = useState<Requerido[]>([]);
  const [completoApi, setCompletoApi] = useState<boolean | null>(null);
  const [cita, setCita] = useState<CitaDatos | null>(null);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [error, setError] = useState("");
  const [subiendo, setSubiendo] = useState<string | null>(null);

  const cargar = (t: string) =>
    fetch(`${api}?t=${encodeURIComponent(t)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setNombre(d.nombre);
        setRequeridos(d.requeridos);
        setArchivos(d.archivos);
        setCompletoApi(typeof d.completo === "boolean" ? d.completo : null);
        setCita(d.cita || null);
        setEstado("listo");
      })
      .catch((e) => {
        setError(e.message || "El enlace no es válido.");
        setEstado("error");
      });

  useEffect(() => {
    if (!token) {
      setError("El enlace no es válido.");
      setEstado("error");
      return;
    }
    cargar(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, api]);

  const subir = async (tipo: string, file: File | null) => {
    if (!file) return;
    setError("");
    const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const esImagen = file.type.startsWith("image/");
    if (!esPdf && !esImagen) return setError("Solo se aceptan archivos PDF o fotografías.");
    if (esPdf && file.size > DOC_MAX_BYTES_PDF) return setError("El PDF pesa más de 3 MB. Puedes tomarle foto al documento en su lugar.");
    setSubiendo(tipo);
    try {
      const contenido = esPdf ? await leerBase64(file) : await comprimirImagen(file);
      const r = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, tipo, nombre: file.name, mime: esPdf ? "application/pdf" : "image/jpeg", contenido }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await cargar(token);
    } catch (e: any) {
      setError(e.message || "No se pudo subir el archivo.");
    } finally {
      setSubiendo(null);
    }
  };

  const quitar = async (archivoId: number) => {
    if (!confirm("¿Quitar este archivo?")) return;
    await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token, accion: "eliminar", archivoId }),
    });
    cargar(token);
  };

  const cargados = requeridos.filter((d) => archivos.some((a) => a.tipo === d.id)).length;
  // El enlace general decide "completo" con los obligatorios (no se muestran al candidato).
  const completo = completoApi ?? (requeridos.length > 0 && cargados === requeridos.length);

  return (
    <div className="min-h-screen bg-[#eef1f6] pb-12">
      <header className="bg-white/85 backdrop-blur-[2px] border-b border-[var(--gray-200)] shadow-sm mb-6">
        <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <Logo size={36} enlace={false} />
          <div>
            <h1 className="font-display text-[16px] sm:text-[18px] font-bold text-[var(--navy)] m-0">Transportes Logisticar</h1>
            <p className="text-[11.5px] sm:text-[12px] text-[var(--gray-400)] m-0">Carga de documentos</p>
          </div>
        </div>
      </header>

      <div className="max-w-[760px] mx-auto px-4 sm:px-6">
        {estado === "cargando" ? (
          <p className="text-[13px] text-[var(--gray-400)]">Cargando…</p>
        ) : estado === "error" ? (
          <div className="bg-white/80 backdrop-blur-[2px] rounded-[18px] p-6 text-[13.5px]">{error}</div>
        ) : (
          <div className="grid gap-3">
            <div className="bg-white/80 backdrop-blur-[2px] rounded-[18px] p-5 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
              <p className="text-[14px] font-bold text-[var(--navy)] m-0 mb-1">Hola, {nombre}</p>
              {aviso}
              <p className="text-[13px] text-[var(--gray-400)] m-0 mb-3">
                Sube cada documento como PDF o tómale una foto. Verifica que se lea completo y con claridad.
              </p>
              <div className="h-2 rounded-full bg-[var(--gray-200)] overflow-hidden">
                <div className="h-2 rounded-full" style={{ width: `${requeridos.length ? (cargados / requeridos.length) * 100 : 0}%`, background: completo ? "#21a866" : "#2f6fed" }} />
              </div>
              <p className={`text-[12.5px] font-bold m-0 mt-1.5 ${completo ? "text-[var(--green)]" : "text-[var(--navy)]"}`}>
                {completo ? (cita ? "¡Listo! Tu documentación está completa y tu cita quedó confirmada." : "¡Listo! Tu documentación está completa. Gracias.") : `${cargados} de ${requeridos.length} documentos`}
              </p>
            </div>

            {completo && cita && <CitaCandidato cita={cita} />}

            {error && <p className="text-[13px] text-[var(--red)] font-semibold m-0">{error}</p>}

            {requeridos.map((d) => {
              const propios = archivos.filter((a) => a.tipo === d.id);
              const hecho = propios.length > 0;
              const puedeMas = propios.length < (d.multiple ? DOC_MAX_ARCHIVOS : 1);
              return (
                <div key={d.id} className={`bg-white/80 backdrop-blur-[2px] rounded-xl p-4 border ${hecho ? "border-[#bfe8d2]" : "border-[var(--gray-200)]"}`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white ${hecho ? "bg-[var(--green)]" : "bg-[var(--gray-200)]"}`}>{hecho ? "✓" : ""}</span>
                    <div className="flex-1">
                      <p className="text-[13.5px] font-bold text-[var(--navy)] m-0">{d.nombre}</p>
                      {d.ayuda && <p className="text-[12px] text-[var(--gray-400)] m-0">{d.ayuda}</p>}
                      {(d.texto || d.url) && (
                        <p className="text-[12px] text-[var(--gray-500)] m-0 mt-0.5 break-words">
                          {d.texto}{" "}
                          {d.url && (
                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[var(--blue)] font-bold underline">
                              {d.url.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                            </a>
                          )}
                        </p>
                      )}
                      {propios.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-[12px] mt-1.5">
                          <span>{a.mime === "application/pdf" ? "📄" : "🖼️"}</span>
                          <span className="truncate flex-1">{a.nombre || "archivo"}</span>
                          <button type="button" onClick={() => quitar(a.id)} className="text-[var(--red)] font-bold">
                            Quitar
                          </button>
                        </div>
                      ))}
                      {puedeMas && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {subiendo === d.id ? (
                            <span className="text-[12.5px] text-[var(--blue)] font-semibold">Subiendo…</span>
                          ) : (
                            <>
                              <label className="bg-[var(--navy)] text-white rounded-lg px-3.5 py-2 text-[12.5px] font-bold cursor-pointer">
                                📷 Tomar foto
                                <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!subiendo} onChange={(e) => { subir(d.id, e.target.files?.[0] || null); e.target.value = ""; }} />
                              </label>
                              <label className="bg-white text-[var(--navy)] border border-[var(--navy)] rounded-lg px-3.5 py-2 text-[12.5px] font-bold cursor-pointer">
                                📎 Subir archivo (PDF o imagen)
                                <input type="file" accept="application/pdf,.pdf,image/*" className="hidden" disabled={!!subiendo} onChange={(e) => { subir(d.id, e.target.files?.[0] || null); e.target.value = ""; }} />
                              </label>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
