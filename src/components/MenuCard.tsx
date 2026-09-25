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
// Desde tablet se ve igual que la tarjeta original. Por defecto desactivado para no afectar otras pantallas.
compactoMovil?: boolean;
}) {
const contenido = compactoMovil ? (
<div className="flex items-center gap-3.5 sm:block">
<div className="w-[42px] h-[42px] md:w-[50px] md:h-[50px] rounded-full bg-[var(--blue-light)] flex items-center justify-center shrink-0 sm:mx-auto sm:mb-3 md:mb-4">
{icono}
</div>
<div className="min-w-0 flex-1">
<h3 className="text-[13.5px] md:text-[14.5px] font-bold text-[var(--navy)] m-0 mb-1 sm:mb-2 leading-tight">{titulo}</h3>
<div className="hidden sm:block w-[26px] h-[3px] bg-[var(--blue)] rounded-sm mx-auto mb-2.5" />
<p className="text-[12px] md:text-[12.5px] text-[var(--gray-400)] m-0 leading-snug sm:leading-relaxed">{descripcion}</p>
</div>
<svg className="sm:hidden shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2.2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
</div>
) : (
<>
<div className="w-[42px] h-[42px] md:w-[50px] md:h-[50px] rounded-full bg-[var(--blue-light)] flex items-center justify-center mx-auto mb-3 md:mb-4">
{icono}
</div>
<h3 className="text-[13.5px] md:text-[14.5px] font-bold text-[var(--navy)] m-0 mb-2 leading-tight">{titulo}</h3>
<div className="w-[26px] h-[3px] bg-[var(--blue)] rounded-sm mx-auto mb-2.5" />
<p className="text-[12px] md:text-[12.5px] text-[var(--gray-400)] m-0 leading-relaxed">{descripcion}</p>
</>
);
const clases = compactoMovil
? "bg-white border border-[var(--gray-200)] rounded-2xl p-3.5 sm:p-4 md:p-6 text-left sm:text-center shadow-[0_1px_2px_rgba(22,33,92,0.04)] block"
: "bg-white border border-[var(--gray-200)] rounded-2xl p-4 md:p-6 text-center shadow-[0_1px_2px_rgba(22,33,92,0.04)] block";
if (href) {
return (
<Link href={href} className={clases}>
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