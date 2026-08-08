export default function PageFooter() {
return (
<footer className="mt-6 bg-[var(--navy)] rounded-t-xl px-4 md:px-8 py-3.5 md:py-4 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-[11px] md:text-[12.5px] text-center sm:text-left">
<div className="flex items-center gap-2 text-white">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
Sistema interno - Transportes Logisticar
</div>
<div style={{ color: "#a9c2ee" }}>© 2026 Transportes Logisticar. Todos los derechos reservados.</div>
</footer>
);
}
