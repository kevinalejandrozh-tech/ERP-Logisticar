import type { Metadata, Viewport } from "next";
import AvisoNotasVencidas from "@/components/AvisoNotasVencidas";
import NotasEnVivo from "@/components/NotasEnVivo";
import OCPorAutorizar from "@/components/OCPorAutorizar";
import SistemaEnVivo from "@/components/SistemaEnVivo";
import BarraGlobal from "@/components/BarraGlobal";
import localFont from "next/font/local";
import "./globals.css";
import ZoomControls from "@/components/ZoomControls";
import PageFooter from "@/components/PageFooter";
import RegistroActividad from "@/components/RegistroActividad";

// Roboto auto-hospedada (latin 400/500/700) — tipografía institucional del sistema
const roboto = localFont({
  src: [
    { path: "./fonts/roboto-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/roboto-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/roboto-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://erp.transporteslogisticar.com.mx"),
  robots: { index: false, follow: false }, // el ERP no se indexa; solo /sitio (ver su metadata)
  title: "Gestión Logisticar",
  description: "Sistema de control operativo - Transportes Logisticar",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <RegistroActividad />
        <AvisoNotasVencidas />
        <NotasEnVivo />
        <OCPorAutorizar />
        <SistemaEnVivo />
        <BarraGlobal />
        <ZoomControls>
          {children}
          <PageFooter />
        </ZoomControls>
      </body>
    </html>
  );
}
