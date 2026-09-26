/**
 * Monta os parâmetros de data de uma consulta, OMITINDO o que não existe.
 *
 * Datas ausentes significam "sem filtro de tempo" — o caso do preset "Tudo".
 * Antes esse caso era representado por um intervalo fabricado (1900→2999), que
 * os consumidores tratavam como real: o gráfico de fluxo de caixa chegou a
 * sintetizar 13 mil meses vazios por causa disso.
 */
export function dateParams(
  startDate?: Date,
  endDate?: Date,
  extras: Record<string, string> = {}
): Record<string, string> {
  const params: Record<string, string> = { ...extras };
  if (startDate) params.startDate = startDate.toISOString();
  if (endDate) params.endDate = endDate.toISOString();
  return params;
}
