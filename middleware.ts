import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

// Páginas que se llenan vía código QR por cualquier operador, sin necesidad de cuenta.
const PAGINAS_PUBLICAS = ["/login", "/menu-dia/pedido", "/buzon-sugerencias/enviar", "/personas/capacitaciones/tomar", "/checklist-evidencias"];

// Rutas de API que esas mismas páginas públicas necesitan para funcionar.
const API_PUBLICA = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/sesion",
  "/api/menu-dia/opciones",
  "/api/menu-dia/pedidos",
  "/api/buzon-sugerencias",
  "/api/capacitaciones",
  "/api/capacitaciones/catalogo/get",
  "/api/expedientes/list",
  "/api/checklist/get",
]);

// El rol supervisor_tms solo puede navegar/consultar dentro de estas secciones.
const PREFIJOS_PERMITIDOS_SUPERVISOR = [
  "/", // solo la página exacta "/", no cubre subrutas (ver comprobación abajo)
  "/unidades",
  "/personas/expedientes",
  "/personas/organigrama",
  "/api/unidades",
  "/api/expedientes",
  "/api/capacitaciones/ultimas-por-nombre",
  "/api/capacitaciones/por-persona",
  "/api/capacitaciones/catalogo/list",
  "/api/sistema/almacenamiento",
  "/api/asistencia-diaria",
  "/api/cuadro-basico",
  "/api/areas-personal",
  "/api/organigrama",
];

function rutaPermitidaParaSupervisor(pathname: string): boolean {
  if (pathname === "/") return true;
  return PREFIJOS_PERMITIDOS_SUPERVISOR.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?")));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const esPaginaPublica = PAGINAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const esApiPublica = API_PUBLICA.has(pathname);

  if (esPaginaPublica || esApiPublica) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarTokenSesion(token) : null;

  // Navegación manual: URL escrita en la barra de direcciones, favorito, enlace externo o pestaña nueva.
  // Los clics dentro del sistema llegan como "same-origin", así que esto solo bloquea el acceso por barra.
  // Si el navegador no envía estas cabeceras (versiones antiguas) no se aplica el bloqueo.
  const esNavegacionManual =
    !pathname.startsWith("/api/") &&
    req.headers.get("sec-fetch-dest") === "document" &&
    req.headers.get("sec-fetch-site") === "none";

  if (!sesion || esNavegacionManual) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado. Inicia sesión." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = esNavegacionManual || pathname === "/" ? "" : `?destino=${encodeURIComponent(pathname)}`;
    const redireccion = NextResponse.redirect(url);
    if (esNavegacionManual && token) {
      // Se invalida la sesión: para entrar hay que iniciar sesión de nuevo.
      redireccion.cookies.set(COOKIE_SESION, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    }
    redireccion.headers.set("Cache-Control", "no-store");
    return redireccion;
  }

  if (sesion.rol === "supervisor_tms") {
    // Solo puede consultar (GET). Cualquier escritura queda bloqueada.
    if (pathname.startsWith("/api/") && req.method !== "GET") {
      return NextResponse.json({ error: "Tu usuario solo tiene permisos de consulta." }, { status: 403 });
    }
    // Y solo dentro de Unidades y Expedientes.
    if (!rutaPermitidaParaSupervisor(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Tu usuario no tiene acceso a esta sección." }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("x-usuario-rol", sesion.rol);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)).*)"],
};

