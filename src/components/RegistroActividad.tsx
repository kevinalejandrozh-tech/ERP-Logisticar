"use client";
import { useEffect } from "react";

// Registra automáticamente los movimientos (altas, cambios y bajas) que hace el usuario en cualquier página.
// Intercepta las llamadas a /api/ que modifican datos y, si salieron bien, avisa a /api/actividad.
// Así las notificaciones del inicio funcionan en todos los módulos sin tocar cada uno.
const API_EXCLUIDAS = ["/api/auth/", "/api/actividad", "/api/notificaciones", "/api/favoritos", "/api/sistema/"];

export default function RegistroActividad() {
  useEffect(() => {
    const w = window as typeof window & { __glActividad?: boolean };
    if (w.__glActividad) return;
    w.__glActividad = true;
    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const respuesta = await fetchOriginal(input, init);
      try {
        const metodo = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
        if (metodo !== "GET" && metodo !== "HEAD" && respuesta.ok) {
          const texto = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          const url = new URL(texto, window.location.origin);
          if (url.origin === window.location.origin && url.pathname.startsWith("/api/") && !API_EXCLUIDAS.some((e) => url.pathname.startsWith(e))) {
            fetchOriginal("/api/actividad", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ metodo, api: url.pathname, pagina: window.location.pathname }),
              keepalive: true,
            }).catch(() => {});
          }
        }
      } catch {
        // El registro nunca debe interrumpir la operación del usuario.
      }
      return respuesta;
    };
  }, []);
  return null;
}
