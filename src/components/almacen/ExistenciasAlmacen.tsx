"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { compressImage } from "@/lib/imageUtils";

export type ArticuloAlmacen = {
  id: number;
  nombre: string;
  tipo: string;
  categoria: string | null;
  costo: number;
  tiene_imagen: boolean;
  total: number;
  ubicaciones: { ubicacion_id: number; codigo: string; cantidad: number }[];
};

const moneda = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v || 0);

// Existencias del almacén (vista "Inventario" de Control de inventario).
export default function ExistenciasAlmacen() {
  const [articulos, setArticulos] = useState<ArticuloAlmacen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/inventario/almacen/articulos", { cache: "no-store" }).then((x) => x.json());
      setArticulos(r.articulos || []);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return articulos.filter((a) => (!tipo || a.tipo === tipo) && (!t || `${a.nombre} ${a.categoria || ""} ${a.ubicaciones.map((u) => u.codigo).join(" ")}`.toLowerCase().includes(t)));
  }, [articulos, q, tipo]);
  const valor = filtrados.reduce((a, x) => a + x.total * x.costo, 0);

  const subirFoto = async (id: number, file?: File) => {
    if (!file) return;
    try {
      const imagen = await compressImage(file, 700, 0.65, 600000);
      const res = await fetch("/api/inventario/almacen/articulos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, imagen }) });
      if (!res.ok) throw new Error((await res.json()).error || "No se pudo guardar la foto.");
      cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar la foto.");
    }
  };

  return (
    <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 flex-1">Existencias en almacén ({filtrados.length}) · Valor {moneda(valor)}</h3>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] bg-white">
          <option value="">Inventario y Bienes</option>
          <option value="Inventario">Inventario</option>
          <option value="Bienes">Bienes</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artículo, categoría o ubicación" className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] w-[260px]" />
      </div>
      {cargando ? (
        <p className="text-[13px] text-[var(--gray-400)] py-8 text-center">Cargando existencias…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-[13px] text-[var(--gray-400)] py-8 text-center">Sin existencias. Registra una Entrada para comenzar.</p>
      ) : (
        <div className="overflow-x-auto border border-[var(--gray-200)] rounded-lg">
          <table className="w-full text-[12.5px] border-collapse min-w-[760px]">
            <thead className="bg-[#f8fafc] text-[var(--navy)] text-left">
              <tr>
                <th className="p-2.5">Artículo</th>
                <th className="p-2.5">Tipo</th>
                <th className="p-2.5">Categoría</th>
                <th className="p-2.5">Ubicaciones</th>
                <th className="p-2.5 text-right">Existencia</th>
                <th className="p-2.5 text-right">Costo</th>
                <th className="p-2.5 text-right">Valor</th>
                <th className="p-2.5 text-center">Foto</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => (
                <tr key={a.id} className="border-t border-[var(--gray-200)]">
                  <td className="p-2.5 font-medium text-[var(--navy)]">{a.nombre}</td>
                  <td className="p-2.5">{a.tipo}</td>
                  <td className="p-2.5">{a.categoria || "—"}</td>
                  <td className="p-2.5 text-[var(--gray-500)]">{a.ubicaciones.map((u) => `${u.codigo} (${u.cantidad})`).join(", ") || "—"}</td>
                  <td className={`p-2.5 text-right font-bold ${a.total > 0 ? "" : "text-[var(--red)]"}`}>{a.total}</td>
                  <td className="p-2.5 text-right">{moneda(a.costo)}</td>
                  <td className="p-2.5 text-right">{moneda(a.total * a.costo)}</td>
                  <td className="p-2.5 text-center">
                    <label className="text-[11.5px] font-bold text-[var(--blue)] cursor-pointer">
                      {a.tiene_imagen ? "Cambiar" : "Agregar"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => subirFoto(a.id, e.target.files?.[0])} />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
