import Image from "next/image";
export default function Logo({ size = 34 }: { size?: number }) {
return (
<Image
src="/logo-transportes.png"
alt="Transportes Logisticar"
width={size}
height={size}
style={{ width: size, height: size, objectFit: "contain" }}
/>
);
}
