// Permisos por rol: qué secciones del sistema puede ver cada rol.
// Este archivo NO toca la base de datos (lo usa el middleware, que corre en Edge).
// La configuración editable vive en la tabla roles_permisos (ver permisosDB.ts) y viaja dentro del token de sesión.
//
// Reglas:
// - sysadmin: siempre ve todo (no se puede restringir).
// - Gestión de usuarios (/admin, /api/auth/usuarios, registro, password, roles): exclusivo del sysadmin.
// - supervisor_tms: además de sus secciones, sigue siendo de solo lectura (eso lo aplica el middleware).
// - secciones = null significa "sin restricción" (todas las secciones).

export type SeccionSistema = {
  clave: string;
  titulo: string;
  descripcion: string;
  paginas: string[]; // prefijos de página; "=" al inicio = solo esa ruta exacta
  apis: string[]; // prefijos de API que esas páginas necesitan
};

export const SECCIONES_SISTEMA: SeccionSistema[] = [
  { clave: "unidades", titulo: "Unidades", descripcion: "Catálogo de unidades y revisiones de aceite", paginas: ["/unidades"], apis: ["/api/unidades"] },
  {
    clave: "mantenimiento",
    titulo: "Mantenimiento y fallas",
    descripcion: "Cambios de aceite y reportes de falla",
    paginas: ["/ordenes-servicio", "/reportar-falla"],
    apis: ["/api/unidades", "/api/cambios-aceite", "/api/historial-mantenimientos", "/api/operadores", "/api/revision-semanal"],
  },
  {
    clave: "expedientes",
    titulo: "Expedientes",
    descripcion: "Expedientes del personal",
    paginas: ["/personas/expedientes"],
    apis: [
      "/api/expedientes",
      "/api/capacitaciones/ultimas-por-nombre",
      "/api/capacitaciones/por-persona",
      "/api/capacitaciones/catalogo/list",
      "/api/asistencia-diaria",
      "/api/cuadro-basico",
      "/api/areas-personal",
    ],
  },
  { clave: "organigrama", titulo: "Organigrama", descripcion: "Estructura de puestos", paginas: ["/personas/organigrama"], apis: ["/api/organigrama", "/api/expedientes"] },
  {
    clave: "recursos_humanos",
    titulo: "Recursos Humanos (resto)",
    descripcion: "Capacitaciones, uniformes, mochilas, candidatos y documentos de RH",
    paginas: [
      "=/personas",
      "/personas/capacitaciones",
      "/personas/uniformes",
      "/personas/mochilas-covid",
      "/personas/evaluaciones-candidatos",
      "/personas/evaluacion-candidatos",
      "/personas/documentos",
      "/auditoria-mochila-covid",
    ],
    apis: ["/api/capacitaciones", "/api/uniformes", "/api/mochilas", "/api/operadores", "/api/evaluacion-candidatos", "/api/rh-documentos", "/api/expedientes", "/api/areas-personal", "/api/cuadro-basico"],
  },
  { clave: "nomina", titulo: "Nómina", descripcion: "Semanas, recibos y dashboard de nómina", paginas: ["/personas/nomina"], apis: ["/api/nomina", "/api/asistencia", "/api/expedientes"] },
  { clave: "asistencia", titulo: "Asistencia", descripcion: "Registro por QR, vacaciones, permisos y faltas", paginas: ["/asistencia"], apis: ["/api/asistencia", "/api/asistencia-diaria", "/api/expedientes"] },
  {
    clave: "viajes",
    titulo: "Control de Viajes",
    descripcion: "Calendario, gastos, rutas y monitoreo de viajes",
    paginas: ["/control-viajes", "/rutas", "/monitoreo-viajes", "/catalogos-ruta"],
    apis: ["/api/control-viajes", "/api/viajes-calendario", "/api/viajes", "/api/rutas", "/api/catalogos-ruta", "/api/operadores"],
  },
  { clave: "monitoreo_rutas", titulo: "Monitoreo de Rutas", descripcion: "Tablero de planeación y programa de cargas", paginas: ["/planeacion-cargas"], apis: ["/api/planeacion-cargas"] },
  { clave: "plan_trabajo", titulo: "Plan de trabajo", descripcion: "Tareas y seguimiento (Gantt)", paginas: ["/plan-trabajo"], apis: ["/api/gantt", "/api/tareas"] },
  { clave: "scanner", titulo: "Logis SCANNER", descripcion: "Escáner de códigos", paginas: ["/scanner"], apis: ["/api/scanner"] },
  { clave: "compras", titulo: "Compras", descripcion: "Requisiciones y comparativos", paginas: ["/compras", "/comparativo"], apis: ["/api/compras", "/api/comparativos"] },
  { clave: "inventario", titulo: "Control de inventario", descripcion: "Equipos, mobiliario y QR", paginas: ["/inventario"], apis: ["/api/inventario"] },
  { clave: "buzon", titulo: "Buzón de sugerencias", descripcion: "Ideas y sugerencias del equipo", paginas: ["/buzon-sugerencias"], apis: ["/api/buzon-sugerencias"] },
  { clave: "menu_dia", titulo: "Menú del día", descripcion: "Pedidos de comida", paginas: ["/menu-dia"], apis: ["/api/menu-dia"] },
  { clave: "notas", titulo: "Notas", descripcion: "Notas personales (solo si se activa en el rol)", paginas: ["/notas"], apis: ["/api/notas"] },
];

