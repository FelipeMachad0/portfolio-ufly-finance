import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { CSSProperties } from 'react';
import type { CostCenterComparison } from '../../services/cost-centers.service';

interface Props {
  data: CostCenterComparison[];
  loading?: boolean;
  kpiLabel?: string;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

export function CostCenterChart({ data, loading, kpiLabel }: Props) {
  // Filtra apenas CCs que têm algum movimento (previsto > 0 OU realizado > 0)
  const filtered = data.filter((d) => d.previsto > 0 || d.realizado > 0);

  // Ordena: maior realizado primeiro
  const sorted = [...filtered].sort((a, b) => b.realizado - a.realizado);

  const totalPrevisto = sorted.reduce((s, x) => s + x.previsto, 0);
  const totalRealizado = sorted.reduce((s, x) => s + x.realizado, 0);

  const content = loading ? (
    <div
      className="rounded-lg animate-pulse"
      style={{ background: 'var(--neutral-100)', height: 320 }}
    />
  ) : sorted.length === 0 ? (
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
        <path d="M3 3v18h18" />
        <path d="M7 12h3M12 8h3M17 4h3" />
      </svg>
      <p className="text-sm" style={{ color: 'var(--neutral-400)' }}>
        Sem dados de centro de custo no período
      </p>
      <p className="text-xs" style={{ color: 'var(--neutral-400)' }}>
        Cadastre o orçamento previsto em Centros de Custo
      </p>
    </div>
  ) : (
    <>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={sorted}
          margin={{ top: 8, right: 16, left: 0, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
          <XAxis
            dataKey="cost_center"
            tick={{ fontSize: 10, fill: 'var(--neutral-500)' }}
            axisLine={false}
            tickLine={false}
            angle={-30}
            textAnchor="end"
            interval={0}
            height={50}
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
              fmtBRL(Number(value)),
              name === 'previsto' ? 'Previsto' : 'Realizado',
            ]}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as CostCenterComparison | undefined;
              return row?.label ? `${label} — ${row.label}` : String(label);
            }}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid var(--neutral-200)',
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,.08)',
            }}
          />
          <Legend
            formatter={(value) => (value === 'previsto' ? 'Previsto' : 'Realizado')}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Bar
            dataKey="previsto"
            name="previsto"
            fill="var(--ufly-cyan)"
            radius={[4, 4, 0, 0]}
          />
          <Bar dataKey="realizado" name="realizado" radius={[4, 4, 0, 0]}>
            {sorted.map((d, i) => {
              // Verde se ficou dentro do orçamento ou sem previsto, vermelho se estourou
              const exceeded = d.previsto > 0 && d.realizado > d.previsto;
              return (
                <Cell
                  key={i}
                  fill={exceeded ? 'var(--finance-expense)' : 'var(--finance-income)'}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Resumo embaixo */}
      <div
        className="grid grid-cols-3 gap-3 mt-3 pt-3"
        style={{ borderTop: '1px solid var(--neutral-100)' }}
      >
        <div>
          <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            Previsto
          </p>
          <p
            className="text-sm font-semibold font-mono tabular-nums"
            style={{ color: 'var(--ufly-cyan)' }}
          >
            {fmtBRL(totalPrevisto)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            Realizado
          </p>
          <p
            className="text-sm font-semibold font-mono tabular-nums"
            style={{
              color:
                totalRealizado > totalPrevisto && totalPrevisto > 0
                  ? 'var(--finance-expense)'
                  : 'var(--finance-income)',
            }}
          >
            {fmtBRL(totalRealizado)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            Diferença
          </p>
          <p
            className="text-sm font-semibold font-mono tabular-nums"
            style={{
              color:
                totalPrevisto - totalRealizado >= 0
                  ? 'var(--finance-income)'
                  : 'var(--finance-expense)',
            }}
          >
            {fmtBRL(totalPrevisto - totalRealizado)}
          </p>
        </div>
      </div>
    </>
  );

  return (
    <section>
      <div className="flex justify-between items-center mb-3">
        <h2
          className="text-lg font-medium"
          style={{ color: 'var(--neutral-700)' }}
        >
          Centro de Custo — Previsto x Realizado
        </h2>
        {kpiLabel && (
          <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            {kpiLabel}
          </span>
        )}
      </div>

      <div style={cardStyle}>{content}</div>
    </section>
  );
}
