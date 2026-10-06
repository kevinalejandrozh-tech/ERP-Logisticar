import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { sesionDeRequest } from "@/lib/actividadDB";
import { ensureSistemaSchema } from "@/lib/sistemaDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: ¿el sistema está en mantenimiento? (lo consulta cada usuario con sesión para mostrar el aviso)
export async function GET(req: NextRequest) {
  const s = await sesionDeRequest(req);
  if (!s) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await ensureSistemaSchema();
    const r = await getPool().query(`SELECT valor, updated_at FROM sistema_config WHERE clave = 'mantenimiento'`);
    const v = r.rows[0]?.valor || {};
    return NextResponse.json({ ok: true, activo: v.activo === true, desde: r.rows[0]?.updated_at || null, esSysadmin: s.rol === "sysadmin" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

// PUT { activo }: solo el sysadmin enciende/apaga el aviso de "estamos mejorando el sistema".
export async function PUT(req: NextRequest) {
  const s = await sesionDeRequest(req);
  if (!s || s.rol !== "sysadmin") return NextResponse.json({ error: "Solo el sysadmin puede cambiar el modo mantenimiento." }, { status: 403 });
  try {
    await ensureSistemaSchema();
    const activo = (await req.json())?.activo === true;
    await getPool().query(
      `INSERT INTO sistema_config (clave, valor) VALUES ('mantenimiento', $1::jsonb)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
      [JSON.stringify({ activo })]
    );
    return NextResponse.json({ ok: true, activo });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}
