import { describe, it, expect } from 'vitest';
import { fillMonthlyGaps, granularityForPeriodo } from '../components/financial/FluxoCaixaChart';
import { buildPeriodo } from '../components/common/PeriodoSelector';

const dados = [
  { month: 'jan. de 26', revenue: 100, expense: 50 },
  { month: 'mar. de 26', revenue: 200, expense: 80 },
];

describe('fillMonthlyGaps', () => {
  it('preenche os meses sem dados dentro de um período normal', () => {
    const out = fillMonthlyGaps(dados, new Date(2026, 0, 1), new Date(2026, 2, 31));
    expect(out.map((d) => d.month)).toEqual(['jan. de 26', 'fev. de 26', 'mar. de 26']);
    expect(out[1]).toMatchObject({ revenue: 0, expense: 0 });
    expect(out[2]).toMatchObject({ revenue: 200, expense: 80 });
  });

  it('o preset "Tudo" não define intervalo — nada a sintetizar', () => {
    // Antes esse preset usava 1900→2999 como sentinela, o que gerava ~13.200
    // pontos zerados; e como o label usa ano de 2 dígitos, 1919 colidia com
    // 2019 e escondia os meses reais. Agora simplesmente não há intervalo.
    const tudo = buildPeriodo('tudo', 0, 0);
    expect(tudo.start).toBeUndefined();
    expect(tudo.end).toBeUndefined();
  });

  it('mantém o preenchimento no limite de 10 anos', () => {
    const out = fillMonthlyGaps(dados, new Date(2020, 0, 1), new Date(2026, 11, 31));
    expect(out.length).toBe(7 * 12);
  });
});

describe('granularityForPeriodo', () => {
  it('usa granularidade diária em períodos curtos', () => {
    expect(granularityForPeriodo(buildPeriodo('este_mes', 0, 0))).toBe('day');
  });

  it('usa granularidade mensal em "Tudo"', () => {
    expect(granularityForPeriodo(buildPeriodo('tudo', 0, 0))).toBe('month');
  });
});
