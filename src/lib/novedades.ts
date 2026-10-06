// Resumen de cada actualización del sistema. Se agrega una entrada NUEVA (arriba) en cada publicación:
// llega a todos los usuarios como notificación con el detalle de los cambios.
export type Novedad = { id: string; fecha: string; titulo: string; resumen: string; detalles: string[] };

export const NOVEDADES: Novedad[] = [
  {
    id: "2026-10-06-compras-2",
    fecha: "2026-10-06T03:07:00-06:00",
    titulo: "Compras: título, envío, pago y dispersión, imprimir, recibir y eliminar folios",
    resumen: "La OC ya lleva título; quien autoriza define medio de pago y dispersión y puede ajustar viáticos y gasolina; desde el historial se imprime, se recibe en almacén y se eliminan folios.",
    detalles: [
      "Nuevo campo Título de la compra (se ve en el historial, el detalle, el aviso de autorización y el PDF).",
      "Orden de la ruta de proveedores: casilla Envío para marcar al proveedor que envía el pedido (no cuenta como parada en el PDF).",
      "Aviso de autorización: al pulsar Revisar por artículo, el globo se contrae; al autorizar se elige medio de pago y dispersión de recursos.",
      "Quien autoriza puede agregar, editar o quitar viáticos y combustible antes de autorizar, y define medio de pago y dispersión (salen en el PDF).",
      "Historial: botón Imprimir después del folio (OC autorizadas), botón RECIBIR al final de cada fila (abre la entrada y ubicación de almacenamiento) y opción de eliminar folios.",
      "El Total del historial y de la gráfica ahora suma artículos + combustible + viáticos.",
    ],
  },
  {
    id: "2026-10-06-compras",
    fecha: "2026-10-06T01:17:00-06:00",
    titulo: "Mejoras en Compras: fotos de referencia, autorización al instante y gráficas",
    resumen: "La orden de compra ahora lleva foto de referencia, avisa de inmediato a quien autoriza y tiene gráficas de compras por día.",
    detalles: [
      "Referencia: se puede tomar o insertar una foto por artículo; se ve en el detalle y en el PDF.",
      "Vehículo, consumo, combustible, regreso, viáticos y justificación quedan ocultos tras el botón Más detalles.",
      "Se quitó Compra única: el proveedor ya no es obligatorio.",
      "Al pulsar Solicitar autorización, quien autoriza recibe un globo junto a las notificaciones que no se quita hasta Autorizar o Rechazar la orden.",
      "La página de Compras pide confirmación al retroceder, actualizar o salir.",
      "Historial: botón azul más pequeño, columna Referencia después del folio y nuevo botón Ver gráficas (líneas y puntos por día con el total de compras).",
      "PDF de la OC: encabezados en azul fuerte con letra blanca, imagen del proveedor 40 % más grande con sangría de 2 espacios.",
    ],
  },
  {
    id: "2026-10-06-informe-chat-notas",
    fecha: "2026-10-05T20:41:00-06:00",
    titulo: "Mejoras: Informe General, Mensajes, Notas y Calendario de viajes",
    resumen: "Nuevo Informe General diario, chat entre usuarios, notificaciones más claras y mejoras en Notas y Calendario de viajes.",
    detalles: [
      "Nueva página Informe General: asistencia del día, reporte de monitoreo, control de tarjetas/radios/mochilas, incidencias y liquidación de viajes (un informe por día con historial).",
      "Nuevo chat de Mensajes (icono debajo de la casita): grupo general y conversaciones 1 a 1 con aviso al instante.",
      "Notificaciones: ahora se puede abrir cada una para ver el detalle, borrar todo y elegir cuántas se conservan. Ya no avisan cuando alguien solo consulta, y las notas personales ya no generan avisos a todos (solo a quien las comparte).",
      "Aviso en pantalla cuando se está actualizando el sistema.",
      "Notas: la casilla se queda activa y agrega una casilla en cada renglón (doble Enter la desactiva), clic en toda la nota para abrirla y minimizar una o todas.",
      "Inicio: arrastra los botones para ordenarlos; los accesos directos se despliegan al pulsar su título; se agregan desde el título de cada página.",
      "Calendario de viajes: barra tipo Gantt hasta el término estimado, cuentas desde catálogo de clientes, campos N/A, tipo de unidad por catálogo de casetas y botón Marcar hora en Seguimiento.",
    ],
  },
];
