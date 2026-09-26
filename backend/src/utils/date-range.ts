/**
 * Data de query string, quando ela pode não vir.
 *
 * Ausência significa "sem filtro de tempo" (o preset "Tudo" do frontend), e não
 * um intervalo enorme fabricado. `new Date(undefined)` produziria Invalid Date e
 * a comparação em SQL passaria a nunca casar, silenciosamente.
 */
export function parseDataOpcional(valor: unknown): Date | undefined {
  if (typeof valor !== 'string' || valor.trim() === '') return undefined;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Monta o trecho `AND <coluna> BETWEEN $n AND $n+1` e empilha os parâmetros,
 * ou devolve string vazia quando não há intervalo. Centraliza a numeração dos
 * placeholders, que é a parte fácil de errar ao tornar o filtro opcional.
 */
export function filtroDePeriodo(
  coluna: string,
  params: unknown[],
  startDate?: Date,
  endDate?: Date
): string {
  if (!startDate || !endDate) return '';
  const i = params.length;
  params.push(startDate, endDate);
  return `AND ${coluna} BETWEEN $${i + 1} AND $${i + 2}`;
}
