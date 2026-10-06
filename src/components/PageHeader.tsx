import Logo from "@/components/Logo";
import Link from "next/link";
import TituloFavorito from "@/components/TituloFavorito";
export default function PageHeader({
  titulo,
  subtitulo,
  backHref,
  backLabel,
  icono,
  extra,
}: {
  titulo: string;
  subtitulo: string;
  backHref: string;
  backLabel: string;
  icono?: React.ReactNode;
  extra?: React.ReactNode; // enlaces adicionales junto al de regreso (opcional)
}) {
  return (
    <header className="tarjeta-encabezado sticky top-2 sm:top-3 z-30 mt-3 sm:mt-4 mb-5 md:mb-7">
      <div className="px-4 sm:px-6 md:px-7 py-3.5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div>
            <TituloFavorito titulo={titulo} className="font-display text-[16px] sm:text-[19px] font-bold text-[var(--navy)] m-0" />
            <p className="text-[11.5px] sm:text-[12.5px] text-[var(--gray-500)] m-0">{subtitulo}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
        {extra}
        <Link href={backHref} className="text-[13px] sm:text-[13.5px] font-medium text-[var(--blue)] underline underline-offset-[3px] hover:text-[var(--navy)] flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          {backLabel}
        </Link>
        </div>
      </div>
    </header>
  );
}
