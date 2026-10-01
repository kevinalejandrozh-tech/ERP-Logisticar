"use client";
import { useEffect, useState } from "react";

// Horario individual de entrada y salida (lo usa Asistencia para retardos y salidas).
export default function HorarioExpediente({ expedienteId, soloConsulta }: { expedienteId: number; soloConsulta?: boolean }) {
  const [entrada, setEntrada] = useState("");
  const [salida, setSalida] = useState("");
  const [general, setGeneral] = useState<{ hora_entrada: string; hora_salida: string } | null>(null);
  const [estado, setEstado] = useState<"" | "guardando" | "ok" | "error">("");

  useEffect(() => {
    if (soloConsulta) return;
    fetch(`/api/asistencia/horario?expediente_id=${expedienteId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setEntrada(d.horario?.hora_entrada || "");
        setSalida(d.horario?.hora_salida || "");
        setGeneral(d.general || null);
      })
      .catch(() => {});
  }, [expedienteId, soloConsulta]);

  if (soloConsulta) return null;

  const guardar = async () => {
    setEstado("guardando");
    try {
      const res = await fetch("/api/asistencia/horario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expediente_id: expedienteId, hora_entrada: entrada, hora_salida: salida }),
      });
      if (!res.ok) throw new Error();
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  };

  const input = "border border-[var(--gray-300)] rounded-md px-2 py-1 text-[13px] bg-white";
  return (
    <div className="py-2.5 border-b border-[var(--gray-100)] last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] text-[var(--gray-400)]">Horario de entrada / salida</span>
        <div className="flex items-center gap-1.5">
          <input type="time" aria-label="Horario de entrada" value={entrada} onChange={(e) => { setEntrada(e.target.value); setEstado(""); }} className={input} />
          <span className="text-[var(--gray-400)]">–</span>
          <input type="time" aria-label="Horario de salida" value={salida} onChange={(e) => { setSalida(e.target.value); setEstado(""); }} className={input} />
          <button type="button" className="btn btn-secundario py-1 px-2.5 text-[12px]" onClick={guardar} disabled={estado === "guardando"}>
            {estado === "ok" ? "✓ Guardado" : "Guardar"}
          </button>
        </div>
      </div>
      {!entrada && !salida && general && <p className="text-[11px] text-[var(--gray-400)] m-0 mt-1 text-right">Sin horario propio: usa el general {general.hora_entrada}–{general.hora_salida}.</p>}
      {estado === "error" && <p className="text-[11px] text-[var(--red)] m-0 mt-1 text-right">No se pudo guardar.</p>}
    </div>
  );
}
