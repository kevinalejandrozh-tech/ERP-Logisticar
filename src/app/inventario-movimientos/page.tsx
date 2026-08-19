"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

type ItemInventario = {
  id: number;
  codigo: string;
  descripcion: string;
  categoria: string;
  referencia: string;
  costoUnitario: string;
  cantidad: number;
  proveedor: string;
  ubicacion: string;
  fechaIngreso: string;
  unidad: string;
  numeroEtiqueta: string;
};

const OPCIONES_UNIDAD_MEDIDA = ["PZA", "LITRO", "CAJA", "KIT", "JUEGO", "PAR", "ROLLO", "GALON"];

export default function InventarioMovimientosPage() {
  const [vista, setVista] = useState<"menu" | "entrada" | "salida">("menu");

  return (
    <div className="min-h-screen flex justify-center bg-[#dcdfe6] py-6 px-4">
      <div className="w-full max-w-[430px] bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-[var(--gray-200)] flex items-center justify-between">
          <Link href="/ordenes-servicio/inventario" className="text-[var(--blue)] text-[12.5px] font-semibold no-underline">
            ← Regresar a reportes
          </Link>
          <div className="flex items-center gap-2">
            <Logo size={26} />
          </div>
        </div>

        {vista === "menu" && <MenuInicial onEntrada={() => setVista("entrada")} onSalida={() => setVista("salida")} />}
        {vista === "entrada" && <FormularioEntrada onFinalizar={() => setVista("menu")} />}
        {vista === "salida" && <FormularioSalida onFinalizar={() => setVista("menu")} />}
      </div>
    </div>
  );
}

function MenuInicial({ onEntrada, onSalida }: { onEntrada: () => void; onSalida: () => void }) {
  return (
    <div className="px-5 py-8 flex flex-col gap-4">
      <h1 className="text-center font-display font-extrabold text-[var(--navy)] text-[15px] uppercase tracking-wide mb-2">
        Movimientos de inventario
      </h1>
      <button
        type="button"
        onClick={onEntrada}
        className="flex items-center justify-center gap-2.5 bg-[var(--navy)] text-white font-display font-bold rounded-xl py-5 text-[14px]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
        Crear Entrada
      </button>
      <button
        type="button"
        onClick={onSalida}
        className="flex items-center justify-center gap-2.5 bg-white text-[var(--navy)] border-2 border-[var(--navy)] font-display font-bold rounded-xl py-5 text-[14px]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        Crear Salida
      </button>
    </div>
  );
}

function FormularioEntrada({ onFinalizar }: { onFinalizar: () => void }) {
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [referencia, setReferencia] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [unidad, setUnidad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [registrado, setRegistrado] = useState<{ codigo: string; numeroEtiqueta: string } | null>(null);
  const [mensajeImpresora, setMensajeImpresora] = useState("");

  const registrarEntrada = async () => {
    if (!descripcion.trim() || !cantidad) {
      setError("Captura al menos la descripción y la cantidad.");
      return;
    }
    setError("");
    setGuardando(true);
    try {
      const res = await fetch("/api/inventario/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: descripcion.trim(),
          categoria,
          referencia,
          costoUnitario,
          cantidad,
          proveedor,
          ubicacion,
          unidad,
          fechaIngreso: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar la entrada.");
      setRegistrado({ codigo: data.codigo, numeroEtiqueta: data.numeroEtiqueta });
    } catch (err: any) {
      setError(err.message || "Error al registrar la entrada.");
    } finally {
      setGuardando(false);
    }
  };

  const imprimirEtiquetas = () => {
    setMensajeImpresora("No se pudo establecer conexión con la impresora.");
  };

  if (registrado) {
    return (
      <div className="px-5 py-7 flex flex-col gap-4">
        <div className="w-14 h-14 rounded-full bg-[var(--green)]/15 flex items-center justify-center mx-auto">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <p className="text-center text-[13.5px] text-[var(--navy)] font-bold m-0">Entrada registrada</p>
        <p className="text-center text-[12.5px] text-[var(--gray-400)] m-0">
          Código: <span className="font-bold text-[var(--navy)]">{registrado.codigo}</span> · N° Etiqueta: <span className="font-bold text-[var(--navy)]">{registrado.numeroEtiqueta}</span>
        </p>
        {mensajeImpresora && <p className="text-center text-[12px] text-[var(--red)] bg-[var(--red)]/10 rounded-lg py-2 px-3">{mensajeImpresora}</p>}
        <button type="button" onClick={imprimirEtiquetas} className="w-full flex items-center justify-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] font-display font-bold rounded-lg py-3 text-[13px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
          Imprimir Etiquetas
        </button>
        <button type="button" onClick={onFinalizar} className="w-full bg-[var(--navy)] text-white font-display font-bold rounded-lg py-3 text-[13px]">
          Cerrar y regresar al menú
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 flex flex-col gap-3.5">
      <h1 className="text-center font-display font-extrabold text-[var(--navy)] text-[14px] uppercase tracking-wide mb-1">Crear entrada</h1>
      <div>
        <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Descripción</label>
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm" />
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Categoría</label>
        <input value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm" />
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Referencia</label>
        <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Costo unitario</label>
          <input type="number" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm" />
        </div>
        <div>
          <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Cantidad</label>
          <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Proveedor</label>
        <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm" />
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Asignar Ubicación</label>
        <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm" />
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Unidad</label>
        <input value={unidad} onChange={(e) => setUnidad(e.target.value)} list="dl-unidad-medida" className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm" />
        <datalist id="dl-unidad-medida">
          {OPCIONES_UNIDAD_MEDIDA.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
      {error && <p className="text-[12px] text-[var(--red)] m-0">{error}</p>}
      <button type="button" onClick={registrarEntrada} disabled={guardando} className="w-full bg-[var(--navy)] disabled:opacity-60 text-white font-display font-bold rounded-lg py-3.5 text-[13.5px] mt-1">
        {guardando ? "Guardando..." : "Registrar Entrada"}
      </button>
      <button type="button" onClick={onFinalizar} className="text-center text-[12px] text-[var(--gray-400)] font-semibold">
        Cancelar
      </button>
    </div>
  );
}

function cargarJsQR(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).jsQR) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el lector de códigos QR."));
    document.body.appendChild(script);
  });
}

