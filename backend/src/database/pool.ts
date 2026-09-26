import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Shim compatível com a interface `pool.query()` do `pg`, porém executado
 * via Prisma (`$queryRawUnsafe` / `$executeRawUnsafe`). Mantido para as
 * queries SQL cruas (joins/agregações/upserts e scripts one-off). O CRUD dos
 * models usa a API tipada do Prisma diretamente.
 *
 * Normaliza os tipos para ficar idêntico ao retorno antigo do `pg`:
 *   - numeric/decimal -> string (mesma representação do driver pg)
 *   - bigint (COUNT)  -> string
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

const RETURNS_ROWS = /^\s*(select|with)\b/i;
const HAS_RETURNING = /\breturning\b/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O driver `pg` enviava parâmetros como tipo "desconhecido", deixando o
 * Postgres inferir o tipo (ex.: comparar uuid_column = $1 com uma string).
 * O Prisma envia os parâmetros tipados como `text`, o que quebra comparações
 * `uuid = text` (erro 42883). Para manter o comportamento, fazemos cast
 * explícito para `::uuid` dos parâmetros cujo valor é um UUID.
 */
function castUuidParams(text: string, params: unknown[]): string {
  let sql = text;
  // de trás pra frente para não confundir $1 com $10 etc.
  for (let i = params.length; i >= 1; i--) {
    if (typeof params[i - 1] === 'string' && UUID_RE.test(params[i - 1] as string)) {
      sql = sql.replace(new RegExp('\\$' + i + '(?!\\d)(?!::)', 'g'), `$${i}::uuid`);
    }
  }
  return sql;
}

function normalizeRows<T>(rows: T[]): T[] {
  for (const row of rows as Array<Record<string, unknown>>) {
    if (row === null || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      const value = row[key];
      if (value instanceof Prisma.Decimal) {
        // numeric(15,2) -> string com 2 casas, como o pg devolvia
        row[key] = value.toFixed(2);
      } else if (typeof value === 'bigint') {
        row[key] = value.toString();
      }
    }
  }
  return rows;
}

async function runQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const sql = castUuidParams(text, params);
  if (RETURNS_ROWS.test(sql) || HAS_RETURNING.test(sql)) {
    const rows = await prisma.$queryRawUnsafe<T[]>(sql, ...params);
    return { rows: normalizeRows(rows), rowCount: rows.length };
  }
  const affected = await prisma.$executeRawUnsafe(sql, ...params);
  return { rows: [], rowCount: affected };
}

export const pool = {
  query: runQuery,
  /** Fecha a conexão (usado pelos scripts one-off). */
  async end(): Promise<void> {
    await prisma.$disconnect();
  },
};
