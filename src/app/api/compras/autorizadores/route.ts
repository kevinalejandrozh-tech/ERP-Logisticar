import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSchema } from "@/lib/db";
import { ROLES_SISTEMA } from "@/lib/permisos";
import { puedeAutorizarOC, sesionCompras } from "@/lib/comprasDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: si el usuario puede autorizar y, para el sysadmin, qué roles tienen el permiso.
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const s = await sesionCompras(req);
    const r = await getPool().query(`SELECT rol FROM compras_autorizadores`);
    return NextResponse.json({
      ok: true,
      puedeAutorizar: await puedeAutorizarOC(s?.rol),
      esSysadmin: s?.rol === "sysadmin",
      roles: ROLES_SISTEMA.filter((x) => x.rol !== "sysadmin").map((x) => ({ rol: x.rol, etiqueta: x.etiqueta, autoriza: r.rows.some((y) => y.rol === x.rol) })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

// PUT { roles: string[] } — solo sysadmin.
export async function PUT(req: NextRequest) {
  const s = await sesionCompras(req);
  if (s?.rol !== "sysadmin") return NextResponse.json({ error: "Solo el sysadmin puede asignar autorizadores." }, { status: 403 });
  try {
    const b = await req.json();
    const validos = ROLES_SISTEMA.map((x) => x.rol).filter((x) => x !== "sysadmin");
    const roles: string[] = Array.isArray(b?.roles) ? b.roles.filter((x: unknown) => typeof x === "string" && validos.includes(x)) : [];
    await ensureSchema();
    const c = await getPool().connect();
    try {
      await c.query("BEGIN");
      await c.query(`DELETE FROM compras_autorizadores`);
      for (const r of roles) await c.query(`INSERT INTO compras_autorizadores (rol) VALUES ($1)`, [r]);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}
