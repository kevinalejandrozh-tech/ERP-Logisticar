// Catálogo de la Evaluación de Candidatos (Personas → Evaluación Candidatos).
// Este archivo se usa en el navegador: NO contiene la clave de puntajes.
// La clave vive en evaluacionCandidatosPuntaje.ts y solo la importa el API.

export type PreguntaOpcion = { id: string; texto: string; opciones: string[] };

// Categorías del perfil (sección "Tu día a día") y temas de conocimiento (sección "Rutas y experiencia").
export const CATEGORIAS_ESTRATEGICAS: Record<string, string[]> = {
  "Adaptabilidad": ["e1", "e12", "e15"],
  "Disponibilidad": ["e3", "e4", "e5"],
  "Servicio y conflictos": ["e6", "e9", "e10"],
  "Integridad ante autoridades": ["e7", "e8"],
  "Seguridad en ruta": ["e11", "e14"],
  "Salud y cumplimiento": ["e16", "e17"],
};
export const TEMAS_CONOCIMIENTO: Record<string, string[]> = {
  "Rutas": ["c1", "c2", "c3", "c4", "c5", "c7"],
  "Casetas y normativa": ["c6", "c8"],
  "Manejo defensivo": ["c9", "c10"],
};

// 15 preguntas de perfil, redactadas como situaciones cotidianas (todas las opciones suenan razonables).
export const PREGUNTAS_ESTRATEGICAS: PreguntaOpcion[] = [
  {
    id: "e1",
    texto: "Imagina que llegas a una empresa donde varias cosas todavía se están acomodando (procesos, instalaciones, herramientas). ¿Qué es lo primero que harías?",
    opciones: [
      "Observar cómo se trabaja y proponer mejoras cuando conozca bien la operación.",
      "Esperar a que me expliquen todo antes de hacer cualquier cosa.",
      "Trabajar como lo hacía en mis empleos anteriores.",
      "Comparar con otras empresas para ver si me conviene quedarme.",
    ],
  },
  {
    id: "e3",
    texto: "Un día normal de trabajo en el transporte, ¿cómo te lo imaginas?",
    opciones: [
      "Con un horario definido y regresando a casa a la misma hora.",
      "Cada día distinto: a veces salidas temprano, esperas largas o regresos tarde.",
      "Variable, aunque prefiero conocer mi horario con un día de anticipación.",
      "Variable entre semana y libre los fines de semana.",
    ],
  },
  {
    id: "e4",
    texto: "Cuando un viaje se alarga (por ejemplo a Chihuahua o Monterrey) y hay que pasar varios días fuera, ¿qué suele pasar en tu casa?",
    opciones: [
      "Mi familia está acostumbrada; ya tenemos todo organizado.",
      "Lo platico con mi familia antes de cada viaje y nos organizamos.",
      "Me cuesta un poco, porque en casa dependen de que yo esté diario.",
      "Prefiero los viajes cortos o locales.",
    ],
  },
  {
    id: "e5",
    texto: "¿Cómo te organizas con los fines de semana y días festivos?",
    opciones: [
      "Los reservo para la familia, salvo alguna emergencia.",
      "Me gusta que se roten entre compañeros para que sea parejo.",
      "Si la operación lo necesita, cuentan conmigo.",
      "Prefiero verlo en su momento, sin comprometerme de antemano.",
    ],
  },
  {
    id: "e6",
    texto: "Llegas a descargar y el cliente está molesto porque el embarque se retrasó por un bloqueo. ¿Qué es lo más natural para ti?",
    opciones: [
      "Explicarle que el bloqueo no dependió de mí para que lo entienda.",
      "Dejar que se desahogue, darle la información del retraso y avisar a mi coordinador.",
      "Pedirle que lo hable directamente con la oficina.",
      "Mantenerme al margen y esperar a que descarguen.",
    ],
  },
  {
    id: "e7",
    texto: "En una revisión de rutina, un agente te indica que “hay un detalle” con tu unidad. ¿Cómo sueles manejar estas situaciones?",
    opciones: [
      "Trato de resolverlo rápido ahí mismo para no retrasar la entrega.",
      "Muestro la documentación con calma, aviso a monitoreo y, si hay infracción, pido la boleta.",
      "Le pido que me explique y, si no me convence, le digo que conozco mis derechos.",
      "Llamo a mi jefe para que él hable con el agente.",
    ],
  },
  {
    id: "e8",
    texto: "Un compañero te comenta que en cierto tramo “ya todos saben” que conviene dar una cooperación para pasar sin revisión. ¿Qué piensas?",
    opciones: [
      "Si así se acostumbra en ese tramo, es mejor no complicarse.",
      "Depende de la cantidad y de qué tan urgente sea la entrega.",
      "Prefiero apegarme a la documentación y reportar si me piden algo fuera de lugar.",
      "Le preguntaría a la empresa si tiene un apoyo para esos casos.",
    ],
  },
  {
    id: "e9",
    texto: "En la entrega, el cliente te pide dejar parte de la mercancía en otra bodega cercana “porque ya lo acordó con tu empresa”. ¿Qué haces?",
    opciones: [
      "Lo hago, ya que el cliente dice que está acordado.",
      "Confirmo con mi coordinador o monitoreo antes de mover cualquier cosa.",
      "Le pido que me lo firme en la remisión y lo hago.",
      "Me niego y sigo exactamente lo que dice mi documento.",
    ],
  },
  {
    id: "e10",
    texto: "Si no estás de acuerdo con tu supervisor sobre cómo hacer un viaje, normalmente…",
    opciones: [
      "Hago lo que me dice aunque no esté de acuerdo, para evitar problemas.",
      "Le doy mi punto de vista con respeto y al final respeto la decisión.",
      "Lo hago a mi manera si sé que funciona mejor.",
      "Lo comento con mis compañeros para ver qué opinan.",
    ],
  },
  {
    id: "e11",
    texto: "Vas de noche por un tramo solitario y un vehículo sin identificación te hace señas para que te detengas. ¿Qué harías?",
    opciones: [
      "Me detengo con precaución para ver qué necesitan.",
      "No me detengo, aviso de inmediato a monitoreo y sigo hasta un punto seguro.",
      "Bajo la velocidad para ver si es alguna autoridad.",
      "Me orillo más adelante, en un lugar iluminado, y ahí veo qué necesitan.",
    ],
  },
  {
    id: "e12",
    texto: "Si un día te piden apoyar en algo fuera de tu puesto (acomodar mercancía, apoyar en patio, etc.), ¿cómo lo ves?",
    opciones: [
      "Está bien si es algo ocasional.",
      "Lo veo como una oportunidad de conocer más la operación.",
      "Prefiero enfocarme en aquello para lo que me contrataron.",
      "Lo hago si se considera en mi pago.",
    ],
  },
  {
    id: "e14",
    texto: "Durante un viaje, ¿con qué frecuencia te comunicas con tu base o monitoreo?",
    opciones: [
      "Cuando me llaman o si pasa algo importante.",
      "Al salir, en cada parada, ante cualquier cambio y al llegar.",
      "Solo al salir y al llegar, para no distraerme.",
      "Prefiero manejar concentrado y reportar al final.",
    ],
  },
  {
    id: "e15",
    texto: "¿Qué te haría quedarte muchos años en una empresa?",
    opciones: [
      "Un buen sueldo, aunque el ambiente no sea el mejor.",
      "Poder crecer, aprender y tener estabilidad.",
      "Tener horarios cómodos.",
      "Que haya poca supervisión.",
    ],
  },
  {
    id: "e16",
    texto: "Como parte del proceso, la empresa cubre sin costo para ti un examen médico y una prueba antidoping. ¿Qué opinas de este tipo de exámenes?",
    opciones: [
      "Está bien, siempre que los hagan en el laboratorio que yo elija.",
      "Me parecen normales en el transporte; los presento cuando me indiquen.",
      "Preferiría que me avisaran con unos días de anticipación.",
      "No creo que sean necesarios si ya tengo experiencia.",
    ],
  },
  {
    id: "e17",
    texto: "Pensando en los próximos meses, ¿hay algo que te pudiera pedir ausentarte o limitar tus viajes?",
    opciones: [
      "Tengo un asunto por el que debo presentarme periódicamente ante una autoridad.",
      "Tengo algún trámite o cita que puedo acomodar sin afectar mis viajes.",
      "Prefiero platicarlo en persona.",
      "No, estoy en condiciones de viajar sin pendientes.",
    ],
  },
];

