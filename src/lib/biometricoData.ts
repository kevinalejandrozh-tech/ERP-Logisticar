// Reloj checador biométrico (Hikvision, ISAPI) — tipos y catálogos compartidos.

export type BiometricoDispositivo = {
  id: number;
  nombre: string;
  ip: string;
  usuario: string;
  modelo: string | null;
  serie: string | null;
  firmware: string | null;
  activo: boolean;
  ultimo_serial: number;
  ultima_sincronizacion: string | null;
  ultimo_error: string | null;
};

export type ChecadaBiometrica = {
  dispositivo_id: number;
  serial_no: number;
  employee_no: string | null;
  expediente_id: number | null;
  nombre_reloj: string | null;
  fecha_hora: string; // "YYYY-MM-DDTHH:MM:SS" hora local del reloj
  metodo: MetodoChecada;
  minor: number;
  estado_reloj: string | null;
};

export type MetodoChecada = "Rostro" | "Huella" | "Tarjeta" | "Otro";

// Eventos de acceso válidos (major 5) que cuentan como checada.
export const MINOR_CHECADA: Record<number, MetodoChecada> = {
  1: "Tarjeta", // tarjeta válida
  38: "Huella", // huella verificada
  75: "Rostro", // rostro verificado
};

export function metodoDeMinor(minor: number): MetodoChecada {
  return MINOR_CHECADA[minor] || "Otro";
}

// El número de empleado en el reloj es el id del expediente, salvo que el expediente tenga biometrico_id propio.
export function employeeNoDeExpediente(exp: { id: number; biometrico_id?: string | null }): string {
  return (exp.biometrico_id || "").trim() || String(exp.id);
}

// Convierte "2026-10-10T09:57:52-06:00" a hora local "2026-10-10T09:57:52" (el reloj ya está en hora de México).
export function fechaLocalDeEvento(time: string): string {
  return String(time || "").slice(0, 19);
}
