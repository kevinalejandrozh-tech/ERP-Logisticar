"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";

// Módulo vacío creado desde el modo edición del inicio (se construye después).
export default function ModuloVacioPage() {
  const { slug } = useParams<{ slug: string }>();
  const [titulo, setTitulo] = useState("Módulo");
  const [descripcion, setDescripcion] = useState("");
  useEffect(() => {
    fetch(`/api/personalizacion/botones?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const b = d.botones?.[0];
        if (b) {
          setTitulo(b.titulo);
          setDescripcion(b.descripcion || "");
        }
      })
      .catch(() => {});
  }, [slug]);
  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10 pb-10">
        <PageHeader titulo={titulo} subtitulo={descripcion || "Módulo en construcción."} backHref="/" backLabel="Menú principal" />
        <div className="bg-white rounded-[20px] p-10 text-center text-[13px] text-[var(--gray-400)]">Este módulo está vacío por ahora.</div>
      </div>
    </div>
  );
}
