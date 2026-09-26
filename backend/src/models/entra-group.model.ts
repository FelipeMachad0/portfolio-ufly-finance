import { pool } from '../database/pool';

export interface EntraGroupMapping {
  groupObjectId: string;
  groupName: string;
  role: string;
  precedence: number;
}

interface Row {
  group_object_id: string;
  group_name: string;
  role: string;
  precedence: number;
}

/**
 * Cache em memória do mapeamento.
 *
 * A tabela muda raramente (só quando a TI cria um papel novo) e é consultada em
 * todo login. Sem cache, cada autenticação faria uma consulta a mais.
 *
 * O TTL curto existe para não exigir restart do container depois de alterar o
 * mapeamento no banco: em no máximo 5 minutos a mudança vale.
 */
let cache: EntraGroupMapping[] | null = null;
let cacheEm = 0;
const TTL_MS = 5 * 60 * 1000;

export function invalidarCacheDeGrupos(): void {
  cache = null;
  cacheEm = 0;
}

export async function listarMapeamentoDeGrupos(
  agora: number = Date.now()
): Promise<EntraGroupMapping[]> {
  if (cache && agora - cacheEm < TTL_MS) return cache;

  const r = await pool.query<Row>(
    `SELECT group_object_id, group_name, role, precedence
       FROM entra_group_mapping
      ORDER BY precedence ASC`
  );
  cache = r.rows.map((row) => ({
    groupObjectId: row.group_object_id,
    groupName: row.group_name,
    role: row.role,
    precedence: row.precedence,
  }));
  cacheEm = agora;
  return cache;
}

export interface PapelResolvido {
  role: string;
  groupName: string;
}

/**
 * Resolve o papel a partir dos grupos que vieram no token.
 *
 * `undefined` significa "nenhum grupo desta aplicação" — e isso NÃO é o mesmo
 * que papel padrão: quem não está em nenhum grupo não tem acesso. Os dados aqui
 * são compartilhados (todo mundo vê o financeiro inteiro), então autenticar no
 * tenant não pode bastar.
 *
 * Estando em mais de um grupo, vale o de menor `precedence` — sem isso o papel
 * dependeria da ordem em que o Entra montou a claim.
 */
export function resolverPapel(
  gruposDoToken: string[],
  mapeamento: EntraGroupMapping[]
): PapelResolvido | undefined {
  const doToken = new Set(gruposDoToken.map((g) => g.toLowerCase()));
  const candidatos = mapeamento
    .filter((m) => doToken.has(m.groupObjectId.toLowerCase()))
    .sort((a, b) => a.precedence - b.precedence);

  const vencedor = candidatos[0];
  return vencedor ? { role: vencedor.role, groupName: vencedor.groupName } : undefined;
}
