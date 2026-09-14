"use client";
import { compressImage } from "@/lib/imageUtils";

export default function FotoCardGrande({
  label,
  onFoto,
  foto,
  soloLectura,
  onVer,
}: {
  label: string;
  onFoto: (dataUrl: string) => void;
  foto: string | null;
  soloLectura?: boolean;
  onVer?: () => void;
}) {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      onFoto(dataUrl);
    } catch {
      // si falla la compresión, no se guarda foto para evitar payloads gigantes
    }
    e.target.value = "";
  };

  return (
    <div className="border border-[var(--gray-200)] rounded-xl p-2.5 text-center bg-white">
      <p className="text-[10.5px] font-bold text-[var(--navy)] mb-2 leading-tight min-h-[26px] flex items-center justify-center">{label}</p>
      <div
        onClick={() => foto && onVer && onVer()}
        className={`w-full aspect-square rounded-lg bg-[var(--gray-100)] flex items-center justify-center text-[var(--gray-400)] overflow-hidden relative ${foto ? "cursor-pointer" : ""}`}
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt={label} className="w-full h-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        )}
      </div>
      {!soloLectura && (
        <label className="mt-2 flex items-center justify-center gap-1.5 text-[10.5px] font-bold text-[var(--blue)] cursor-pointer py-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 12a9 9 0 11-2.6-6.3M21 3v5h-5" />
          </svg>
          {foto ? "Reemplazar foto" : "Tomar foto"}
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
        </label>
      )}
    </div>
  );
}
