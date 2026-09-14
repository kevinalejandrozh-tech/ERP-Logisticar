"use client";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function ElegirChecklistPage() {
  return (
    <div className="min-h-screen flex justify-center bg-[#dcdfe6] py-8 px-4">
      <div className="w-full max-w-[520px]">
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="text-[var(--blue)] text-[13px] font-semibold no-underline">
            ← Menú principal
          </Link>
          <div className="flex items-center gap-2">
            <Logo size={30} />
            <div className="leading-tight">
              <p className="font-display font-extrabold text-[var(--red)] text-[11px] m-0">TRANSPORTES</p>
              <p className="font-display font-extrabold text-[var(--red)] text-[11px] m-0">LOGISTICAR</p>
            </div>
          </div>
        </div>

        <h1 className="text-center font-display font-extrabold text-[var(--navy)] text-[18px] uppercase tracking-wide mb-1.5">Check List Diario de Unidades</h1>
        <p className="text-center text-[13px] text-[var(--gray-400)] mb-7">Selecciona el tipo de check list que deseas llenar.</p>

        <div className="flex flex-col gap-4">
          <Link
            href="/checklist"
            className="block bg-white border border-[var(--gray-200)] rounded-2xl p-5 no-underline hover:border-[var(--blue)] transition-colors shadow-sm hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--blue-light)] flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M8 12l2.5 2.5L16 9" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[14.5px] font-bold text-[var(--navy)] m-0 mb-0.5">Check List Diario de Unidades</p>
                <p className="text-[12px] text-[var(--gray-400)] m-0">Inspección completa por secciones: unidad, evidencia, niveles, inspección, adicionales y documentación.</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2.2" className="shrink-0"><path d="M9 6l6 6-6 6" /></svg>
            </div>
          </Link>

          <div className="block bg-[var(--gray-100)] border border-dashed border-[var(--gray-200)] rounded-2xl p-5 opacity-70 cursor-not-allowed">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M8 12l2.5 2.5L16 9" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[14.5px] font-bold text-[var(--gray-400)] m-0 mb-0.5">Check List TMS</p>
                <p className="text-[12px] text-[var(--gray-400)] m-0">Próximamente.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
