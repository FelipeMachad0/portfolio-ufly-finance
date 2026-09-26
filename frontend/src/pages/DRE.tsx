import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { PageHeader } from '../components/common/PageHeader';
import { getDRE, type DreReport, type DreSection } from '../services/reports.service';

// ───────────────────────────────────────────────────────────
// Utilidades de formatação
// ───────────────────────────────────────────────────────────
function fmtBRL(v: number): string {
  if (v === 0) return '—';
  const abs = Math.abs(v);
  const s = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return v < 0 ? `(${s})` : s;
}

function currentYearRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31, 23, 59, 59),
    label: String(year),
  };
}

// ───────────────────────────────────────────────────────────
// Mapeamento de seções → linhas da DRE
// ───────────────────────────────────────────────────────────
const SECTION_LABEL: Record<DreSection, string> = {
  receita_servicos: 'Receita de Serviços',
  receita_produtos: 'Receita de Produtos (Licenças)',
  deducoes: 'Deduções (ISS, PIS/COFINS, IRRF)',
  cpv_terceiros: 'Parceiros / Terceiros',
  cpv_licencas: 'Licenças / Produtos',
  cpv_infra: 'Infraestrutura (Nuvem)',
  desp_consultoria: 'Consultorias externas',
  desp_marketing: 'Marketing / Comercial',
  desp_outros: 'Outros gastos',
  distribuicao_socios: 'Distribuição de sócios',
  emprestimos: 'Empréstimos / Devoluções',
  outros: 'Outros',
};

interface DreRow {
  label: string;
  section?: DreSection;
  kind: 'section' | 'item' | 'subtotal' | 'total';
  className?: string;
  values: number[]; // por mês
  accumulated: number;
  color?: 'red' | 'green' | 'purple';
}

