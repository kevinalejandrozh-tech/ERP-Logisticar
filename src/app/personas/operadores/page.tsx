"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { exportarExcel } from "@/lib/exportExcel";

type Operador = { id: number; nombre: string; fechaIngreso: string };
type DatosGenerales = {
  id: number;
  noEmpleado: string;
  nombreEmpleado: string;
  rfc: string;
  curp: string;
  nss: string;
  puesto: string;
  departamento: string;
  salarioDiario: string;
  fechaIngreso: string;
  estatus: string;
};
type Pago = {
  id: number;
  diasPagados: string;
  totalPercepciones: string;
  totalDeducciones: string;
  totalEntregado: string;
  metodoPago: string;
  banco: string;
  ultimos4Cuenta: string;
  observaciones: string;
  estatus: string;
  fechaElaboracion: string;
};
type PrevisualizarPago = { id: number; folio: string; noEmpleado: string; tipo: string; concepto: string; importe: string };

const OPCIONES_METODO_PAGO = ["Transferencia", "Efectivo", "Cheque", "Depósito"];
const OPCIONES_TIPO = ["Percepción", "Deducción"];

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

export default function OperadoresPage() {
  const [vista, setVista] = useState<"operadores" | "datosGenerales" | "pagos" | "previsualizarPago">("datosGenerales");
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [fNombre, setFNombre] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const res = await fetch("/api/operadores/list");
      const data = await res.json();
      setOperadores(data.registros || []);
    } catch {
      // se reintenta al recargar la página
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // ---- Datos generales ----
  const [datosGenerales, setDatosGenerales] = useState<DatosGenerales[]>([]);
  const [cargandoDG, setCargandoDG] = useState(true);
  const [bloqueadoDG, setBloqueadoDG] = useState(true);
  const cargarDatosGenerales = async () => {
    try {
      const res = await fetch("/api/empleados/datos-generales/list", { cache: "no-store" });
      const data = await res.json();
      setDatosGenerales(data.registros || []);
    } catch {
      // se reintenta con la siguiente acción
    } finally {
      setCargandoDG(false);
    }
  };
  const agregarDatosGenerales = async () => {
    try {
      const res = await fetch("/api/empleados/datos-generales", { method: "POST" });
      const data = await res.json();
      setDatosGenerales((prev) => [
        ...prev,
        { id: data.id, noEmpleado: "", nombreEmpleado: "", rfc: "", curp: "", nss: "", puesto: "", departamento: "", salarioDiario: "", fechaIngreso: "", estatus: "Activo" },
      ]);
    } catch {
      alert("No se pudo agregar la fila.");
    }
  };
  const actualizarDGLocal = (id: number, campo: keyof DatosGenerales, valor: string) => {
    setDatosGenerales((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  };
  const guardarDGCampo = (id: number, campo: string, valor: string) => {
    fetch("/api/empleados/datos-generales/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [campo]: valor }),
    }).catch(() => cargarDatosGenerales());
  };
  const eliminarDG = async (id: number) => {
    if (!confirm("¿Eliminar esta fila?")) return;
    setDatosGenerales((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch("/api/empleados/datos-generales/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargarDatosGenerales();
    }
  };
  const exportarDG = () => {
    exportarExcel(`Datos_generales_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: "Datos generales",
        filas: datosGenerales.map((f) => ({
          No_Empleado: f.noEmpleado,
          Nombre_Empleado: f.nombreEmpleado,
          RFC: f.rfc,
          CURP: f.curp,
          NSS: f.nss,
          Puesto: f.puesto,
          Departamento: f.departamento,
          Salario_Diario: f.salarioDiario,
          Fecha_Ingreso: f.fechaIngreso,
          Estatus: f.estatus,
        })),
      },
    ]);
  };

  // ---- Pagos ----
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargandoPagos, setCargandoPagos] = useState(true);
  const [bloqueadoPagos, setBloqueadoPagos] = useState(true);
  const cargarPagos = async () => {
    try {
      const res = await fetch("/api/empleados/pagos/list", { cache: "no-store" });
      const data = await res.json();
      setPagos(data.registros || []);
    } catch {
      // se reintenta con la siguiente acción
    } finally {
      setCargandoPagos(false);
    }
  };
  const agregarPago = async () => {
    try {
      const res = await fetch("/api/empleados/pagos", { method: "POST" });
      const data = await res.json();
      setPagos((prev) => [
        ...prev,
        { id: data.id, diasPagados: "", totalPercepciones: "", totalDeducciones: "", totalEntregado: "", metodoPago: "Transferencia", banco: "", ultimos4Cuenta: "", observaciones: "", estatus: "Pendiente", fechaElaboracion: "" },
      ]);
    } catch {
      alert("No se pudo agregar la fila.");
    }
  };
  const actualizarPagoLocal = (id: number, campo: keyof Pago, valor: string) => {
    setPagos((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  };
  const guardarPagoCampo = (id: number, campo: string, valor: string) => {
    fetch("/api/empleados/pagos/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [campo]: valor }),
    }).catch(() => cargarPagos());
  };
  const eliminarPago = async (id: number) => {
    if (!confirm("¿Eliminar esta fila?")) return;
    setPagos((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch("/api/empleados/pagos/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargarPagos();
    }
  };
  const exportarPagos = () => {
    exportarExcel(`Pagos_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: "Pagos",
        filas: pagos.map((f) => ({
          Dias_Pagados: f.diasPagados,
          Total_Percepciones: f.totalPercepciones,
          Total_Deducciones: f.totalDeducciones,
          Total_Entregado: f.totalEntregado,
          Metodo_Pago: f.metodoPago,
          Banco: f.banco,
          Ultimos_4_Cuenta: f.ultimos4Cuenta,
          Observaciones: f.observaciones,
          Estatus: f.estatus,
          Fecha_Elaboracion: f.fechaElaboracion,
        })),
      },
    ]);
  };

  // ---- Previsualizar pago ----
  const [previsualizar, setPrevisualizar] = useState<PrevisualizarPago[]>([]);
  const [cargandoPrevisualizar, setCargandoPrevisualizar] = useState(true);
  const [bloqueadoPrevisualizar, setBloqueadoPrevisualizar] = useState(true);
  const cargarPrevisualizar = async () => {
    try {
      const res = await fetch("/api/empleados/previsualizacion-pago/list", { cache: "no-store" });
      const data = await res.json();
      setPrevisualizar(data.registros || []);
    } catch {
      // se reintenta con la siguiente acción
    } finally {
      setCargandoPrevisualizar(false);
    }
  };
  const agregarPrevisualizar = async () => {
    try {
      const res = await fetch("/api/empleados/previsualizacion-pago", { method: "POST" });
      const data = await res.json();
      setPrevisualizar((prev) => [...prev, { id: data.id, folio: "", noEmpleado: "", tipo: "Percepción", concepto: "", importe: "" }]);
    } catch {
      alert("No se pudo agregar la fila.");
    }
  };
  const actualizarPrevisualizarLocal = (id: number, campo: keyof PrevisualizarPago, valor: string) => {
    setPrevisualizar((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  };
  const guardarPrevisualizarCampo = (id: number, campo: string, valor: string) => {
    fetch("/api/empleados/previsualizacion-pago/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [campo]: valor }),
    }).catch(() => cargarPrevisualizar());
  };
  const eliminarPrevisualizar = async (id: number) => {
    if (!confirm("¿Eliminar esta fila?")) return;
    setPrevisualizar((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch("/api/empleados/previsualizacion-pago/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargarPrevisualizar();
    }
  };
  const totalPrevisualizar = previsualizar.reduce((s, f) => s + (parseFloat(f.importe) || 0), 0);
  const exportarPrevisualizar = () => {
    exportarExcel(`Previsualizar_pago_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: "Previsualizar pago",
        filas: previsualizar.map((f) => ({ Folio: f.folio, No_Empleado: f.noEmpleado, Tipo: f.tipo, Concepto: f.concepto, Importe: f.importe })),
      },
    ]);
  };

  useEffect(() => {
    cargarDatosGenerales();
    cargarPagos();
    cargarPrevisualizar();
  }, []);

  const abrirAgregar = () => {
    setEditandoId(null);
    setFNombre("");
    setFFecha("");
    setFormAbierto(true);
  };

  const abrirEditar = (o: Operador) => {
    setEditandoId(o.id);
    setFNombre(o.nombre);
    setFFecha(o.fechaIngreso || "");
    setFormAbierto(true);
  };

  const guardar = async () => {
    if (!fNombre.trim()) {
      alert("Captura el nombre del operador.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/operadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editandoId, nombre: fNombre.trim(), fechaIngreso: fFecha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar.");
      setFormAbierto(false);
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al guardar el operador.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (o: Operador) => {
    if (!confirm(`¿Eliminar a ${o.nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch("/api/operadores/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: o.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar.");
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al eliminar el operador.");
    }
  };

  const exportar = () => {
    exportarExcel(`Operadores_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: "Operadores",
        filas: operadores.map((o) => ({ Nombre: o.nombre, "Fecha de ingreso": o.fechaIngreso || "" })),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Agregar / Administrar personas"
          subtitulo="Da de alta o edita la información del personal."
          backHref="/personas"
          backLabel="Personas"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /><path d="M19 8v6M22 11h-6" /></svg>}
        />

        <div className="flex flex-wrap gap-2.5 mb-5">
          {([
            ["datosGenerales", "Datos generales"],
            ["pagos", "Pagos"],
            ["previsualizarPago", "Previsualizar pago"],
            ["operadores", "Operadores"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setVista(key)}
              className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${vista === key ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {vista === "operadores" && (
        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center gap-2.5 md:gap-3 mb-5">
            <button type="button" onClick={abrirAgregar} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Agregar
            </button>
            {!cargando && operadores.length > 0 && (
              <button type="button" onClick={exportar} className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                Exportar Excel
              </button>
            )}
          </div>

          {cargando ? (
            <div className="text-center text-[var(--gray-400)] text-[13.5px] py-10">Cargando operadores...</div>
          ) : operadores.length === 0 ? (
            <div className="text-center text-[var(--gray-400)] text-[13.5px] py-10">Aún no hay operadores registrados.</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[480px]">
              <thead>
                <tr>
                  <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 rounded-l-lg">Nombre del operador</th>
                  <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3">Fecha de ingreso</th>
                  <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 rounded-r-lg w-[180px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {operadores.map((o) => (
                  <tr key={o.id} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
                    <td className="px-3.5 py-3 text-[13.5px]">{o.nombre}</td>
                    <td className="px-3.5 py-3 text-[13.5px]">{o.fechaIngreso || "—"}</td>
                    <td className="px-3.5 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span onClick={() => abrirEditar(o)} className="inline-flex items-center gap-1.5 text-[var(--gray-400)] text-[12.5px] font-semibold cursor-pointer">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                          Editar
                        </span>
                        <span onClick={() => eliminar(o)} className="inline-flex items-center gap-1.5 text-[var(--red)] text-[12.5px] font-semibold cursor-pointer">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                          Eliminar
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
        )}

        {vista === "datosGenerales" && (
          <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={agregarDatosGenerales} disabled={bloqueadoDG} className="flex items-center gap-1.5 bg-[var(--navy)] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                  + Agregar fila
                </button>
                <span onClick={() => setBloqueadoDG((p) => !p)} className="text-[var(--gray-400)] hover:text-[var(--navy)] cursor-pointer" title={bloqueadoDG ? "Tabla bloqueada — clic para editar" : "Tabla editable — clic para bloquear"}>
                  {bloqueadoDG ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 017.5-2" /></svg>
                  )}
                </span>
              </div>
              {!cargandoDG && datosGenerales.length > 0 && (
                <button type="button" onClick={exportarDG} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                  Exportar Excel
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["No. Empleado", "Nombre del empleado", "RFC", "CURP", "NSS", "Puesto", "Departamento", "Salario diario", "Fecha de ingreso", "Estatus", "Acciones"].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datosGenerales.map((f) => (
                    <tr key={f.id} className="border-b border-[var(--gray-200)]">
                      {([
                        ["noEmpleado", "text", "w-[90px]"],
                        ["nombreEmpleado", "text", "w-[160px]"],
                        ["rfc", "text", "w-[110px]"],
                        ["curp", "text", "w-[140px]"],
                        ["nss", "text", "w-[110px]"],
                        ["puesto", "text", "w-[120px]"],
                        ["departamento", "text", "w-[120px]"],
                        ["salarioDiario", "number", "w-[95px]"],
                      ] as const).map(([campo, tipo, ancho]) => (
                        <td key={campo} className="px-2 py-1.5 whitespace-nowrap">
                          <input
                            disabled={bloqueadoDG}
                            type={tipo}
                            defaultValue={f[campo]}
                            onBlur={(e) => {
                              actualizarDGLocal(f.id, campo, e.target.value);
                              guardarDGCampo(f.id, campo, e.target.value);
                            }}
                            className={`border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] ${ancho}`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <input
                          disabled={bloqueadoDG}
                          type="date"
                          defaultValue={f.fechaIngreso}
                          onBlur={(e) => {
                            actualizarDGLocal(f.id, "fechaIngreso", e.target.value);
                            guardarDGCampo(f.id, "fechaIngreso", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[11.5px]"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <input
                          disabled={bloqueadoDG}
                          defaultValue={f.estatus}
                          onBlur={(e) => {
                            actualizarDGLocal(f.id, "estatus", e.target.value);
                            guardarDGCampo(f.id, "estatus", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[85px]"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {!bloqueadoDG && (
                          <span onClick={() => eliminarDG(f.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar fila">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!cargandoDG && datosGenerales.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin registros. Desbloquea la tabla y usa &quot;+ Agregar fila&quot;.</div>}
            </div>
          </div>
        )}

        {vista === "pagos" && (
          <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={agregarPago} disabled={bloqueadoPagos} className="flex items-center gap-1.5 bg-[var(--navy)] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                  + Agregar fila
                </button>
                <span onClick={() => setBloqueadoPagos((p) => !p)} className="text-[var(--gray-400)] hover:text-[var(--navy)] cursor-pointer" title={bloqueadoPagos ? "Tabla bloqueada — clic para editar" : "Tabla editable — clic para bloquear"}>
                  {bloqueadoPagos ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 017.5-2" /></svg>
                  )}
                </span>
              </div>
              {!cargandoPagos && pagos.length > 0 && (
                <button type="button" onClick={exportarPagos} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                  Exportar Excel
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Días pagados", "Total percepciones", "Total deducciones", "Total entregado", "Método de pago", "Banco", "Últimos 4 (cuenta)", "Observaciones", "Estatus", "Fecha de elaboración", "Acciones"].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((f) => (
                    <tr key={f.id} className="border-b border-[var(--gray-200)]">
                      {([
                        ["diasPagados", "number", "w-[85px]"],
                        ["totalPercepciones", "number", "w-[100px]"],
                        ["totalDeducciones", "number", "w-[100px]"],
                        ["totalEntregado", "number", "w-[100px]"],
                      ] as const).map(([campo, tipo, ancho]) => (
                        <td key={campo} className="px-2 py-1.5 whitespace-nowrap">
                          <input
                            disabled={bloqueadoPagos}
                            type={tipo}
                            defaultValue={f[campo]}
                            onBlur={(e) => {
                              actualizarPagoLocal(f.id, campo, e.target.value);
                              guardarPagoCampo(f.id, campo, e.target.value);
                            }}
                            className={`border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] ${ancho}`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <select
                          disabled={bloqueadoPagos}
                          value={f.metodoPago}
                          onChange={(e) => {
                            actualizarPagoLocal(f.id, "metodoPago", e.target.value);
                            guardarPagoCampo(f.id, "metodoPago", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px]"
                        >
                          {OPCIONES_METODO_PAGO.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>
                      {([
                        ["banco", "text", "w-[110px]"],
                        ["ultimos4Cuenta", "text", "w-[80px]"],
                        ["observaciones", "text", "w-[160px]"],
                        ["estatus", "text", "w-[90px]"],
                      ] as const).map(([campo, tipo, ancho]) => (
                        <td key={campo} className="px-2 py-1.5 whitespace-nowrap">
                          <input
                            disabled={bloqueadoPagos}
                            type={tipo}
                            defaultValue={f[campo]}
                            onBlur={(e) => {
                              actualizarPagoLocal(f.id, campo, e.target.value);
                              guardarPagoCampo(f.id, campo, e.target.value);
                            }}
                            className={`border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] ${ancho}`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <input
                          disabled={bloqueadoPagos}
                          type="date"
                          defaultValue={f.fechaElaboracion}
                          onBlur={(e) => {
                            actualizarPagoLocal(f.id, "fechaElaboracion", e.target.value);
                            guardarPagoCampo(f.id, "fechaElaboracion", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[11.5px]"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {!bloqueadoPagos && (
                          <span onClick={() => eliminarPago(f.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar fila">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!cargandoPagos && pagos.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin registros. Desbloquea la tabla y usa &quot;+ Agregar fila&quot;.</div>}
            </div>
          </div>
        )}

        {vista === "previsualizarPago" && (
          <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={agregarPrevisualizar} disabled={bloqueadoPrevisualizar} className="flex items-center gap-1.5 bg-[var(--navy)] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                  + Agregar fila
                </button>
                <span onClick={() => setBloqueadoPrevisualizar((p) => !p)} className="text-[var(--gray-400)] hover:text-[var(--navy)] cursor-pointer" title={bloqueadoPrevisualizar ? "Tabla bloqueada — clic para editar" : "Tabla editable — clic para bloquear"}>
                  {bloqueadoPrevisualizar ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 017.5-2" /></svg>
                  )}
                </span>
                {previsualizar.length > 0 && (
                  <span className="text-[12px] font-bold text-[var(--navy)]">Total: ${totalPrevisualizar.toFixed(2)}</span>
                )}
              </div>
              {!cargandoPrevisualizar && previsualizar.length > 0 && (
                <button type="button" onClick={exportarPrevisualizar} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                  Exportar Excel
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Folio", "No. Empleado", "Tipo", "Concepto", "Importe", "Acciones"].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previsualizar.map((f) => (
                    <tr key={f.id} className="border-b border-[var(--gray-200)]">
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <input
                          disabled={bloqueadoPrevisualizar}
                          defaultValue={f.folio}
                          onBlur={(e) => {
                            actualizarPrevisualizarLocal(f.id, "folio", e.target.value);
                            guardarPrevisualizarCampo(f.id, "folio", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[100px]"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <input
                          disabled={bloqueadoPrevisualizar}
                          defaultValue={f.noEmpleado}
                          onBlur={(e) => {
                            actualizarPrevisualizarLocal(f.id, "noEmpleado", e.target.value);
                            guardarPrevisualizarCampo(f.id, "noEmpleado", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[90px]"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <select
                          disabled={bloqueadoPrevisualizar}
                          value={f.tipo}
                          onChange={(e) => {
                            actualizarPrevisualizarLocal(f.id, "tipo", e.target.value);
                            guardarPrevisualizarCampo(f.id, "tipo", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px]"
                        >
                          {OPCIONES_TIPO.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <input
                          disabled={bloqueadoPrevisualizar}
                          defaultValue={f.concepto}
                          onBlur={(e) => {
                            actualizarPrevisualizarLocal(f.id, "concepto", e.target.value);
                            guardarPrevisualizarCampo(f.id, "concepto", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[180px]"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <input
                          disabled={bloqueadoPrevisualizar}
                          type="number"
                          defaultValue={f.importe}
                          onBlur={(e) => {
                            actualizarPrevisualizarLocal(f.id, "importe", e.target.value);
                            guardarPrevisualizarCampo(f.id, "importe", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[90px]"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {!bloqueadoPrevisualizar && (
                          <span onClick={() => eliminarPrevisualizar(f.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar fila">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!cargandoPrevisualizar && previsualizar.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin registros. Desbloquea la tabla y usa &quot;+ Agregar fila&quot;.</div>}
            </div>
          </div>
        )}

        <PageFooter />
      </div>

      {formAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">{editandoId !== null ? "Editar operador" : "Agregar operador"}</h3>
            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Nombre del operador</label>
              <input value={fNombre} onChange={(e) => setFNombre(e.target.value)} placeholder="Nombre completo" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="mb-6">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Fecha de ingreso</label>
              <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setFormAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardar} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
