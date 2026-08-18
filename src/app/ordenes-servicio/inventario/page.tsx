"use client";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { UNIDADES } from "@/lib/unidadesData";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const UMBRAL_BAJO = 5;

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
type FilaEntrada = {
  codigo: string;
  descripcion: string;
  categoria: string;
  referencia: string;
  costoUnitario: string;
  cantidad: string;
  proveedor: string;
  ubicacion: string;
  fechaIngreso: string;
  unidad: string;
  numeroEtiqueta: string;
};
type FilaSalida = { codigo: string; descripcion: string; cantidad: string; folioServicio: string; paraUnidad: string; entregadoA: string };
type Movimiento = { id: number; tipo: string; codigo: string; descripcion: string; cantidad: number; datos: Record<string, string>; fecha: string };

const OPCIONES_UNIDAD_MEDIDA = ["PZA", "LITRO", "CAJA", "KIT", "JUEGO", "PAR", "ROLLO", "GALON"];

function fechaHoraLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function filaEntradaVacia(): FilaEntrada {
  return { codigo: "", descripcion: "", categoria: "", referencia: "", costoUnitario: "", cantidad: "", proveedor: "", ubicacion: "", fechaIngreso: fechaHoraLocal(), unidad: "", numeroEtiqueta: "" };
}
function filaSalidaVacia(): FilaSalida {
  return { codigo: "", descripcion: "", cantidad: "", folioServicio: "", paraUnidad: "", entregadoA: "" };
}
function escaparHtml(texto: string) {
  return String(texto || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatearFechaCorta(f: string) {
  if (!f) return "—";
  const d = new Date(f);
  if (isNaN(d.getTime())) return f;
  return d.toLocaleDateString("es-MX");
}
function cargarJsBarcode(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).JsBarcode) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/JsBarcode/3.11.5/JsBarcode.all.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el generador de código de barras."));
    document.body.appendChild(script);
  });
}
async function generarImagenBarcode(valor: string): Promise<string> {
  await cargarJsBarcode();
  const canvas = document.createElement("canvas");
  (window as any).JsBarcode(canvas, valor || "000000", { format: "CODE128", displayValue: true, width: 2, height: 55, fontSize: 12 });
  return canvas.toDataURL("image/png");
}
function bloqueEtiquetaHtml(f: FilaEntrada, imagenBarcode: string) {
  return `
<div class="etiqueta">
  <p class="desc">${escaparHtml(f.descripcion) || "—"}</p>
  <img class="bc" src="${imagenBarcode}" alt="${escaparHtml(f.numeroEtiqueta)}" />
  <p class="info">Costo unitario: $${parseFloat(f.costoUnitario || "0").toFixed(2)}</p>
  <p class="info">Fecha de entrada: ${formatearFechaCorta(f.fechaIngreso)}</p>
</div>`;
}
async function abrirVentanaEtiquetas(filas: FilaEntrada[]) {
  const imagenes = await Promise.all(filas.map((f) => generarImagenBarcode(f.numeroEtiqueta)));
  const ventana = window.open("", "_blank", "width=420,height=560");
  if (!ventana) {
    alert("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.");
    return;
  }
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Etiquetas de inventario</title>
<style>
  body { font-family: Arial, sans-serif; text-align: center; margin: 0; padding: 0; }
  .etiqueta { padding: 22px 16px; page-break-after: always; }
  .desc { font-size: 13px; font-weight: bold; color: #16215c; margin: 0 0 8px; }
  .bc { max-width: 90%; height: auto; }
  .info { font-size: 11px; color: #16215c; margin: 2px 0; }
  .barras { position: fixed; bottom: 16px; left: 0; right: 0; }
  button { padding: 10px 26px; font-size: 13px; font-weight: bold; background: #16215c; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
  @media print { .barras { display: none; } }
</style>
</head>
<body>
${filas.map((f, i) => bloqueEtiquetaHtml(f, imagenes[i])).join("\n")}
<div class="barras"><button id="btnImprimir">Imprimir</button></div>
<script>
  document.getElementById("btnImprimir").addEventListener("click", function () {
    window.print();
    setTimeout(function () { window.close(); }, 300);
  });
</script>
</body>
</html>`;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}

export default function InventarioPage() {
  const [tab, setTab] = useState<"reportes" | "entrada" | "salida" | "movimientos">("reportes");
  const [items, setItems] = useState<ItemInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [operadores, setOperadores] = useState<string[]>([]);
  const ecosUnidad = useMemo(() => UNIDADES.map((u) => u.eco), []);

  const cargarItems = async () => {
    try {
      const res = await fetch("/api/inventario/items/list", { cache: "no-store" });
      const data = await res.json();
      setItems(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    } finally {
      setCargando(false);
    }
  };
  const cargarMovimientos = async () => {
    try {
      const res = await fetch("/api/inventario/movimientos/list", { cache: "no-store" });
      const data = await res.json();
      setMovimientos(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    }
  };
  const cargarOperadores = async () => {
    try {
      const res = await fetch("/api/operadores/list", { cache: "no-store" });
      const data = await res.json();
      setOperadores((data.registros || []).map((o: { nombre: string }) => o.nombre));
    } catch {
      // el campo sigue funcionando como texto libre
    }
  };

  useEffect(() => {
    cargarItems();
    cargarMovimientos();
    cargarOperadores();
    const id = setInterval(() => {
      cargarItems();
      cargarMovimientos();
    }, 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cargarQRious = (): Promise<void> =>
      new Promise((resolve, reject) => {
        if ((window as any).QRious) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("No se pudo cargar el generador de código QR."));
        document.body.appendChild(script);
      });
    cargarQRious()
      .then(async () => {
        await new Promise((r) => setTimeout(r, 50));
        const canvas = document.getElementById("qr-inventario-movimientos") as HTMLCanvasElement | null;
        if (canvas) {
          new (window as any).QRious({ element: canvas, value: `${window.location.origin}/inventario-movimientos`, size: 64, level: "M" });
        }
      })
      .catch(() => {});
  }, []);

  const descripcionesUnicas = useMemo(() => Array.from(new Set(items.map((i) => i.descripcion).filter(Boolean))).sort(), [items]);
  const categoriasUnicas = useMemo(() => Array.from(new Set(items.map((i) => i.categoria).filter(Boolean))).sort(), [items]);
  const unidadesUnicas = useMemo(() => Array.from(new Set(items.map((i) => i.unidad).filter(Boolean))).sort(), [items]);
  const ubicacionesUnicas = useMemo(() => Array.from(new Set(items.map((i) => i.ubicacion).filter(Boolean))).sort(), [items]);

  // ---- Edicion en linea de items (Reportes) ----
  const actualizarItemLocal = (id: number, campo: keyof ItemInventario, valor: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [campo]: valor } : it)));
  };
  const guardarItemCampo = (id: number, campo: string, valor: string) => {
    fetch("/api/inventario/items/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [campo]: valor }),
    }).catch(() => cargarItems());
  };
  const eliminarItem = async (id: number) => {
    if (!confirm("¿Eliminar este artículo del inventario?")) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
    try {
      await fetch("/api/inventario/items/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      await cargarItems();
    }
  };

  // ---- Busqueda y filtros (Reportes) ----
  const [busqueda, setBusqueda] = useState("");
  const [filtroDescripcion, setFiltroDescripcion] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");
  const [filtroUbicacion, setFiltroUbicacion] = useState("");

  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((it) => {
      if (filtroDescripcion && it.descripcion !== filtroDescripcion) return false;
      if (filtroCategoria && it.categoria !== filtroCategoria) return false;
      if (filtroUnidad && it.unidad !== filtroUnidad) return false;
      if (filtroUbicacion && it.ubicacion !== filtroUbicacion) return false;
      if (!q) return true;
      const texto = `${it.codigo} ${it.descripcion} ${it.categoria} ${it.referencia} ${it.proveedor} ${it.ubicacion} ${it.unidad}`.toLowerCase();
      return texto.includes(q);
    });
  }, [items, busqueda, filtroDescripcion, filtroCategoria, filtroUnidad, filtroUbicacion]);

  // ---- Panel: detalles / bajo stock / mas usadas / mas obsoleto ----
  const detalles = useMemo(() => {
    const totalArticulos = items.length;
    const totalPiezas = items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
    const valorTotal = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (parseFloat(it.costoUnitario) || 0), 0);
    const costoPorCodigo: Record<string, number> = {};
    items.forEach((it) => {
      costoPorCodigo[it.codigo] = parseFloat(it.costoUnitario) || 0;
    });
    const valorConsumos = movimientos
      .filter((m) => m.tipo === "salida")
      .reduce((s, m) => s + (Number(m.cantidad) || 0) * (costoPorCodigo[m.codigo] || 0), 0);
    return { totalArticulos, totalPiezas, valorTotal, valorConsumos };
  }, [items, movimientos]);
  const inventarioBajo = useMemo(() => items.filter((it) => (Number(it.cantidad) || 0) < UMBRAL_BAJO).sort((a, b) => a.cantidad - b.cantidad), [items]);
  const salidasRecientes = useMemo(() => movimientos.filter((m) => m.tipo === "salida").slice(0, 6), [movimientos]);
  const masObsoleto = useMemo(
    () =>
      [...items]
        .filter((it) => it.fechaIngreso)
        .sort((a, b) => new Date(a.fechaIngreso).getTime() - new Date(b.fechaIngreso).getTime())
        .slice(0, 6),
    [items]
  );

  // ---- Entrada ----
  const [filasEntrada, setFilasEntrada] = useState<FilaEntrada[]>([]);
  const [recibiendo, setRecibiendo] = useState(false);
  const maxCodigoActual = useMemo(() => {
    let max = 0;
    items.forEach((it) => {
      const n = parseInt(String(it.codigo).replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max;
  }, [items]);

  const agregarFilaEntrada = () => {
    setFilasEntrada((prev) => [...prev, { ...filaEntradaVacia(), codigo: String(maxCodigoActual + prev.length + 1).padStart(4, "0") }]);
  };
  const actualizarFilaEntrada = (idx: number, campo: keyof FilaEntrada, valor: string) => {
    setFilasEntrada((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)));
  };
  const quitarFilaEntrada = (idx: number) => {
    setFilasEntrada((prev) => prev.filter((_, i) => i !== idx).map((f, i) => ({ ...f, codigo: String(maxCodigoActual + i + 1).padStart(4, "0") })));
  };

  const [generandoEtiquetas, setGenerandoEtiquetas] = useState(false);
  const generarEtiquetas = async () => {
    const pendientes = filasEntrada.filter((f) => !f.numeroEtiqueta);
    if (pendientes.length === 0) {
      alert(filasEntrada.length === 0 ? "Agrega primero filas a la tabla de entrada." : "Todas las filas ya tienen número de etiqueta.");
      return;
    }
    setGenerandoEtiquetas(true);
    try {
      const res = await fetch("/api/inventario/etiquetas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad: pendientes.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar etiquetas.");
      let i = 0;
      setFilasEntrada((prev) => prev.map((f) => (f.numeroEtiqueta ? f : { ...f, numeroEtiqueta: data.numeros[i++] })));
    } catch (err: any) {
      alert(err.message || "No se pudieron generar las etiquetas.");
    } finally {
      setGenerandoEtiquetas(false);
    }
  };
  const imprimirEtiqueta = (f: FilaEntrada) => {
    if (!f.numeroEtiqueta) {
      alert("Primero genera el número de etiqueta.");
      return;
    }
    abrirVentanaEtiquetas([f]);
  };
  const imprimirTodasEntradas = async () => {
    if (filasEntrada.length === 0) {
      alert("No hay filas en la tabla de entrada.");
      return;
    }
    let filas = filasEntrada;
    const pendientes = filas.filter((f) => !f.numeroEtiqueta);
    if (pendientes.length > 0) {
      setGenerandoEtiquetas(true);
      try {
        const res = await fetch("/api/inventario/etiquetas/generar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cantidad: pendientes.length }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al generar etiquetas.");
        let i = 0;
        filas = filasEntrada.map((f) => (f.numeroEtiqueta ? f : { ...f, numeroEtiqueta: data.numeros[i++] }));
        setFilasEntrada(filas);
      } catch (err: any) {
        alert(err.message || "No se pudieron generar las etiquetas.");
        setGenerandoEtiquetas(false);
        return;
      }
      setGenerandoEtiquetas(false);
    }
    abrirVentanaEtiquetas(filas);
  };

  const recibirEntrada = async () => {
    const validas = filasEntrada.filter((f) => f.descripcion.trim());
    if (validas.length === 0) {
      alert("Agrega al menos un artículo con descripción.");
      return;
    }
    setRecibiendo(true);
    try {
      for (const f of validas) {
        await fetch("/api/inventario/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigo: f.codigo,
            descripcion: f.descripcion.trim(),
            categoria: f.categoria,
            referencia: f.referencia,
            costoUnitario: f.costoUnitario,
            cantidad: f.cantidad,
            proveedor: f.proveedor,
            ubicacion: f.ubicacion,
            fechaIngreso: f.fechaIngreso,
            unidad: f.unidad,
            numeroEtiqueta: f.numeroEtiqueta,
          }),
        });
      }
      setFilasEntrada([]);
      await cargarItems();
      await cargarMovimientos();
      alert(`Se recibieron ${validas.length} artículo(s) al inventario.`);
      setTab("reportes");
    } catch (err: any) {
      alert("Ocurrió un error al recibir la entrada. Verifica e intenta de nuevo.");
    } finally {
      setRecibiendo(false);
    }
  };

  // ---- Salida ----
  const [filasSalida, setFilasSalida] = useState<FilaSalida[]>([]);
  const [registrandoSalida, setRegistrandoSalida] = useState(false);

  const agregarFilaSalida = () => setFilasSalida((prev) => [...prev, filaSalidaVacia()]);
  const actualizarFilaSalida = (idx: number, campo: keyof FilaSalida, valor: string) => {
    setFilasSalida((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        if (campo === "codigo") {
          const item = items.find((it) => it.codigo === valor);
          return { ...f, codigo: valor, descripcion: item?.descripcion || "" };
        }
        return { ...f, [campo]: valor };
      })
    );
  };
  const quitarFilaSalida = (idx: number) => setFilasSalida((prev) => prev.filter((_, i) => i !== idx));

  const registrarSalida = async () => {
    const validas = filasSalida.filter((f) => f.codigo && f.cantidad);
    if (validas.length === 0) {
      alert("Agrega al menos una salida con código y cantidad.");
      return;
    }
    setRegistrandoSalida(true);
    try {
      for (const f of validas) {
        const res = await fetch("/api/inventario/salida", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo: f.codigo, cantidad: f.cantidad, folioServicio: f.folioServicio, paraUnidad: f.paraUnidad, entregadoA: f.entregadoA }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error al descontar el código ${f.codigo}.`);
      }
      setFilasSalida([]);
      await cargarItems();
      await cargarMovimientos();
      alert(`Se registraron ${validas.length} salida(s) del inventario.`);
      setTab("reportes");
    } catch (err: any) {
      alert(err.message || "Ocurrió un error al registrar la salida.");
    } finally {
      setRegistrandoSalida(false);
    }
  };

  const SUBMENU = [
    { key: "reportes", label: "Reportes" },
    { key: "entrada", label: "Entrada" },
    { key: "salida", label: "Salida" },
    { key: "movimientos", label: "Transacciones y movimientos" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Compras / Inventario y consumos"
          subtitulo="Controla el inventario de insumos y refacciones."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>}
        />

        <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] gap-5">
          {/* Submenu vertical */}
          <div className="flex md:flex-col flex-wrap gap-2 md:gap-1.5">
            {SUBMENU.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setTab(s.key)}
                className={`text-left text-[13px] font-bold px-4 py-2.5 rounded-lg ${tab === s.key ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Contenido */}
          <div>
            {tab === "reportes" && (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                  <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4">
                    <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Detalles del inventario</p>
                    <div className="flex gap-5">
                      <div>
                        <p className="text-[22px] font-bold text-[var(--navy)] m-0 leading-none">{detalles.totalArticulos}</p>
                        <p className="text-[10px] text-[var(--gray-400)] m-0">Artículos</p>
                      </div>
                      <div>
                        <p className="text-[22px] font-bold text-[var(--navy)] m-0 leading-none">{detalles.totalPiezas}</p>
                        <p className="text-[10px] text-[var(--gray-400)] m-0">Piezas totales</p>
                      </div>
                      <div>
                        <p className="text-[22px] font-bold text-[var(--navy)] m-0 leading-none">${detalles.valorTotal.toFixed(2)}</p>
                        <p className="text-[10px] text-[var(--gray-400)] m-0">Valor total</p>
                      </div>
                      <div>
                        <p className="text-[15px] font-bold text-[var(--red)] m-0 leading-none">${detalles.valorConsumos.toFixed(2)}</p>
                        <p className="text-[10px] text-[var(--gray-400)] m-0">Valor Consumos</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4">
                    <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">
                      Inventario Bajo - compras <span className="text-[var(--red)]">({inventarioBajo.length})</span>
                    </p>
                    <div className="flex flex-col gap-1 max-h-[90px] overflow-y-auto">
                      {inventarioBajo.length === 0 && <span className="text-[12px] text-[var(--gray-400)]">Sin artículos con stock bajo.</span>}
                      {inventarioBajo.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-[11.5px]">
                          <span className="text-[var(--navy)]">{it.descripcion || it.codigo}</span>
                          <span className="font-bold text-[var(--red)]">{it.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4">
                    <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Seguimiento a refacciones usadas</p>
                    <div className="flex flex-col gap-1 max-h-[90px] overflow-y-auto">
                      {salidasRecientes.length === 0 && <span className="text-[12px] text-[var(--gray-400)]">Sin salidas registradas.</span>}
                      {salidasRecientes.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-[11.5px]">
                          <span className="text-[var(--navy)] truncate">{m.descripcion || m.codigo}</span>
                          <span className="font-bold text-[var(--navy)]">-{m.cantidad}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-[var(--gray-100)]">
                      <canvas id="qr-inventario-movimientos" width={64} height={64} />
                      <p className="text-[10.5px] text-[var(--gray-400)] m-0">Escanea para registrar una entrada o salida desde tu celular.</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4">
                    <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Inventario más obsoleto</p>
                    <div className="flex flex-col gap-1 max-h-[90px] overflow-y-auto">
                      {masObsoleto.length === 0 && <span className="text-[12px] text-[var(--gray-400)]">Sin datos.</span>}
                      {masObsoleto.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-[11.5px]">
                          <span className="text-[var(--navy)] truncate">{it.descripcion || it.codigo}</span>
                          <span className="text-[var(--gray-400)]">{it.fechaIngreso ? new Date(it.fechaIngreso).toLocaleDateString("es-MX") : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
                  <div className="mb-3.5">
                    <div className="flex items-center gap-2 bg-white border border-[var(--gray-200)] rounded-lg px-3.5 py-2.5 max-w-[420px]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en el inventario..." className="flex-1 outline-none text-[13px]" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2.5 mb-4">
                    <div>
                      <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Descripción</label>
                      <select value={filtroDescripcion} onChange={(e) => setFiltroDescripcion(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px]">
                        <option value="">Todas</option>
                        {descripcionesUnicas.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Categoría</label>
                      <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px]">
                        <option value="">Todas</option>
                        {categoriasUnicas.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Unidad</label>
                      <select value={filtroUnidad} onChange={(e) => setFiltroUnidad(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px]">
                        <option value="">Todas</option>
                        {unidadesUnicas.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Ubicación</label>
                      <select value={filtroUbicacion} onChange={(e) => setFiltroUbicacion(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px]">
                        <option value="">Todas</option>
                        {ubicacionesUnicas.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(filtroDescripcion || filtroCategoria || filtroUnidad || filtroUbicacion || busqueda) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroDescripcion("");
                          setFiltroCategoria("");
                          setFiltroUnidad("");
                          setFiltroUbicacion("");
                          setBusqueda("");
                        }}
                        className="text-[11.5px] text-[var(--red)] font-semibold px-2 py-1.5"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="border-collapse min-w-max w-full">
                      <thead>
                        <tr>
                          {["Código", "N° Etiqueta", "Descripción", "Categoría", "Referencia", "Costo unitario", "Cantidad", "Proveedor", "Ubicación", "Fecha de ingreso", "Unidad", "Acciones"].map((c) => (
                            <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {itemsFiltrados.map((it) => (
                          <tr key={it.id} className="border-b border-[var(--gray-200)]" style={it.cantidad < UMBRAL_BAJO ? { backgroundColor: "rgba(226,65,44,0.08)" } : undefined}>
                            <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap font-semibold text-[var(--navy)]">{it.codigo}</td>
                            <td className="px-2.5 py-2 text-[12px] whitespace-nowrap font-mono text-[var(--navy)]">{it.numeroEtiqueta || "—"}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <input
                                defaultValue={it.descripcion}
                                onBlur={(e) => {
                                  actualizarItemLocal(it.id, "descripcion", e.target.value);
                                  guardarItemCampo(it.id, "descripcion", e.target.value);
                                }}
                                className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[150px]"
                              />
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <input
                                defaultValue={it.categoria}
                                onBlur={(e) => {
                                  actualizarItemLocal(it.id, "categoria", e.target.value);
                                  guardarItemCampo(it.id, "categoria", e.target.value);
                                }}
                                className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[110px]"
                              />
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <input
                                defaultValue={it.referencia}
                                onBlur={(e) => {
                                  actualizarItemLocal(it.id, "referencia", e.target.value);
                                  guardarItemCampo(it.id, "referencia", e.target.value);
                                }}
                                className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[110px]"
                              />
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <input
                                type="number"
                                defaultValue={it.costoUnitario}
                                onBlur={(e) => {
                                  actualizarItemLocal(it.id, "costoUnitario", e.target.value);
                                  guardarItemCampo(it.id, "costoUnitario", e.target.value);
                                }}
                                className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[80px]"
                              />
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <span className={`font-semibold text-[12.5px] ${it.cantidad < UMBRAL_BAJO ? "text-[var(--red)]" : "text-[var(--navy)]"}`}>{it.cantidad}</span>
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <input
                                defaultValue={it.proveedor}
                                onBlur={(e) => {
                                  actualizarItemLocal(it.id, "proveedor", e.target.value);
                                  guardarItemCampo(it.id, "proveedor", e.target.value);
                                }}
                                className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[110px]"
                              />
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <input
                                defaultValue={it.ubicacion}
                                onBlur={(e) => {
                                  actualizarItemLocal(it.id, "ubicacion", e.target.value);
                                  guardarItemCampo(it.id, "ubicacion", e.target.value);
                                }}
                                className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[100px]"
                              />
                            </td>
                            <td className="px-2.5 py-2 text-[12px] whitespace-nowrap">{it.fechaIngreso ? new Date(it.fechaIngreso).toLocaleString("es-MX") : "—"}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <input
                                defaultValue={it.unidad}
                                onBlur={(e) => {
                                  actualizarItemLocal(it.id, "unidad", e.target.value);
                                  guardarItemCampo(it.id, "unidad", e.target.value);
                                }}
                                className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[70px]"
                              />
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <span onClick={() => eliminarItem(it.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar artículo">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!cargando && itemsFiltrados.length === 0 && (
                      <div className="text-center text-[var(--gray-400)] text-[13px] py-8">{items.length === 0 ? "Sin artículos registrados. Usa la sección Entrada para agregar." : "Ningún artículo coincide con la búsqueda."}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "entrada" && (
              <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
                  <h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0">Entrada de inventario</h3>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={agregarFilaEntrada} className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                      + Agregar fila
                    </button>
                    <button type="button" onClick={recibirEntrada} disabled={recibiendo || filasEntrada.length === 0} className="flex items-center gap-1.5 bg-[var(--navy)] disabled:opacity-50 text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M20 6L9 17l-5-5" /></svg>
                      {recibiendo ? "Recibiendo..." : "Recibir entrada"}
                    </button>
                    <button
                      type="button"
                      onClick={generarEtiquetas}
                      disabled={generandoEtiquetas || filasEntrada.length === 0}
                      className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-1.5 text-[12px] font-bold disabled:opacity-50"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M20.59 13.41L11 3.83V3a1 1 0 00-1-1H4a1 1 0 00-1 1v6a1 1 0 001 1h.83l9.58 9.59a2 2 0 002.83 0l3.35-3.35a2 2 0 000-2.83z" /><circle cx="6.5" cy="6.5" r="1.5" /></svg>
                      {generandoEtiquetas ? "Generando..." : "Generar etiquetas"}
                    </button>
                    <button
                      type="button"
                      onClick={imprimirTodasEntradas}
                      disabled={generandoEtiquetas || filasEntrada.length === 0}
                      className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-1.5 text-[12px] font-bold disabled:opacity-50"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                      Imprimir todas las entradas
                    </button>
                  </div>
                </div>
                <datalist id="dl-inv-descripcion">
                  {descripcionesUnicas.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                <datalist id="dl-inv-categoria">
                  {categoriasUnicas.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <datalist id="dl-inv-unidad">
                  {OPCIONES_UNIDAD_MEDIDA.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
                <div className="overflow-x-auto">
                  <table className="border-collapse min-w-max w-full">
                    <thead>
                      <tr>
                        {["Código", "Descripción", "Categoría", "Referencia", "Costo unitario", "Cantidad", "Proveedor", "Ubicación", "Fecha de ingreso", "Unidad", "N° Etiqueta", ""].map((c, i) => (
                          <th key={i} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-2 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filasEntrada.map((f, idx) => (
                        <tr key={idx} className="border-b border-[var(--gray-200)]">
                          <td className="px-2 py-1.5 text-[12.5px] font-semibold text-[var(--navy)] whitespace-nowrap">{f.codigo}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input value={f.descripcion} onChange={(e) => actualizarFilaEntrada(idx, "descripcion", e.target.value)} list="dl-inv-descripcion" className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[140px]" />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input value={f.categoria} onChange={(e) => actualizarFilaEntrada(idx, "categoria", e.target.value)} list="dl-inv-categoria" className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[100px]" />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input value={f.referencia} onChange={(e) => actualizarFilaEntrada(idx, "referencia", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[100px]" />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input type="number" value={f.costoUnitario} onChange={(e) => actualizarFilaEntrada(idx, "costoUnitario", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[75px]" />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input type="number" value={f.cantidad} onChange={(e) => actualizarFilaEntrada(idx, "cantidad", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[65px]" />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input value={f.proveedor} onChange={(e) => actualizarFilaEntrada(idx, "proveedor", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[100px]" />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input value={f.ubicacion} onChange={(e) => actualizarFilaEntrada(idx, "ubicacion", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[95px]" />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input type="datetime-local" value={f.fechaIngreso} onChange={(e) => actualizarFilaEntrada(idx, "fechaIngreso", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[11px]" />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input value={f.unidad} onChange={(e) => actualizarFilaEntrada(idx, "unidad", e.target.value)} list="dl-inv-unidad" className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[75px]" />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {f.numeroEtiqueta ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11.5px] font-mono font-semibold text-[var(--navy)]">{f.numeroEtiqueta}</span>
                                <button type="button" onClick={() => imprimirEtiqueta(f)} className="text-[10px] text-[var(--blue)] font-bold whitespace-nowrap">
                                  Imprimir etiqueta
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[var(--gray-400)]">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <span onClick={() => quitarFilaEntrada(idx)} className="text-[var(--red)] cursor-pointer" title="Quitar fila">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filasEntrada.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Usa &quot;+ Agregar fila&quot; para capturar artículos de entrada.</div>}
                </div>
              </div>
            )}

            {tab === "salida" && (
              <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
                  <h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0">Salida de inventario</h3>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={agregarFilaSalida} className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                      + Agregar fila
                    </button>
                    <button type="button" onClick={registrarSalida} disabled={registrandoSalida || filasSalida.length === 0} className="flex items-center gap-1.5 bg-[var(--red)] disabled:opacity-50 text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      {registrandoSalida ? "Registrando..." : "Registrar salida del inventario"}
                    </button>
                  </div>
                </div>
                <datalist id="dl-inv-entregadoa">
                  {operadores.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
                <div className="overflow-x-auto">
                  <table className="border-collapse min-w-max w-full">
                    <thead>
                      <tr>
                        {["Código", "Descripción", "Cantidad", "Folio de servicio", "Para qué unidad", "A quién se entrega", ""].map((c, i) => (
                          <th key={i} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filasSalida.map((f, idx) => {
                        const item = items.find((it) => it.codigo === f.codigo);
                        return (
                          <tr key={idx} className="border-b border-[var(--gray-200)]">
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <select value={f.codigo} onChange={(e) => actualizarFilaSalida(idx, "codigo", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[100px]">
                                <option value=""></option>
                                {items.map((it) => (
                                  <option key={it.id} value={it.codigo}>
                                    {it.codigo}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2.5 py-1.5 text-[12.5px] whitespace-nowrap">
                              {f.descripcion || "—"} {item && <span className="text-[10.5px] text-[var(--gray-400)]">(disp. {item.cantidad})</span>}
                            </td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <input type="number" value={f.cantidad} onChange={(e) => actualizarFilaSalida(idx, "cantidad", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[70px]" />
                            </td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <input value={f.folioServicio} onChange={(e) => actualizarFilaSalida(idx, "folioServicio", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[110px]" />
                            </td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <select value={f.paraUnidad} onChange={(e) => actualizarFilaSalida(idx, "paraUnidad", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[95px]">
                                <option value=""></option>
                                {ecosUnidad.map((eco) => (
                                  <option key={eco} value={eco}>
                                    {eco}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <input value={f.entregadoA} onChange={(e) => actualizarFilaSalida(idx, "entregadoA", e.target.value)} list="dl-inv-entregadoa" className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[130px]" />
                            </td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <span onClick={() => quitarFilaSalida(idx)} className="text-[var(--red)] cursor-pointer" title="Quitar fila">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filasSalida.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Usa &quot;+ Agregar fila&quot; para capturar salidas de inventario.</div>}
                </div>
              </div>
            )}

            {tab === "movimientos" && (
              <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
                <h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0 mb-4">Transacciones y movimientos</h3>
                <div className="overflow-x-auto">
                  <table className="border-collapse min-w-max w-full">
                    <thead>
                      <tr>
                        {["Fecha", "Tipo", "Código", "Descripción", "Cantidad", "Folio de servicio", "Comentario", "Detalle"].map((c) => (
                          <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((m) => (
                        <tr key={m.id} className="border-b border-[var(--gray-200)]">
                          <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{new Date(m.fecha).toLocaleString("es-MX")}</td>
                          <td className="px-2.5 py-2 whitespace-nowrap">
                            <span className={`text-[9.5px] font-bold uppercase px-2 py-1 rounded-full ${m.tipo === "entrada" ? "bg-[var(--green)] text-white" : "bg-[var(--red)] text-white"}`}>{m.tipo}</span>
                          </td>
                          <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap font-semibold text-[var(--navy)]">{m.codigo}</td>
                          <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{m.descripcion}</td>
                          <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{m.tipo === "salida" ? "-" : "+"}{m.cantidad}</td>
                          <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{m.datos?.folioServicio || "—"}</td>
                          <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap max-w-[180px] truncate" title={m.datos?.comentario || ""}>{m.datos?.comentario || "—"}</td>
                          <td className="px-2.5 py-2 text-[11.5px] whitespace-nowrap text-[var(--gray-400)]">
                            {m.tipo === "entrada"
                              ? [m.datos?.proveedor, m.datos?.ubicacion].filter(Boolean).join(" · ")
                              : [m.datos?.paraUnidad, m.datos?.entregadoA].filter(Boolean).join(" · ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {movimientos.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin movimientos registrados.</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        <PageFooter />
      </div>
    </div>
  );
}
