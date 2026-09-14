"use client";
import { SwitchState } from "@/lib/checklistData";
export default function PuntoChecklist({
label,
value,
comentarioActivo,
comentario,
onChange,
onToggleComentario,
onComentarioChange,
opciones,
}: {
label: string;
value: SwitchState;
comentarioActivo: boolean;
comentario: string;
onChange: (v: SwitchState) => void;
onToggleComentario: () => void;
onComentarioChange: (v: string) => void;
opciones?: [string, string];
}) {
const [textoPositivo, textoNegativo] = opciones || ["Sí", "No"];
return (
<div className="py-3 border-b border-[var(--gray-200)] last:border-0">
<div className="flex items-center justify-between gap-2">
<span className="text-xs text-[var(--text)] flex-1">{label}</span>
<button
type="button"
onClick={onToggleComentario}
className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 shadow-sm transition-shadow hover:shadow-md ${
comentarioActivo
? "bg-[var(--amber)] text-white"
: "bg-[var(--gray-100)] text-[var(--gray-400)]"
}`}
>
Comentarios
</button>
</div>
<div className="flex flex-col gap-2 mt-2">
<button
type="button"
onClick={() => onChange(value === "si" ? null : "si")}
className={`text-left px-3 py-2 rounded-md text-[11px] font-semibold shadow-sm transition-shadow ${
value === "si"
? "bg-[var(--green)] text-white shadow-md"
: "bg-[var(--gray-100)] text-[var(--text)] hover:shadow-md"
}`}
>
{textoPositivo}
</button>
<button
type="button"
onClick={() => onChange(value === "no" ? null : "no")}
className={`text-left px-3 py-2 rounded-md text-[11px] font-semibold shadow-sm transition-shadow ${
value === "no"
? "bg-[var(--red)] text-white shadow-md"
: "bg-[var(--gray-100)] text-[var(--text)] hover:shadow-md"
}`}
>
{textoNegativo}
</button>
</div>
{comentarioActivo && (
<input
type="text"
placeholder="Observaciones / evidencia"
value={comentario}
onChange={(e) => onComentarioChange(e.target.value)}
className="mt-2 w-full rounded-md border border-[var(--gray-200)] px-3 py-2 text-xs outline-none focus:border-[var(--blue)]"
/>
)}
</div>
);
}
