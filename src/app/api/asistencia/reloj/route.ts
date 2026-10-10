import { NextRequest, NextResponse } from "next/server";
import { sesionAsistencia } from "@/lib/asistenciaDB";
import { dispositivoConfigurado, personalParaReloj, refrescarInfoDispositivo } from "@/lib/biometricoDB";
import { ErrorReloj, eliminarUsuariosReloj, guardarUsuarioReloj, listarUsuariosReloj, UsuarioReloj } from "@/lib/hikvision";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Reloj checador biométrico — alta y baja del personal en el dispositivo.
// GET: estado del reloj + personal del ERP cruzado con los usuarios registrados en el reloj.
// POST { accion: "alta", ids: number[] }        → da de alta / actualiza nombre en el reloj
//      { accion: "alta_pendientes" }             → da de alta a todo el personal activo que falte
//      { accion: "quitar", employee_nos: string[] } → elimina usuarios del reloj (rostro y huellas incluidos)
//      { accion: "quitar_bajas" }                → elimina del reloj a quien está de Baja en el ERP

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error con el reloj.");

export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const disp = await dispositivoConfigurado();
    const personal = await personalParaReloj();
    if (!disp) return NextResponse.json({ ok: true, configurado: false, personal: personal.filter((p) => p.estatus !== "Baja"), usuarios: [] });

    const error = await refrescarInfoDispositivo(disp.id);
    const dispositivo = await dispositivoConfigurado();
    if (error) return NextResponse.json({ ok: true, configurado: true, conectado: false, error, dispositivo, personal: personal.filter((p) => p.estatus !== "Baja"), usuarios: [] });

    const usuarios = await listarUsuariosReloj();
    const porEmp = new Map(usuarios.map((u) => [String(u.employeeNo), u]));
    const delErp = new Set(personal.map((p) => p.employee_no));
    const filas = personal
      .filter((p) => p.estatus !== "Baja" || porEmp.has(p.employee_no))
      .map((p) => {
        const u = porEmp.get(p.employee_no);
        return {
          ...p,
          en_reloj: !!u,
          nombre_reloj: u?.name || null,
          rostros: u?.numOfFace ?? 0,
          huellas: u?.numOfFP ?? 0,
          tarjetas: u?.numOfCard ?? 0,
        };
      });
    const sinExpediente = usuarios.filter((u) => !delErp.has(String(u.employeeNo)));
    return NextResponse.json({ ok: true, configurado: true, conectado: true, dispositivo, personal: filas, sin_expediente: sinExpediente, total_reloj: usuarios.length });
  } catch (e) {
    return NextResponse.json({ error: mensaje(e) }, { status: e instanceof ErrorReloj ? 502 : 500 });
  }
}

export async function POST(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion || "");
    const disp = await dispositivoConfigurado();
    if (!disp) return NextResponse.json({ error: "El reloj checador no está configurado en el servidor." }, { status: 400 });
    const personal = await personalParaReloj();

    if (accion === "alta" || accion === "alta_pendientes") {
      let objetivo = personal.filter((p) => p.estatus !== "Baja");
      if (accion === "alta") {
        const ids = new Set((Array.isArray(body.ids) ? body.ids : []).map(Number));
        objetivo = objetivo.filter((p) => ids.has(p.id));
      } else {
        const enReloj = new Set((await listarUsuariosReloj()).map((u: UsuarioReloj) => String(u.employeeNo)));
        objetivo = objetivo.filter((p) => !enReloj.has(p.employee_no));
      }
      const fallidos: { nombre: string; error: string }[] = [];
      let hechos = 0;
      for (const p of objetivo) {
        try {
          await guardarUsuarioReloj(p.employee_no, p.nombre);
          hechos++;
        } catch (e) {
          fallidos.push({ nombre: p.nombre, error: mensaje(e) });
          if (e instanceof ErrorReloj && (e.status === 401 || e.status === 0)) break; // sin conexión o credenciales: no seguir intentando
        }
      }
      return NextResponse.json({ ok: true, hechos, fallidos });
    }

    if (accion === "quitar" || accion === "quitar_bajas") {
      let nos: string[];
      if (accion === "quitar") {
        nos = (Array.isArray(body.employee_nos) ? body.employee_nos : []).map(String).filter(Boolean);
      } else {
        const enReloj = new Set((await listarUsuariosReloj()).map((u) => String(u.employeeNo)));
        nos = personal.filter((p) => p.estatus === "Baja" && enReloj.has(p.employee_no)).map((p) => p.employee_no);
      }
      if (nos.length) await eliminarUsuariosReloj(nos);
      return NextResponse.json({ ok: true, hechos: nos.length, fallidos: [] });
    }

    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: mensaje(e) }, { status: e instanceof ErrorReloj ? 502 : 500 });
  }
}
