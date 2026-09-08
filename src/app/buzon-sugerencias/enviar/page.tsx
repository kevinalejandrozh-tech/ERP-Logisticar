"use client";
import { useState } from "react";
import Image from "next/image";

export default function EnviarSugerenciaPage() {
  const [nombre, setNombre] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const enviar = async () => {
    if (!comentario.trim()) {
      setError("Escribe tu sugerencia o idea antes de enviarla.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/api/buzon-sugerencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), comentario: comentario.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar tu sugerencia.");
      setEnviado(true);
    } catch (err: any) {
      setError(err.message || "No se pudo enviar tu sugerencia. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(160deg, #eef1f6 0%, #dbe6fb 45%, #eef1f6 100%)" }}
    >
      <div className="w-full max-w-[440px]">
        <div className="bg-white rounded-[26px] shadow-[0_20px_60px_rgba(22,33,92,0.16)] overflow-hidden">
          {/* Franja superior decorativa */}
          <div className="h-[6px] bg-gradient-to-r from-[#2f6fed] via-[#21a866] to-[#f2b134]" />

          <div className="px-6 sm:px-8 pt-8 pb-9">
            <div className="flex justify-center mb-5">
              <Image src="/logo-completo.png" alt="Transportes Logisticar" width={220} height={119} style={{ width: 190, height: "auto" }} priority />
            </div>

            {!enviado ? (
              <>
                <h1 className="text-center font-display font-extrabold text-[var(--navy)] text-[19px] leading-tight m-0 mb-2">
                  Buzón de sugerencias e ideas de mejora
                </h1>
                <p className="text-center text-[13px] text-[var(--gray-400)] m-0 mb-7 leading-relaxed">
                  Tu opinión construye un mejor lugar de trabajo. Cuéntanos qué se te ocurre, cada idea cuenta y es leída
                  con atención.
                </p>

                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Tu nombre (opcional)</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Puedes dejarlo en blanco si prefieres ser anónimo"
                  className="w-full border border-[var(--gray-200)] rounded-xl px-4 py-3 text-[14px] mb-4 outline-none focus:border-[var(--blue)] transition-colors"
                />

                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Tu sugerencia o idea de mejora</label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Escribe aquí lo que piensas que podríamos mejorar, o cualquier idea que tengas..."
                  rows={5}
                  className="w-full border border-[var(--gray-200)] rounded-xl px-4 py-3 text-[14px] mb-2 outline-none focus:border-[var(--blue)] transition-colors resize-none"
                />
                {error && <p className="text-[12.5px] text-[var(--red)] font-semibold mb-2">{error}</p>}

                <button
                  type="button"
                  onClick={enviar}
                  disabled={enviando}
                  className="w-full mt-4 bg-[var(--navy)] disabled:opacity-60 text-white rounded-xl py-3.5 text-[14.5px] font-bold shadow-[0_8px_20px_rgba(22,33,92,0.25)] active:scale-[0.99] transition-transform"
                >
                  {enviando ? "Enviando..." : "Enviar sugerencia"}
                </button>
                <p className="text-center text-[10.5px] text-[var(--gray-400)] mt-4 mb-0">
                  Transportes Logisticar · Este espacio es para ti, gracias por participar.
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-[74px] h-[74px] rounded-full bg-gradient-to-br from-[#21a866] to-[#178a54] flex items-center justify-center mx-auto mb-5 shadow-[0_10px_24px_rgba(33,168,102,0.35)]">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <h2 className="font-display font-extrabold text-[var(--navy)] text-[21px] m-0 mb-2.5">
                  ¡Gracias{nombre.trim() ? `, ${nombre.trim()}` : ""}!
                </h2>
                <p className="text-[13.5px] text-[var(--text)] leading-relaxed m-0 mb-1.5 max-w-[320px] mx-auto">
                  Tu idea ya fue registrada y es muy valiosa para nosotros. Cada sugerencia que compartes nos ayuda a
                  construir un mejor lugar de trabajo para todos.
                </p>
                <p className="text-[13px] text-[var(--gray-400)] leading-relaxed m-0 mb-7 max-w-[320px] mx-auto">
                  Nuestro equipo la revisará con atención. ¡Sigue compartiendo tus ideas cuando quieras!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNombre("");
                    setComentario("");
                    setEnviado(false);
                  }}
                  className="text-[13px] font-bold text-[var(--blue)]"
                >
                  Enviar otra sugerencia
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
