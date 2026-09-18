export type RespuestaDoc = "si" | "no" | null;

export const DOCUMENTOS_CHECK: { key: string; label: string }[] = [
  { key: "poliza", label: "Póliza de seguro vigente" },
  { key: "tarjeta", label: "Tarjeta de circulación" },
  { key: "verificacion", label: "Verificación físico/mecánica vigente" },
];

export const MAX_FOTOS_DOC = 4;

export type DocumentoGuardado = { respuesta: RespuestaDoc; fotos: string[] };
export type DocumentosCheck = Record<string, DocumentoGuardado>;

export type RegistroDocumentacion = {
  folio: string;
  fecha_hora: string;
  eco_unidad: string;
  descripcion_unidad: string;
  placas: string;
  documentos: DocumentosCheck;
};
