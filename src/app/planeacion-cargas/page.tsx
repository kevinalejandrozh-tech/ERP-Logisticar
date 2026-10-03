"use client";
import PageHeader from "@/components/PageHeader";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

// La tabla de programación de cargas se retiró de esta página a petición del usuario.
// Los datos y las APIs (/api/planeacion-cargas) se conservan en la base de datos por si se requieren después.
export default function PlaneacionCargasPage() {
  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Monitoreo de Rutas"
          subtitulo="Monitoreo y seguimiento de rutas."
          backHref="/"
          backLabel="Menú principal"
          icono={
            <svg width="24" height="24" viewBox="0 0 24 24" {...sw}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18M8 4v18M8 15h13" />
            </svg>
          }
        />
        <div className="bg-white rounded-[20px] shadow-[0_4px_18px_rgba(22,33,92,0.09)] overflow-hidden">
          <div className="h-[5px] bg-gradient-to-r from-[#16215c] via-[#2f6fed] to-[#21a866]" />
          <p className="text-center text-[var(--gray-400)] text-[13px] py-14 m-0">Sin contenido por el momento.</p>
        </div>
      </div>
    </div>
  );
}
