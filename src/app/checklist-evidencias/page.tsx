"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

type Registro = {
  folio: string;
  eco_unidad: string;
  descripcion_unidad: string;
  placas: string;
  fecha_hora: string;
  fotos_evidencia: Record<string, string> | null;
  fotos_libres: string[] | null;
  estado_llantas: { fotos?: string[]; dictamen?: string; comentario?: string } | null;
};

export default function ChecklistEvidenciasPage() {
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setError("Falta el identificador del registro.");
      setCargando(false);
      return;
    }
    fetch(`/api/checklist/get?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "No se encontró el registro.");
        setRegistro(data.registro);
      })
      .catch((err) => setError(err.message || "No se encontró el registro."))
      .finally(() => setCargando(false));
  }, []);

  const grupos: { titulo: string; fotos: string[] }[] = [];
  if (registro) {
    if (registro.fotos_evidencia) {
      Object.entries(registro.fotos_evidencia).forEach(([nombre, foto]) => {
        if (foto) grupos.push({ titulo: nombre, fotos: [foto] });
      });
    }
    if (registro.estado_llantas?.fotos && registro.estado_llantas.fotos.length > 0) {
      grupos.push({ titulo: "Estado de llantas", fotos: registro.estado_llantas.fotos });
    }
    if (registro.fotos_libres && registro.fotos_libres.length > 0) {
      grupos.push({ titulo: "Fotos adicionales", fotos: registro.fotos_libres });
    }
  }

  return (
    <div className="min-h-screen flex justify-center bg-[#dcdfe6] py-6 px-4">
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-[var(--gray-200)] flex items-center gap-2.5">
          <Logo size={30} />
          <div className="leading-tight">
            <p className="font-display font-extrabold text-[var(--red)] text-[12px]">TRANSPORTES</p>
            <p className="font-display font-extrabold text-[var(--red)] text-[12px]">LOGISTICAR</p>
          </div>
        </div>

        {cargando && <p className="text-center text-[13px] text-[var(--gray-400)] py-10">Cargando evidencias...</p>}
        {error && <p className="text-center text-[13px] text-[var(--red)] py-10 px-5">{error}</p>}

        {registro && (
          <>
            <div className="px-5 py-4 border-b border-[var(--gray-200)]">
              <h1 className="font-display font-extrabold text-[var(--navy)] text-[15px] m-0">{registro.eco_unidad} — {registro.descripcion_unidad}</h1>
              <p className="text-[12px] text-[var(--gray-400)] mt-1 mb-0">
                Folio {registro.folio} · Placas {registro.placas} · {new Date(registro.fecha_hora).toLocaleString("es-MX")}
              </p>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {grupos.length === 0 && <p className="text-center text-[13px] text-[var(--gray-400)] py-6">Este registro no tiene fotos de evidencia.</p>}
              {grupos.map((g, gi) => (
                <div key={gi}>
                  <p className="text-[11.5px] font-bold text-[var(--navy)] uppercase tracking-wide mb-2">{g.titulo}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {g.fotos.map((foto, fi) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={fi}
                        src={foto}
                        alt={g.titulo}
                        onClick={() => setFotoAmpliada(foto)}
                        className="w-full aspect-square object-cover rounded-lg border border-[var(--gray-200)] cursor-pointer"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {fotoAmpliada && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setFotoAmpliada(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoAmpliada} alt="Ampliada" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
