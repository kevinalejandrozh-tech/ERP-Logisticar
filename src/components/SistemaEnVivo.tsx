"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Aviso global cuando se está mejorando el sistema ("modo mantenimiento", lo enciende el sysadmin desde el engrane)
// y aviso de "mejoras disponibles" cuando termina. Consulta cada pocos segundos, sin recargar nada por su cuenta.
export default function SistemaEnVivo() {
  const ruta = usePathname();
  const [activo, setActivo] = useState(false);
  const [esSysadmin, setEsSysadmin] = useState(false);
  const [listo, setListo] = useState(false);
  const antes = useRef(false);
  const bloqueado = useRef(false);

  useEffect(() => {
    bloqueado.current = false;
    if (!ruta || ruta === "/login" || ruta.startsWith("/sitio")) return;
    let vivo = true;
    const consultar = async () => {
      if (!vivo || bloqueado.current || document.hidden) return;
      try {
        const r = await fetch("/api/sistema/mantenimiento", { cache: "no-store" });
        if (r.status === 401 || r.status === 403) return void (bloqueado.current = true);
        if (!r.ok) return;
        const d = await r.json();
        setEsSysadmin(!!d.esSysadmin);
        setActivo(d.activo === true);
        if (antes.current && d.activo !== true) setListo(true);
        if (d.activo === true) setListo(false);
        antes.current = d.activo === true;
      } catch {
        /* sin conexión */
      }
    };
    consultar();
    const id = window.setInterval(consultar, 8000);
    const ya = () => consultar();
    window.addEventListener("mantenimiento-cambio", ya);
    document.addEventListener("visibilitychange", ya);
    return () => {
      vivo = false;
      window.clearInterval(id);
      window.removeEventListener("mantenimiento-cambio", ya);
      document.removeEventListener("visibilitychange", ya);
    };
  }, [ruta]);

  if (activo)
    return (
      <div role="status" className="fixed top-0 inset-x-0 z-[95] bg-[#f5a524] text-[#3b2a00] text-[13px] font-bold px-4 py-2.5 text-center shadow-lg print:hidden">
        🛠 Estamos trabajando en mejorar el sistema Logisticar. En breve se cargarán las mejoras.
        {esSysadmin && (
          <button
            type="button"
            className="ml-3 underline"
            onClick={async () => {
              await fetch("/api/sistema/mantenimiento", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: false }) });
              window.dispatchEvent(new Event("mantenimiento-cambio"));
            }}
          >
            Desactivar aviso
          </button>
        )}
      </div>
    );
  if (listo)
    return (
      <div role="status" className="fixed top-0 inset-x-0 z-[95] bg-[var(--green)] text-white text-[13px] font-bold px-4 py-2.5 text-center shadow-lg print:hidden">
        ✅ Las mejoras ya están disponibles.
        <button type="button" className="ml-3 underline" onClick={() => window.location.reload()}>Actualizar ahora</button>
        <button type="button" className="ml-3 opacity-80" aria-label="Cerrar" onClick={() => setListo(false)}>✕</button>
      </div>
    );
  return null;
}
