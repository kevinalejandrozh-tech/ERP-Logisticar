import { NextRequest, NextResponse } from "next/server";
import { crearRol, guardarSeccionesRol, rolExiste, sesionSoloSysadmin, todosLosRoles } from "@/lib/permisosDB";
import { SECCIONES_SISTEMA, normalizarSecciones } from "@/lib/permisos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Roles existentes y las secciones que puede ver cada uno (solo sysadmin).
export async function GET(req: NextRequest) {
  const s = await sesionSoloSysadmin(req);
  if (s instanceof NextResponse) return s;
  try {
    const roles = await todosLosRoles();
    return NextResponse.json({ ok: true, roles, secciones: SECCIONES_SISTEMA.map(({ clave, titulo, descripcion }) => ({ clave, titulo, descripcion })) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los roles." }, { status: 500 });
  }
}

// Guarda las secciones de un rol. secciones = null → todas. El cambio aplica al siguiente inicio de sesión de cada usuario.
export async function PUT(req: NextRequest) {
  const s = await sesionSoloSysadmin(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const rol = String(b.rol || "");
    if (!(await rolExiste(rol))) return NextResponse.json({ error: "Rol no válido." }, { status: 400 });
    if (rol === "sysadmin") return NextResponse.json({ error: "El sysadmin siempre tiene acceso total." }, { status: 400 });
    await guardarSeccionesRol(rol, b.secciones === null ? null : normalizarSecciones(b.secciones) || []);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el rol." }, { status: 500 });
  }
}

// Crea un rol nuevo con sus secciones (solo sysadmin). Los roles nuevos pueden editar en sus secciones.
export async function POST(req: NextRequest) {
  const s = await sesionSoloSysadmin(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const etiqueta = String(b.nombre || "").replace(/\s+/g, " ").trim();
    if (!etiqueta) return NextResponse.json({ error: "Escribe el nombre del rol." }, { status: 400 });
    const rol = await crearRol(etiqueta, String(b.descripcion || "").trim() || null, normalizarSecciones(b.secciones) || []);
    return NextResponse.json({ ok: true, rol });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear el rol." }, { status: 500 });
  }
}
