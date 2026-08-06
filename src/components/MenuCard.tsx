import Link from "next/link";
export default function MenuCard({
href,
icono,
titulo,
descripcion,
}: {
href?: string;
icono: React.ReactNode;
titulo: string;
descripcion: string;
}) {
const contenido = (
<>
<div className="w-[50px] h-[50px] rounded-full bg-[var(--blue-light)] flex items-center justify-center mx-auto mb-4">
{icono}
</div>
<h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0 mb-2 leading-tight">{titulo}</h3>
<div className="w-[26px] h-[3px] bg-[var(--blue)] rounded-sm mx-auto mb-2.5" />
<p className="text-[12.5px] text-[var(--gray-400)] m-0 leading-relaxed">{descripcion}</p>
</>
);
const clases =
"bg-white border border-[var(--gray-200)] rounded-2xl p-6 text-center shadow-[0_1px_2px_rgba(22,33,92,0.04)] block";
if (href) {
return (
<Link href={href} className={clases}>
{contenido}
</Link>
);
}
return (
<button type="button" className={`${clases} w-full cursor-default`}>
{contenido}
</button>
);
}
