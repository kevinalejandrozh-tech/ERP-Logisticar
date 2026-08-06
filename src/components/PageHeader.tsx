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
icono: React.ReactNode;
}) {
return (
<>
<div className="flex items-center justify-between mb-7">
<div className="flex items-center gap-3.5">
<Logo size={48} />
<div>
<h1 className="font-display text-[22px] font-bold text-[var(--navy)] m-0">Gestión Logística</h1>
<p className="text-[13px] text-[var(--gray-400)] m-0">Transportes Logisticar</p>
</div>
</div>
</div>
<Link href={backHref} className="inline-flex items-center gap-1.5 text-[var(--blue)] text-[13.5px] font-semibold no-underline mb-2.5">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
{backLabel}
</Link>
<div className="flex items-center gap-3 mb-6">
<div className="w-[46px] h-[46px] rounded-xl bg-[var(--blue-light)] flex items-center justify-center shrink-0">
{icono}
</div>
<div>
<h2 className="text-[22px] font-bold text-[var(--navy)] m-0">{titulo}</h2>
<p className="text-[13px] text-[var(--gray-400)] mt-0.5 mb-0">{subtitulo}</p>
</div>
</div>
</>
);
}
