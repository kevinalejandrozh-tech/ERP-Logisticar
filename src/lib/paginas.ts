// Catálogo central de páginas internas del sistema.
// Lo usan: el buscador del inicio, las notificaciones (para nombrar la página donde ocurrió un cambio)
// y los favoritos. Al agregar una página nueva, regístrala aquí.

export type PaginaSistema = {
  ruta: string;
  titulo: string;
  seccion: string;
  palabras?: string; // términos extra para el buscador
  supervisor?: boolean; // visible también para el rol supervisor_tms
};

export const PAGINAS_SISTEMA: PaginaSistema[] = [
  { ruta: "/", titulo: "Inicio", seccion: "General", palabras: "menu principal centro de operaciones", supervisor: true },
  { ruta: "/unidades", titulo: "Unidades", seccion: "Unidades", palabras: "flota eco placas camiones parque vehicular", supervisor: true },
  { ruta: "/unidades/revisiones-aceite", titulo: "Revisiones de aceite", seccion: "Unidades", palabras: "aceite mantenimiento", supervisor: true },
  { ruta: "/ordenes-servicio/cambios-aceite", titulo: "Cambios de aceite", seccion: "Unidades", palabras: "ordenes servicio mantenimiento aceite" },
  { ruta: "/reportar-falla", titulo: "Reportar falla", seccion: "Unidades", palabras: "falla taller mecanica" },
  { ruta: "/personas", titulo: "Recursos Humanos", seccion: "Recursos Humanos", palabras: "personas personal rh" },
  { ruta: "/personas/expedientes", titulo: "Expedientes", seccion: "Recursos Humanos", palabras: "personal operadores empleados", supervisor: true },
  { ruta: "/personas/expedientes/detalle", titulo: "Expediente", seccion: "Recursos Humanos", palabras: "detalle personal", supervisor: true },
  { ruta: "/personas/expedientes/asistencia", titulo: "Asistencia diaria", seccion: "Recursos Humanos", palabras: "asistencia faltas retardos" },
  { ruta: "/personas/organigrama", titulo: "Organigrama", seccion: "Recursos Humanos", palabras: "puestos estructura", supervisor: true },
  { ruta: "/personas/capacitaciones", titulo: "Capacitaciones", seccion: "Recursos Humanos", palabras: "cursos evaluaciones examenes" },
  { ruta: "/personas/uniformes", titulo: "Uniformes", seccion: "Recursos Humanos", palabras: "responsiva ropa" },
  { ruta: "/personas/mochilas-covid", titulo: "Mochilas Covid", seccion: "Recursos Humanos", palabras: "covid mochila" },
  { ruta: "/personas/evaluaciones-candidatos", titulo: "Evaluaciones de candidatos", seccion: "Recursos Humanos", palabras: "reclutamiento candidatos psicometrica" },
  { ruta: "/personas/documentos", titulo: "Documentos de RH", seccion: "Recursos Humanos", palabras: "documentos formatos" },
  { ruta: "/personas/nomina", titulo: "Nómina", seccion: "Recursos Humanos", palabras: "nomina sueldos recibos pagos" },
  { ruta: "/personas/nomina/semana", titulo: "Nómina semanal", seccion: "Recursos Humanos", palabras: "nomina captura semana" },
  { ruta: "/personas/nomina/dashboard", titulo: "Dashboard de nómina", seccion: "Recursos Humanos", palabras: "nomina indicadores" },
  { ruta: "/asistencia", titulo: "Asistencia", seccion: "Asistencia", palabras: "qr entradas salidas calendario permisos faltas" },
  { ruta: "/asistencia/vacaciones", titulo: "Vacaciones", seccion: "Asistencia", palabras: "vacaciones descansos" },
  { ruta: "/control-viajes", titulo: "Control de Viajes", seccion: "Viajes", palabras: "viajes viaticos casetas combustible" },
  { ruta: "/control-viajes/calendario", titulo: "Calendario de viajes", seccion: "Viajes", palabras: "calendario viajes" },
  { ruta: "/control-viajes/gastos-totales", titulo: "Gastos totales de viajes", seccion: "Viajes", palabras: "gastos viaticos" },
  { ruta: "/rutas", titulo: "Rutas", seccion: "Viajes", palabras: "rutas destinos bono" },
  { ruta: "/monitoreo-viajes", titulo: "Monitoreo de viajes y rutas", seccion: "Viajes", palabras: "monitoreo gps" },
  { ruta: "/monitoreo-viajes/detalle", titulo: "Detalle de viaje", seccion: "Viajes", palabras: "monitoreo detalle" },
  { ruta: "/planeacion-cargas", titulo: "Planeación y programa de cargas", seccion: "Operación", palabras: "cargas clientes programa tablero" },
  { ruta: "/plan-trabajo", titulo: "Plan de trabajo y seguimiento", seccion: "Operación", palabras: "tareas gantt seguimiento" },
  { ruta: "/scanner", titulo: "Logis SCANNER", seccion: "Operación", palabras: "escaner codigos" },
  { ruta: "/compras", titulo: "Compras", seccion: "Compras", palabras: "requisiciones cotizaciones" },
  { ruta: "/comparativo", titulo: "Generar comparativo", seccion: "Compras", palabras: "comparativo cotizaciones proveedores" },
  { ruta: "/inventario", titulo: "Control de inventario", seccion: "Inventario", palabras: "equipos mobiliario qr" },
  { ruta: "/inventario/categorias", titulo: "Categorías de inventario", seccion: "Inventario", palabras: "categorias" },
  { ruta: "/buzon-sugerencias", titulo: "Buzón de sugerencias", seccion: "General", palabras: "ideas mejora sugerencias" },
  { ruta: "/menu-dia", titulo: "Menú del día", seccion: "General", palabras: "comida pedidos comedor" },
  { ruta: "/auditoria-mochila-covid", titulo: "Auditoría mochila Covid", seccion: "Recursos Humanos", palabras: "auditoria covid" },
  { ruta: "/admin/usuarios", titulo: "Gestión de usuarios", seccion: "Administración", palabras: "usuarios contraseñas" },
];

// Busca la página registrada que mejor corresponde a una ruta (coincidencia más larga).
export function paginaDeRuta(ruta: string): PaginaSistema | null {
  const limpia = (ruta || "/").split("?")[0].replace(/\/+$/, "") || "/";
  let mejor: PaginaSistema | null = null;
  for (const p of PAGINAS_SISTEMA) {
    const coincide = p.ruta === "/" ? limpia === "/" : limpia === p.ruta || limpia.startsWith(p.ruta + "/");
    if (coincide && (!mejor || p.ruta.length > mejor.ruta.length)) mejor = p;
  }
  return mejor;
}

export function tituloDeRuta(ruta: string): string {
  return paginaDeRuta(ruta)?.titulo || ruta;
}

// Normaliza para comparar sin acentos ni mayúsculas.
export function normalizarTexto(t: string): string {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function coincideBusqueda(texto: string, consulta: string): boolean {
  const q = normalizarTexto(consulta);
  if (!q) return true;
  const base = normalizarTexto(texto);
  return q.split(/\s+/).every((palabra) => base.includes(palabra));
}
