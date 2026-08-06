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
}: {
label: string;
value: SwitchState;
comentarioActivo: boolean;
comentario: string;
onChange: (v: SwitchState) => void;
onToggleComentario: () => void;
onComentarioChange: (v: string) => void;
}) {
return (
<div className="py-3 border-b border-[var(--gray-200)] last:border-0">
<div className="flex items-center justify-between gap-2">
<span className="text-xs text-[var(--text)] flex-1">{label}</span>
<div className="flex items-center rounded-full bg-[var(--gray-100)] p-1 shrink-0">
<button
type="button"
onClick={() => onChange(value === "si" ? null : "si")}
className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
value === "si"
? "bg-[var(--green)] text-white"
: "text-[var(--gray-400)]"
}`}
>
Sí
</button>
<button
type="button"
onClick={() => onChange(value === "no" ? null : "no")}
className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
value === "no"
? "bg-[var(--red)] text-white"
: "text-[var(--gray-400)]"
}`}
>
No
</button>
<button
type="button"
onClick={onToggleComentario}
className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
comentarioActivo
? "bg-[var(--amber)] text-white"
: "text-[var(--gray-400)]"
}`}
>
Comentarios
</button>
</div>
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
