export type SwitchState = "si" | "no" | null;
export const SECCIONES: { key: string; titulo: string; puntos: string[] }[] = [
{
key: "cabina",
titulo: "Inspección completa",
puntos: [
"Limpieza de la unidad",
"Asientos en buen estado",
"Espejos completos",
"Vidrios en buen estado",
"Funcionamiento del aire acondicionado",
"Revisión de placas",
"Pintura",
"Estado de la caja de carga",
],
},
{
key: "adicionales",
titulo: "Adicionales de la unidad",
puntos: [
"Gato hidráulico",
"Extintor vigente",
"Botiquín",
"Triángulos de seguridad",
"Llanta de refacción",
"Diablo o carro de carga",
"Llave para birlos",
"Gatas / Barras de seguridad",
],
},
{
key: "documentacion",
titulo: "Documentación",
puntos: [
"Tarjeta de circulación",
"Póliza de seguro vigente",
"Verificación vigente",
],
},
];
export const TOTAL_PUNTOS = SECCIONES.reduce(
(acc, s) => acc + s.puntos.length,
0
);
export const NIVELES_LABELS: { key: string; label: string }[] = [
{ key: "aceite", label: "Nivel de aceite" },
{ key: "frenos", label: "Nivel de líquido de frenos" },
{ key: "direccion", label: "Nivel de fluido de dirección" },
{ key: "anticongelante", label: "Nivel de anticongelante" },
{ key: "limpiaparabrisas", label: "Agua limpiaparabrisas" },
];
export const NIVEL_OPCIONES = ["1/4", "1/2", "3/4", "LLENO"];

// Opciones de respuesta personalizadas (positiva/negativa) para cada punto de "Inspección completa".
// El valor "si" corresponde a la opción positiva y "no" a la opción negativa.
export const OPCIONES_CABINA: Record<string, [string, string]> = {
"Limpieza de la unidad": ["La unidad se encuentra limpia", "La unidad se encuentra sucia"],
"Asientos en buen estado": ["Asientos en buen estado", "Asientos en mal estado"],
"Espejos completos": ["Espejos en buen estado", "Daño en espejos"],
"Vidrios en buen estado": ["Vidrios sin detalles", "Se detecta un vidrio roto"],
"Funcionamiento del aire acondicionado": ["El aire acondicionado funciona bien", "El aire acondicionado no funciona"],
"Revisión de placas": ["La placa está bien asegurada", "La placa necesita ser asegurada mejor"],
"Pintura": ["Pintura en buen estado", "Se detecta detalle en pintura"],
"Estado de la caja de carga": ["La caja de carga está en buen estado", "Se detecta un detalle en la caja de carga"],
};
