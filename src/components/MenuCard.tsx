import Link from "next/link";
export default function MenuCard({
href,
onClick,
icono,
titulo,
descripcion,
compactoMovil = false,
}: {
href?: string;
onClick?: () => void;
icono: React.ReactNode;
titulo: string;
descripcion: string;
// Opcional: en celular (menos de 640 px) muestra la tarjeta en formato horizontal compacto.
// Desde tablet se ve igual que la tarjeta estándar. Por defecto desactivado para no afectar otras pantallas.
compactoMovil?: boolean;
}) {
const iconoCaja = (
<div className="w-[40px] h-[40px] md:w-[46px] md:h-[46px] rounded-lg bg-[var(--blue-light)] flex items-center justify-center shrink-0">
{icono}
</div>
);
const abrir = (
<span className="inline-flex items-center gap-1.5 text-[13.5px] md:text-[14px] font-medium text-[var(--blue)] mt-3">
Abrir
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
</span>
);
const contenido = compactoMovil ? (
<div className="flex items-center gap-3.5 sm:block">
<div className="sm:mb-3.5">{iconoCaja}</div>
<div className="min-w-0 flex-1">
<h3 className="text-[15px] md:text-[17px] font-bold text-[var(--navy)] m-0 mb-1 leading-tight">{titulo}</h3>
<p className="text-[12.5px] md:text-[13.5px] text-[var(--gray-500)] m-0 leading-snug sm:leading-relaxed">{descripcion}</p>
<span className="hidden sm:inline-flex">{abrir}</span>
</div>
<svg className="sm:hidden shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a91a0" strokeWidth="2.2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
</div>
) : (
<>
<div className="mb-3.5">{iconoCaja}</div>
<h3 className="text-[15px] md:text-[17px] font-bold text-[var(--navy)] m-0 mb-1 leading-tight">{titulo}</h3>
<p className="text-[12.5px] md:text-[13.5px] text-[var(--gray-500)] m-0 leading-relaxed">{descripcion}</p>
{abrir}
</>
);
const clases = "group bg-white border border-[var(--gray-200)] rounded-xl p-3.5 sm:p-5 md:p-6 text-left block h-full shadow-[0_1px_4px_rgba(22,33,92,0.05)] hover:border-[var(--blue)] hover:shadow-[0_4px_14px_rgba(22,33,92,0.09)]";
if (href) {
return (
<Link href={href} className={`${clases} no-underline`}>
{contenido}
</Link>
);
}
if (onClick) {
return (
<button type="button" onClick={onClick} className={`${clases} w-full`}>
{contenido}
</button>
);
}
return (
<button type="button" className={`${clases} w-full cursor-default`}>
{contenido}
</button>
);
}
