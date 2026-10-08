"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import CargaDocumentosCandidato from "@/components/CargaDocumentosCandidato";

// Página PÚBLICA (enlace general): la persona escribe su nombre y después carga sus documentos.
// El token de su registro queda en la URL (?t=) y en el navegador para que pueda continuar después.
const API = "/api/carga-documentos";
const LLAVE = "logisticar_carga_documentos";

export default function CargaDocumentosPage() {
  const [token, setToken] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [operador, setOperador] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let t = new URLSearchParams(window.location.search).get("t") || "";
    if (!t) {
      try {
        t = localStorage.getItem(LLAVE) || "";
      } catch {}
      if (t) window.history.replaceState(null, "", `?t=${t}`);
    }
    setToken(t);
  }, []);

  const registrar = async () => {
    setError("");
    const limpio = nombre.replace(/\s+/g, " ").trim();
    if (limpio.length < 5 || !limpio.includes(" ")) return setError("Escribe tu nombre completo (nombre y apellidos).");
    if (operador === null) return setError("Indica si aplicas como operador.");
    setGuardando(true);
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "registrar", nombre: limpio, operador }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      try {
        localStorage.setItem(LLAVE, d.token);
      } catch {}
      window.history.replaceState(null, "", `?t=${d.token}`);
      setToken(d.token);
    } catch (e: any) {
      setError(e.message || "No se pudo registrar.");
    } finally {
      setGuardando(false);
    }
  };

  const otraPersona = () => {
    try {
      localStorage.removeItem(LLAVE);
    } catch {}
    window.history.replaceState(null, "", window.location.pathname);
    setNombre("");
    setOperador(null);
    setToken("");
  };

  if (token === null) return <div className="min-h-screen bg-[#eef1f6]" />;

  if (token) {
    return (
      <CargaDocumentosCandidato
        api={API}
        token={token}
        aviso={
          <p className="text-[12px] text-[var(--gray-400)] m-0 mb-2">
            Puedes cerrar y volver a este enlace para continuar después.{" "}
            <button type="button" onClick={otraPersona} className="text-[var(--blue)] font-bold">
              ¿No eres tú? Registrar a otra persona
            </button>
          </p>
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#eef1f6] pb-12">
      <header className="bg-white border-b border-[var(--gray-200)] shadow-sm mb-6">
        <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <Logo size={36} enlace={false} />
          <div>
            <h1 className="font-display text-[16px] sm:text-[18px] font-bold text-[var(--navy)] m-0">Transportes Logisticar</h1>
            <p className="text-[11.5px] sm:text-[12px] text-[var(--gray-400)] m-0">Carga de documentos</p>
          </div>
        </div>
      </header>
      <div className="max-w-[760px] mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-[18px] p-5 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] grid gap-4">
          <div>
            <p className="text-[14px] font-bold text-[var(--navy)] m-0 mb-1">Bienvenido</p>
            <p className="text-[13px] text-[var(--gray-400)] m-0">Escribe tus datos para comenzar a cargar tu documentación.</p>
          </div>
          <label className="grid gap-1.5">
            <span className="text-[12.5px] font-bold text-[var(--navy)]">Nombre completo</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              placeholder="Nombre(s) y apellidos"
              className="border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[14px]"
            />
          </label>
          <div className="grid gap-1.5">
            <span className="text-[12.5px] font-bold text-[var(--navy)]">¿Aplicas como operador de unidad?</span>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setOperador(v)}
                  className={`rounded-lg px-5 py-2 text-[13px] font-bold border ${operador === v ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "bg-white text-[var(--navy)] border-[var(--gray-200)]"}`}
                >
                  {v ? "Sí" : "No"}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-[13px] text-[var(--red)] font-semibold m-0">{error}</p>}
          <button type="button" onClick={registrar} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-3 text-[13.5px] font-bold">
            {guardando ? "Guardando…" : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
