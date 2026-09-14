"use client";
import { SwitchState } from "@/lib/checklistData";

export default function PuntoChecklistCompacto({
  label,
  value,
  comentario,
  onChange,
  onComentarioChange,
}: {
  label: string;
  value: SwitchState;
  comentario: string;
  onChange: (v: SwitchState) => void;
  onComentarioChange: (v: string) => void;
}) {
  return (
    <div className="py-3 border-b border-[var(--gray-200)] last:border-0">
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <span className="text-[12.5px] text-[var(--text)] flex-1 min-w-[140px]">{label}</span>
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={value === "si"} onChange={() => onChange("si")} className="accent-[var(--green)] w-4 h-4" />
            <span className={`text-[11.5px] font-bold ${value === "si" ? "text-[var(--green)]" : "text-[var(--gray-400)]"}`}>Sí</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={value === "no"} onChange={() => onChange("no")} className="accent-[var(--red)] w-4 h-4" />
            <span className={`text-[11.5px] font-bold ${value === "no" ? "text-[var(--red)]" : "text-[var(--gray-400)]"}`}>No</span>
          </label>
        </div>
        <input
          type="text"
          placeholder="Comentarios (opcional)"
          value={comentario}
          onChange={(e) => onComentarioChange(e.target.value)}
          className="flex-1 min-w-[140px] rounded-md border border-[var(--gray-200)] px-2.5 py-1.5 text-[11.5px] outline-none focus:border-[var(--blue)]"
        />
      </div>
    </div>
  );
}
