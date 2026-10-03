"use client";
import MenuCard from "@/components/MenuCard";
import PageHeader from "@/components/PageHeader";
import { useSesion } from "@/lib/useSesion";
import { puedeVerSeccion } from "@/lib/permisos";
import { CATALOGOS, ORDEN_CATALOGOS } from "@/lib/catalogosRutaData";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

// Índice de catálogos de ruta. "Zonas sin cobertura" solo se muestra a Monitoreo de Rutas.
export default function CatalogosRutaPage() {
  const sesion = useSesion();
  const verMonitoreo = puedeVerSeccion("monitoreo_rutas", sesion.rol || "", sesion.secciones);
  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10 pb-10">
        <PageHeader
          titulo="Catálogos de ruta"
          subtitulo="Resguardos, casetas, alimentos, gasolineras, mecánicos, contactos y documentos para las rutas."
          backHref="/control-viajes"
          backLabel="Control de Viajes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M4 6h16M4 12h16M4 18h10" /></svg>}
        />
        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-5">
            <MenuCard
              href="/rutas"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H17a3.5 3.5 0 000-7H7a3.5 3.5 0 010-7h8.5" /></svg>}
              titulo="Rutas"
              descripcion="Rutas con casetas, tiempos, bonos y lugares permitidos."
            />
            {ORDEN_CATALOGOS.filter((k) => !CATALOGOS[k].soloMonitoreo || verMonitoreo).map((k) => (
              <MenuCard
                key={k}
                href={`/catalogos-ruta/${k}`}
                icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>}
                titulo={CATALOGOS[k].titulo}
                descripcion={CATALOGOS[k].descripcion}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
