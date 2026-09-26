import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CSSProperties } from 'react';
import type { MonthlyData } from '../../services/reports.service';
import type { Periodo } from '../common/PeriodoSelector';

interface FluxoItem extends MonthlyData {
  saldo: number;
}

interface FluxoCaixaChartProps {
  data: MonthlyData[];
  loading: boolean;
  /** Texto descritivo do período (ex: "maio de 2026"). */
  kpiLabel?: string;
  periodo: Periodo;
  /** Se true, envolve o conteúdo em um card próprio. Default: true. */
  withCard?: boolean;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Decide granularidade do servidor baseado no tamanho do período:
 * até 35 dias → 'day' (gráfico diário), acima → 'month'.
 * Sem período definido ("Tudo") só faz sentido agrupar por mês.
 */
export function granularityForPeriodo(p: Periodo): 'day' | 'month' {
  if (!p.start || !p.end) return 'month';
  return diffDays(p.start, p.end) <= 35 ? 'day' : 'month';
}

/**
 * Teto de meses que faz sentido sintetizar (10 anos). Acima disso o intervalo
 * pedido não descreve dados reais — é o caso do preset "Tudo", que usa
 * 1900→2999 como sentinela. Preencher aquilo geraria 13.200 pontos zerados, e
 * como o label usa ano de 2 dígitos, 1919 e 2019 colidem no mesmo "jan. de 19",
 * fazendo os meses reais desaparecerem entre os zeros.
 */
const MAX_MESES_PREENCHIDOS = 120;

function mesesEntre(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1
  );
}

/**
 * Preenche meses sem dados com revenue=0 / expense=0 para que o gráfico mostre
 * um ponto por mês mesmo quando não há transações.
 *
 * Em intervalos amplos demais desiste do preenchimento e usa só os meses que o
 * servidor devolveu — que já vêm ordenados e são exatamente os que têm dados.
 */
export function fillMonthlyGaps(
  data: MonthlyData[],
  start: Date,
  end: Date
): MonthlyData[] {
  if (mesesEntre(start, end) > MAX_MESES_PREENCHIDOS) return data;

  const all: MonthlyData[] = [];
  const cur = new Date(Date.UTC(start.getFullYear(), start.getMonth(), 1));
  const last = new Date(Date.UTC(end.getFullYear(), end.getMonth(), 1));

  while (cur <= last) {
    const label = cur.toLocaleDateString('pt-BR', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    });
    const found = data.find((d) => d.month === label);
    all.push(found ?? { month: label, revenue: 0, expense: 0 });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return all;
}

/**
 * Gera todos os dias do período preenchendo dias sem transação com zero,
 * depois agrupa em janelas de N dias.
 */
function fillAndGroupDaily(
  data: MonthlyData[],
  start: Date,
  end: Date,
  windowSize: number
): MonthlyData[] {
  const allDays: MonthlyData[] = [];
  const cur = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const last = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));

  while (cur <= last) {
    const label = cur.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
    const found = data.find((d) => d.month === label);
    allDays.push(found ?? { month: label, revenue: 0, expense: 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Tamanho de janela adaptativo: ajusta para gerar ~7-10 pontos no gráfico
  // (mesmo que windowSize seja sugerido externamente)
  const days = allDays.length;
  let win = windowSize;
  if (days <= 10) win = 1; // até 10 dias → 1 ponto por dia
  else if (days <= 21) win = 2; // até 3 semanas → janelas de 2 dias
  else win = Math.max(windowSize, Math.ceil(days / 10));

  const result: MonthlyData[] = [];
  for (let i = 0; i < allDays.length; i += win) {
    const slice = allDays.slice(i, i + win);
    result.push({
      month: slice[0].month,
      revenue: slice.reduce((s, d) => s + d.revenue, 0),
      expense: slice.reduce((s, d) => s + d.expense, 0),
    });
  }
  return result;
}

function fmtYAxis(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return String(val);
}

const cardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)',
  border: '1px solid var(--neutral-200)',
  padding: '20px 24px',
};

export function FluxoCaixaChart({
  data,
  loading,
  kpiLabel,
  periodo,
  withCard = true,
}: FluxoCaixaChartProps) {
  const semPeriodo = !periodo.start || !periodo.end;
  const isDaily = !semPeriodo && diffDays(periodo.start!, periodo.end!) <= 35;

  // Janela "sugerida" para agrupamento diário; o fillAndGroupDaily ajusta
  // dinamicamente para gerar uma quantidade legível de pontos.
  //
  // Sem período definido ("Tudo") não há intervalo para preencher: usa-se
  // exatamente os meses devolvidos pelo servidor, que já são os que têm dados.
  const grouped = semPeriodo
    ? data
    : isDaily
      ? fillAndGroupDaily(data, periodo.start!, periodo.end!, 4)
      : fillMonthlyGaps(data, periodo.start!, periodo.end!);

  const chartData: FluxoItem[] = grouped.map((d) => ({
    ...d,
    saldo: d.revenue - d.expense,
  }));

  const content = (
    <>
      {loading ? (
        <div
          className="rounded-lg animate-pulse"
          style={{ background: 'var(--neutral-100)', height: 320 }}
        />
      ) : chartData.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{ height: 320 }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--neutral-300)"
            strokeWidth="1.5"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--neutral-400)' }}>
            Sem dados para este período
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'var(--neutral-500)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtYAxis}
              tick={{ fontSize: 11, fill: 'var(--neutral-500)' }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              formatter={(value, name) => [
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  Number(value)
                ),
                name === 'revenue' ? 'Receita' : name === 'expense' ? 'Despesa' : 'Saldo',
              ]}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid var(--neutral-200)',
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,.08)',
              }}
            />
            <Legend
              formatter={(value) =>
                value === 'revenue' ? 'Receita' : value === 'expense' ? 'Despesa' : 'Saldo'
              }
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              name="revenue"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              name="expense"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="saldo"
              name="saldo"
              stroke="var(--ufly-cyan)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3, fill: 'var(--ufly-cyan)', strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </>
  );

  return (
    <section>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-medium" style={{ color: 'var(--neutral-700)' }}>
          Fluxo de Caixa
        </h2>
        {kpiLabel && (
          <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            {kpiLabel}
          </span>
        )}
      </div>

      {withCard ? <div style={cardStyle}>{content}</div> : content}
    </section>
  );
}
