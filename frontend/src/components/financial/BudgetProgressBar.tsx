import type { BudgetWithStatus } from '../../services/budgets.service';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function BudgetProgressBar({
  budget,
  onDelete,
}: {
  budget: BudgetWithStatus;
  onDelete?: (id: string) => void;
}) {
  const barColor = budget.isExceeded
    ? 'var(--danger)'
    : budget.isWarning
      ? 'var(--warning)'
      : 'var(--success)';

  return (
    <Card padding="md">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: 'var(--neutral-900)' }}>
            {budget.category_name}
          </span>
          <Badge tone="neutral">
            {budget.period === 'monthly' ? 'Mensal' : 'Anual'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold tabular-nums"
            style={{
              color: budget.isExceeded ? 'var(--danger)' : 'var(--neutral-700)',
            }}
          >
            {fmt(budget.spent)} / {fmt(Number(budget.limit_amount))}
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(budget.id)}
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: 'var(--neutral-500)' }}
              aria-label="Remover orçamento"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div
        className="w-full h-2.5"
        style={{
          background: 'var(--neutral-100)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div
          className="h-2.5 transition-all"
          style={{
            background: barColor,
            width: `${budget.percentage}%`,
            borderRadius: 'var(--radius-md)',
          }}
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
          {budget.percentage.toFixed(0)}%
        </span>
        <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
          Restante: {fmt(budget.remaining)}
        </span>
      </div>

      {budget.isExceeded && (
        <p className="text-xs mt-2 font-medium" style={{ color: 'var(--danger)' }}>
          Orçamento excedido!
        </p>
      )}
      {budget.isWarning && !budget.isExceeded && (
        <p className="text-xs mt-2 font-medium" style={{ color: 'var(--warning-dark)' }}>
          Aproximando do limite (80%+)
        </p>
      )}
    </Card>
  );
}
