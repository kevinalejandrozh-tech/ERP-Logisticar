// Funciones de BD del enlace general de documentos de candidatos (solo servidor).
import { getPool } from "@/lib/db";
import {
  CONFIG_CARGA_DEFECTO,
  documentosConfigurados,
  estaCompleto,
  formatoFolio,
  type ConfigCargaDocumentos,
} from "@/lib/candidatoDocumentos";

export async function leerConfigCarga(): Promise<ConfigCargaDocumentos> {
  const r = await getPool().query(`SELECT documentos, cita_fecha, cita_hora FROM candidato_docs_config WHERE id = 1`);
  if (!r.rows.length) return { ...CONFIG_CARGA_DEFECTO };
  const x = r.rows[0];
  return { documentos: x.documentos || {}, cita_fecha: x.cita_fecha || "", cita_hora: x.cita_hora || "" };
}

export async function guardarConfigCarga(c: ConfigCargaDocumentos) {
  await getPool().query(
    `INSERT INTO candidato_docs_config (id, documentos, cita_fecha, cita_hora, updated_at) VALUES (1, $1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET documentos = EXCLUDED.documentos, cita_fecha = EXCLUDED.cita_fecha, cita_hora = EXCLUDED.cita_hora, updated_at = now()`,
    [JSON.stringify(c.documentos), c.cita_fecha, c.cita_hora]
  );
}

export type EstadoRegistro = {
  completo: boolean;
  folio: string | null;
  cita_fecha: string;
  cita_hora: string;
};

// Calcula si el registro está completo; al completarse por primera vez le asigna folio consecutivo
// y guarda la cita vigente en ese momento (si después cambia la configuración, su cita no cambia).
export async function estadoRegistro(registroId: number, config?: ConfigCargaDocumentos): Promise<EstadoRegistro | null> {
  const pool = getPool();
  const cfg = config || (await leerConfigCarga());
  const reg = await pool.query(`SELECT puesto, folio, cita_fecha, cita_hora FROM candidato_registros WHERE id = $1`, [registroId]);
  if (!reg.rows.length) return null;
  const tipos = await pool.query(`SELECT DISTINCT tipo FROM candidato_registro_documentos WHERE registro_id = $1`, [registroId]);
  const completo = estaCompleto(documentosConfigurados(reg.rows[0].puesto, cfg), tipos.rows.map((t: { tipo: string }) => t.tipo));
  let { folio, cita_fecha, cita_hora } = reg.rows[0];

  if (completo && !folio) {
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query("SELECT pg_advisory_xact_lock(784512)"); // evita folios repetidos si dos personas terminan a la vez
      const actual = await cliente.query(`SELECT folio FROM candidato_registros WHERE id = $1`, [registroId]);
      if (actual.rows[0]?.folio) {
        folio = actual.rows[0].folio;
      } else {
        const n = await cliente.query(`SELECT COALESCE(MAX(folio_num), 0) + 1 AS n FROM candidato_registros`);
        folio = formatoFolio(n.rows[0].n);
        await cliente.query(
          `UPDATE candidato_registros SET folio_num = $2, folio = $3, cita_fecha = $4, cita_hora = $5, completado_at = now() WHERE id = $1`,
          [registroId, n.rows[0].n, folio, cfg.cita_fecha || null, cfg.cita_hora || null]
        );
        cita_fecha = cfg.cita_fecha || null;
        cita_hora = cfg.cita_hora || null;
      }
      await cliente.query("COMMIT");
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      cliente.release();
    }
  }
  // Sin cita guardada (se completó antes de configurarla): se usa la vigente.
  return { completo, folio: folio || null, cita_fecha: cita_fecha || cfg.cita_fecha, cita_hora: cita_hora || cfg.cita_hora };
}
