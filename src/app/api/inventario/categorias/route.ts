import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureInventarioSchema } from "@/lib/inventarioDB";
import { validarCategoria, type CampoInventario, type CategoriaInventarioBD } from "@/lib/inventarioData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface FilaCategoria {
  id: number;
  clave: string;
  nombre: string;
  prefijo: string;
  campos: CampoInventario[];
  activa: boolean;
  total_equipos: string | number;
}

function aCategoria(f: FilaCategoria): CategoriaInventarioBD {
  return {
    id: f.id,
    clave: f.clave,
    nombre: f.nombre,
    prefijo: f.prefijo,
    campos: Array.isArray(f.campos) ? f.campos : [],
    activa: f.activa,
    total_equipos: Number(f.total_equipos) || 0,
  };
}

function mensajeError(err: unknown, porDefecto: string): string {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

// GET /api/inventario/categorias           -> solo categorías activas
// GET /api/inventario/categorias?todas=1   -> incluye las desactivadas (administración)
export async function GET(req: Request) {
  try {
    await ensureInventarioSchema();
    const todas = new URL(req.url).searchParams.get("todas") === "1";
    const result = await getPool().query<FilaCategoria>(
      `SELECT c.id, c.clave, c.nombre, c.prefijo, c.campos, c.activa,
              (SELECT COUNT(*) FROM inventario_equipos e WHERE e.categoria_clave = c.clave) AS total_equipos
       FROM inventario_categorias c
       ${todas ? "" : "WHERE c.activa = true"}
       ORDER BY c.nombre ASC`
    );
    return NextResponse.json({ ok: true, registros: result.rows.map(aCategoria) });
  } catch (err) {
    return NextResponse.json({ error: mensajeError(err, "Error al leer las categorías.") }, { status: 500 });
  }
}

// POST /api/inventario/categorias
// Sin "id": crea una categoría nueva.
// Con "id": actualiza nombre, campos y estado (activa). La clave nunca cambia.
export async function POST(req: Request) {
  try {
    await ensureInventarioSchema();
    const pool = getPool();
    const body = await req.json();

    const validacion = validarCategoria(body);
    if (!validacion.ok) return NextResponse.json({ error: validacion.error }, { status: 400 });
    const { nombre, prefijo, campos } = validacion.categoria;
    const activa = body.activa !== false;

    // ---------- Crear ----------
    if (!body.id) {
      const prefijoUsado = await pool.query(`SELECT 1 FROM inventario_categorias WHERE prefijo = $1`, [prefijo]);
      if (prefijoUsado.rowCount) {
        return NextResponse.json({ error: `El prefijo "${prefijo}" ya lo usa otra categoría.` }, { status: 409 });
      }

      // Clave única: si "ropa" ya existe, se usa "ropa_2", "ropa_3"...
      const base = validacion.categoria.clave;
      let clave = base;
      for (let n = 2; ; n++) {
        const existe = await pool.query(`SELECT 1 FROM inventario_categorias WHERE clave = $1`, [clave]);
        if (!existe.rowCount) break;
        clave = `${base}_${n}`;
      }

      const insertado = await pool.query<FilaCategoria>(
        `INSERT INTO inventario_categorias (clave, nombre, prefijo, campos, activa)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         RETURNING id, clave, nombre, prefijo, campos, activa, 0 AS total_equipos`,
        [clave, nombre, prefijo, JSON.stringify(campos), activa]
      );
      return NextResponse.json({ ok: true, registro: aCategoria(insertado.rows[0]) }, { status: 201 });
    }

    // ---------- Actualizar ----------
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Id de categoría inválido." }, { status: 400 });

    const actual = await pool.query<FilaCategoria>(
      `SELECT c.id, c.clave, c.nombre, c.prefijo, c.campos, c.activa,
              (SELECT COUNT(*) FROM inventario_equipos e WHERE e.categoria_clave = c.clave) AS total_equipos
       FROM inventario_categorias c WHERE c.id = $1`,
      [id]
    );
    if (!actual.rowCount) return NextResponse.json({ error: "La categoría no existe." }, { status: 404 });
    const previa = aCategoria(actual.rows[0]);

    // El prefijo solo puede cambiar si la categoría todavía no tiene equipos (los folios ya emitidos no cambian).
    if (prefijo !== previa.prefijo) {
      if ((previa.total_equipos || 0) > 0) {
        return NextResponse.json({ error: "No se puede cambiar el prefijo: la categoría ya tiene equipos registrados." }, { status: 409 });
      }
      const prefijoUsado = await pool.query(`SELECT 1 FROM inventario_categorias WHERE prefijo = $1 AND id <> $2`, [prefijo, id]);
      if (prefijoUsado.rowCount) {
        return NextResponse.json({ error: `El prefijo "${prefijo}" ya lo usa otra categoría.` }, { status: 409 });
      }
    }

    // Un campo que existía y ya no viene en la lista NO se borra: se conserva desactivado
    // para no perder la información capturada en equipos anteriores.
    const clavesNuevas = new Set(campos.map((c) => c.clave));
    const conservados = previa.campos
      .filter((c) => !clavesNuevas.has(c.clave))
      .map((c) => ({ ...c, activo: false }));
    const camposFinales = [...campos, ...conservados];

    const actualizado = await pool.query<FilaCategoria>(
      `UPDATE inventario_categorias
       SET nombre = $1, prefijo = $2, campos = $3::jsonb, activa = $4, updated_at = now()
       WHERE id = $5
       RETURNING id, clave, nombre, prefijo, campos, activa,
                 (SELECT COUNT(*) FROM inventario_equipos e WHERE e.categoria_clave = inventario_categorias.clave) AS total_equipos`,
      [nombre, prefijo, JSON.stringify(camposFinales), activa, id]
    );
    return NextResponse.json({ ok: true, registro: aCategoria(actualizado.rows[0]) });
  } catch (err) {
    return NextResponse.json({ error: mensajeError(err, "Error al guardar la categoría.") }, { status: 500 });
  }
}