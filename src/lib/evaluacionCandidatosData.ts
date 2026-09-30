// Catálogo de preguntas de la Evaluación de Candidatos (Personas → Evaluación Candidatos).
// Este archivo se usa en el navegador: NO contiene la clave de puntajes.
// La clave vive en evaluacionCandidatosPuntaje.ts y solo la importa el API.

export type PreguntaOpcion = { id: string; texto: string; opciones: string[] };

// Sección 2 — 15 preguntas estratégicas: disposición a condiciones de una empresa en crecimiento,
// disponibilidad propia del transporte, resolución de conflictos y negociación con autoridades y clientes.
export const PREGUNTAS_ESTRATEGICAS: PreguntaOpcion[] = [
  {
    id: "e1",
    texto: "Somos una empresa en crecimiento: todavía estamos ordenando procesos, instalaciones y herramientas. ¿Cómo te sentirías trabajando aquí?",
    opciones: [
      "Preferiría una empresa donde todo ya esté bien establecido.",
      "Me motiva; me gustaría aportar ideas para que las cosas mejoren.",
      "Me adapto, siempre que mis condiciones básicas se respeten.",
      "Me costaría trabajo, pero lo intentaría.",
    ],
  },
  {
    id: "e2",
    texto: "Si un día la unidad o el equipo asignado no está en las mejores condiciones (pero es seguro), ¿qué harías?",
    opciones: [
      "No salgo hasta que me den otra unidad.",
      "Salgo sin decir nada; así son las cosas.",
      "Reporto los detalles por escrito, confirmo que sea segura y cumplo con el servicio.",
      "Me quejo con mis compañeros.",
    ],
  },
  {
    id: "e3",
    texto: "En el transporte los horarios pueden cambiar sin aviso (salidas de madrugada, esperas largas en carga o descarga). ¿Cuál es tu disponibilidad?",
    opciones: [
      "Tengo disponibilidad total y entiendo que es parte del trabajo.",
      "Solo puedo trabajar en horario fijo de oficina.",
      "Tengo disponibilidad la mayoría de las veces, avisándome con tiempo.",
      "Depende de cómo me sienta ese día.",
    ],
  },
  {
    id: "e4",
    texto: "¿Puedes estar varios días fuera de casa cuando la operación lo requiera?",
    opciones: [
      "No, necesito regresar a casa todos los días.",
      "Sí, sin problema; ya tengo organizada a mi familia para eso.",
      "Solo una o dos noches como máximo.",
      "Sí, siempre que se me avise con anticipación.",
    ],
  },
  {
    id: "e5",
    texto: "¿Tienes disponibilidad para trabajar fines de semana y días festivos?",
    opciones: [
      "Sí, cuando la operación lo necesite.",
      "Sí, de vez en cuando y rolando con los compañeros.",
      "No, esos días son solo para mí.",
      "Solo si me pagan el triple.",
    ],
  },
  {
    id: "e6",
    texto: "Un cliente te recibe molesto porque la carga llegó tarde por causas que no dependían de ti. ¿Qué haces?",
    opciones: [
      "Le explico que no es mi culpa y me retiro.",
      "Discuto con él para defender mi trabajo.",
      "Lo escucho con calma, le explico brevemente lo ocurrido y aviso a mi jefe o a monitoreo.",
      "Lo ignoro y espero a que descarguen.",
    ],
  },
  {
    id: "e7",
    texto: "Una autoridad (policía o tránsito) te detiene en carretera. ¿Cuál es la forma correcta de actuar?",
    opciones: [
      "Me pongo nervioso y trato de irme lo antes posible.",
      "Le ofrezco dinero para evitar problemas.",
      "Discuto porque sé que no hice nada malo.",
      "Mantengo la calma y el respeto, muestro mis documentos, aviso a monitoreo y pido que se detalle por escrito cualquier infracción.",
    ],
  },
  {
    id: "e8",
    texto: "Si una autoridad te pide dinero de forma indebida, ¿qué harías?",
    opciones: [
      "Pago para no perder tiempo.",
      "Me niego con respeto, solicito la boleta oficial, reporto a monitoreo y registro los datos de la unidad o del agente.",
      "Me enojo y lo grabo mientras le grito.",
      "Le llamo a un conocido para que me ayude.",
    ],
  },
  {
    id: "e9",
    texto: "El cliente te pide descargar en un lugar distinto al indicado en tu documentación. ¿Qué haces?",
    opciones: [
      "Lo hago para que el cliente quede contento.",
      "Me niego y me retiro sin avisar.",
      "Lo consulto con mi jefe o con monitoreo antes de hacer cualquier cambio.",
      "Le cobro algo extra al cliente y lo hago.",
    ],
  },
  {
    id: "e10",
    texto: "Tienes un desacuerdo con un compañero o con tu supervisor. ¿Cómo lo resuelves?",
    opciones: [
      "Hablo con la persona de forma directa y respetuosa para llegar a un acuerdo.",
      "Evito a la persona y dejo que pase el tiempo.",
      "Lo comento con los demás compañeros.",
      "Renuncio si no me dan la razón.",
    ],
  },
  {
    id: "e11",
    texto: "¿Qué harías si no sabes cómo resolver un problema en ruta (una falla mecánica, un bloqueo, etc.)?",
    opciones: [
      "Espero a que alguien se dé cuenta.",
      "Intento resolverlo yo solo sin avisar a nadie.",
      "Apago el teléfono hasta que se solucione.",
      "Pongo la unidad en un lugar seguro, reporto de inmediato a monitoreo y sigo sus indicaciones.",
    ],
  },
  {
    id: "e12",
    texto: "Si te piden apoyar en una actividad que no es exactamente la de tu puesto, ¿qué opinas?",
    opciones: [
      "Solo hago lo que dice mi puesto.",
      "Apoyo con gusto; en una empresa en crecimiento todos sumamos.",
      "Apoyo, pero solo si me lo pagan aparte.",
      "Apoyo de vez en cuando, sin que se vuelva costumbre.",
    ],
  },
  {
    id: "e13",
    texto: "Si en algún momento el pago de algún viático o un trámite interno se retrasa unas horas, ¿cómo reaccionas?",
    opciones: [
      "Detengo la unidad hasta que me paguen.",
      "Me comunico con el área correspondiente, doy seguimiento con paciencia y continúo con el servicio.",
      "Lo publico en redes sociales.",
      "Busco otro trabajo de inmediato.",
    ],
  },
  {
    id: "e14",
    texto: "¿Cómo te comunicas con el área de monitoreo durante un viaje?",
    opciones: [
      "Reporto puntualmente salida, paradas, incidencias y llegada, aunque no me lo pidan.",
      "Solo contesto cuando me llaman.",
      "Reporto únicamente si hay un problema grave.",
      "Prefiero no reportar para que no me estén vigilando.",
    ],
  },
  {
    id: "e15",
    texto: "¿Qué es lo más importante para ti al momento de elegir un trabajo?",
    opciones: [
      "Solo el sueldo.",
      "Tener horarios cortos.",
      "Estabilidad, crecimiento y la posibilidad de aprender.",
      "Que no me supervisen.",
    ],
  },
];

