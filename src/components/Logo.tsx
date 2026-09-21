import Image from "next/image";
import Link from "next/link";

// Por defecto el logo lleva a la página de inicio. Usar enlace={false} donde no aplique
// (login, páginas públicas por QR y documentos para imprimir).
export default function Logo({ size = 34, enlace = true }: { size?: number; enlace?: boolean }) {
const imagen = (
<Image
src="/logo-transportes.png"
alt="Transportes Logisticar"
width={size}
height={size}
style={{ width: size, height: size, objectFit: "contain" }}
/>
);
if (!enlace) return imagen;
return (
<Link href="/" title="Ir al inicio" aria-label="Ir al inicio" className="inline-flex shrink-0">
{imagen}
</Link>
);
}
