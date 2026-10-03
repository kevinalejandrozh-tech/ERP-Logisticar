"use client";
import { useRef, useState } from "react";
import { compressImage } from "@/lib/imageUtils";

// Ventana "Mi perfil" (engrane junto al nombre): foto de perfil y cambio de la propia contraseña. Disponible para todos los roles.
export default function PerfilModal({
  nombre,
  foto,
  onFotoCambiada,
  onCerrar,
}: {
  nombre: string;
  foto: string | null;
  onFotoCambiada: (foto: string | null) => void;
  onCerrar: () => void;
}) {
  const archivoRef = useRef<HTMLInputElement>(null);
  const [mensajeFoto, setMensajeFoto] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [mensajePass, setMensajePass] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardarFoto = async (valor: string | null) => {
    setSubiendo(true);
    setMensajeFoto("");
    try {
      const res = await fetch("/api/auth/perfil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ foto: valor }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo guardar la foto.");
      onFotoCambiada(valor);
      setMensajeFoto(valor ? "Foto actualizada." : "Foto eliminada.");
    } catch (e) {
      setMensajeFoto(e instanceof Error ? e.message : "No se pudo guardar la foto.");
    } finally {
      setSubiendo(false);
    }
  };

  const elegirFoto = async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      const dataUrl = await compressImage(archivo, 320, 0.8, 300000);
      await guardarFoto(dataUrl);
    } catch (e) {
      setMensajeFoto(e instanceof Error ? e.message : "No se pudo procesar la imagen.");
    }
  };

  const cambiarPassword = async () => {
    setGuardando(true);
    setMensajePass(null);
    try {
      const res = await fetch("/api/auth/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordActual: actual, nuevaPassword: nueva, confirmarPassword: confirmar }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo cambiar la contraseña.");
      setMensajePass({ ok: true, texto: "Contraseña actualizada." });
      setActual("");
      setNueva("");
      setConfirmar("");
    } catch (e) {
      setMensajePass({ ok: false, texto: e instanceof Error ? e.message : "No se pudo cambiar la contraseña." });
    } finally {
      setGuardando(false);
    }
  };

  const iniciales = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const campo = "w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]";

  return (
    <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-[10001]" onClick={onCerrar}>
      <div className="bg-white rounded-2xl w-[420px] max-w-full max-h-[92vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--gray-200)]">
          <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Mi perfil</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-[22px] leading-none text-[var(--gray-400)]">×</button>
        </div>

        <div className="px-6 py-5 border-b border-[var(--gray-200)]">
          <p className="text-[12px] font-bold text-[var(--navy)] mb-3">Foto de perfil</p>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[var(--blue-light)] overflow-hidden flex items-center justify-center text-[24px] font-medium text-[var(--blue)] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : iniciales}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={archivoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => elegirFoto(e.target.files?.[0])} />
              <button type="button" disabled={subiendo} onClick={() => archivoRef.current?.click()} className="btn btn-secundario py-1.5">
                {subiendo ? "Guardando…" : foto ? "Cambiar foto" : "Subir foto"}
              </button>
              {foto && (
                <button type="button" disabled={subiendo} onClick={() => guardarFoto(null)} className="text-[12px] text-[var(--red)] underline text-left">
                  Quitar foto
                </button>
              )}
            </div>
          </div>
          {mensajeFoto && <p className="text-[12px] text-[var(--blue)] font-semibold mt-2 mb-0">{mensajeFoto}</p>}
        </div>

        <div className="px-6 py-5 grid gap-3">
          <p className="text-[12px] font-bold text-[var(--navy)] m-0">Cambiar contraseña</p>
          <input type={ver ? "text" : "password"} placeholder="Contraseña actual" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" className={campo} />
          <input type={ver ? "text" : "password"} placeholder="Nueva contraseña" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" className={campo} />
          <input type={ver ? "text" : "password"} placeholder="Confirmar nueva contraseña" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" className={campo} />
          <label className="flex items-center gap-2 text-[12px] text-[var(--gray-500)]">
            <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseñas
          </label>
          {mensajePass && <p className={`text-[12px] font-semibold m-0 ${mensajePass.ok ? "text-[var(--green)]" : "text-[var(--red)]"}`}>{mensajePass.texto}</p>}
          <button type="button" disabled={guardando || !actual || !nueva || !confirmar} onClick={cambiarPassword} className="btn btn-primario justify-self-end">
            {guardando ? "Guardando…" : "Guardar contraseña"}
          </button>
        </div>
      </div>
    </div>
  );
}
