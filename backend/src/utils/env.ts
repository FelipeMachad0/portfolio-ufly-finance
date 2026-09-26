/**
 * Leitura de variáveis de ambiente numéricas.
 *
 * Existe por causa de um bug real em produção: o `docker-compose.yml` repassa
 * variáveis opcionais como `LEITURA_PRAZO_MS: ${LEITURA_PRAZO_MS:-}`, e quando
 * a variável não está no `.env` isso não a deixa indefinida — deixa **string
 * vazia**. Aí `process.env.X ?? padrao` não cai no padrão (`''` não é nullish) e
 * `Number('')` vira `0`.
 *
 * No caso de um timeout o efeito foi silencioso e total: teto de 0 ms, toda
 * chamada estourando o tempo limite e caindo no fallback, sem nenhum erro nos
 * logs. Nada indicava configuração — parecia lentidão do serviço externo.
 */
export function numeroDoAmbiente(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto.trim() === '') return padrao;
  const n = Number(bruto);
  // Valor inválido ou não-positivo cai no padrão: um teto de 0 ou NaN desliga o
  // recurso em silêncio, que é pior que ignorar a configuração errada.
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`[env] ${nome}="${bruto}" não é um número válido; usando ${padrao}.`);
    return padrao;
  }
  return n;
}
