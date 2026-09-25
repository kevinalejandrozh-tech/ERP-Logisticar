"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import type { EquipoPublico, EstadoInventario } from "@/lib/inventarioData";

// Página PÚBLICA: es la que se abre al escanear el QR de un equipo.
// Solo muestra la ficha del equipo. Cualquier otra sección del sistema pide iniciar sesión.

const COLOR_ESTADO: Record<EstadoInventario, { bg: string; fg: string }> = {
  Activo: { bg: "#e6f6ee", fg: "var(--green)" },
  "En reparación": { bg: "#fdf4e1", fg: "#b7800f" },
  "En almacén": { bg: "var(--blue-light)", fg: "var(--blue)" },
  Baja: { bg: "#fdeaea", fg: "var(--red)" },
};

type Fase = "cargando" | "listo" | "error";

export default function ConsultaInventarioPage() {
  const [fase, setFase] = useState<Fase>("cargando");
  const [equipo, setEquipo] = useState<EquipoPublico | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const consultar = async () => {
      const folio = new URLSearchParams(window.location.search).get("folio");
      if (!folio) throw new Error("El código QR no contiene un folio de equipo.");
      const res = await fetch(`/api/inventario/consulta?folio=${encodeURIComponent(folio)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo consultar el equipo.");
      return data.equipo as EquipoPublico;
    };

    consultar()
      .then((e) => {
        setEquipo(e);
        setFase("listo");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo consultar el equipo.");
        setFase("error");
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#eef1f6] flex flex-col">
      <header className="bg-white border-b border-[var(--gray-200)] shadow-sm">
        <div className="max-w-[640px] mx-auto px-4 py-3.5 flex items-center gap-3">
          <Logo size={36} enlace={false} />
          <div>
            <h1 className="font-display text-[16px] font-bold text-[var(--navy)] m-0">Control de inventario</h1>
            <p className="text-[11.5px] text-[var(--gray-400)] m-0">Transportes Logisticar · Ficha del equipo</p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[640px] mx-auto px-4 py-6">
        {fase === "cargando" && (
          <div className="bg-white rounded-[18px] p-8 text-center shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <p className="text-[13.5px] text-[var(--gray-400)] m-0">Consultando equipo…</p>
          </div>
        )}

        {fase === "error" && (
          <div className="bg-white rounded-[18px] p-8 text-center shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="w-12 h-12 rounded-full bg-[#fdeaea] flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e2412c" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-1">No se pudo mostrar el equipo</h2>
            <p className="text-[13px] text-[var(--gray-400)] m-0">{error}</p>
          </div>
        )}

        {fase === "listo" && equipo && (
          <div className="bg-white rounded-[18px] p-5 sm:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <p className="text-[12px] font-bold text-[var(--blue)] m-0">
              {equipo.folio} · {equipo.categoria}
            </p>
            <h2 className="text-[20px] font-bold text-[var(--navy)] m-0 mt-1 mb-2 break-words">{equipo.nombre}</h2>
            <span
              className="inline-block text-[11.5px] font-bold rounded-full px-3 py-1 mb-5"
              style={{ backgroundColor: COLOR_ESTADO[equipo.estado]?.bg, color: COLOR_ESTADO[equipo.estado]?.fg }}
            >
              {equipo.estado}
            </span>

            {equipo.campos.length === 0 ? (
              <p className="text-[13px] text-[var(--gray-400)] m-0">Este equipo no tiene información adicional registrada.</p>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5 m-0 border-t border-[var(--gray-200)] pt-4">
                {equipo.campos.map((c) => (
                  <div key={c.etiqueta}>
                    <dt className="text-[10.5px] uppercase tracking-wide text-[var(--gray-400)]">{c.etiqueta}</dt>
                    <dd className="text-[14px] font-semibold text-[var(--navy)] m-0 break-words">{c.valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        <p className="text-[11px] text-[var(--gray-400)] text-center mt-5 mb-0">Consulta de solo lectura. Para cualquier otra acción es necesario iniciar sesión.</p>
      </main>

      <footer className="w-full bg-[var(--navy)]">
        <div className="max-w-[640px] mx-auto px-4 py-3.5 text-center text-[11px]" style={{ color: "#a9c2ee" }}>
          © 2026 Transportes Logisticar
        </div>
      </footer>
    </div>
  );
}