// 10 preguntas de nivel alto: rutas principales (Guadalajara, Monterrey, Chihuahua y locales), casetas, normativa y manejo defensivo.
export const PREGUNTAS_CONOCIMIENTO: PreguntaOpcion[] = [
  {
    id: "c1",
    texto: "Rumbo a Monterrey por la carretera 57, después de salir de Querétaro, ¿en qué orden vas pasando por estas ciudades?",
    opciones: [
      "San Juan del Río → Aguascalientes → Zacatecas → Saltillo",
      "San Luis Potosí → Matehuala → Saltillo",
      "Celaya → León → Zacatecas → Saltillo",
      "San Luis Potosí → Zacatecas → Torreón → Saltillo",
    ],
  },
  {
    id: "c2",
    texto: "Para el tramo final Saltillo–Monterrey, ¿qué autopista de cuota se utiliza?",
    opciones: ["57D", "85D", "40D", "45D"],
  },
  {
    id: "c3",
    texto: "Vas a Chihuahua y ya pasaste Torreón / Gómez Palacio. ¿Por cuáles ciudades cruzas antes de llegar?",
    opciones: ["Durango y Parral", "Saltillo y Monclova", "Cuauhtémoc y Madera", "Jiménez y Delicias"],
  },
  {
    id: "c4",
    texto: "La Autopista de Occidente rumbo a Guadalajara que inicia en Maravatío, Michoacán, ¿en qué punto de Jalisco termina, ya cerca de Guadalajara?",
    opciones: ["Zapotlanejo", "Lagos de Moreno", "Tepatitlán", "Ocotlán"],
  },
  {
    id: "c5",
    texto: "Saliendo del norte del Valle de México hacia Guadalajara, ¿qué autopista te permite llegar a la zona de Atlacomulco sin cruzar Toluca?",
    opciones: ["Circuito Exterior Mexiquense", "Arco Norte", "Autopista México–Pachuca", "Autopista Chamapa–Lechería"],
  },
  {
    id: "c6",
    texto: "Si entras a la México–Querétaro desde Cuautitlán Izcalli rumbo al norte, ¿cuál es la primera caseta de cobro?",
    opciones: ["Palmillas", "Polotitlán", "Tepotzotlán", "Jorobas"],
  },
  {
    id: "c7",
    texto: "Dentro de la zona metropolitana, ¿qué vía conecta la México–Querétaro (a la altura de Cuautitlán) con la México–Puebla por el lado mexiquense, sin entrar a la CDMX?",
    opciones: ["Circuito Exterior Mexiquense", "Periférico Norte", "Viaducto Bicentenario", "Autopista Chamapa–Lechería"],
  },
  {
    id: "c8",
    texto: "¿Qué norma oficial mexicana establece los tiempos de conducción y pausas para los conductores del autotransporte federal?",
    opciones: ["NOM-012-SCT-2", "NOM-068-SCT-2", "NOM-035-STPS", "NOM-087-SCT-2"],
  },
  {
    id: "c9",
    texto: "¿En qué situación es más probable que un tractocamión haga “tijera” (jackknife)?",
    opciones: [
      "Al frenar bruscamente en curva o piso mojado con el remolque vacío o poco cargado.",
      "Al circular cargado a velocidad constante en una recta.",
      "Al subir una pendiente en una velocidad baja.",
      "Al usar el freno de motor en piso seco con el remolque bien cargado.",
    ],
  },
  {
    id: "c10",
    texto: "Antes de bajar una pendiente larga y pronunciada con carga, ¿qué regla es la correcta?",
    opciones: [
      "Bajar en neutral y controlar la velocidad con el freno de servicio.",
      "Bajar en la misma velocidad (marcha) con la que subirías, o una menor, apoyándote en el freno de motor.",
      "Bajar en una marcha alta y frenar fuerte solo al final.",
      "Bajar en la marcha que traes y usar el freno de mano si los frenos se calientan.",
    ],
  },
];

