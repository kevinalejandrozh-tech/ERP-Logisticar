"use client";
import { compressImage } from "@/lib/imageUtils";
export default function MultiFotoUploader({
fotos,
onChange,
titulo,
}: {
fotos: string[];
onChange: (fotos: string[]) => void;
titulo?: string;
}) {
const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
const files = Array.from(e.target.files || []);
if (files.length === 0) return;
const nuevas: string[] = [];
for (const file of files) {
try {
const dataUrl = await compressImage(file);
nuevas.push(dataUrl);
} catch {
// se omite si falla la compresion
}
}
onChange([...fotos, ...nuevas]);
e.target.value = "";
};
const eliminar = (idx: number) => {
onChange(fotos.filter((_, i) => i !== idx));
};
const contenido = (
<div className="flex flex-wrap gap-2">
{fotos.map((f, i) => (
<div
key={i}
className="relative w-14 h-14 rounded-md overflow-hidden border border-[var(--gray-200)]"
>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={f} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
<button
type="button"
onClick={() => eliminar(i)}
className="absolute top-0 right-0 bg-[var(--red)] text-white text-[10px] w-4 h-4 flex items-center justify-center leading-none"
>
×
</button>
</div>
))}
<label className="w-14 h-14 rounded-md border-2 border-dashed border-[var(--gray-200)] flex items-center justify-center cursor-pointer text-[var(--navy)] shrink-0">
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
<circle cx="12" cy="13" r="4" />
</svg>
<input
type="file"
accept="image/*"
capture="environment"
multiple
onChange={handleFiles}
className="hidden"
/>
</label>
</div>
);
if (!titulo) return contenido;
return (
<div className="border border-[var(--gray-200)] rounded-lg p-3.5">
<p className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-2.5">
{titulo}
</p>
{contenido}
</div>
);
}
