import Image from "next/image";
import Link from "next/link";

// Por defecto el logo lleva a la página de inicio. Usar enlace={false} donde no aplique
// (login, páginas públicas por QR y documentos para imprimir).
// El logo se muestra 25% más grande que el tamaño indicado (ajuste global en todas las páginas).
export const ESCALA_LOGO = 1.25;

export default function Logo({ size: sizeBase = 34, enlace = true }: { size?: number; enlace?: boolean }) {
const size = Math.round(sizeBase * ESCALA_LOGO);
const imagen = (
<Image
src="/logo-icono.png"
alt="Transportes Logisticar"
width={size}
height={size}
style={{ width: size, height: size, objectFit: "contain" }}
unoptimized
draggable={false}
/>
);
if (!enlace) return imagen;
return (
<Link href="/" title="Ir al inicio" aria-label="Ir al inicio" className="inline-flex shrink-0">
{imagen}
</Link>
);
}