function buildDreRows(report: DreReport): DreRow[] {
  const months = report.months;
  const value = (s: DreSection) => months.map((m) => m.sections[s] ?? 0);
  const total = (s: DreSection) => report.totals[s] ?? 0;
  const sumArrays = (arrs: number[][]) =>
    arrs[0]?.map((_, i) => arrs.reduce((a, b) => a + (b[i] ?? 0), 0)) ?? [];
  const sumTotals = (...vals: number[]) => vals.reduce((a, b) => a + b, 0);

  // Receita bruta
  const recServicos = value('receita_servicos');
  const recProdutos = value('receita_produtos');
  const receitaBruta = sumArrays([recServicos, recProdutos]);
  const receitaBrutaTotal = sumTotals(total('receita_servicos'), total('receita_produtos'));

  // Deduções
  const deducoes = value('deducoes');
  const deducoesTotal = total('deducoes');

  // Receita líquida
  const receitaLiquida = receitaBruta.map((v, i) => v - (deducoes[i] ?? 0));
  const receitaLiquidaTotal = receitaBrutaTotal - deducoesTotal;

  // CPV
  const cpvTerceiros = value('cpv_terceiros');
  const cpvLicencas = value('cpv_licencas');
  const cpvInfra = value('cpv_infra');
  const cpvSomado = sumArrays([cpvTerceiros, cpvLicencas, cpvInfra]);
  const cpvTotal = sumTotals(total('cpv_terceiros'), total('cpv_licencas'), total('cpv_infra'));

  // Lucro bruto
  const lucroBruto = receitaLiquida.map((v, i) => v - (cpvSomado[i] ?? 0));
  const lucroBrutoTotal = receitaLiquidaTotal - cpvTotal;

  // Despesas operacionais
  const despConsult = value('desp_consultoria');
  const despMkt = value('desp_marketing');
  const despOutros = value('desp_outros');
  const despSomada = sumArrays([despConsult, despMkt, despOutros]);
  const despTotal = sumTotals(
    total('desp_consultoria'),
    total('desp_marketing'),
    total('desp_outros'),
  );

  // EBITDA
  const ebitda = lucroBruto.map((v, i) => v - (despSomada[i] ?? 0));
  const ebitdaTotal = lucroBrutoTotal - despTotal;

  // Distribuição / Empréstimos
  const distribuicao = value('distribuicao_socios');
  const distribuicaoTotal = total('distribuicao_socios');
  const emprestimos = value('emprestimos');
  const emprestimosTotal = total('emprestimos');

  // Resultado líquido
  const resultado = ebitda.map((v, i) => v - (distribuicao[i] ?? 0) - (emprestimos[i] ?? 0));
  const resultadoTotal = ebitdaTotal - distribuicaoTotal - emprestimosTotal;

  return [
    { label: 'RECEITA BRUTA', kind: 'section', values: [], accumulated: 0 },
    { label: SECTION_LABEL.receita_servicos, kind: 'item', values: recServicos, accumulated: total('receita_servicos') },
    { label: SECTION_LABEL.receita_produtos, kind: 'item', values: recProdutos, accumulated: total('receita_produtos') },
    { label: '= Receita Bruta Total', kind: 'subtotal', values: receitaBruta, accumulated: receitaBrutaTotal },

    { label: 'DEDUÇÕES', kind: 'section', values: [], accumulated: 0 },
    { label: SECTION_LABEL.deducoes, kind: 'item', values: deducoes.map((v) => -v), accumulated: -deducoesTotal, color: 'red' },
    { label: '= Receita Líquida', kind: 'subtotal', values: receitaLiquida, accumulated: receitaLiquidaTotal, color: 'green' },

    { label: 'CUSTOS OPERACIONAIS (CPV)', kind: 'section', values: [], accumulated: 0 },
    { label: SECTION_LABEL.cpv_terceiros, kind: 'item', values: cpvTerceiros.map((v) => -v), accumulated: -total('cpv_terceiros'), color: 'red' },
    { label: SECTION_LABEL.cpv_licencas, kind: 'item', values: cpvLicencas.map((v) => -v), accumulated: -total('cpv_licencas'), color: 'red' },
    { label: SECTION_LABEL.cpv_infra, kind: 'item', values: cpvInfra.map((v) => -v), accumulated: -total('cpv_infra'), color: 'red' },
    { label: '= Lucro Bruto', kind: 'subtotal', values: lucroBruto, accumulated: lucroBrutoTotal, color: 'green' },

    { label: 'DESPESAS OPERACIONAIS', kind: 'section', values: [], accumulated: 0 },
    { label: SECTION_LABEL.desp_consultoria, kind: 'item', values: despConsult.map((v) => -v), accumulated: -total('desp_consultoria'), color: 'red' },
    { label: SECTION_LABEL.desp_marketing, kind: 'item', values: despMkt.map((v) => -v), accumulated: -total('desp_marketing'), color: 'red' },
    { label: SECTION_LABEL.desp_outros, kind: 'item', values: despOutros.map((v) => -v), accumulated: -total('desp_outros'), color: 'red' },
    { label: '= EBITDA', kind: 'subtotal', values: ebitda, accumulated: ebitdaTotal, color: 'purple' },

    { label: SECTION_LABEL.distribuicao_socios, kind: 'item', values: distribuicao.map((v) => -v), accumulated: -distribuicaoTotal, color: 'red' },
    { label: SECTION_LABEL.emprestimos, kind: 'item', values: emprestimos.map((v) => -v), accumulated: -emprestimosTotal, color: 'red' },

    { label: '= RESULTADO LÍQUIDO', kind: 'total', values: resultado, accumulated: resultadoTotal },
  ];
}

