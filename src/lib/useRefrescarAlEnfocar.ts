"use client";
import { useEffect } from "react";

// Vuelve a ejecutar la función cuando la pestaña recupera el foco o vuelve a ser visible,
// en vez de sondear la base de datos cada pocos segundos. Esto evita mantener el cómputo
// de Neon despierto de forma continua (y con ello el consumo/costo) mientras alguien
// simplemente tiene la pestaña abierta sin estar mirándola.
export function useRefrescarAlEnfocar(fn: () => void) {
  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === "visible") fn();
    };
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
