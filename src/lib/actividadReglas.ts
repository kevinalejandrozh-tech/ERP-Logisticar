// APIs que NO generan notificaciones a otros usuarios: lecturas disfrazadas de POST (marcar "visto"),
// organización personal (orden, carpetas, favoritos, preferencias) y mensajería (tiene su propio aviso).
// Solo deben notificar los movimientos que cargan, cambian o eliminan datos de trabajo.
export const PREFIJOS_SIN_NOTIFICACION = [
  "/api/auth/",
  "/api/actividad",
  "/api/notificaciones",
  "/api/favoritos",
  "/api/sistema/",
  "/api/chat",
  "/api/buzon-sugerencias/pendientes",
  "/api/notas", // notas personales: tienen sus propios avisos dirigidos (compartidas/ediciones), no un aviso general a todos
  "/api/informe-general/asistencia",
];
export const sinNotificacion = (api: string) => PREFIJOS_SIN_NOTIFICACION.some((p) => api.startsWith(p));