// ───────────────────────────────────────────────────────────
// Componente principal
// ───────────────────────────────────────────────────────────
export function DRE() {
  const [report, setReport] = useState<DreReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [{ start, end, label }] = useState(currentYearRange());

  useEffect(() => {
    getDRE(start, end)
      .then(setReport)
      .catch((e) => setError(e?.message || 'Erro ao carregar DRE'))
      .finally(() => setLoading(false));
  }, [start, end]);

  const rows = useMemo(() => (report ? buildDreRows(report) : []), [report]);
  const months = report?.months ?? [];

  return (
    <Layout>
      <PageHeader
        title="DRE"
        subtitle={`Demonstração do Resultado do Exercício — ${label}`}
      />

      {loading && (
        <div
          className="p-12 text-center"
          style={{
            background: '#fff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--neutral-200)',
            color: 'var(--neutral-500)',
          }}
        >
          Carregando DRE...
        </div>
      )}

      {error && (
        <div
          className="p-4"
          style={{
            background: 'var(--danger-soft)',
            color: 'var(--danger-dark)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {error}
        </div>
      )}

      {report && !loading && (
        <div
          className="overflow-x-auto"
          style={{
            background: '#fff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--neutral-200)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--ufly-navy)', color: '#fff' }}>
                <th
                  className="text-left px-5 py-3 font-medium"
                  style={{ width: '36%' }}
                >
                  Conta
                </th>
                {months.map((m) => (
                  <th
                    key={m.month}
                    className="text-right px-4 py-3 font-medium font-mono text-xs uppercase"
                  >
                    {m.monthLabel}
                  </th>
                ))}
                <th
                  className="text-right px-5 py-3 font-medium font-mono text-xs uppercase"
                  style={{ background: 'rgba(80,166,210,0.18)' }}
                >
                  Acumulado
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                if (row.kind === 'section') {
                  return (
                    <tr
                      key={idx}
                      style={{
                        background: 'var(--neutral-100)',
                        borderTop: '2px solid var(--neutral-200)',
                      }}
                    >
                      <td
                        colSpan={months.length + 2}
                        className="px-5 py-2.5 font-semibold uppercase tracking-wide text-xs"
                        style={{ color: 'var(--neutral-700)' }}
                      >
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                if (row.kind === 'total') {
                  return (
                    <tr
                      key={idx}
                      style={{
                        background: 'var(--ufly-navy)',
                        color: '#fff',
                        borderTop: '3px double var(--ufly-cyan)',
                      }}
                    >
                      <td className="px-5 py-3 font-bold">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td
                          key={i}
                          className="px-4 py-3 text-right font-mono font-bold tabular-nums"
                          style={{
                            color: v < 0 ? '#fca5a5' : '#86efac',
                          }}
                        >
                          {fmtBRL(v)}
                        </td>
                      ))}
                      <td
                        className="px-5 py-3 text-right font-mono font-bold tabular-nums"
                        style={{
                          background: 'rgba(80,166,210,0.15)',
                          color: row.accumulated < 0 ? '#fca5a5' : '#86efac',
                        }}
                      >
                        {fmtBRL(row.accumulated)}
                      </td>
                    </tr>
                  );
                }

                if (row.kind === 'subtotal') {
                  const color =
                    row.color === 'purple'
                      ? '#7c3aed'
                      : row.color === 'green'
                        ? 'var(--success-dark)'
                        : 'var(--ufly-deep)';
                  return (
                    <tr
                      key={idx}
                      style={{
                        background: row.color === 'purple' ? '#f5f3ff' : 'var(--ufly-ice-soft)',
                        borderTop: '1px solid var(--neutral-200)',
                      }}
                    >
                      <td className="px-5 py-2.5 font-bold" style={{ color }}>
                        {row.label}
                      </td>
                      {row.values.map((v, i) => (
                        <td
                          key={i}
                          className="px-4 py-2.5 text-right font-mono font-bold tabular-nums"
                          style={{ color }}
                        >
                          {fmtBRL(v)}
                        </td>
                      ))}
                      <td
                        className="px-5 py-2.5 text-right font-mono font-bold tabular-nums"
                        style={{
                          background: 'rgba(80,166,210,0.15)',
                          color,
                        }}
                      >
                        {fmtBRL(row.accumulated)}
                      </td>
                    </tr>
                  );
                }

                // item normal
                const color =
                  row.color === 'red' ? 'var(--finance-expense)' : 'var(--neutral-700)';
                return (
                  <tr
                    key={idx}
                    style={{ borderTop: '1px solid var(--neutral-100)' }}
                  >
                    <td
                      className="px-5 py-2 text-xs"
                      style={{ color: 'var(--neutral-500)', paddingLeft: '2.25rem' }}
                    >
                      {row.label}
                    </td>
                    {row.values.map((v, i) => (
                      <td
                        key={i}
                        className="px-4 py-2 text-right font-mono tabular-nums text-xs"
                        style={{ color }}
                      >
                        {fmtBRL(v)}
                      </td>
                    ))}
                    <td
                      className="px-5 py-2 text-right font-mono tabular-nums text-xs font-medium"
                      style={{
                        background: 'rgba(80,166,210,0.06)',
                        color,
                      }}
                    >
                      {fmtBRL(row.accumulated)}
                    </td>
                  </tr>
                );
              })}

              {months.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-5 py-12 text-center"
                    style={{ color: 'var(--neutral-500)' }}
                  >
                    Sem dados para o período. Registre transações para ver a DRE.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {report && months.length > 0 && (
        <p
          className="text-xs mt-3"
          style={{ color: 'var(--neutral-500)' }}
        >
          Valores agrupados automaticamente por categoria. Edite o nome das categorias
          (Serviços, Produtos, ISS, PIS/COFINS, Terceiros, Infraestrutura, Marketing,
          Consultoria, Sócios, Empréstimos) para refinar o enquadramento.
        </p>
      )}
    </Layout>
  );
}