// Secciones que NO se incluyen con "todas las secciones" (null): el rol debe tenerlas marcadas explícitamente.
export const SECCIONES_EXPLICITAS = ["notas"];

export const CLAVES_SECCIONES = SECCIONES_SISTEMA.map((s) => s.clave);

// Rutas que cualquier usuario con sesión puede usar sin importar sus secciones.
const API_COMUNES = [
  "/api/auth/sesion",
  "/api/auth/logout",
  "/api/auth/perfil",
  "/api/favoritos",
  "/api/notificaciones",
  "/api/sistema",
  "/api/actividad",
  "/api/personalizacion",
];

// Exclusivo del sysadmin (rol principal).
export const PREFIJOS_SOLO_SYSADMIN = ["/admin", "/api/auth/usuarios", "/api/auth/registro", "/api/auth/password", "/api/auth/roles"];

export const ROLES_SISTEMA: { rol: string; etiqueta: string; descripcion: string }[] = [
  { rol: "sysadmin", etiqueta: "Sysadmin", descripcion: "Acceso total. Único rol con Gestión de usuarios." },
  { rol: "personal", etiqueta: "Personal", descripcion: "Usuarios generados desde Expedientes. Pueden editar en sus secciones." },
  { rol: "supervisor_tms", etiqueta: "Supervisor TMS", descripcion: "Solo consulta. En Expedientes solo ve la cuenta TMS." },
];

// Secciones por defecto (antes de que el sysadmin las edite). Replican el acceso que ya existía.
export const SECCIONES_DEFAULT: Record<string, string[] | null> = {
  sysadmin: null,
  personal: null,
  supervisor_tms: ["unidades", "expedientes", "organigrama"],
};

// Roles creados por el sysadmin sin configuración: sin secciones (nunca acceso total por omisión).
export function seccionesPorDefecto(rol: string): string[] | null {
  return rol in SECCIONES_DEFAULT ? SECCIONES_DEFAULT[rol] : [];
}

function coincide(pathname: string, prefijo: string): boolean {
  if (prefijo.startsWith("=")) return pathname === prefijo.slice(1);
  return pathname === prefijo || pathname.startsWith(prefijo + "/");
}

export function esSoloSysadmin(pathname: string): boolean {
  return PREFIJOS_SOLO_SYSADMIN.some((p) => coincide(pathname, p));
}

// ¿Puede este rol (con estas secciones) entrar a la ruta? (página o API)
export function rutaPermitida(pathname: string, rol: string, secciones: string[] | null | undefined): boolean {
  if (rol === "sysadmin") return true;
  if (esSoloSysadmin(pathname)) return false;
  const lista = secciones === undefined ? seccionesPorDefecto(rol) : secciones;
  if (pathname === "/" || pathname === "/sitio" || pathname.startsWith("/modulo/")) return true;
  const esApi = pathname.startsWith("/api/");
  if (esApi && API_COMUNES.some((p) => coincide(pathname, p))) return true;
  const ruta = (s: SeccionSistema) => (esApi ? s.apis : s.paginas).some((p) => coincide(pathname, p));
  // Rutas de secciones explícitas: solo si el rol las tiene marcadas.
  const explicita = SECCIONES_SISTEMA.find((s) => SECCIONES_EXPLICITAS.includes(s.clave) && ruta(s));
  if (explicita) return Array.isArray(lista) && lista.includes(explicita.clave);
  if (lista === null) return true;
  return SECCIONES_SISTEMA.some((s) => lista.includes(s.clave) && ruta(s));
}

// Para el inicio y el buscador: ¿mostrar el acceso a esta sección?
export function puedeVerSeccion(clave: string, rol: string | undefined, secciones: string[] | null | undefined): boolean {
  if (!rol) return false;
  if (rol === "sysadmin") return true;
  const lista = secciones === undefined ? seccionesPorDefecto(rol) : secciones;
  if (SECCIONES_EXPLICITAS.includes(clave)) return Array.isArray(lista) && lista.includes(clave);
  return lista === null || lista.includes(clave);
}

export function normalizarSecciones(valor: unknown): string[] | null {
  if (valor === null) return null;
  if (!Array.isArray(valor)) return null;
  return CLAVES_SECCIONES.filter((c) => valor.includes(c));
}
