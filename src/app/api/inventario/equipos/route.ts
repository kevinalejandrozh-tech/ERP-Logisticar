import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureInventarioSchema } from "@/lib/inventarioDB";
import { articuloId, ensureAlmacenSchema, siguienteFolio, sumarExistencia, ubicacionPorCodigo, usuarioDe } from "@/lib/almacenDB";
import {
  CAMPOS_GENERALES,
  camposActivos,
  esEstadoValido,
  type CampoInventario,
  type EquipoInventario,
  type EstadoInventario,
} from "@/lib/inventarioData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LARGO_MAXIMO = 500; // caracteres por campo
const LARGO_MAXIMO_NOTAS = 2000;

interface FilaEquipo {
  id: number;
  folio: string;
  categoria_clave: string;
  estado: EstadoInventario;
  datos: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

function aEquipo(f: FilaEquipo): EquipoInventario {
  return {
    id: f.id,
    folio: f.folio,
    categoria: f.categoria_clave,
    estado: f.estado,
    datos: f.datos || {},
    created_at: new Date(f.created_at).toISOString(),
    updated_at: new Date(f.updated_at).toISOString(),
  };
}

function mensajeError(err: unknown, porDefecto: string): string {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

// Limpia y valida los datos capturados contra los campos permitidos.
// Solo se guardan los campos generales, los campos activos de la categoría y las notas.
function validarDatos(entrada: unknown, campos: CampoInventario[]): { ok: true; datos: Record<string, string> } | { ok: false; error: string } {
  const bruto = entrada && typeof entrada === "object" ? (entrada as Record<string, unknown>) : {};
  const datos: Record<string, string> = {};

  for (const campo of campos) {
    const valorBruto = bruto[campo.clave];
    const valor = valorBruto === undefined || valorBruto === null ? "" : String(valorBruto).trim();

    if (!valor) {
      if (campo.requerido) return { ok: false, error: `El campo "${campo.etiqueta}" es obligatorio.` };
      continue;
    }
    if (valor.length > LARGO_MAXIMO) return { ok: false, error: `El campo "${campo.etiqueta}" es demasiado largo.` };

    if (campo.tipo === "numero" && !Number.isFinite(Number(valor))) {
      return { ok: false, error: `El campo "${campo.etiqueta}" debe ser un número.` };
    }
    if (campo.tipo === "fecha" && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return { ok: false, error: `El campo "${campo.etiqueta}" debe ser una fecha válida.` };
    }
    if (campo.tipo === "select" && !(campo.opciones || []).includes(valor)) {
      return { ok: false, error: `El valor de "${campo.etiqueta}" no está en la lista de opciones.` };
    }
    datos[campo.clave] = valor;
  }

  const notas = typeof bruto.notas === "string" ? bruto.notas.trim() : "";
  if (notas.length > LARGO_MAXIMO_NOTAS) return { ok: false, error: "Las notas son demasiado largas." };
  if (notas) datos.notas = notas;

  return { ok: true, datos };
}

// GET /api/inventario/equipos
// Filtros opcionales: ?categoria=laptop&estado=Activo
export async function GET(req: Request) {
  try {
    await ensureInventarioSchema();
    const params = new URL(req.url).searchParams;
    const categoria = params.get("categoria");
    const estado = params.get("estado");

    const condiciones: string[] = [];
    const valores: string[] = [];
    if (categoria) {
      valores.push(categoria);
      condiciones.push(`categoria_clave = $${valores.length}`);
    }
    if (estado) {
      if (!esEstadoValido(estado)) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
      valores.push(estado);
      condiciones.push(`estado = $${valores.length}`);
    }

    const result = await getPool().query<FilaEquipo>(
      `SELECT id, folio, categoria_clave, estado, datos, created_at, updated_at
       FROM inventario_equipos
       ${condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : ""}
       ORDER BY created_at DESC, id DESC`,
      valores
    );
    return NextResponse.json({ ok: true, registros: result.rows.map(aEquipo) });
  } catch (err) {
    return NextResponse.json({ error: mensajeError(err, "Error al leer los equipos.") }, { status: 500 });
  }
}

// POST /api/inventario/equipos
// Body: { categoria: "laptop", estado: "Activo", datos: { nombre: "...", ... },
//         almacen?: { cantidad, ubicacion, costo } }
// El folio lo genera el servidor con el prefijo y el consecutivo de la categoría.
// Si viene `almacen`, en la misma transacción se suma el producto a las existencias de almacén
// (artículo por nombre, movimiento de Entrada y folio de recibo REC-…).
export async function POST(req: NextRequest) {
  const pool = getPool();
  await ensureAlmacenSchema().catch(() => {}); // incluye ensureInventarioSchema
  const usuario = await usuarioDe(req).catch(() => null);
  const client = await pool.connect();
  try {
    await ensureInventarioSchema();
    const body = await req.json();

    const alm = body.almacen && typeof body.almacen === "object" ? body.almacen : null;
    const almCantidad = alm ? Number(alm.cantidad) : 0;
    const almUbicacion = alm ? String(alm.ubicacion || "").trim() : "";
    const almCosto = alm ? Math.max(0, Number(alm.costo) || 0) : 0;
    if (alm && (!(almCantidad > 0) || !almUbicacion)) {
      return NextResponse.json({ error: "Indica cantidad y ubicación de almacén." }, { status: 400 });
    }

    const claveCategoria = typeof body.categoria === "string" ? body.categoria.trim() : "";
    if (!claveCategoria) return NextResponse.json({ error: "Selecciona una categoría." }, { status: 400 });

    const estado = body.estado ?? "Activo";
    if (!esEstadoValido(estado)) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });

    await client.query("BEGIN");

    // FOR UPDATE bloquea la categoría mientras se asigna el folio (evita folios repetidos).
    const cat = await client.query<{ clave: string; nombre: string; prefijo: string; campos: CampoInventario[]; activa: boolean; consecutivo: number }>(
      `SELECT clave, nombre, prefijo, campos, activa, consecutivo FROM inventario_categorias WHERE clave = $1 FOR UPDATE`,
      [claveCategoria]
    );
    if (!cat.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "La categoría no existe." }, { status: 404 });
    }
    const categoria = cat.rows[0];
    if (!categoria.activa) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "La categoría está desactivada." }, { status: 400 });
    }

    const campos = [...CAMPOS_GENERALES, ...camposActivos({ clave: categoria.clave, nombre: "", prefijo: categoria.prefijo, campos: categoria.campos || [] })];
    const validacion = validarDatos(body.datos, campos);
    if (!validacion.ok) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    // Siguiente folio libre (si por algún motivo ya existe, avanza al siguiente).
    let consecutivo = categoria.consecutivo;
    let folio = "";
    for (;;) {
      consecutivo += 1;
      folio = `${categoria.prefijo}-${String(consecutivo).padStart(4, "0")}`;
      const existe = await client.query(`SELECT 1 FROM inventario_equipos WHERE folio = $1`, [folio]);
      if (!existe.rowCount) break;
    }

    await client.query(`UPDATE inventario_categorias SET consecutivo = $1 WHERE clave = $2`, [consecutivo, categoria.clave]);

    const insertado = await client.query<FilaEquipo>(
      `INSERT INTO inventario_equipos (folio, categoria_clave, estado, datos)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, folio, categoria_clave, estado, datos, created_at, updated_at`,
      [folio, categoria.clave, estado, JSON.stringify(validacion.datos)]
    );

    let recibo: string | null = null;
    if (alm) {
      const nombre = validacion.datos.nombre;
      const u = await ubicacionPorCodigo(client, almUbicacion);
      const aid = await articuloId(client, nombre, "Inventario", categoria.nombre, almCosto);
      await sumarExistencia(client, aid, u.id, almCantidad);
      recibo = await siguienteFolio(client, "REC");
      await client.query(
        `INSERT INTO alm_movimientos (tipo, folio, articulo_id, articulo, ubicacion_id, ubicacion, cantidad, costo_unitario, referencia, fecha_compra, usuario)
         VALUES ('Entrada', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [recibo, aid, nombre, u.id, u.codigo, almCantidad, almCosto, `Alta de producto ${folio}`, validacion.datos.fecha_adquisicion || null, usuario]
      );
      await client.query(`INSERT INTO alm_recibos (folio, origen, oc_folios, items, total, usuario) VALUES ($1, 'Directo', '[]', $2, $3, $4)`, [
        recibo,
        JSON.stringify([{ cantidad: almCantidad, articulo: nombre, categoria: categoria.nombre, tipo: "Inventario", precio: almCosto, ubicacion: u.codigo, equipo: folio }]),
        almCantidad * almCosto,
        usuario,
      ]);
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, registro: aEquipo(insertado.rows[0]), recibo }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ error: mensajeError(err, "Error al registrar el equipo.") }, { status: 500 });
  } finally {
    client.release();
  }
}