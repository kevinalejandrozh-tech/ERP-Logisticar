"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

export default function AuditoriaMochilaCovidPage() {
  const [folio, setFolio] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFolio(params.get("folio"));
  }, []);

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-14 pt-10">
        <PageHeader
          titulo="Auditoría mochila Covid"
          subtitulo={folio ? `Mochila: ${folio}` : "Página en construcción."}
          backHref="/personas/mochilas-covid"
          backLabel="Mochilas Covid"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" /><path d="M9 12l2 2 4-4" /></svg>}
        />
        <div className="bg-white rounded-[18px] p-10 shadow-[0_1px_3px_rgba(22,33,92,0.06)] text-center">
          <p className="text-[14px] text-[var(--gray-400)] m-0">Esta página está en construcción. Próximamente aquí se registrará la auditoría de la mochila.</p>
        </div>
        <PageFooter />
      </div>
    </div>
  );
}
