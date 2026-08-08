"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { exportarExcel } from "@/lib/exportExcel";

type Operador = { id: number; nombre: string; fechaIngreso: string };

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

export default function OperadoresPage() {
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
      <div className="max-w-[1440px] mx-auto px-14 pt-10">
        <PageHeader
          titulo="Agregar / Administrar personas"
          subtitulo="Da de alta o edita la información del personal."
          backHref="/personas"
          backLabel="Personas"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /><path d="M19 8v6M22 11h-6" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex items-center gap-3 mb-5">
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
            <table className="w-full border-collapse">
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
                      <div className="flex items-center gap-4">
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
          )}
        </div>

        <PageFooter />
      </div>

      {formAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
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
