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
"Placa delantera asegurada",
"Placa trasera asegurada",
"Pintura, limpieza y estado de la caja de carga",
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
key: "general",
titulo: "Inspección general",
puntos: [
"Fugas de aceite",
"Fugas de líquido de frenos",
"Fugas de refrigerante",
"Estado de la carrocería",
"Luces delanteras",
"Luces traseras",
"Luces direccionales",
"Luces intermitentes",
"Frenos de servicio",
"Freno de motor",
"Suspensión",
"Sistema de dirección",
"Batería y terminales",
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
{
key: "comandos",
titulo: "Funcionamiento de comandos",
puntos: [
"Accesorios",
"Paro de motor",
"Habilitado de motor",
"Apertura de chapa",
"Cierre de chapa",
"Activación de sirena",
"Puertas segura",
"Voz en cabina",
"Rotochamber",
],
},
{
key: "acceso",
titulo: "Accesorios",
puntos: [
"Botón de pánico izq",
"Botón de pánico der",
"1° chapa",
"2° chapa",
"3° chapa",
"Puerta segura operador",
"Puerta segura copiloto",
"Sirenas",
"Luces intermitentes",
"Sensor de puerta operador",
"Sensor de puerta copiloto",
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
