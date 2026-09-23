"use client";
import PageHeader from "@/components/PageHeader";
import MenuCard from "@/components/MenuCard";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

export default function ControlViajesPage() {
  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Control de Viajes"
          subtitulo="Administra los gastos, viáticos y documentos relacionados con los viajes."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="1" y="7" width="14" height="11" /><path d="M15 10h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-5">
            <MenuCard
              href="/control-viajes/gastos-totales"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M3 3v18h18M8 17V9M13 17V5M18 17v-7" /></svg>}
              titulo="Gastos Totales de Viajes"
              descripcion="Tabla libre: agrega columnas y filas, y edita directamente."
            />
            <MenuCard
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="2" y="6" width="20" height="13" rx="2" /><circle cx="12" cy="12.5" r="3" /><path d="M6 6v13M18 6v13" /></svg>}
              titulo="Viáticos en efectivo"
              descripcion="Registro de viáticos entregados en efectivo."
            />
            <MenuCard
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>}
              titulo="Viáticos en Transferencia"
              descripcion="Registro de viáticos entregados por transferencia bancaria."
            />
            <MenuCard
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 15h2M14 15h2" /></svg>}
              titulo="PASE casetas"
              descripcion="Control del saldo y movimientos de las tarjetas PASE."
            />
            <MenuCard
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></svg>}
              titulo="Vales de Combustible"
              descripcion="Registro y control de vales de combustible entregados."
            />
            <MenuCard
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M4 19V5a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" /><path d="M14 3v6h6" /><path d="M8 13h8M8 17h5" /></svg>}
              titulo="Reportes"
              descripcion="Reportes relacionados con el control de viajes."
            />
            <MenuCard
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></svg>}
              titulo="Liquidación de Combustible - Viajes"
              descripcion="Liquidación del combustible consumido por viaje."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
