"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

export default function DetalleViajePage() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setId(params.get("id"));
  }, []);

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Detalles de viaje"
          subtitulo={id ? `Viaje #${id}` : "Página en construcción."}
          backHref="/monitoreo-viajes"
          backLabel="Monitoreo de viajes y rutas"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>}
        />
        <div className="bg-white rounded-[18px] p-10 shadow-[0_1px_3px_rgba(22,33,92,0.06)] text-center">
          <p className="text-[14px] text-[var(--gray-400)] m-0">Esta página está en construcción. Próximamente aquí se mostrará el detalle completo del viaje.</p>
        </div>
        <PageFooter />
      </div>
    </div>
  );
}
