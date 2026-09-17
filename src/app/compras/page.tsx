"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import PageFooter from "@/components/PageFooter";

interface FilaProducto {
  id: string;
  cantidad: string;
  articulo: string;
  precio: string; // Precio unitario
  proveedores: string[];
}

interface ProductoOrdenBD {
  cantidad: number;
  articulo: string;
  precioUnitario: number;
  totalProducto: number;
  proveedores?: string[];
}

interface OrdenCompraBD {
  id?: number;
  folio: string;
  fecha: string;
  num_proveedores?: number;
  numProveedores?: number;
  total_general?: number | string;
  totalGeneral?: number | string;
  productos: ProductoOrdenBD[] | string;
  estado?: string;
  created_at?: string;
}

export default function ComprasPage() {
  const [tab, setTab] = useState<"agregar" | "consultar">("agregar");

  // Estado para la tabla de O.C. (Modo Agregar)
  const [numProveedores, setNumProveedores] = useState<number>(1);
  const [filas, setFilas] = useState<FilaProducto[]>([
    { id: "1", cantidad: "", articulo: "", precio: "", proveedores: [""] },
  ]);

  // Modales, Guardado y Validaciones
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mostrarPreview, setMostrarPreview] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [folioOC, setFolioOC] = useState<string>("");
  const [fechaActualFormatted, setFechaActualFormatted] = useState<string>("");

  // Estado para Consultar Órdenes de Compra
  const [ordenes, setOrdenes] = useState<OrdenCompraBD[]>([]);
  const [cargandoConsultas, setCargandoConsultas] = useState<boolean>(false);
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null);
  const [esModoVisualizacion, setEsModoVisualizacion] = useState<boolean>(false);

  useEffect(() => {
    // Formatear la fecha actual en español
    const hoy = new Date();
    const opciones: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    setFechaActualFormatted(hoy.toLocaleDateString("es-ES", opciones));
  }, []);

  // Cargar órdenes cuando se cambia a la pestaña "Consultar"
  useEffect(() => {
    if (tab === "consultar") {
      cargarOrdenes();
    }
  }, [tab]);

  // Función para obtener las órdenes desde la base de datos
  const cargarOrdenes = async () => {
    setCargandoConsultas(true);
    setErrorConsulta(null);
    try {
      const res = await fetch("/api/compras");
      if (!res.ok) {
        throw new Error("Ocurrió un error al cargar las órdenes de compra.");
      }
      const data = await res.json();
      setOrdenes(data);
    } catch (err: any) {
      setErrorConsulta(err.message || "Error al obtener la información.");
    } finally {
      setCargandoConsultas(false);
    }
  };

  // Función formateadora de moneda
  const formatearMoneda = (valor: number | string) => {
    const num = typeof valor === "string" ? parseFloat(valor) : valor;
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(isNaN(num) ? 0 : num);
  };

  // Formatear fechas guardadas
  const formatearFechaBD = (fechaIso?: string) => {
    if (!fechaIso) return "-";
    const fecha = new Date(fechaIso);
    return fecha.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Cálculo del Total General para captura activa
  const totalGeneral = filas.reduce((acc, fila) => {
    const cant = Number(fila.cantidad) || 0;
    const prec = Number(fila.precio) || 0;
    return acc + cant * prec;
  }, 0);

  // Agregar una columna de proveedor (máximo 5)
  const agregarProveedorColumna = () => {
    if (numProveedores >= 5) {
      alert("Solo se permite un máximo de 5 proveedores.");
      return;
    }
    const nuevoNum = numProveedores + 1;
    setNumProveedores(nuevoNum);
    setFilas((prev) =>
      prev.map((f) => ({
        ...f,
        proveedores: [...f.proveedores, ""],
      }))
    );
  };

  // Quitar la última columna de proveedor
  const removerProveedorColumna = () => {
    if (numProveedores <= 1) return;
    const nuevoNum = numProveedores - 1;
    setNumProveedores(nuevoNum);
    setFilas((prev) =>
      prev.map((f) => ({
        ...f,
        proveedores: f.proveedores.slice(0, nuevoNum),
      }))
    );
  };

  // Agregar nueva fila de producto
  const agregarFilaProducto = () => {
    const nuevaFila: FilaProducto = {
      id: Date.now().toString(),
      cantidad: "",
      articulo: "",
      precio: "",
      proveedores: Array(numProveedores).fill(""),
    };
    setFilas((prev) => [...prev, nuevaFila]);
  };

  // Eliminar fila
  const eliminarFila = (id: string) => {
    if (filas.length === 1) {
      alert("Debe existir al menos un producto en la orden.");
      return;
    }
    setFilas((prev) => prev.filter((f) => f.id !== id));
  };

  // Actualizar valores de fila
  const actualizarFila = (id: string, campo: keyof FilaProducto, valor: any) => {
    setFilas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f))
    );
  };

  // Actualizar texto de un proveedor específico en una fila
  const actualizarProveedorFila = (idFila: string, indexProv: number, valor: string) => {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.id === idFila) {
          const nuevosProv = [...f.proveedores];
          nuevosProv[indexProv] = valor;
          return { ...f, proveedores: nuevosProv };
        }
        return f;
      })
    );
  };

  // Abrir Previsualización y Generar Folio Automático
  const handleGenerarOC = () => {
    setErrorMsg(null);

    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const cant = Number(f.cantidad);
      const prec = Number(f.precio);

      if (!f.articulo.trim()) {
        setErrorMsg(`Fila ${i + 1}: El nombre del artículo es obligatorio.`);
        return;
      }
      if (isNaN(cant) || cant <= 0) {
        setErrorMsg(`Fila ${i + 1}: La cantidad debe ser un número positivo mayor a 0.`);
        return;
      }
      if (isNaN(prec) || prec <= 0) {
        setErrorMsg(`Fila ${i + 1}: El precio unitario debe ser un número positivo mayor a 0.`);
        return;
      }
    }

    const fecha = new Date();
    const YYYY = fecha.getFullYear();
    const MM = String(fecha.getMonth() + 1).padStart(2, "0");
    const DD = String(fecha.getDate()).padStart(2, "0");
    const rand = Math.floor(100 + Math.random() * 900);
    const nuevoFolio = `OC-${YYYY}${MM}${DD}-${rand}`;

    setFolioOC(nuevoFolio);
    setEsModoVisualizacion(false);
    setMostrarPreview(true);
  };

  // Visualizar una orden guardada previamente
  const verOrdenGuardada = (orden: OrdenCompraBD) => {
    let prods: ProductoOrdenBD[] = [];
    if (typeof orden.productos === "string") {
      try {
        prods = JSON.parse(orden.productos);
      } catch {
        prods = [];
      }
    } else {
      prods = orden.productos || [];
    }

    const nProvs = orden.num_proveedores || orden.numProveedores || 1;
    setNumProveedores(nProvs);

    // Convertir de formato BD a filas de estado para previsualización
    setFilas(
      prods.map((p, idx) => ({
        id: idx.toString(),
        cantidad: p.cantidad.toString(),
        articulo: p.articulo,
        precio: p.precioUnitario ? p.precioUnitario.toString() : "0",
        proveedores: p.proveedores || Array(nProvs).fill("-"),
      }))
    );

    setFolioOC(orden.folio);
    setEsModoVisualizacion(true);
    setMostrarPreview(true);
  };

  // Confirmar y Guardar Orden en Base de Datos
  const handleConfirmarOC = async () => {
    setGuardando(true);
    try {
      const payload = {
        folio: folioOC,
        fecha: new Date().toISOString(),
        numProveedores,
        totalGeneral,
        productos: filas.map((f) => {
          const cant = Number(f.cantidad);
          const prec = Number(f.precio);
          return {
            cantidad: cant,
            articulo: f.articulo,
            precioUnitario: prec,
            totalProducto: cant * prec,
            proveedores: f.proveedores,
          };
        }),
      };

      const res = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Error al guardar la orden de compra.");
      }

      alert(`✅ ¡Orden de compra ${folioOC} confirmada y guardada con éxito!`);

      // Reiniciar formulario
      setFilas([{ id: Date.now().toString(), cantidad: "", articulo: "", precio: "", proveedores: [""] }]);
      setNumProveedores(1);
      setMostrarPreview(false);
    } catch (err: any) {
      alert(`⚠️ ${err.message || "Ocurrió un error al guardar en la base de datos."}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6] flex flex-col">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          #area-impresion, #area-impresion * {
            visibility: visible !important;
          }
          #area-impresion {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          @page {
            margin: 12mm;
            size: auto;
          }
        }
      `}</style>

      {/* Encabezado Principal Responsivo */}
      <header className="no-print bg-white border-b border-[var(--gray-200)] shadow-sm sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-3.5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <h1 className="font-display text-[16px] sm:text-[18px] font-bold text-[var(--navy)] m-0">
                Gestión de Compras
              </h1>
              <p className="text-[11px] sm:text-[12px] text-[var(--gray-400)] m-0">Transportes Logisticar</p>
            </div>
          </div>
          <Link
            href="/"
            className="text-[12.5px] sm:text-[13px] font-semibold text-[var(--blue)] hover:underline flex items-center gap-1"
          >
            ← Volver al menú
          </Link>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="no-print flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 md:px-10 pt-4 sm:pt-6 pb-8">
        {/* Conmutador de Opciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-5 sm:mb-6">
          <button
            onClick={() => setTab("agregar")}
            className={`p-4 sm:p-5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              tab === "agregar"
                ? "bg-white border-[var(--blue)] shadow-md ring-2 ring-[var(--blue)]/20"
                : "bg-white/60 border-[var(--gray-200)] hover:bg-white"
            }`}
          >
            <div>
              <span className="text-[11px] sm:text-[12px] font-bold tracking-wider text-[var(--blue)] uppercase block mb-1">
                Opción 1
              </span>
              <h2 className="text-[15px] sm:text-[16px] font-bold text-[var(--navy)] m-0">
                Agregar orden de compra
              </h2>
            </div>
            <p className="text-[11.5px] sm:text-[12px] text-[var(--gray-400)] mt-2 mb-0">
              Crea una nueva solicitud con productos, cantidades, precios unitarios y proveedores.
            </p>
          </button>

          <button
            onClick={() => setTab("consultar")}
            className={`p-4 sm:p-5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              tab === "consultar"
                ? "bg-white border-[var(--blue)] shadow-md ring-2 ring-[var(--blue)]/20"
                : "bg-white/60 border-[var(--gray-200)] hover:bg-white"
            }`}
          >
            <div>
              <span className="text-[11px] sm:text-[12px] font-bold tracking-wider text-[var(--blue)] uppercase block mb-1">
                Opción 2
              </span>
              <h2 className="text-[15px] sm:text-[16px] font-bold text-[var(--navy)] m-0">
                Consultar órdenes de compra
              </h2>
            </div>
            <p className="text-[11.5px] sm:text-[12px] text-[var(--gray-400)] mt-2 mb-0">
              Historial y estado de órdenes de compra emitidas anteriormente.
            </p>
          </button>
        </div>

        {/* CONTENIDO 1: AGREGAR ORDEN DE COMPRA */}
        {tab === "agregar" && (
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-[var(--gray-200)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 mb-5 sm:mb-6">
              <div>
                <h3 className="text-[15px] sm:text-[16px] font-bold text-[var(--navy)] m-0">
                  Captura de Productos y Proveedores
                </h3>
                <p className="text-[11.5px] sm:text-[12.5px] text-[var(--gray-400)] m-0">
                  Agrega productos, calcula subtotales y gestiona hasta 5 proveedores.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={agregarProveedorColumna}
                  disabled={numProveedores >= 5}
                  className="flex-1 sm:flex-initial px-3 py-2 bg-[#eef1f6] text-[var(--navy)] text-[12px] sm:text-[12.5px] font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50 text-center"
                >
                  + Columna proveedor ({numProveedores}/5)
                </button>
                {numProveedores > 1 && (
                  <button
                    onClick={removerProveedorColumna}
                    className="px-2.5 py-2 bg-red-50 text-[var(--red)] text-[12px] sm:text-[12.5px] font-semibold rounded-lg hover:bg-red-100"
                  >
                    - Quitar
                  </button>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[12.5px] sm:text-[13px]">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="block lg:hidden text-[11px] text-[var(--gray-400)] text-right mb-1 font-medium">
              ← Desliza la tabla horizontalmente →
            </div>

            <div className="overflow-x-auto border border-[var(--gray-200)] rounded-xl mb-5 sm:mb-6 -mx-1 sm:mx-0">
              <table className="w-full text-left text-[12.5px] sm:text-[13px] border-collapse min-w-[780px]">
                <thead className="bg-[#f8fafc] text-[var(--navy)] font-bold border-b border-[var(--gray-200)]">
                  <tr>
                    <th className="p-2.5 sm:p-3 w-[90px]">Cant.</th>
                    <th className="p-2.5 sm:p-3 min-w-[160px]">Nombre del Artículo</th>
                    <th className="p-2.5 sm:p-3 w-[120px]">Precio Unit. ($)</th>
                    <th className="p-2.5 sm:p-3 w-[130px] text-right bg-emerald-50/60 text-emerald-900">
                      Total Prod. ($)
                    </th>
                    {Array.from({ length: numProveedores }).map((_, i) => (
                      <th key={i} className="p-2.5 sm:p-3 min-w-[140px] bg-blue-50/50">
                        Proveedor {i + 1}
                      </th>
                    ))}
                    <th className="p-2.5 sm:p-3 w-[45px] text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--gray-200)]">
                  {filas.map((fila) => {
                    const cant = Number(fila.cantidad) || 0;
                    const prec = Number(fila.precio) || 0;
                    const totalFila = cant * prec;

                    return (
                      <tr key={fila.id} className="hover:bg-gray-50/50">
                        <td className="p-2 sm:p-2.5">
                          <input
                            type="number"
                            min="1"
                            placeholder="0"
                            value={fila.cantidad}
                            onChange={(e) => actualizarFila(fila.id, "cantidad", e.target.value)}
                            className="w-full px-2 py-1.5 border border-[var(--gray-200)] rounded-md text-[16px] sm:text-[13px] focus:outline-none focus:border-[var(--blue)]"
                          />
                        </td>
                        <td className="p-2 sm:p-2.5">
                          <input
                            type="text"
                            placeholder="Descripción..."
                            value={fila.articulo}
                            onChange={(e) => actualizarFila(fila.id, "articulo", e.target.value)}
                            className="w-full px-2 py-1.5 border border-[var(--gray-200)] rounded-md text-[16px] sm:text-[13px] focus:outline-none focus:border-[var(--blue)]"
                          />
                        </td>
                        <td className="p-2 sm:p-2.5">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={fila.precio}
                            onChange={(e) => actualizarFila(fila.id, "precio", e.target.value)}
                            className="w-full px-2 py-1.5 border border-[var(--gray-200)] rounded-md text-[16px] sm:text-[13px] focus:outline-none focus:border-[var(--blue)]"
                          />
                        </td>
                        <td className="p-2 sm:p-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                          {formatearMoneda(totalFila)}
                        </td>
                        {Array.from({ length: numProveedores }).map((_, pIdx) => (
                          <td key={pIdx} className="p-2 sm:p-2.5 bg-blue-50/20">
                            <input
                              type="text"
                              placeholder={`Prov. ${pIdx + 1}`}
                              value={fila.proveedores[pIdx] || ""}
                              onChange={(e) =>
                                actualizarProveedorFila(fila.id, pIdx, e.target.value)
                              }
                              className="w-full px-2 py-1.5 border border-[var(--gray-200)] rounded-md text-[16px] sm:text-[13px] bg-white focus:outline-none focus:border-[var(--blue)]"
                            />
                          </td>
                        ))}
                        <td className="p-2 sm:p-2.5 text-center">
                          <button
                            onClick={() => eliminarFila(fila.id)}
                            className="text-red-500 hover:text-red-700 font-bold px-1.5 py-1 text-[14px]"
                            title="Eliminar fila"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <button
                onClick={agregarFilaProducto}
                className="w-full sm:w-auto px-4 py-2.5 bg-[var(--navy)] text-white text-[13px] font-semibold rounded-lg hover:opacity-90 text-center"
              >
                + Agregar producto
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="bg-emerald-50/60 sm:bg-transparent p-2.5 sm:p-0 rounded-lg text-center sm:text-right border border-emerald-100 sm:border-0">
                  <span className="text-[10.5px] sm:text-[11px] text-[var(--gray-400)] block uppercase font-bold">
                    Total Estimado
                  </span>
                  <span className="text-[17px] sm:text-[18px] font-extrabold text-emerald-600 font-mono">
                    {formatearMoneda(totalGeneral)}
                  </span>
                </div>
                <button
                  onClick={handleGenerarOC}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[var(--blue)] text-white text-[14px] font-bold rounded-xl shadow-md hover:bg-blue-600 transition-colors text-center"
                >
                  Generar O.C.
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO 2: CONSULTAR ÓRDENES DE COMPRA */}
        {tab === "consultar" && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-[var(--gray-200)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-[15px] sm:text-[16px] font-bold text-[var(--navy)] m-0">
                  Historial de Órdenes de Compra
                </h3>
                <p className="text-[12px] sm:text-[12.5px] text-[var(--gray-400)] m-0">
                  Consulta las solicitudes registradas y reimprime tus documentos.
                </p>
              </div>
              <button
                onClick={cargarOrdenes}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-semibold rounded-lg self-start sm:self-auto flex items-center gap-1.5"
              >
                🔄 Actualizar lista
              </button>
            </div>

            {cargandoConsultas && (
              <div className="py-12 text-center text-gray-500 text-[13px]">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
                <p className="m-0">Cargando órdenes de compra...</p>
              </div>
            )}

            {errorConsulta && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[13px] mb-4">
                ⚠️ {errorConsulta}
              </div>
            )}

            {!cargandoConsultas && !errorConsulta && ordenes.length === 0 && (
              <div className="py-12 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <p className="text-[13px] sm:text-[14px] text-gray-500 font-medium m-0">
                  No se encontraron órdenes de compra registradas.
                </p>
                <button
                  onClick={() => setTab("agregar")}
                  className="mt-3 text-[12.5px] font-semibold text-[var(--blue)] hover:underline"
                >
                  + Crear la primera orden
                </button>
              </div>
            )}

            {!cargandoConsultas && !errorConsulta && ordenes.length > 0 && (
              <div className="overflow-x-auto border border-[var(--gray-200)] rounded-xl">
                <table className="w-full text-left text-[12.5px] sm:text-[13px] border-collapse min-w-[650px]">
                  <thead className="bg-[#f8fafc] text-[var(--navy)] font-bold border-b border-[var(--gray-200)]">
                    <tr>
                      <th className="p-3">Folio</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3 text-center">Proveedores</th>
                      <th className="p-3 text-right">Total General</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gray-200)]">
                    {ordenes.map((orden) => {
                      const total = orden.total_general ?? orden.totalGeneral ?? 0;
                      const numProv = orden.num_proveedores ?? orden.numProveedores ?? 1;

                      return (
                        <tr key={orden.folio || orden.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="p-3 font-bold text-[var(--navy)]">{orden.folio}</td>
                          <td className="p-3 text-gray-600">{formatearFechaBD(orden.fecha || orden.created_at)}</td>
                          <td className="p-3 text-center font-semibold text-gray-700">{numProv}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            {formatearMoneda(total)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-amber-100 text-amber-800">
                              {orden.estado || "Pendiente"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => verOrdenGuardada(orden)}
                              className="px-3 py-1 bg-blue-50 text-[var(--blue)] hover:bg-blue-100 font-semibold text-[12px] rounded-md transition-colors"
                            >
                              👁️ Ver / Imprimir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL / MENÚ DE PREVISUALIZACIÓN */}
      {mostrarPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden my-4 sm:my-8 border border-[var(--gray-200)]">
            <div className="no-print bg-[#1e293b] text-white p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <span className="text-[13px] sm:text-[14px] font-semibold text-center sm:text-left">
                {esModoVisualizacion ? "Consulta de Orden de Compra" : "Previsualización de Orden de Compra"}
              </span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 bg-blue-600 text-white text-[12px] sm:text-[12.5px] font-semibold rounded-lg hover:bg-blue-500 flex items-center gap-1.5"
                >
                  🖨️ Imprimir / Guardar PDF
                </button>

                {!esModoVisualizacion && (
                  <button
                    onClick={handleConfirmarOC}
                    disabled={guardando}
                    className="w-full sm:w-auto justify-center px-4 py-2 sm:py-1.5 bg-emerald-600 text-white text-[12px] sm:text-[12.5px] font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {guardando ? "Guardando..." : "✅ Confirmar orden"}
                  </button>
                )}

                <button
                  onClick={() => setMostrarPreview(false)}
                  className="w-full sm:w-auto justify-center px-3 py-2 sm:py-1.5 bg-gray-700 text-gray-200 text-[12px] sm:text-[12.5px] font-semibold rounded-lg hover:bg-gray-600"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* DOCUMENTO PREVISUALIZADO */}
            <div id="area-impresion" className="p-4 sm:p-8 bg-white text-[12px] sm:text-[13px] text-gray-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 sm:pb-6 border-b border-gray-300 gap-3 sm:gap-0">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <Logo size={38} />
                  <span className="font-bold text-[15px] sm:text-[18px] text-[var(--navy)] tracking-wide uppercase">
                    TRANSPORTES LOGISTICAR
                  </span>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto border-t sm:border-0 pt-2 sm:pt-0 border-gray-100">
                  <p className="text-[12px] sm:text-[13px] text-[var(--blue)] font-medium m-0">
                    {fechaActualFormatted}
                  </p>
                  <p className="text-[13px] sm:text-[14px] font-bold text-gray-900 m-0 mt-0.5 sm:mt-1">
                    Folio: {folioOC}
                  </p>
                </div>
              </div>

              <div className="text-center my-4 sm:my-6">
                <h2 className="text-[16px] sm:text-[18px] font-bold uppercase tracking-wider text-[var(--navy)] m-0">
                  ORDEN DE COMPRA
                </h2>
              </div>

              <div className="overflow-x-auto border border-gray-300 rounded-lg mb-6">
                <table className="w-full text-left text-[11.5px] sm:text-[12px] border-collapse min-w-[550px]">
                  <thead className="bg-gray-100 text-gray-900 font-bold border-b border-gray-300">
                    <tr>
                      <th className="p-2 sm:p-2.5 border-r border-gray-300 text-center w-[55px]">Cant.</th>
                      <th className="p-2 sm:p-2.5 border-r border-gray-300">Artículo</th>
                      <th className="p-2 sm:p-2.5 border-r border-gray-300 text-right w-[95px]">Precio Unit.</th>
                      <th className="p-2 sm:p-2.5 border-r border-gray-300 text-right w-[105px]">Total Prod.</th>
                      {Array.from({ length: numProveedores }).map((_, i) => (
                        <th key={i} className="p-2 sm:p-2.5 border-r border-gray-300">
                          Proveedor {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filas.map((fila) => {
                      const cant = Number(fila.cantidad) || 0;
                      const prec = Number(fila.precio) || 0;
                      const totalFila = cant * prec;

                      return (
                        <tr key={fila.id}>
                          <td className="p-2 sm:p-2.5 border-r border-gray-200 text-center font-semibold">
                            {fila.cantidad}
                          </td>
                          <td className="p-2 sm:p-2.5 border-r border-gray-200">{fila.articulo}</td>
                          <td className="p-2 sm:p-2.5 border-r border-gray-200 text-right font-mono">
                            {formatearMoneda(prec)}
                          </td>
                          <td className="p-2 sm:p-2.5 border-r border-gray-200 text-right font-mono font-bold text-gray-900 bg-gray-50/50">
                            {formatearMoneda(totalFila)}
                          </td>
                          {Array.from({ length: numProveedores }).map((_, pIdx) => (
                            <td key={pIdx} className="p-2 sm:p-2.5 border-r border-gray-200 text-gray-600">
                              {fila.proveedores[pIdx] || "-"}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-8 sm:mb-10">
                <div className="w-full sm:w-[340px] bg-gray-50 border border-gray-300 rounded-xl p-3.5 sm:p-4 font-mono text-[11.5px] sm:text-[12px]">
                  <div className="text-center font-bold border-b border-dashed border-gray-400 pb-2 mb-2 uppercase text-[11.5px] sm:text-[12.5px] text-gray-900 tracking-wide">
                    *** RESUMEN DE ORDEN DE COMPRA ***
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {filas.map((f, i) => {
                      const cant = Number(f.cantidad) || 0;
                      const prec = Number(f.precio) || 0;
                      const subtotal = cant * prec;
                      return (
                        <div key={i} className="flex justify-between items-center text-gray-700 gap-2">
                          <span className="truncate max-w-[180px] sm:max-w-[200px]">
                            {f.articulo || `Producto ${i + 1}`} ({cant}x)
                          </span>
                          <span className="font-semibold">{formatearMoneda(subtotal)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t-2 border-gray-800 pt-2 flex justify-between items-center text-[13px] sm:text-[14px] font-bold text-gray-900">
                    <span>TOTAL A PAGAR:</span>
                    <span className="text-[15px] sm:text-[16px] text-emerald-700">
                      {formatearMoneda(totalGeneral)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-10 sm:mt-12 pt-6 sm:pt-8 flex justify-center">
                <div className="w-[220px] sm:w-[260px] text-center">
                  <div className="border-t border-gray-800 mb-2" />
                  <p className="font-bold text-[12px] sm:text-[13px] text-gray-800 uppercase tracking-wider m-0">
                    QUIEN APRUEBA
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="no-print mt-auto w-full">
        <PageFooter />
      </footer>
    </div>
  );
}