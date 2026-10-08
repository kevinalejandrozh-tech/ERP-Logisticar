"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import PageHeader from "@/components/PageHeader";
import { DOCUMENTOS } from "@/lib/evaluacionCandidatosData";
import { CONFIG_DOC_DEFECTO, fechaCita, horaCita, type ConfigCargaDocumentos, type ConfigDocumento, type DocumentoConfigurado } from "@/lib/candidatoDocumentos";

// Registros del enlace general de documentos de candidatos. Solo sysadmin (middleware + API).
type Registro = { id: number; nombre: string; puesto: string; created_at: string; ultima_carga: string | null; cargados: number; total: number; completo: boolean; folio: string | null; cita_fecha: string; cita_hora: string };
type Archivo = { id: number; tipo: string; nombre: string | null; mime: string };
type Detalle = {
  registro: { id: number; nombre: string; puesto: string; token: string; created_at: string; completo: boolean; folio: string | null; cita_fecha: string; cita_hora: string };
  requeridos: DocumentoConfigurado[];
  archivos: Archivo[];
};

const API = "/api/candidatos-documentos";
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const b64aBytes = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};
const origen = () => (typeof window !== "undefined" ? window.location.origin : "");
const linkGeneral = () => `${origen()}/personas/carga-documentos`;
const linkRegistro = (t: string) => `${origen()}/personas/carga-documentos?t=${t}`;

