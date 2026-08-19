"use client";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { UNIDADES } from "@/lib/unidadesData";
import { compressImage } from "@/lib/imageUtils";

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
  refCompra: string;
  numeroRecepcion: string;
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
  refCompra: string;
  numeroRecepcion: string;
};
type FilaSalida = { codigo: string; numeroEtiqueta: string; descripcion: string; cantidad: string; folioServicio: string; paraUnidad: string; entregadoA: string; solicitudId?: number };
type Movimiento = { id: number; tipo: string; codigo: string; descripcion: string; cantidad: number; datos: Record<string, string>; fecha: string };
type SolicitudMaterial = {
  id: number;
  historialId: number;
  folioServicio: string;
  ecoUnidad: string;
  estado: string;
  items: { noEtiqueta: string; descripcion: string; cantidad: string; folioServicio: string; paraUnidad: string; entregadoA: string }[];
};
type CompraPendiente = { id: number; descripcion: string; cantidad: string; origen: string };
type FotoDesc = { foto: string; descripcion: string };
type Proveedor = { id: number; nombre: string; contacto: string; telefono: string; email: string; notas: string };
type OrdenCompra = { id: number; folio: string; proveedor: string; fecha: string; items: { descripcion: string; cantidad: string; costoEstimado: string }[]; estado: string };
type ConteoCiclico = { id: number; codigo: string; descripcion: string; cantidadSistema: number; cantidadContada: number; diferencia: number; contadoPor: string; fecha: string };

const OPCIONES_UNIDAD_MEDIDA = ["PZA", "LITRO", "CAJA", "KIT", "JUEGO", "PAR", "ROLLO", "GALON"];

function fechaHoraLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function filaEntradaVacia(): FilaEntrada {
  return { codigo: "", descripcion: "", categoria: "", referencia: "", costoUnitario: "", cantidad: "", proveedor: "", ubicacion: "", fechaIngreso: fechaHoraLocal(), unidad: "", numeroEtiqueta: "", refCompra: "", numeroRecepcion: "" };
}
function filaSalidaVacia(): FilaSalida {
  return { codigo: "", numeroEtiqueta: "", descripcion: "", cantidad: "", folioServicio: "", paraUnidad: "", entregadoA: "" };
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
function formatoContable(valor: string): string {
  const n = parseFloat(valor);
  if (isNaN(n)) return "";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${abs})` : `$${abs}`;
}
function desformatoContable(valor: string): string {
  const limpio = valor.replace(/[$,()]/g, "");
  return valor.trim().startsWith("(") ? `-${limpio}` : limpio;
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

// ---- Etiqueta con código QR (diseño 5cm x 2.5cm) para la vista Reportes ----
function cargarQRiousLib(): Promise<void> {
  return new Promise((resolve, reject) => {
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
}
async function generarImagenQR(valor: string): Promise<string> {
  await cargarQRiousLib();
  const canvas = document.createElement("canvas");
  new (window as any).QRious({ element: canvas, value: valor || "000000", size: 300, level: "H" });
  return canvas.toDataURL("image/png");
}
function bloqueEtiquetaQRHtml(item: { descripcion: string; costoUnitario: string; numeroEtiqueta: string }, imagenQR: string) {
  return `
<div class="etiqueta">
  <p class="titulo">${escaparHtml(item.descripcion) || "—"}</p>
  <img class="qr" src="${imagenQR}" alt="${escaparHtml(item.numeroEtiqueta)}" />
  <p class="precio">$${parseFloat(item.costoUnitario || "0").toFixed(2)}</p>
</div>`;
}
const ESTILOS_ETIQUETA_QR = `
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: #eef1f6; }
  .lienzo { padding: 24px 16px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .etiqueta {
    width: 5cm;
    height: 2.5cm;
    box-sizing: border-box;
    padding: 1.5mm 3mm;
    background: #fff;
    border: 1px solid #ccc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.9mm;
    page-break-after: always;
  }
  .titulo { font-size: 6.5pt; font-weight: 700; color: #000; text-align: center; margin: 0; line-height: 1.15; max-height: 0.56cm; overflow: hidden; width: 100%; }
  .qr { width: 1.05cm; height: 1.05cm; flex-shrink: 0; }
  .precio { font-size: 10.5pt; font-weight: 800; color: #000; margin: 0; }
  .barras { position: sticky; bottom: 0; background: #eef1f6; padding: 10px 0; }
  button { padding: 10px 26px; font-size: 13px; font-weight: bold; background: #16215c; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
  @media print {
    body { background: #fff; }
    .lienzo { padding: 0; gap: 0; }
    .etiqueta { border: none; }
    .barras { display: none; }
    @page { size: 5cm 2.5cm; margin: 0; }
  }
`;
async function abrirVentanaEtiquetaQR(item: { descripcion: string; costoUnitario: string; numeroEtiqueta: string }) {
  if (!item.numeroEtiqueta) {
    alert("Este artículo aún no tiene número de etiqueta.");
    return;
  }
  const imagenQR = await generarImagenQR(item.numeroEtiqueta);
  const ventana = window.open("", "_blank", "width=380,height=420");
  if (!ventana) {
    alert("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.");
    return;
  }
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Etiqueta ${escaparHtml(item.numeroEtiqueta)}</title>
<style>${ESTILOS_ETIQUETA_QR}</style>
</head>
<body>
<div class="lienzo">
  ${bloqueEtiquetaQRHtml(item, imagenQR)}
  <div class="barras"><button id="btnImprimir">Imprimir</button></div>
</div>
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
async function abrirVentanaEtiquetasQRLote(items: { descripcion: string; costoUnitario: string; numeroEtiqueta: string }[]) {
  const validos = items.filter((it) => it.numeroEtiqueta);
  if (validos.length === 0) {
    alert("No hay etiquetas para imprimir.");
    return;
  }
  const imagenes = await Promise.all(validos.map((it) => generarImagenQR(it.numeroEtiqueta)));
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
<style>${ESTILOS_ETIQUETA_QR}</style>
</head>
<body>
<div class="lienzo">
  ${validos.map((it, i) => bloqueEtiquetaQRHtml(it, imagenes[i])).join("\n")}
  <div class="barras"><button id="btnImprimir">Imprimir (${validos.length})</button></div>
</div>
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
          new (window as any).QRious({ element: canvas, value: `${window.location.origin}/inventario-movimientos`, size: 128, level: "M" });
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

  // ---- Consumir por etiqueta (inline, Reportes) ----
  const [consumoEtiqueta, setConsumoEtiqueta] = useState("");
  const [consumoReferencia, setConsumoReferencia] = useState("");
  const [consumoArticulo, setConsumoArticulo] = useState<ItemInventario | null>(null);
  const [consumoError, setConsumoError] = useState("");
  const [buscandoConsumo, setBuscandoConsumo] = useState(false);
  const [consumiendoInline, setConsumiendoInline] = useState(false);

  const buscarArticuloInline = () => {
    setConsumoError("");
    setBuscandoConsumo(true);
    const encontrado = items.find((it) => it.numeroEtiqueta === consumoEtiqueta);
    if (!encontrado) {
      setConsumoError("No se encontró ningún artículo con esa etiqueta.");
      setConsumoArticulo(null);
    } else {
      setConsumoArticulo(encontrado);
    }
    setBuscandoConsumo(false);
  };
  const consumirInline = async () => {
    if (!consumoArticulo) return;
    setConsumiendoInline(true);
    try {
      const res = await fetch("/api/inventario/salida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: consumoArticulo.codigo, cantidad: consumoArticulo.cantidad, comentario: consumoReferencia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al consumir el inventario.");
      setConsumoEtiqueta("");
      setConsumoReferencia("");
      setConsumoArticulo(null);
      await cargarItems();
      await cargarMovimientos();
      alert("Inventario consumido correctamente.");
    } catch (err: any) {
      alert(err.message || "No se pudo consumir el inventario.");
    } finally {
      setConsumiendoInline(false);
    }
  };

  // ---- Existencias por artículo ----
  const [modalExistencias, setModalExistencias] = useState(false);
  const [buscarExistencias, setBuscarExistencias] = useState("");
  const itemsFiltradosExistencias = useMemo(() => {
    const q = buscarExistencias.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.descripcion.toLowerCase().includes(q) || it.codigo.toLowerCase().includes(q) || it.categoria.toLowerCase().includes(q));
  }, [items, buscarExistencias]);

  // ---- Catálogo de proveedores ----
  const [modalProveedores, setModalProveedores] = useState(false);
  const [proveedoresLista, setProveedoresLista] = useState<Proveedor[]>([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(true);
  const cargarProveedores = async () => {
    try {
      const res = await fetch("/api/inventario/proveedores/list", { cache: "no-store" });
      const data = await res.json();
      setProveedoresLista(data.registros || []);
    } catch {
      // se reintenta con la siguiente accion
    } finally {
      setCargandoProveedores(false);
    }
  };
  useEffect(() => {
    cargarProveedores();
  }, []);
  const agregarProveedor = async () => {
    try {
      const res = await fetch("/api/inventario/proveedores", { method: "POST" });
      const data = await res.json();
      setProveedoresLista((prev) => [...prev, { id: data.id, nombre: "", contacto: "", telefono: "", email: "", notas: "" }]);
    } catch {
      alert("No se pudo agregar el proveedor.");
    }
  };
  const actualizarProveedorLocal = (id: number, campo: keyof Proveedor, valor: string) => {
    setProveedoresLista((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  };
  const guardarProveedorCampo = (id: number, campo: string, valor: string) => {
    fetch("/api/inventario/proveedores/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [campo]: valor }),
    }).catch(() => cargarProveedores());
  };
  const eliminarProveedor = async (id: number) => {
    if (!confirm("¿Eliminar este proveedor?")) return;
    setProveedoresLista((prev) => prev.filter((p) => p.id !== id));
    try {
      await fetch("/api/inventario/proveedores/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargarProveedores();
    }
  };

  // ---- Nueva Orden de Compra ----
  const [modalOrdenCompra, setModalOrdenCompra] = useState(false);
  const [ocProveedor, setOcProveedor] = useState("");
  const [ocFecha, setOcFecha] = useState(new Date().toISOString().slice(0, 10));
  const [ocItems, setOcItems] = useState<{ descripcion: string; cantidad: string; costoEstimado: string }[]>([{ descripcion: "", cantidad: "", costoEstimado: "" }]);
  const [guardandoOC, setGuardandoOC] = useState(false);
  const [ordenesCompraLista, setOrdenesCompraLista] = useState<OrdenCompra[]>([]);
  const cargarOrdenesCompra = async () => {
    try {
      const res = await fetch("/api/inventario/ordenes-compra/list", { cache: "no-store" });
      const data = await res.json();
      setOrdenesCompraLista(data.registros || []);
    } catch {
      // se reintenta con la siguiente accion
    }
  };
  useEffect(() => {
    cargarOrdenesCompra();
  }, []);
  const actualizarItemOC = (idx: number, campo: "descripcion" | "cantidad" | "costoEstimado", valor: string) => {
    setOcItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  };
  const agregarItemOC = () => setOcItems((prev) => [...prev, { descripcion: "", cantidad: "", costoEstimado: "" }]);
  const quitarItemOC = (idx: number) => setOcItems((prev) => prev.filter((_, i) => i !== idx));
  const guardarOrdenCompra = async () => {
    const itemsValidos = ocItems.filter((it) => it.descripcion.trim());
    if (!ocProveedor.trim() || itemsValidos.length === 0) {
      alert("Captura el proveedor y al menos un artículo.");
      return;
    }
    setGuardandoOC(true);
    try {
      const res = await fetch("/api/inventario/ordenes-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proveedor: ocProveedor.trim(), fecha: ocFecha, items: itemsValidos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la orden de compra.");
      setOcProveedor("");
      setOcItems([{ descripcion: "", cantidad: "", costoEstimado: "" }]);
      await cargarOrdenesCompra();
      alert(`Orden de compra ${data.folio} creada correctamente.`);
    } catch (err: any) {
      alert(err.message || "No se pudo crear la orden de compra.");
    } finally {
      setGuardandoOC(false);
    }
  };

  // ---- Conteos Cíclicos ----
  const [modalConteos, setModalConteos] = useState(false);
  const [ccArticulo, setCcArticulo] = useState("");
  const [ccCantidadContada, setCcCantidadContada] = useState("");
  const [ccContadoPor, setCcContadoPor] = useState("");
  const [guardandoConteo, setGuardandoConteo] = useState(false);
  const [conteosLista, setConteosLista] = useState<ConteoCiclico[]>([]);
  const cargarConteos = async () => {
    try {
      const res = await fetch("/api/inventario/conteos-ciclicos/list", { cache: "no-store" });
      const data = await res.json();
      setConteosLista(data.registros || []);
    } catch {
      // se reintenta con la siguiente accion
    }
  };
  useEffect(() => {
    cargarConteos();
  }, []);
  const itemSeleccionadoConteo = useMemo(() => items.find((it) => it.codigo === ccArticulo), [items, ccArticulo]);
  const guardarConteo = async () => {
    if (!itemSeleccionadoConteo || ccCantidadContada === "") {
      alert("Selecciona el artículo y captura la cantidad contada.");
      return;
    }
    setGuardandoConteo(true);
    try {
      const res = await fetch("/api/inventario/conteos-ciclicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: itemSeleccionadoConteo.codigo,
          descripcion: itemSeleccionadoConteo.descripcion,
          cantidadSistema: itemSeleccionadoConteo.cantidad,
          cantidadContada: ccCantidadContada,
          contadoPor: ccContadoPor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el conteo.");
      setCcArticulo("");
      setCcCantidadContada("");
      await cargarConteos();
      alert(`Conteo registrado. Diferencia: ${data.diferencia > 0 ? "+" : ""}${data.diferencia}`);
    } catch (err: any) {
      alert(err.message || "No se pudo guardar el conteo.");
    } finally {
      setGuardandoConteo(false);
    }
  };

  // ---- Entrada ----
  const [filasEntrada, setFilasEntrada] = useState<FilaEntrada[]>([]);
  const [recibiendo, setRecibiendo] = useState(false);
  const [generandoRecepcion, setGenerandoRecepcion] = useState(false);
  const [evidenciaRecepcion, setEvidenciaRecepcion] = useState<FotoDesc[]>([]);

  const agregarFilaEntrada = async () => {
    if (filasEntrada.length === 0) {
      setGenerandoRecepcion(true);
      try {
        const res = await fetch("/api/inventario/recepciones/generar", { method: "POST" });
        const data = await res.json();
        const numeroRecepcion = res.ok ? data.numeroRecepcion : "";
        setFilasEntrada([{ ...filaEntradaVacia(), numeroRecepcion }]);
      } catch {
        setFilasEntrada([filaEntradaVacia()]);
      } finally {
        setGenerandoRecepcion(false);
      }
      return;
    }
    setFilasEntrada((prev) => {
      const anterior = prev[prev.length - 1];
      const nueva: FilaEntrada = {
        ...filaEntradaVacia(),
        categoria: anterior.categoria,
        referencia: anterior.referencia,
        proveedor: anterior.proveedor,
        ubicacion: anterior.ubicacion,
        fechaIngreso: anterior.fechaIngreso,
        unidad: anterior.unidad,
        refCompra: anterior.refCompra,
        numeroRecepcion: anterior.numeroRecepcion,
      };
      return [...prev, nueva];
    });
  };
  const actualizarFilaEntrada = (idx: number, campo: keyof FilaEntrada, valor: string) => {
    setFilasEntrada((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)));
  };
  const quitarFilaEntrada = (idx: number) => {
    setFilasEntrada((prev) => prev.filter((_, i) => i !== idx));
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

  const agregarEvidenciaRecepcion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const nuevas: FotoDesc[] = [];
    for (const file of files) {
      try {
        nuevas.push({ foto: await compressImage(file), descripcion: "" });
      } catch {
        // se omite si falla la compresion
      }
    }
    setEvidenciaRecepcion((prev) => [...prev, ...nuevas]);
    e.target.value = "";
  };

  // Crea los articulos en la tabla principal a partir de las filas capturadas en Entrada.
  // Si una fila tiene cantidad > 1, se separa en un registro unitario por cada pieza,
  // cada uno con su propio numero de etiqueta, y devuelve los datos listos para imprimir.
  const procesarRecepcion = async (): Promise<{ descripcion: string; costoUnitario: string; numeroEtiqueta: string }[] | null> => {
    const validas = filasEntrada.filter((f) => f.descripcion.trim());
    if (validas.length === 0) {
      alert("Agrega al menos un artículo con descripción.");
      return null;
    }
    const etiquetasCreadas: { descripcion: string; costoUnitario: string; numeroEtiqueta: string }[] = [];
    for (const f of validas) {
      const cantidadTotal = Math.max(1, Math.round(parseFloat(f.cantidad) || 1));
      if (cantidadTotal === 1) {
        // una sola unidad: conserva la etiqueta ya generada para esta fila, si existe
        const res = await fetch("/api/inventario/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descripcion: f.descripcion.trim(),
            categoria: f.categoria,
            referencia: f.referencia,
            costoUnitario: desformatoContable(f.costoUnitario),
            cantidad: "1",
            proveedor: f.proveedor,
            ubicacion: f.ubicacion,
            fechaIngreso: f.fechaIngreso,
            unidad: f.unidad,
            numeroEtiqueta: f.numeroEtiqueta,
            refCompra: f.refCompra,
            numeroRecepcion: f.numeroRecepcion,
          }),
        });
        const data = await res.json();
        etiquetasCreadas.push({ descripcion: f.descripcion.trim(), costoUnitario: desformatoContable(f.costoUnitario), numeroEtiqueta: data.numeroEtiqueta || f.numeroEtiqueta });
      } else {
        // cantidad > 1: se separa en un registro individual por cada unidad, cada uno con
        // su propio numero de etiqueta (autogenerado), para poder consumirlas por separado
        for (let i = 0; i < cantidadTotal; i++) {
          const res = await fetch("/api/inventario/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              descripcion: f.descripcion.trim(),
              categoria: f.categoria,
              referencia: f.referencia,
              costoUnitario: desformatoContable(f.costoUnitario),
              cantidad: "1",
              proveedor: f.proveedor,
              ubicacion: f.ubicacion,
              fechaIngreso: f.fechaIngreso,
              unidad: f.unidad,
              refCompra: f.refCompra,
              numeroRecepcion: f.numeroRecepcion,
            }),
          });
          const data = await res.json();
          etiquetasCreadas.push({ descripcion: f.descripcion.trim(), costoUnitario: desformatoContable(f.costoUnitario), numeroEtiqueta: data.numeroEtiqueta || "" });
        }
      }
    }
    const numeroRecepcionLote = validas[0]?.numeroRecepcion;
    if (numeroRecepcionLote && evidenciaRecepcion.length > 0) {
      await fetch("/api/inventario/recepciones/evidencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroRecepcion: numeroRecepcionLote, evidencias: evidenciaRecepcion }),
      });
    }
    setFilasEntrada([]);
    setEvidenciaRecepcion([]);
    await cargarItems();
    await cargarMovimientos();
    return etiquetasCreadas;
  };

  const imprimirTodasEntradas = async () => {
    if (filasEntrada.length === 0) {
      alert("No hay filas en la tabla de entrada.");
      return;
    }
    setRecibiendo(true);
    try {
      const etiquetasCreadas = await procesarRecepcion();
      if (!etiquetasCreadas) return;
      await abrirVentanaEtiquetasQRLote(etiquetasCreadas);
      setTab("reportes");
    } catch {
      alert("Ocurrió un error al recibir la entrada. Verifica e intenta de nuevo.");
    } finally {
      setRecibiendo(false);
    }
  };

  const recibirEntrada = async () => {
    setRecibiendo(true);
    try {
      const etiquetasCreadas = await procesarRecepcion();
      if (!etiquetasCreadas) return;
      alert(`Se recibieron ${etiquetasCreadas.length} artículo(s) unitario(s) al inventario.`);
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
  const [filasFaltantes, setFilasFaltantes] = useState<Set<number>>(new Set());
  const [comprasAgregadas, setComprasAgregadas] = useState<Set<number>>(new Set());

  const agregarFilaSalida = () => setFilasSalida((prev) => [...prev, filaSalidaVacia()]);
  const actualizarFilaSalida = (idx: number, campo: keyof FilaSalida, valor: string) => {
    setFilasSalida((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        if (campo === "codigo") {
          const item = items.find((it) => it.codigo === valor);
          return { ...f, codigo: valor, numeroEtiqueta: item?.numeroEtiqueta || "", descripcion: item?.descripcion || "" };
        }
        if (campo === "numeroEtiqueta") {
          const item = items.find((it) => it.numeroEtiqueta === valor);
          return { ...f, numeroEtiqueta: valor, codigo: item?.codigo || "", descripcion: item?.descripcion || f.descripcion };
        }
        return { ...f, [campo]: valor };
      })
    );
  };
  const quitarFilaSalida = (idx: number) => setFilasSalida((prev) => prev.filter((_, i) => i !== idx));

  // ---- Solicitudes de material pendientes (desde Historial de mantenimientos) ----
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudMaterial[]>([]);
  const cargarSolicitudesPendientes = async () => {
    try {
      const res = await fetch("/api/historial-mantenimientos/solicitudes/list", { cache: "no-store" });
      const data = await res.json();
      setSolicitudesPendientes((data.registros || []).filter((s: SolicitudMaterial) => s.estado === "pendiente"));
    } catch {
      // se reintenta con el sondeo periodico
    }
  };
  useEffect(() => {
    cargarSolicitudesPendientes();
    const id = setInterval(cargarSolicitudesPendientes, 20000);
    return () => clearInterval(id);
  }, []);

  const [comprasPendientes, setComprasPendientes] = useState<CompraPendiente[]>([]);
  const cargarComprasPendientes = async () => {
    try {
      const res = await fetch("/api/inventario/compras-pendientes/list", { cache: "no-store" });
      const data = await res.json();
      setComprasPendientes(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    }
  };
  useEffect(() => {
    cargarComprasPendientes();
    const id = setInterval(cargarComprasPendientes, 20000);
    return () => clearInterval(id);
  }, []);

  const revisarSolicitud = async (sol: SolicitudMaterial) => {
    const nuevasFilas: FilaSalida[] = sol.items.map((it) => {
      const item = items.find((i) => i.numeroEtiqueta === it.noEtiqueta);
      return {
        codigo: item?.codigo || "",
        numeroEtiqueta: it.noEtiqueta,
        descripcion: item?.descripcion || it.descripcion,
        cantidad: it.cantidad,
        folioServicio: it.folioServicio,
        paraUnidad: it.paraUnidad,
        entregadoA: it.entregadoA,
        solicitudId: sol.id,
      };
    });
    setFilasSalida((prev) => [...prev, ...nuevasFilas]);
    try {
      await fetch("/api/historial-mantenimientos/solicitudes/actualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sol.id, estado: "en_revision" }),
      });
      setSolicitudesPendientes((prev) => prev.filter((s) => s.id !== sol.id));
    } catch {
      // no bloquea la revision local
    }
  };

  const registrarSalida = async () => {
    const validas = filasSalida.filter((f) => (f.codigo || f.numeroEtiqueta) && f.cantidad);
    if (validas.length === 0) {
      alert("Agrega al menos una salida con artículo y cantidad.");
      return;
    }
    setRegistrandoSalida(true);
    try {
      const res = await fetch("/api/inventario/salida-multiple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validas.map((f) => ({
            numeroEtiqueta: f.numeroEtiqueta,
            descripcion: f.descripcion,
            cantidad: Number(f.cantidad),
            folioServicio: f.folioServicio,
            paraUnidad: f.paraUnidad,
            entregadoA: f.entregadoA,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar la salida.");

      const nuevasFaltantes = new Set<number>();
      const restantes: FilaSalida[] = [];
      const solicitudesCompletadas = new Set<number>();
      const solicitudesConFaltante = new Set<number>();

      validas.forEach((f, i) => {
        const resultado = data.resultados[i];
        if (resultado?.ok) {
          if (f.solicitudId) solicitudesCompletadas.add(f.solicitudId);
        } else {
          restantes.push(f);
          nuevasFaltantes.add(restantes.length - 1);
          if (f.solicitudId) solicitudesConFaltante.add(f.solicitudId);
        }
      });

      setFilasSalida(restantes);
      setFilasFaltantes(nuevasFaltantes);
      await cargarItems();
      await cargarMovimientos();

      for (const solId of solicitudesCompletadas) {
        if (!solicitudesConFaltante.has(solId)) {
          await fetch("/api/historial-mantenimientos/solicitudes/actualizar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: solId, estado: "atendida" }),
          }).catch(() => {});
        }
      }

      const exitosas = validas.length - restantes.length;
      if (restantes.length > 0) {
        alert(`Se registraron ${exitosas} salida(s). ${restantes.length} artículo(s) no se pudieron descontar (sin existencia suficiente) — quedaron marcados en naranja.`);
      } else {
        alert(`Se registraron ${exitosas} salida(s) del inventario.`);
        setTab("reportes");
      }
    } catch (err: any) {
      alert(err.message || "Ocurrió un error al registrar la salida.");
    } finally {
      setRegistrandoSalida(false);
    }
  };

  const agregarACompras = async (idx: number) => {
    const f = filasSalida[idx];
    if (!f) return;
    try {
      await fetch("/api/inventario/compras-pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: f.descripcion || f.numeroEtiqueta, cantidad: f.cantidad, origen: `Salida — folio ${f.folioServicio || "s/f"}` }),
      });
      setComprasAgregadas((prev) => new Set(prev).add(idx));
      await cargarComprasPendientes();
    } catch {
      alert("No se pudo agregar a compras.");
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
                  <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4 sm:col-span-2">
                    <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Seguimiento a refacciones usadas</p>
                    <div className="flex flex-col gap-1 max-h-[90px] overflow-y-auto mb-3">
                      {salidasRecientes.length === 0 && <span className="text-[12px] text-[var(--gray-400)]">Sin salidas registradas.</span>}
                      {salidasRecientes.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-[11.5px]">
                          <span className="text-[var(--navy)] truncate">{m.descripcion || m.codigo}</span>
                          <span className="font-bold text-[var(--navy)]">-{m.cantidad}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 pt-3 border-t border-[var(--gray-100)]">
                      <div className="flex flex-col items-center gap-1.5">
                        <canvas id="qr-inventario-movimientos" width={128} height={128} />
                        <p className="text-[10.5px] text-[var(--gray-400)] m-0 text-center max-w-[128px]">Escanea para registrar una entrada o salida desde tu celular.</p>
                      </div>
                      <div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                          <div>
                            <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Consumir Etiqueta</label>
                            <select
                              value={consumoEtiqueta}
                              onChange={(e) => {
                                setConsumoEtiqueta(e.target.value);
                                setConsumoArticulo(null);
                                setConsumoError("");
                              }}
                              className="w-full border border-[var(--gray-200)] rounded-lg px-2.5 py-2 text-[12.5px]"
                            >
                              <option value="">Selecciona una etiqueta...</option>
                              {items
                                .filter((it) => it.numeroEtiqueta)
                                .map((it) => (
                                  <option key={it.id} value={it.numeroEtiqueta}>
                                    {it.numeroEtiqueta} — {it.descripcion}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Referencia de uso</label>
                            <input
                              value={consumoReferencia}
                              onChange={(e) => setConsumoReferencia(e.target.value)}
                              placeholder="Ej. Folio de servicio / motivo"
                              className="w-full border border-[var(--gray-200)] rounded-lg px-2.5 py-2 text-[12.5px]"
                            />
                          </div>
                        </div>
                        <button type="button" onClick={buscarArticuloInline} disabled={!consumoEtiqueta || buscandoConsumo} className="text-[11.5px] font-bold text-[var(--blue)] disabled:opacity-50">
                          {buscandoConsumo ? "Buscando..." : "Buscar artículo"}
                        </button>
                        {consumoError && <p className="text-[11.5px] text-[var(--red)] mt-1.5 mb-0">{consumoError}</p>}
                        {consumoArticulo && (
                          <div className="bg-[var(--green)]/8 border border-[var(--green)]/40 rounded-lg p-3 mt-2.5">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-[var(--navy)] mb-2.5">
                              <p className="m-0"><b>Descripción:</b> {consumoArticulo.descripcion}</p>
                              <p className="m-0"><b>Categoría:</b> {consumoArticulo.categoria || "—"}</p>
                              <p className="m-0"><b>Existencias:</b> {consumoArticulo.cantidad}</p>
                              <p className="m-0"><b>Ubicación:</b> {consumoArticulo.ubicacion || "—"}</p>
                            </div>
                            <button
                              type="button"
                              onClick={consumirInline}
                              disabled={consumiendoInline}
                              className="w-full flex items-center justify-center gap-1.5 bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg py-2 text-[12px] font-bold"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
                              {consumiendoInline ? "Consumiendo..." : "Consumir del Inventario"}
                            </button>
                          </div>
                        )}
                      </div>
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

                <div className="flex flex-wrap gap-2.5 mb-5">
                  <button type="button" onClick={() => setModalExistencias(true)} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[12.5px] font-bold">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M20.59 13.41L11 3.83V3a1 1 0 00-1-1H4a1 1 0 00-1 1v6a1 1 0 001 1h.83l9.58 9.59a2 2 0 002.83 0l3.35-3.35a2 2 0 000-2.83z" /><circle cx="6.5" cy="6.5" r="1.5" /></svg>
                    Existencias por artículo
                  </button>
                  <button type="button" onClick={() => setModalProveedores(true)} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[12.5px] font-bold">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>
                    Catálogo de proveedores
                  </button>
                  <button type="button" onClick={() => setModalOrdenCompra(true)} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[12.5px] font-bold">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M12 11v6M9 14h6" /></svg>
                    Nueva Orden de Compra
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalConteos(true)}
                    className="flex items-center gap-2 text-white rounded-lg px-4 py-2.5 text-[12.5px] font-bold shadow-[0_4px_14px_rgba(242,177,52,0.45)]"
                    style={{ background: "linear-gradient(135deg, #f2b134, #e2412c)" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M21 12a9 9 0 11-9-9c2.5 0 4.7 1 6.3 2.7" /><path d="M21 3v6h-6" /></svg>
                    Conteos Cíclicos
                  </button>
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
                            <td className="px-2.5 py-2 text-[12px] whitespace-nowrap font-mono">
                              {it.numeroEtiqueta ? (
                                <span
                                  onClick={() => abrirVentanaEtiquetaQR(it)}
                                  className="text-[var(--blue)] font-bold cursor-pointer underline decoration-dotted"
                                  title="Ver / imprimir etiqueta con código QR"
                                >
                                  {it.numeroEtiqueta}
                                </span>
                              ) : (
                                <span className="text-[var(--navy)]">—</span>
                              )}
                            </td>
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
              <div>
                {comprasPendientes.length > 0 && (
                  <div className="bg-[var(--amber)]/10 border border-[var(--amber)]/50 rounded-2xl p-4 sm:p-5 mb-5">
                    <p className="text-[13px] font-bold text-[var(--navy)] m-0 mb-3">Pendientes por comprar ({comprasPendientes.length})</p>
                    <div className="flex flex-col gap-1.5">
                      {comprasPendientes.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                          <span className="text-[var(--navy)]">
                            {c.descripcion} {c.cantidad ? `× ${c.cantidad}` : ""} <span className="text-[var(--gray-400)]">({c.origen})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
                  <h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0">Entrada de inventario</h3>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={agregarFilaEntrada} disabled={generandoRecepcion} className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] disabled:opacity-50 rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
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
                      disabled={recibiendo || filasEntrada.length === 0}
                      className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-1.5 text-[12px] font-bold disabled:opacity-50"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                      {recibiendo ? "Procesando..." : "Recibir e imprimir todas"}
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
                        {["Ref. Compra", "N° Recepción", "Descripción", "Categoría", "Referencia", "Costo unitario", "Cantidad", "Proveedor", "Ubicación", "Fecha de ingreso", "Unidad", "N° Etiqueta", ""].map((c, i) => (
                          <th key={i} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-2 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filasEntrada.map((f, idx) => (
                        <tr key={idx} className="border-b border-[var(--gray-200)]">
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <input value={f.refCompra} onChange={(e) => actualizarFilaEntrada(idx, "refCompra", e.target.value)} placeholder="Ej. Factura 1234" className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[110px]" />
                          </td>
                          <td className="px-2 py-1.5 text-[11.5px] font-mono font-semibold text-[var(--gray-400)] whitespace-nowrap">{f.numeroRecepcion || "—"}</td>
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
                            <input
                              type="text"
                              inputMode="decimal"
                              value={f.costoUnitario}
                              onFocus={(e) => actualizarFilaEntrada(idx, "costoUnitario", desformatoContable(e.target.value))}
                              onChange={(e) => actualizarFilaEntrada(idx, "costoUnitario", e.target.value)}
                              onBlur={(e) => actualizarFilaEntrada(idx, "costoUnitario", e.target.value ? formatoContable(desformatoContable(e.target.value)) : "")}
                              className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[85px]"
                            />
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
                {filasEntrada.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--gray-200)]">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--navy)] cursor-pointer">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        Evidencia / Factura o nota
                        <input type="file" accept="image/*" capture="environment" multiple onChange={agregarEvidenciaRecepcion} className="hidden" />
                      </label>
                      {evidenciaRecepcion.length > 0 && <span className="text-[11px] font-bold text-[var(--green)]">{evidenciaRecepcion.length} foto(s) lista(s)</span>}
                    </div>
                    {evidenciaRecepcion.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {evidenciaRecepcion.map((f, i) => (
                          <div key={i} className="relative w-14 h-14">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f.foto} alt={`Evidencia ${i + 1}`} className="w-14 h-14 rounded-md object-cover" />
                            <span
                              onClick={() => setEvidenciaRecepcion((prev) => prev.filter((_, idx) => idx !== i))}
                              className="absolute -top-1.5 -right-1.5 bg-[var(--red)] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] cursor-pointer"
                            >
                              ×
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
            )}

            {tab === "salida" && (
              <div>
                {solicitudesPendientes.length > 0 && (
                  <div className="bg-[var(--amber)]/10 border border-[var(--amber)]/50 rounded-2xl p-4 sm:p-5 mb-5">
                    <p className="text-[13px] font-bold text-[var(--navy)] m-0 mb-3">
                      Solicitudes de material pendientes de autorización ({solicitudesPendientes.length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {solicitudesPendientes.map((sol) => (
                        <div key={sol.id} className="bg-white rounded-lg border border-[var(--gray-200)] px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-[12.5px] font-semibold text-[var(--navy)] m-0">
                              Folio {sol.folioServicio || "—"} · {sol.ecoUnidad || "—"} · {sol.items.length} artículo(s)
                            </p>
                          </div>
                          <button type="button" onClick={() => revisarSolicitud(sol)} className="bg-[var(--navy)] text-white rounded-lg px-4 py-1.5 text-[11.5px] font-bold">
                            Revisar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                  <datalist id="dl-inv-etiquetas">
                    {items.filter((it) => it.numeroEtiqueta).map((it) => (
                      <option key={it.id} value={it.numeroEtiqueta} />
                    ))}
                  </datalist>
                  <div className="overflow-x-auto">
                    <table className="border-collapse min-w-max w-full">
                      <thead>
                        <tr>
                          {["N° Etiqueta", "Descripción", "Cantidad", "Folio de servicio", "Para qué unidad", "A quién se entrega", ""].map((c, i) => (
                            <th key={i} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filasSalida.map((f, idx) => {
                          const item = items.find((it) => it.numeroEtiqueta === f.numeroEtiqueta || (it.codigo === f.codigo && f.codigo));
                          const esFaltante = filasFaltantes.has(idx);
                          return (
                            <tr key={idx} className="border-b border-[var(--gray-200)]" style={esFaltante ? { backgroundColor: "rgba(242,177,52,0.18)" } : undefined}>
                              <td className="px-2.5 py-1.5 whitespace-nowrap">
                                <input
                                  value={f.numeroEtiqueta}
                                  onChange={(e) => actualizarFilaSalida(idx, "numeroEtiqueta", e.target.value)}
                                  list="dl-inv-etiquetas"
                                  placeholder="000123"
                                  className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[95px]"
                                />
                              </td>
                              <td className="px-2.5 py-1.5 text-[12.5px] whitespace-nowrap">
                                {f.descripcion || "—"} {item && <span className="text-[10.5px] text-[var(--gray-400)]">(disp. {item.cantidad})</span>}
                                {esFaltante && <span className="text-[10.5px] font-bold text-[var(--amber)] ml-1">· sin existencia suficiente</span>}
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
                                <div className="flex items-center gap-2">
                                  {esFaltante && (
                                    <button
                                      type="button"
                                      onClick={() => agregarACompras(idx)}
                                      disabled={comprasAgregadas.has(idx)}
                                      className="text-[10.5px] font-bold text-white bg-[var(--amber)] disabled:opacity-50 rounded px-2 py-1 whitespace-nowrap"
                                    >
                                      {comprasAgregadas.has(idx) ? "✓ Agregado" : "Agregar a compras"}
                                    </button>
                                  )}
                                  <span onClick={() => quitarFilaSalida(idx)} className="text-[var(--red)] cursor-pointer" title="Quitar fila">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filasSalida.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Usa &quot;+ Agregar fila&quot; para capturar salidas de inventario.</div>}
                  </div>
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

      {modalExistencias && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[680px] max-w-[95%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Existencias por artículo</h3>
              <span onClick={() => setModalExistencias(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <input
              value={buscarExistencias}
              onChange={(e) => setBuscarExistencias(e.target.value)}
              placeholder="Buscar por código, descripción o categoría..."
              className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13px] mb-4"
            />
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Código", "Descripción", "Categoría", "Ubicación", "Existencias"].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltradosExistencias.map((it) => (
                    <tr key={it.id} className="border-b border-[var(--gray-200)]">
                      <td className="px-2.5 py-2 text-[12.5px] font-semibold text-[var(--navy)] whitespace-nowrap">{it.codigo}</td>
                      <td className="px-2.5 py-2 text-[12.5px]">{it.descripcion}</td>
                      <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{it.categoria || "—"}</td>
                      <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{it.ubicacion || "—"}</td>
                      <td className={`px-2.5 py-2 text-[12.5px] font-bold whitespace-nowrap ${it.cantidad < UMBRAL_BAJO ? "text-[var(--red)]" : "text-[var(--navy)]"}`}>{it.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {itemsFiltradosExistencias.length === 0 && <p className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin artículos que coincidan.</p>}
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setModalExistencias(false)} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalProveedores && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[820px] max-w-[96%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Catálogo de proveedores</h3>
              <span onClick={() => setModalProveedores(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <button type="button" onClick={agregarProveedor} className="flex items-center gap-1.5 bg-[var(--navy)] text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold mb-3.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              + Agregar proveedor
            </button>
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Nombre", "Contacto", "Teléfono", "Email", "Notas", ""].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proveedoresLista.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--gray-200)]">
                      {([
                        ["nombre", "w-[140px]"],
                        ["contacto", "w-[120px]"],
                        ["telefono", "w-[110px]"],
                        ["email", "w-[150px]"],
                        ["notas", "w-[160px]"],
                      ] as const).map(([campo, ancho]) => (
                        <td key={campo} className="px-2 py-1.5">
                          <input
                            defaultValue={p[campo]}
                            onBlur={(e) => {
                              actualizarProveedorLocal(p.id, campo, e.target.value);
                              guardarProveedorCampo(p.id, campo, e.target.value);
                            }}
                            className={`border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] ${ancho}`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span onClick={() => eliminarProveedor(p.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!cargandoProveedores && proveedoresLista.length === 0 && <p className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin proveedores registrados aún.</p>}
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setModalProveedores(false)} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOrdenCompra && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[720px] max-w-[96%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Nueva Orden de Compra</h3>
              <span onClick={() => setModalOrdenCompra(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Proveedor</label>
                <input value={ocProveedor} onChange={(e) => setOcProveedor(e.target.value)} list="dl-inv-proveedores-oc" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
                <datalist id="dl-inv-proveedores-oc">
                  {proveedoresLista.map((p) => (
                    <option key={p.id} value={p.nombre} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Fecha</label>
                <input type="date" value={ocFecha} onChange={(e) => setOcFecha(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
            </div>
            <div className="overflow-x-auto mb-2.5">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Descripción", "Cantidad", "Costo estimado", ""].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ocItems.map((it, idx) => (
                    <tr key={idx} className="border-b border-[var(--gray-200)]">
                      <td className="px-2 py-1.5">
                        <input value={it.descripcion} onChange={(e) => actualizarItemOC(idx, "descripcion", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[220px]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={it.cantidad} onChange={(e) => actualizarItemOC(idx, "cantidad", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[80px]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={it.costoEstimado} onChange={(e) => actualizarItemOC(idx, "costoEstimado", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[100px]" />
                      </td>
                      <td className="px-2 py-1.5">
                        {ocItems.length > 1 && (
                          <span onClick={() => quitarItemOC(idx)} className="text-[var(--red)] cursor-pointer" title="Quitar">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={agregarItemOC} className="text-[12px] font-bold text-[var(--blue)] mb-5">
              + Agregar artículo
            </button>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setModalOrdenCompra(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button type="button" onClick={guardarOrdenCompra} disabled={guardandoOC} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoOC ? "Guardando..." : "Crear orden de compra"}
              </button>
            </div>
            {ordenesCompraLista.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[var(--gray-200)]">
                <p className="text-[12.5px] font-bold text-[var(--navy)] mb-2.5">Órdenes recientes</p>
                <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
                  {ordenesCompraLista.slice(0, 8).map((oc) => (
                    <div key={oc.id} className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--navy)]">
                        {oc.folio} — {oc.proveedor} ({oc.items.length} art.)
                      </span>
                      <span className="text-[var(--gray-400)]">{oc.fecha}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalConteos && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[680px] max-w-[96%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Conteos Cíclicos</h3>
              <span onClick={() => setModalConteos(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Artículo</label>
                <select value={ccArticulo} onChange={(e) => setCcArticulo(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]">
                  <option value="">Selecciona...</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.codigo}>
                      {it.codigo} — {it.descripcion}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Contado por</label>
                <input value={ccContadoPor} onChange={(e) => setCcContadoPor(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
            </div>
            {itemSeleccionadoConteo && (
              <p className="text-[12.5px] text-[var(--gray-400)] mb-2.5">
                Cantidad en sistema: <span className="font-bold text-[var(--navy)]">{itemSeleccionadoConteo.cantidad}</span>
              </p>
            )}
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Cantidad contada físicamente</label>
              <input type="number" value={ccCantidadContada} onChange={(e) => setCcCantidadContada(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              {itemSeleccionadoConteo && ccCantidadContada !== "" && (
                <p className={`text-[12px] font-bold mt-1.5 ${Number(ccCantidadContada) - itemSeleccionadoConteo.cantidad === 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                  Diferencia: {Number(ccCantidadContada) - itemSeleccionadoConteo.cantidad > 0 ? "+" : ""}
                  {Number(ccCantidadContada) - itemSeleccionadoConteo.cantidad}
                </p>
              )}
            </div>
            <div className="flex gap-2.5 justify-end mb-6">
              <button type="button" onClick={() => setModalConteos(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button type="button" onClick={guardarConteo} disabled={guardandoConteo} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoConteo ? "Guardando..." : "Registrar conteo"}
              </button>
            </div>
            {conteosLista.length > 0 && (
              <div className="pt-4 border-t border-[var(--gray-200)]">
                <p className="text-[12.5px] font-bold text-[var(--navy)] mb-2.5">Conteos recientes</p>
                <div className="overflow-x-auto">
                  <table className="border-collapse min-w-max w-full">
                    <thead>
                      <tr>
                        {["Fecha", "Código", "Descripción", "Sistema", "Contado", "Diferencia", "Contado por"].map((c) => (
                          <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {conteosLista.slice(0, 10).map((c) => (
                        <tr key={c.id} className="border-b border-[var(--gray-200)]">
                          <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{c.fecha}</td>
                          <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap font-semibold text-[var(--navy)]">{c.codigo}</td>
                          <td className="px-2 py-1.5 text-[11.5px]">{c.descripcion}</td>
                          <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{c.cantidadSistema}</td>
                          <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{c.cantidadContada}</td>
                          <td className={`px-2 py-1.5 text-[11.5px] font-bold whitespace-nowrap ${c.diferencia === 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                            {c.diferencia > 0 ? "+" : ""}
                            {c.diferencia}
                          </td>
                          <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{c.contadoPor || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
