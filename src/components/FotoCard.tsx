"use client";
import { compressImage } from "@/lib/imageUtils";
export default function FotoCard({
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
// si falla la compresion, no se guarda foto para evitar payloads gigantes
}
};
return (
<div className="border border-[var(--gray-200)] rounded-lg p-2 pb-2.5 text-center bg-white">
<p className="text-[9px] font-bold text-[var(--navy)] mb-2 leading-tight min-h-[22px]">
{label}
</p>
{soloLectura ? (
<div
onClick={() => foto && onVer && onVer()}
className={`w-7 h-7 mx-auto rounded-full bg-[var(--gray-100)] flex items-center justify-center text-[var(--navy)] overflow-hidden pointer-events-auto ${foto ? "cursor-pointer" : ""}`}
>
{foto ? (
<img src={foto} alt={label} className="w-full h-full object-cover rounded-full" />
) : (
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
<circle cx="12" cy="13" r="4" />
</svg>
)}
</div>
) : (
<label className="w-7 h-7 mx-auto rounded-full bg-[var(--gray-100)] flex items-center justify-center text-[var(--navy)] cursor-pointer overflow-hidden">
{foto ? (
<img src={foto} alt={label} className="w-full h-full object-cover rounded-full" />
) : (
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
<circle cx="12" cy="13" r="4" />
</svg>
)}
<input type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
</label>
)}
</div>
);
}
