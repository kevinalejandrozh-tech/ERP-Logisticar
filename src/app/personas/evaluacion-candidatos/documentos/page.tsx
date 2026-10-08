"use client";
import { useEffect, useState } from "react";
import CargaDocumentosCandidato from "@/components/CargaDocumentosCandidato";

// Página PÚBLICA: el candidato solo carga sus documentos (PDF o foto) con el enlace que se le comparte.
export default function DocumentosCandidatoPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("t") || "");
  }, []);
  if (token === null) return <div className="min-h-screen bg-[#eef1f6]" />;
  return <CargaDocumentosCandidato api="/api/evaluacion-candidatos/documentos/publico" token={token} />;
}