export const OPCIONES_VIVIENDA = ["Rento", "Es propia", "Vivo con un familiar / en casa de un familiar", "Otra"];
export const OPCIONES_TIEMPO = ["Menos de 6 meses", "De 6 meses a 1 año", "De 1 a 3 años", "De 3 a 5 años", "Más de 5 años"];
export const OPCIONES_TRANSPORTE = ["Automóvil", "Motocicleta", "Bicicleta", "Transporte público", "Otro"];
export const OPCIONES_ESTADO_CIVIL = ["Soltero(a)", "Casado(a)", "Unión libre", "Divorciado(a) / separado(a)", "Viudo(a)"];
export const OPCIONES_LICENCIA = [
  "Federal tipo B",
  "Federal tipo C",
  "Federal tipo E",
  "Federal tipo A",
  "Estatal de chofer / carga",
  "Automovilista",
  "No tengo licencia",
];
export const OPCIONES_UNIDAD = ["Tractocamión full", "Tractocamión sencillo", "Torton", "Rabón", "Camioneta 3.5 t", "Otra"];
export const OPCIONES_RUTAS = ["Guadalajara", "Monterrey", "Chihuahua", "Locales (Valle de México)", "Otras"];
export const OPCIONES_EMPLEOS = ["1", "2", "3", "4 o más"];
export const OPCIONES_PSICOFISICO = ["Sí, vigente", "En trámite", "No / vencido"];

// Umbrales del dictamen automático (porcentaje mínimo en cada sección).
export const UMBRAL_ESTRATEGICO = 70;
export const UMBRAL_CONOCIMIENTO = 60;

// Video de inducción de la empresa: se sube y se descarga en partes para respetar el límite de Vercel.
export const VIDEO_MAX_BYTES = 40 * 1024 * 1024; // 40 MB
export const VIDEO_TAM_PARTE = 3_000_000; // caracteres base64 por parte (~2.2 MB)
