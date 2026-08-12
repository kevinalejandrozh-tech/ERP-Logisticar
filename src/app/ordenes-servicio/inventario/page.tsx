"use client";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

export default function InventarioPage() {
  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Inventario"
          subtitulo="Página en construcción."
          backHref="/ordenes-servicio"
          backLabel="Órdenes de servicio y mantenimiento"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>}
        />
        <div className="bg-white rounded-[18px] p-10 shadow-[0_1px_3px_rgba(22,33,92,0.06)] text-center">
          <p className="text-[14px] text-[var(--gray-400)] m-0">Esta página está en construcción. Próximamente aquí se gestionará el inventario de refacciones e insumos.</p>
        </div>
        <PageFooter />
      </div>
    </div>
  );
}