function FormularioSalida({ onFinalizar }: { onFinalizar: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [folioServicio, setFolioServicio] = useState("");
  const [comentario, setComentario] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [articulo, setArticulo] = useState<ItemInventario | null>(null);
  const [consumiendo, setConsumiendo] = useState(false);
  const [consumido, setConsumido] = useState(false);

  const buscar = async (valor: string) => {
    if (!valor.trim()) {
      setError("Captura el número de etiqueta a buscar.");
      return;
    }
    setError("");
    setArticulo(null);
    setBuscando(true);
    try {
      const res = await fetch("/api/inventario/items/list", { cache: "no-store" });
      const data = await res.json();
      const registros: ItemInventario[] = data.registros || [];
      const encontrado = registros.find((it) => it.numeroEtiqueta === valor.trim());
      if (!encontrado) {
        setError(`No se encontró ningún artículo con la etiqueta "${valor.trim()}".`);
        return;
      }
      setArticulo(encontrado);
    } catch {
      setError("No se pudo consultar el artículo.");
    } finally {
      setBuscando(false);
    }
  };
  const consultarArticulo = () => buscar(busqueda);

  // ---- Escáner de cámara en vivo (lee el QR impreso en la etiqueta) ----
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [errorCamara, setErrorCamara] = useState("");

  const detenerEscaneo = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setEscaneando(false);
  };

  const loopEscaneo = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(loopEscaneo);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loopEscaneo);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const resultado = (window as any).jsQR(imagen.data, imagen.width, imagen.height);
    if (resultado && resultado.data) {
      const valor = String(resultado.data).trim();
      detenerEscaneo();
      setBusqueda(valor);
      buscar(valor);
      return;
    }
    rafRef.current = requestAnimationFrame(loopEscaneo);
  };

  const iniciarEscaneo = async () => {
    setErrorCamara("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorCamara("Este navegador no soporta acceso a la cámara, o el sitio no se abrió con conexión segura (https). Abre este enlace en Chrome o Safari desde tu celular.");
      return;
    }
    try {
      await cargarJsQR();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEscaneando(true);
      rafRef.current = requestAnimationFrame(loopEscaneo);
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setErrorCamara(
          "Este sitio no tiene permiso para usar la cámara. Toca el ícono de candado (🔒) o el menú del navegador junto a la dirección, entra a Permisos del sitio y activa \"Cámara\". Después vuelve a intentar."
        );
      } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
        setErrorCamara("No se encontró ninguna cámara disponible en este dispositivo.");
      } else {
        setErrorCamara("No se pudo acceder a la cámara. Revisa los permisos del navegador e intenta de nuevo.");
      }
    }
  };

  useEffect(() => {
    return () => {
      detenerEscaneo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const consumirInventario = async () => {
    if (!articulo) return;
    setConsumiendo(true);
    setError("");
    try {
      const res = await fetch("/api/inventario/salida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: articulo.codigo, cantidad: articulo.cantidad, folioServicio, comentario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al consumir el inventario.");
      setConsumido(true);
    } catch (err: any) {
      setError(err.message || "Error al consumir el inventario.");
    } finally {
      setConsumiendo(false);
    }
  };

  if (consumido) {
    return (
      <div className="px-5 py-8 flex flex-col gap-4">
        <div className="w-14 h-14 rounded-full bg-[var(--green)]/15 flex items-center justify-center mx-auto">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <p className="text-center text-[13.5px] text-[var(--navy)] font-bold m-0">Inventario consumido correctamente</p>
        <button type="button" onClick={onFinalizar} className="w-full bg-[var(--navy)] text-white font-display font-bold rounded-lg py-3 text-[13px]">
          Cerrar y regresar al menú
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 flex flex-col gap-3.5">
      <h1 className="text-center font-display font-extrabold text-[var(--navy)] text-[14.5px] uppercase tracking-wide mb-1">
        Escanea el artículo que se va a consumir
      </h1>

      <div>
        <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Buscar número de etiqueta</label>
        <input
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setArticulo(null);
          }}
          placeholder="Ej. 000123"
          className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm"
        />
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Folio de servicio ligado</label>
        <input value={folioServicio} onChange={(e) => setFolioServicio(e.target.value)} placeholder="Ej. FOL-000456" className="w-full h-10 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm" />
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Para qué se usó</label>
        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Ej. Cambio de filtro de aceite" className="w-full bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md p-3 text-sm" />
      </div>

      <div className="border-2 border-dashed border-[var(--gray-200)] rounded-xl text-[var(--navy)] overflow-hidden">
        {!escaneando ? (
          <div className="py-6 flex flex-col items-center gap-2 px-4">
            <p className="text-[12.5px] font-bold text-center m-0">Scanner con cámara del dispositivo</p>
            <div className="w-11 h-11 rounded-full bg-[var(--gray-100)] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            </div>
            <button type="button" onClick={iniciarEscaneo} className="text-[12px] font-bold text-[var(--blue)] mt-1">
              Activar cámara y escanear QR
            </button>
            {errorCamara && (
              <div className="flex flex-col items-center gap-2 mt-1">
                <p className="text-[11px] text-[var(--red)] text-center m-0 max-w-[280px]">{errorCamara}</p>
                <button type="button" onClick={iniciarEscaneo} className="text-[11.5px] font-bold text-white bg-[var(--navy)] rounded-full px-4 py-1.5">
                  Reintentar
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} playsInline muted className="w-full h-[220px] object-cover block" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[62%] aspect-square border-[3px] border-[var(--blue)] rounded-xl" style={{ boxShadow: "0 0 0 999px rgba(0,0,0,0.35)" }} />
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-white text-[11px] font-bold">Apunta al código QR de la etiqueta</p>
            <button type="button" onClick={detenerEscaneo} className="absolute top-2 right-2 bg-black/60 text-white text-[11px] font-bold rounded-full px-3 py-1.5">
              Cancelar
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={consultarArticulo}
        disabled={buscando}
        className="w-full flex items-center justify-center gap-2 bg-white text-[var(--navy)] border-2 border-[var(--navy)] font-display font-bold rounded-full py-3 text-[13px] disabled:opacity-60"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        {buscando ? "Buscando..." : "Consultar artículo"}
      </button>

      {error && <p className="text-[12px] text-[var(--red)] m-0">{error}</p>}

      {articulo && (
        <div className="bg-[var(--green)]/8 border border-[var(--green)]/40 rounded-xl p-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--green)] m-0 mb-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
            Información del artículo
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px] text-[var(--navy)]">
            <p className="m-0"><b>Código:</b> {articulo.codigo}</p>
            <p className="m-0"><b>Categoría:</b> {articulo.categoria || "—"}</p>
            <p className="m-0"><b>Descripción:</b> {articulo.descripcion || "—"}</p>
            <p className="m-0"><b>Referencia:</b> {articulo.referencia || "—"}</p>
            <p className="m-0"><b>Unidad de medida:</b> {articulo.unidad || "—"}</p>
            <p className="m-0"><b>Ubicación:</b> {articulo.ubicacion || "—"}</p>
            <p className="m-0"><b>Existencias disponibles:</b> {articulo.cantidad}</p>
            <p className="m-0"><b>Proveedor:</b> {articulo.proveedor || "—"}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={consumirInventario}
        disabled={!articulo || consumiendo}
        className="w-full flex items-center justify-center gap-2 bg-[var(--navy)] disabled:opacity-40 text-white font-display font-bold rounded-lg py-3.5 text-[13.5px]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
        {consumiendo ? "Consumiendo..." : "Consumir Inventario"}
      </button>
      <button type="button" onClick={onFinalizar} className="text-center text-[12px] text-[var(--gray-400)] font-semibold">
        Cancelar
      </button>
    </div>
  );
}