export default function DocumentosCandidatosPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [estado, setEstado] = useState<"todos" | "incompletos" | "completos">("todos");
  const [copiado, setCopiado] = useState("");
  const [qr, setQr] = useState("");
  const [qrAbierto, setQrAbierto] = useState(false);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [unirProgreso, setUnirProgreso] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfNombre, setPdfNombre] = useState("Documentos");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Editor de la carga de documentos (obligatorios, texto con link y cita)
  const [config, setConfig] = useState<ConfigCargaDocumentos | null>(null);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  // Al abrir desde el QR de la cita (?folio=RLKA01) se arma el PDF automáticamente.
  const [pdfAuto, setPdfAuto] = useState(false);

  const cargar = () =>
    fetch(API, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRegistros(d.registros || []))
      .catch(() => setRegistros([]))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
    const folio = new URLSearchParams(window.location.search).get("folio");
    if (folio) {
      window.history.replaceState(null, "", window.location.pathname);
      fetch(`${API}?folio=${encodeURIComponent(folio)}`, { cache: "no-store" })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setPdfAuto(true);
          await cargarDetalle(d.id);
        })
        .catch((e) => alert(e.message || "No se encontró el folio."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pdfAuto && detalle) {
      setPdfAuto(false);
      unirDocumentos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfAuto, detalle]);

  const abrirConfig = () =>
    fetch(`${API}?config=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setConfig(d.config))
      .catch(() => alert("No se pudo leer la configuración."));
  const docCfg = (id: string): ConfigDocumento => ({ ...CONFIG_DOC_DEFECTO, ...(config?.documentos[id] || {}) });
  const cambiarDoc = (id: string, campo: Partial<ConfigDocumento>) =>
    setConfig((c) => (c ? { ...c, documentos: { ...c.documentos, [id]: { ...CONFIG_DOC_DEFECTO, ...(c.documentos[id] || {}), ...campo } } } : c));
  const guardarConfig = async () => {
    if (!config) return;
    setGuardandoConfig(true);
    try {
      const documentos = Object.fromEntries(DOCUMENTOS.map((d) => [d.id, docCfg(d.id)]));
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "config", ...config, documentos }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setConfig(null);
      cargar();
    } catch (e: any) {
      alert(e.message || "No se pudo guardar.");
    } finally {
      setGuardandoConfig(false);
    }
  };

  const copiar = async (texto: string, clave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(""), 2000);
    } catch {
      prompt("Copia el link:", texto);
    }
  };

  const abrirQr = async () => {
    setQrAbierto(true);
    if (!qr) setQr(await QRCode.toDataURL(linkGeneral(), { width: 260, margin: 1 }));
  };

  const cargarDetalle = async (id: number) => {
    const r = await fetch(`${API}?id=${id}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setDetalle(d);
  };
  const abrir = (id: number) => cargarDetalle(id).catch((e) => alert(e.message || "No se pudo abrir el registro."));

  const verArchivo = async (archivoId: number) => {
    const ventana = window.open("", "_blank");
    try {
      const r = await fetch(`${API}?archivo=${archivoId}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const url = URL.createObjectURL(new Blob([b64aBytes(d.contenido)], { type: d.mime }));
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
    } catch (err: any) {
      ventana?.close();
      alert(err.message || "No se pudo abrir el archivo.");
    }
  };

  const quitarArchivo = async (archivoId: number) => {
    if (!detalle || !confirm("¿Quitar este archivo?")) return;
    await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "eliminar_archivo", archivoId }) });
    await cargarDetalle(detalle.registro.id);
    cargar();
  };

  const eliminarRegistro = async () => {
    if (!detalle || !confirm(`¿Eliminar el registro de ${detalle.registro.nombre} y todos sus documentos? No se puede deshacer.`)) return;
    await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "eliminar", id: detalle.registro.id }) });
    setDetalle(null);
    cargar();
  };

  // Une todos los documentos en un solo PDF (portada + fotos + PDFs), en el orden de la lista.
  const unirDocumentos = async () => {
    if (!detalle || !detalle.archivos.length) return;
    const { registro, requeridos, archivos } = detalle;
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const salida = await PDFDocument.create();
      const fuente = await salida.embedFont(StandardFonts.Helvetica);
      const negrita = await salida.embedFont(StandardFonts.HelveticaBold);
      const azul = rgb(22 / 255, 33 / 255, 92 / 255);
      const ordenados = requeridos.flatMap((d) => archivos.filter((a) => a.tipo === d.id).map((a) => ({ ...a, doc: d.nombre })));

      const portada = salida.addPage([612, 792]);
      portada.drawText("TRANSPORTES LOGISTICAR", { x: 48, y: 730, size: 14, font: negrita, color: azul });
      portada.drawText("Expediente de documentos del candidato", { x: 48, y: 704, size: 12, font: negrita });
      portada.drawText(`${registro.nombre}  -  ${registro.puesto}`, { x: 48, y: 684, size: 11, font: fuente });
      portada.drawText(`Folio ${registro.folio || `DOC-${String(registro.id).padStart(4, "0")}`}  -  ${new Date().toLocaleDateString("es-MX")}`, { x: 48, y: 668, size: 10, font: fuente, color: rgb(0.4, 0.4, 0.4) });
      let yy = 630;
      requeridos.forEach((d) => {
        const n = archivos.filter((a) => a.tipo === d.id).length;
        portada.drawText(`${n ? "[X]" : "[  ]"}  ${d.nombre.replace(/—/g, "-")}${d.obligatorio ? "" : " (opcional)"}${n > 1 ? ` (${n} archivos)` : ""}`, { x: 48, y: yy, size: 10, font: fuente, color: n ? rgb(0, 0, 0) : rgb(0.6, 0.6, 0.6) });
        yy -= 18;
      });

      for (let i = 0; i < ordenados.length; i++) {
        const a = ordenados[i];
        setUnirProgreso(`Uniendo ${i + 1} de ${ordenados.length}…`);
        const r = await fetch(`${API}?archivo=${a.id}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        const bytes = b64aBytes(d.contenido);
        if (a.mime === "application/pdf") {
          try {
            const org = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const paginas = await salida.copyPages(org, org.getPageIndices());
            paginas.forEach((pg) => salida.addPage(pg));
          } catch {
            const pg = salida.addPage([612, 792]);
            pg.drawText(`${a.doc.replace(/—/g, "-")}: no se pudo incluir el PDF "${a.nombre || ""}".`, { x: 48, y: 740, size: 10, font: fuente });
          }
        } else {
          const img = a.mime === "image/png" ? await salida.embedPng(bytes) : await salida.embedJpg(bytes);
          const pg = salida.addPage([612, 792]);
          pg.drawText(a.doc.replace(/—/g, "-"), { x: 36, y: 765, size: 10, font: negrita, color: azul });
          const esc = Math.min(540 / img.width, 700 / img.height, 1.5);
          const w = img.width * esc;
          const h = img.height * esc;
          pg.drawImage(img, { x: (612 - w) / 2, y: 750 - h - (700 - h) / 2, width: w, height: h });
        }
      }
      const bytes = await salida.save();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfNombre(`Documentos_${registro.nombre.replace(/\s+/g, "_")}`);
      setPdfUrl(URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" })));
    } catch (err: any) {
      alert(err.message || "No se pudieron unir los documentos.");
    } finally {
      setUnirProgreso("");
    }
  };

  const descargarPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${pdfNombre}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const completo = (r: Registro) => r.completo;
  const visibles = registros.filter(
    (r) =>
      `${r.nombre} ${r.puesto}`.toLowerCase().includes(filtro.toLowerCase()) &&
      (estado === "todos" || (estado === "completos" ? completo(r) : !completo(r)))
  );
  const nCompletos = registros.filter(completo).length;

  return (
    <div className="min-h-screen bg-[#eef1f6] pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Documentos de candidatos"
          subtitulo="Registros del enlace general de carga de documentos. Solo tú puedes verlos."
          backHref="/personas"
          backLabel="Personas"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-4">
          <h3 className="text-[14px] font-bold text-[var(--navy)] m-0 mb-1">Enlace para compartir</h3>
          <p className="text-[12.5px] text-[var(--gray-400)] m-0 mb-2.5">La persona escribe su nombre y carga sus documentos. No necesita cuenta.</p>
          <div className="bg-[var(--gray-100)] rounded-lg px-3 py-2 text-[12px] break-all text-[var(--navy)] mb-2.5">{linkGeneral()}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copiar(linkGeneral(), "general")} className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">
              {copiado === "general" ? "✓ Link copiado" : "Copiar link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hola, por favor carga tu documentación para continuar con tu proceso en Transportes Logisticar: ${linkGeneral()}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#21a866] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold"
            >
              Enviar por WhatsApp
            </a>
            <button type="button" onClick={abrirQr} className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
              Ver QR
            </button>
            <a href={linkGeneral()} target="_blank" rel="noopener noreferrer" className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
              Abrir enlace
            </a>
            <button type="button" onClick={abrirConfig} className="bg-white text-[var(--navy)] border border-[var(--navy)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
              ✏️ Editar carga de documentos
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(
              [
                ["todos", `Todos (${registros.length})`],
                ["incompletos", `Incompletos (${registros.length - nCompletos})`],
                ["completos", `Completos (${nCompletos})`],
              ] as const
            ).map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => setEstado(v)}
                className={`rounded-lg px-3.5 py-2 text-[12.5px] font-bold border ${estado === v ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "bg-white text-[var(--navy)] border-[var(--gray-200)]"}`}
              >
                {t}
              </button>
            ))}
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por nombre…" className="ml-auto border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] w-full sm:w-[260px]" />
            <button type="button" onClick={cargar} className="text-[12px] text-[var(--blue)] font-bold">
              Actualizar
            </button>
          </div>

          {cargando ? (
            <p className="text-[13px] text-[var(--gray-400)]">Cargando…</p>
          ) : !visibles.length ? (
            <p className="text-[13px] text-[var(--gray-400)]">No hay registros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[var(--gray-400)] border-b border-[var(--gray-200)]">
                    <th className="py-2 pr-3">Folio</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Puesto</th>
                    <th className="py-2 pr-3">Registro</th>
                    <th className="py-2 pr-3">Avance</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3">Cita</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--gray-100)]">
                      <td className="py-2.5 pr-3 font-bold whitespace-nowrap" style={{ color: "#d2601a" }}>{r.folio || "—"}</td>
                      <td className="py-2.5 pr-3 font-bold text-[var(--navy)]">{r.nombre}</td>
                      <td className="py-2.5 pr-3">{r.puesto}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{fecha(r.created_at)}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-[90px] h-2 rounded-full bg-[var(--gray-200)] overflow-hidden">
                            <div className="h-2 rounded-full" style={{ width: `${r.total ? (r.cargados / r.total) * 100 : 0}%`, background: completo(r) ? "#21a866" : "#2f6fed" }} />
                          </div>
                          {r.cargados}/{r.total}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${completo(r) ? "bg-[#e3f6ec] text-[#178a52]" : "bg-[#fff4e0] text-[#b06a00]"}`}>{completo(r) ? "Completo" : "Incompleto"}</span>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{r.completo ? `${fechaCita(r.cita_fecha) || "Sin fecha"} ${horaCita(r.cita_hora) ? `${r.cita_hora} hrs` : ""}` : "—"}</td>
                      <td className="py-2.5 text-right">
                        <button type="button" onClick={() => abrir(r.id)} className="text-[var(--blue)] font-bold">
                          Ver documentos
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {qrAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center z-50" onClick={() => setQrAbierto(false)}>
          <div className="bg-white rounded-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-3">QR — Carga de documentos</h3>
            {qr ? <img src={qr} alt="QR del enlace" className="w-[240px] h-[240px] mx-auto" /> : <p className="text-[13px]">Generando…</p>}
            <div className="flex gap-2 justify-center mt-4">
              <button type="button" onClick={() => setQrAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
                Cerrar
              </button>
              {qr && (
                <a href={qr} download="QR_Carga_Documentos.png" className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">
                  Descargar QR
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[640px] max-w-[94%] p-5 sm:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] m-0 mb-1">Documentación — {detalle.registro.nombre}</h3>
            <p className="text-[12.5px] text-[var(--gray-400)] m-0 mb-3">
              {detalle.registro.puesto} · Registrado el {fecha(detalle.registro.created_at)}
              {detalle.registro.folio && (
                <>
                  {" "}· Folio <b style={{ color: "#d2601a" }}>{detalle.registro.folio}</b>
                  {detalle.registro.completo && ` · Cita ${fechaCita(detalle.registro.cita_fecha) || "sin fecha"} ${detalle.registro.cita_hora ? `${detalle.registro.cita_hora} hrs` : ""}`}
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button type="button" onClick={() => copiar(linkRegistro(detalle.registro.token), "registro")} className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-2 text-[12px] font-bold">
                {copiado === "registro" ? "✓ Link copiado" : "Copiar su link para continuar"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Hola ${detalle.registro.nombre.split(" ")[0]}, por favor completa tu documentación en Transportes Logisticar: ${linkRegistro(detalle.registro.token)}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#21a866] text-white rounded-lg px-3.5 py-2 text-[12px] font-bold"
              >
                Recordar por WhatsApp
              </a>
            </div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[13.5px] font-bold text-[var(--navy)] m-0">
                Documentos cargados: {detalle.requeridos.filter((d) => detalle.archivos.some((a) => a.tipo === d.id)).length} de {detalle.requeridos.length}
                {" "}· <span className={detalle.registro.completo ? "text-[var(--green)]" : "text-[#b06a00]"}>{detalle.registro.completo ? "Obligatorios completos" : "Faltan obligatorios"}</span>
              </h4>
              <button type="button" onClick={() => cargarDetalle(detalle.registro.id)} className="text-[12px] text-[var(--blue)] font-bold">
                Actualizar
              </button>
            </div>
            <div className="grid gap-1.5 max-h-[45vh] overflow-y-auto">
              {detalle.requeridos.map((d) => {
                const propios = detalle.archivos.filter((a) => a.tipo === d.id);
                return (
                  <div key={d.id} className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full shrink-0 text-[10px] text-white font-bold flex items-center justify-center ${propios.length ? "bg-[var(--green)]" : "bg-[var(--gray-200)]"}`}>{propios.length ? "✓" : ""}</span>
                      <b className="text-[var(--navy)] flex-1">{d.nombre}</b>
                      {!d.obligatorio && <span className="text-[10.5px] font-bold text-[var(--gray-400)] border border-[var(--gray-200)] rounded px-1.5">Opcional</span>}
                      {!propios.length && <span className="text-[var(--gray-400)]">Pendiente</span>}
                    </div>
                    {propios.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 mt-1 pl-6">
                        <span>{a.mime === "application/pdf" ? "📄" : "🖼️"}</span>
                        <span className="truncate flex-1">{a.nombre || "archivo"}</span>
                        <button type="button" onClick={() => verArchivo(a.id)} className="text-[var(--blue)] font-bold">Ver</button>
                        <button type="button" onClick={() => quitarArchivo(a.id)} className="text-[var(--red)] font-bold">Quitar</button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-between gap-2.5 mt-5">
              <button type="button" onClick={eliminarRegistro} className="text-[var(--red)] text-[12.5px] font-bold">
                Eliminar registro
              </button>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={() => setDetalle(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  Cerrar
                </button>
                <button type="button" onClick={unirDocumentos} disabled={!detalle.archivos.length || !!unirProgreso} className="bg-[var(--navy)] disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  {unirProgreso || "Imprimir todo en un PDF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {config && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[860px] max-w-[96%] p-5 sm:p-7">
            <h3 className="text-[17px] font-bold text-[var(--navy)] m-0 mb-1">Editar carga de documentos</h3>
            <p className="text-[12.5px] text-[var(--gray-400)] m-0 mb-4">
              "Obligatorio" solo lo ves tú. Al completar los obligatorios, la persona recibe su folio, la cita y el QR. El texto y el link se muestran debajo de cada documento.
            </p>

            <div className="border border-[var(--gray-200)] rounded-xl p-4 mb-4">
              <h4 className="text-[13.5px] font-bold text-[var(--navy)] m-0 mb-2">Cita</h4>
              <div className="flex flex-wrap gap-3">
                <label className="grid gap-1 text-[12px] font-bold text-[var(--navy)]">
                  Día
                  <input type="date" value={config.cita_fecha} onChange={(e) => setConfig({ ...config, cita_fecha: e.target.value })} className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] font-normal" />
                </label>
                <label className="grid gap-1 text-[12px] font-bold text-[var(--navy)]">
                  Hora
                  <input type="time" value={config.cita_hora} onChange={(e) => setConfig({ ...config, cita_hora: e.target.value })} className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] font-normal" />
                </label>
              </div>
              <p className="text-[11.5px] text-[var(--gray-400)] m-0 mt-2">Cada persona conserva la cita vigente al momento de completar sus documentos.</p>
            </div>

            <div className="grid gap-2 max-h-[52vh] overflow-y-auto pr-1">
              {DOCUMENTOS.map((d) => {
                const c = docCfg(d.id);
                return (
                  <div key={d.id} className="border border-[var(--gray-200)] rounded-xl p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <b className="text-[13px] text-[var(--navy)] flex-1">{d.nombre}</b>
                      {d.soloOperador && <span className="text-[10.5px] font-bold text-[var(--gray-400)] border border-[var(--gray-200)] rounded px-1.5">Solo operadores</span>}
                      <label className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--navy)] cursor-pointer">
                        <input type="checkbox" checked={c.obligatorio} onChange={(e) => cambiarDoc(d.id, { obligatorio: e.target.checked })} />
                        Obligatorio
                      </label>
                    </div>
                    <div className="grid sm:grid-cols-[1fr_1fr] gap-2">
                      <input
                        value={c.texto}
                        maxLength={300}
                        onChange={(e) => cambiarDoc(d.id, { texto: e.target.value })}
                        placeholder="Texto (ej. Puedes descargar tu CURP desde aquí:)"
                        className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px]"
                      />
                      <input
                        value={c.url}
                        onChange={(e) => cambiarDoc(d.id, { url: e.target.value })}
                        placeholder="Link (https://…)"
                        className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-end gap-2.5 mt-5">
              <button type="button" onClick={() => setConfig(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarConfig} disabled={guardandoConfig} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoConfig ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfUrl && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-[60]">
          <div className="bg-white rounded-2xl w-[720px] max-w-[94%] p-4 sm:p-6 md:p-7">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Previsualización — Documentación del candidato</h3>
            <iframe ref={iframeRef} src={pdfUrl} className="w-full h-[560px] border border-[var(--gray-200)] rounded-lg" />
            <div className="flex gap-2.5 justify-end mt-4 flex-wrap">
              <button type="button" onClick={() => { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button type="button" onClick={descargarPdf} className="bg-white text-[var(--navy)] border border-[var(--navy)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Descargar PDF
              </button>
              <button type="button" onClick={() => { const w = iframeRef.current?.contentWindow; w?.focus(); w?.print(); }} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
