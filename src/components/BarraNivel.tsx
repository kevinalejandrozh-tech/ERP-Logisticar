"use client";
import { NIVEL_OPCIONES } from "@/lib/checklistData";
export default function BarraNivel({
label,
value,
onChange,
}: {
label: string;
value: number; // 0-4 (0 = vacío)
onChange: (v: number) => void;
}) {
return (
<div>
<div className="h-2 rounded-full bg-[var(--gray-200)] overflow-hidden mb-1">
<div
className="h-full bg-[var(--blue)] transition-all"
style={{ width: `${(value / 4) * 100}%` }}
/>
</div>
<div className="flex gap-1">
{NIVEL_OPCIONES.map((op, i) => (
<button
key={op}
type="button"
onClick={() => onChange(value === i + 1 ? 0 : i + 1)}
className={`text-[8.5px] font-semibold px-1 py-0.5 rounded ${
value === i + 1
? "bg-[var(--blue)] text-white"
: "text-[var(--gray-400)]"
}`}
>
{op}
</button>
))}
</div>
</div>
);
}
