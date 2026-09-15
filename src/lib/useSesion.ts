"use client";
import { useEffect, useState } from "react";

export type SesionActual = { ok: boolean; nombre?: string; correo?: string; rol?: "sysadmin" | "supervisor_tms"; cargando: boolean };

export function useSesion(): SesionActual {
  const [sesion, setSesion] = useState<SesionActual>({ ok: false, cargando: true });

  useEffect(() => {
    fetch("/api/auth/sesion", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSesion({ ...d, cargando: false }))
      .catch(() => setSesion({ ok: false, cargando: false }));
  }, []);

  return sesion;
}
