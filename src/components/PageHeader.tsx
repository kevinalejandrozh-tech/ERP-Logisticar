import Logo from "@/components/Logo";
import Link from "next/link";
export default function PageHeader({
  titulo,
  subtitulo,
  backHref,
  backLabel,
  icono,
}: {
  titulo: string;
  subtitulo: string;
  backHref: string;
  backLabel: string;
  icono?: React.ReactNode;
}) {
  return (
    <header className="bg-white border-b border-[var(--gray-200)] sticky top-0 z-30 -mx-4 sm:-mx-6 md:-mx-10 lg:-mx-14 mb-5 md:mb-7">
      <div className="px-4 sm:px-6 md:px-10 lg:px-14 py-3.5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div>
            <h1 className="font-display text-[16px] sm:text-[18px] font-medium text-[var(--navy)] m-0">{titulo}</h1>
            <p className="text-[11.5px] sm:text-[12.5px] text-[var(--gray-500)] m-0">{subtitulo}</p>
          </div>
        </div>
        <Link href={backHref} className="text-[13px] sm:text-[13.5px] font-medium text-[var(--blue)] underline underline-offset-[3px] hover:text-[var(--navy)] flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          {backLabel}
        </Link>
      </div>
    </header>
  );
}
