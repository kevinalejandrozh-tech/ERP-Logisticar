"use client";
import { useState } from "react";

// Monto con formato de contabilidad: "$" a la izquierda y la cantidad alineada a la derecha con separador de miles.
// Al enfocar se edita el número limpio; al salir se vuelve a mostrar con formato.
export function formatoContable(n: number): string {
  return (Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CampoMoneda({
  valor,
  onCambio,
  deshabilitado = false,
  className = "",
  ariaLabel,
}: {
  valor: number;
  onCambio?: (n: number) => void;
  deshabilitado?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const editando = texto !== null;
  return (
    <div className={`campo-moneda ${deshabilitado ? "deshabilitado" : ""} ${className}`}>
      <span className="text-[13.5px] text-[var(--gray-500)] select-none">$</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={deshabilitado}
        value={editando ? texto : formatoContable(valor)}
        onFocus={() => setTexto(valor ? String(valor) : "")}
        onChange={(e) => {
          const limpio = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
          setTexto(limpio);
          onCambio?.(limpio === "" ? 0 : Number(limpio) || 0);
        }}
        onBlur={() => setTexto(null)}
      />
    </div>
  );
}
