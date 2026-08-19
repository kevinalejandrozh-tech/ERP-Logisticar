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
type FolioHistorial = { id: number; folio: string; ecoUnidad: string; unidad: string; estado: string };

const OPCIONES_UNIDAD_MEDIDA = ["PZA", "LITRO", "CAJA", "KIT", "JUEGO", "PAR", "ROLLO", "GALON"];

export default function InventarioMovimientosPage() {
  const [vista, setVista] = useState<"menu" | "entrada" | "salida">("menu");
  const [etiquetaInicial, setEtiquetaInicial] = useState("");

  useEffect(() => {
    const etiqueta = new URLSearchParams(window.location.search).get("etiqueta");
    if (etiqueta) {
      setEtiquetaInicial(etiqueta);
      setVista("salida");
    }
  }, []);

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
        {vista === "salida" && <FormularioSalida onFinalizar={() => setVista("menu")} etiquetaInicial={etiquetaInicial} />}
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

function FormularioSalida({ onFinalizar, etiquetaInicial }: { onFinalizar: () => void; etiquetaInicial?: string }) {
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [articulo, setArticulo] = useState<ItemInventario | null>(null);
  const [accion, setAccion] = useState<"elegir" | "consultar" | "consumir" | "surtir">("elegir");
  const [comentario, setComentario] = useState("");
  const [consumiendo, setConsumiendo] = useState(false);
  const [consumido, setConsumido] = useState<{ folio?: string } | null>(null);

  // ---- Surtir orden: selección de folio del Historial de mantenimientos ----
  const [folios, setFolios] = useState<FolioHistorial[]>([]);
  const [cargandoFolios, setCargandoFolios] = useState(false);
  const [folioSeleccionado, setFolioSeleccionado] = useState("");
  const cargarFolios = async () => {
    setCargandoFolios(true);
    try {
      const res = await fetch("/api/historial-mantenimientos/list", { cache: "no-store" });
      const data = await res.json();
      setFolios((data.registros || []).slice().reverse());
    } catch {
      // el selector queda vacio si falla
    } finally {
      setCargandoFolios(false);
    }
  };

  const buscar = async (valor: string) => {
    if (!valor.trim()) return;
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
      setAccion("elegir");
      setComentario("");
      setFolioSeleccionado("");
    } catch {
      setError("No se pudo consultar el artículo.");
    } finally {
      setBuscando(false);
    }
  };

  const irASurtirOrden = () => {
    setAccion("surtir");
    if (folios.length === 0) cargarFolios();
  };

  const confirmarConsumo = async () => {
    if (!articulo) return;
    setConsumiendo(true);
    setError("");
    try {
      const res = await fetch("/api/inventario/consumir-etiqueta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroEtiqueta: articulo.numeroEtiqueta, comentario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al consumir el inventario.");
      setConsumido({});
    } catch (err: any) {
      setError(err.message || "Error al consumir el inventario.");
    } finally {
      setConsumiendo(false);
    }
  };

  const confirmarSurtirOrden = async () => {
    if (!articulo) return;
    if (!folioSeleccionado) {
      setError("Selecciona el folio de la orden a surtir.");
      return;
    }
    setConsumiendo(true);
    setError("");
    try {
      const res = await fetch("/api/inventario/consumir-etiqueta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroEtiqueta: articulo.numeroEtiqueta, comentario, historialId: Number(folioSeleccionado) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al surtir la orden.");
      setConsumido({ folio: data.folio });
    } catch (err: any) {
      setError(err.message || "Error al surtir la orden.");
    } finally {
      setConsumiendo(false);
    }
  };

  // Esta pantalla solo se usa llegando desde un QR escaneado con la cámara del celular
  // (enlace con ?etiqueta=). Al entrar, se busca automáticamente esa etiqueta.
  useEffect(() => {
    if (etiquetaInicial) buscar(etiquetaInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etiquetaInicial]);

  if (consumido) {
    return (
      <div className="px-5 py-8 flex flex-col gap-4">
        <div className="w-14 h-14 rounded-full bg-[var(--green)]/15 flex items-center justify-center mx-auto">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <p className="text-center text-[13.5px] text-[var(--navy)] font-bold m-0">
          {consumido.folio ? `Se surtió a la orden ${consumido.folio} correctamente` : "Inventario consumido correctamente"}
        </p>
        <button type="button" onClick={onFinalizar} className="w-full bg-[var(--navy)] text-white font-display font-bold rounded-lg py-3 text-[13px]">
          Cerrar y regresar al menú
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 flex flex-col gap-3.5">
      {buscando && <p className="text-center text-[13px] text-[var(--gray-400)] py-8">Buscando artículo...</p>}

      {!buscando && !articulo && (
        <div className="px-2 py-10 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--blue-light)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z" /></svg>
          </div>
          <p className="text-[13.5px] text-[var(--navy)] font-bold m-0">Escanea el código QR de una etiqueta</p>
          <p className="text-[12px] text-[var(--gray-400)] m-0 max-w-[260px]">Usa la cámara de tu celular para escanear la etiqueta impresa del artículo; se abrirá esta pantalla automáticamente.</p>
          {error && <p className="text-[12px] text-[var(--red)] m-0 mt-1">{error}</p>}
        </div>
      )}

      {articulo && (
        <div className="bg-[var(--blue-light)] border border-[var(--blue)]/30 rounded-xl p-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--navy)] m-0 mb-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
            Etiqueta {articulo.numeroEtiqueta} — {articulo.descripcion || "Sin descripción"}
          </p>

          {accion === "elegir" && (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setAccion("consultar")} className="w-full flex items-center justify-center gap-2 bg-white text-[var(--navy)] border-2 border-[var(--navy)] font-display font-bold rounded-lg py-3 text-[13px]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                Consultar
              </button>
              <button type="button" onClick={() => setAccion("consumir")} className="w-full flex items-center justify-center gap-2 bg-[var(--navy)] text-white font-display font-bold rounded-lg py-3 text-[13px]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
                Consumir
              </button>
              <button type="button" onClick={irASurtirOrden} className="w-full flex items-center justify-center gap-2 bg-[var(--red)] text-white font-display font-bold rounded-lg py-3 text-[13px]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
                Surtir Orden
              </button>
            </div>
          )}

          {accion === "consultar" && (
            <div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px] text-[var(--navy)] mb-3.5">
                <p className="m-0"><b>Código:</b> {articulo.codigo}</p>
                <p className="m-0"><b>Categoría:</b> {articulo.categoria || "—"}</p>
                <p className="m-0"><b>Referencia:</b> {articulo.referencia || "—"}</p>
                <p className="m-0"><b>Unidad de medida:</b> {articulo.unidad || "—"}</p>
                <p className="m-0"><b>Ubicación:</b> {articulo.ubicacion || "—"}</p>
                <p className="m-0"><b>Existencias:</b> {articulo.cantidad}</p>
                <p className="m-0"><b>Costo unitario:</b> ${parseFloat(articulo.costoUnitario || "0").toFixed(2)}</p>
                <p className="m-0"><b>Proveedor:</b> {articulo.proveedor || "—"}</p>
              </div>
              <button type="button" onClick={() => setAccion("elegir")} className="w-full text-center text-[12px] text-[var(--navy)] font-bold">
                ← Volver
              </button>
            </div>
          )}

          {accion === "consumir" && (
            <div>
              <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Referencia de uso (opcional)</label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
                placeholder="Ej. Folio de servicio o motivo"
                className="w-full bg-white border border-[var(--gray-200)] rounded-md p-3 text-sm mb-3"
              />
              <button
                type="button"
                onClick={confirmarConsumo}
                disabled={consumiendo}
                className="w-full flex items-center justify-center gap-2 bg-[var(--navy)] disabled:opacity-60 text-white font-display font-bold rounded-lg py-3 text-[13px] mb-2"
              >
                {consumiendo ? "Consumiendo..." : "Confirmar consumo"}
              </button>
              <button type="button" onClick={() => setAccion("elegir")} disabled={consumiendo} className="w-full text-center text-[12px] text-[var(--navy)] font-bold">
                ← Volver
              </button>
            </div>
          )}

          {accion === "surtir" && (
            <div>
              <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Folio del Historial de mantenimientos</label>
              <select
                value={folioSeleccionado}
                onChange={(e) => setFolioSeleccionado(e.target.value)}
                disabled={cargandoFolios}
                className="w-full h-10 bg-white border border-[var(--gray-200)] rounded-md px-3 text-sm mb-3"
              >
                <option value="">{cargandoFolios ? "Cargando folios..." : "Selecciona un folio..."}</option>
                {folios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.folio} — {f.ecoUnidad} ({f.estado || "Sin estado"})
                  </option>
                ))}
              </select>
              <label className="block text-[12px] font-bold text-[var(--navy)] mb-1">Nota (opcional)</label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
                placeholder="Ej. Se usó para reparación de motor"
                className="w-full bg-white border border-[var(--gray-200)] rounded-md p-3 text-sm mb-3"
              />
              <button
                type="button"
                onClick={confirmarSurtirOrden}
                disabled={consumiendo || !folioSeleccionado}
                className="w-full flex items-center justify-center gap-2 bg-[var(--red)] disabled:opacity-60 text-white font-display font-bold rounded-lg py-3 text-[13px] mb-2"
              >
                {consumiendo ? "Surtiendo..." : "Confirmar Surtir Orden"}
              </button>
              <button type="button" onClick={() => setAccion("elegir")} disabled={consumiendo} className="w-full text-center text-[12px] text-[var(--navy)] font-bold">
                ← Volver
              </button>
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={onFinalizar} className="text-center text-[12px] text-[var(--gray-400)] font-semibold">
        Cancelar
      </button>
    </div>
  );
}