// Sección 3 — 10 preguntas de conocimiento: rutas, casetas y manejo defensivo.
export const PREGUNTAS_CONOCIMIENTO: PreguntaOpcion[] = [
  {
    id: "c1",
    texto: "En carretera y con piso seco, ¿qué distancia de seguimiento es la recomendada para un vehículo de carga pesada?",
    opciones: ["1 segundo", "2 segundos", "4 segundos o más (y aumentarla con lluvia o de noche)", "No importa si manejo atento"],
  },
  {
    id: "c2",
    texto: "¿Para qué sirve el TAG (IAVE, Pase, etc.) en una unidad?",
    opciones: [
      "Para localizar la unidad por GPS",
      "Para pagar las casetas de peaje de forma electrónica",
      "Para abrir la caja de la unidad",
      "Para registrar la velocidad",
    ],
  },
  {
    id: "c3",
    texto: "En las casetas de cuota, ¿de qué depende principalmente la tarifa que paga un vehículo de carga?",
    opciones: ["Del color de la unidad", "Del peso de la mercancía", "Del número de ejes", "De la hora del día"],
  },
  {
    id: "c4",
    texto: "¿Cuál es la autopista de cuota principal para ir de la Ciudad de México a Querétaro?",
    opciones: ["Autopista México–Querétaro (57D)", "Autopista México–Puebla (150D)", "Autopista México–Cuernavaca (95D)", "Autopista México–Pachuca (85D)"],
  },
  {
    id: "c5",
    texto: "¿Cuál es la principal ventaja de circular por el Arco Norte?",
    opciones: [
      "Es una carretera libre, sin casetas",
      "Permite evitar el cruce por la zona metropolitana de la Ciudad de México",
      "Es la ruta más corta para ir a Acapulco",
      "Solo pueden circular autos particulares",
    ],
  },
  {
    id: "c6",
    texto: "¿Cuál es la autopista de cuota para ir de la Ciudad de México a Puebla?",
    opciones: ["Autopista México–Querétaro (57D)", "Autopista México–Pachuca (85D)", "Autopista México–Toluca (15D)", "Autopista México–Puebla (150D)"],
  },
  {
    id: "c7",
    texto: "Si encuentras neblina densa en carretera, ¿qué es lo correcto?",
    opciones: [
      "Encender luces altas para ver mejor",
      "Reducir la velocidad, encender luces bajas o antiniebla y aumentar la distancia",
      "Mantener la velocidad para salir rápido de la neblina",
      "Detenerse sobre el carril de circulación",
    ],
  },
  {
    id: "c8",
    texto: "En un tractocamión, ¿de qué lado está el punto ciego más grande?",
    opciones: ["Del lado derecho (lado del copiloto)", "Del lado izquierdo (lado del conductor)", "Justo detrás de la cabina", "No tiene puntos ciegos si se usan espejos"],
  },
  {
    id: "c9",
    texto: "Al bajar una pendiente pronunciada con la unidad cargada, ¿qué es lo correcto?",
    opciones: [
      "Poner neutral para ahorrar combustible",
      "Frenar fuerte y constante solo con el freno de pie",
      "Usar una velocidad baja y el freno de motor, controlando la velocidad antes de bajar",
      "Acelerar para llegar más rápido al final",
    ],
  },
  {
    id: "c10",
    texto: "Si sientes sueño o cansancio mientras manejas, ¿qué debes hacer?",
    opciones: [
      "Tomar bebidas energéticas y seguir",
      "Abrir la ventana y subir el volumen del radio",
      "Manejar más rápido para llegar antes",
      "Detenerte en un lugar seguro, descansar y avisar a monitoreo",
    ],
  },
];

export const OPCIONES_VIVIENDA = ["Rento", "Es propia", "Vivo con un familiar / en casa de un familiar", "Otra"];
export const OPCIONES_TIEMPO = ["Menos de 6 meses", "De 6 meses a 1 año", "De 1 a 3 años", "De 3 a 5 años", "Más de 5 años"];
export const OPCIONES_TRANSPORTE = ["Automóvil", "Motocicleta", "Bicicleta", "Transporte público", "Otro"];

// Umbrales del dictamen automático (porcentaje mínimo en cada sección).
export const UMBRAL_ESTRATEGICO = 70;
export const UMBRAL_CONOCIMIENTO = 60;

// Video opcional: se sube en partes para respetar el límite de tamaño de las funciones de Vercel.
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
export const VIDEO_TAM_PARTE = 3_000_000; // caracteres base64 por parte (~2.2 MB)
