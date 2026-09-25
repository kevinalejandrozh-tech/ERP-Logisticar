import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureInventarioSchema } from "@/lib/inventarioDB";
import { esEstadoValido, type EquipoInventario, type EstadoInventario } from "@/lib/inventarioData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface FilaEquipo {
  id: number;
  folio: string;
  categoria_clave: string;
  estado: EstadoInventario;
  datos: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

function mensajeError(err: unknown, porDefecto: string): string {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

// POST /api/inventario/equipos/estado
// Body: { id: 12, estado: "En reparación" }
export async function POST(req: Request) {
  try {
    await ensureInventarioSchema();
    const body = await req.json();

    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Id de equipo inválido." }, { status: 400 });
    if (!esEstadoValido(body.estado)) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });

    const result = await getPool().query<FilaEquipo>(
      `UPDATE inventario_equipos
       SET estado = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, folio, categoria_clave, estado, datos, created_at, updated_at`,
      [body.estado, id]
    );
    if (!result.rowCount) return NextResponse.json({ error: "El equipo no existe." }, { status: 404 });

    const f = result.rows[0];
    const registro: EquipoInventario = {
      id: f.id,
      folio: f.folio,
      categoria: f.categoria_clave,
      estado: f.estado,
      datos: f.datos || {},
      created_at: new Date(f.created_at).toISOString(),
      updated_at: new Date(f.updated_at).toISOString(),
    };
    return NextResponse.json({ ok: true, registro });
  } catch (err) {
    return NextResponse.json({ error: mensajeError(err, "Error al cambiar el estado.") }, { status: 500 });
  }
}