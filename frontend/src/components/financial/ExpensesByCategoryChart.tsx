import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CSSProperties } from 'react';
import type { CategoryExpense } from '../../services/reports.service';

const fmt = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FALLBACK_COLORS = [
  '#50A6D2', '#08133E', '#10B981', '#EF4444',
  '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4',
];

interface Props {
  data: CategoryExpense[];
  /** Texto descritivo do período (ex: "maio de 2026"). Opcional. */
  kpiLabel?: string;
  loading?: boolean;
}

const cardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)',
  border: '1px solid var(--neutral-200)',
  padding: '20px 24px',
};

export function ExpensesByCategoryChart({ data, kpiLabel, loading }: Props) {
  const content =
    loading ? (
      <div
        className="rounded-lg animate-pulse"
        style={{ background: 'var(--neutral-100)', height: 320 }}
      />
    ) : data.length === 0 ? (
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
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2 A10 10 0 0 1 22 12 L12 12 Z" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--neutral-400)' }}>
          Sem despesas no período
        </p>
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={100}
            dataKey="total"
            nameKey="name"
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => fmt(Number(value))} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    );

  return (
    <section>
      <div className="flex justify-between items-center mb-3">
        <h2
          className="text-lg font-medium"
          style={{ color: 'var(--neutral-700)' }}
        >
          Despesas por Categoria
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
