import type { CSSProperties } from 'react';
import type { ClientRevenue } from '../../services/reports.service';

interface Props {
  data: ClientRevenue[];
  loading?: boolean;
  /** Limita a quantidade de clientes exibidos (padrão: 10). */
  limit?: number;
  /** Texto descritivo do período (ex: "maio de 2026"). Opcional. */
  kpiLabel?: string;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Trunca nome longo do cliente (ex: "EXEMPLO PARTICIPAÇÕES S.A." → "Exemplo Participações") */
function shortName(raw: string): string {
  if (!raw) return 'Sem cliente';
  const clean = raw.replace(/(\bLTDA\b|\bS\.A\.?\b|\bME\b|\bEPP\b)/gi, '').trim();
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.join(' ');
}

const cardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)',
  border: '1px solid var(--neutral-200)',
  padding: '20px 24px',
};

export function RevenueByClientCard({ data, loading, limit = 10, kpiLabel }: Props) {
  const total = data.reduce((sum, c) => sum + c.total, 0);
  const max = Math.max(...data.map((d) => d.total), 1);
  const top = data.slice(0, limit);

  const content =
    loading ? (
      <div
        className="h-56 animate-pulse rounded-lg"
        style={{ background: 'var(--neutral-100)' }}
      />
    ) : top.length === 0 ? (
      <p className="text-sm text-center py-12" style={{ color: 'var(--neutral-400)' }}>
        Sem receitas no período selecionado.
      </p>
    ) : (
      <div className="space-y-2.5">
        {top.map((c) => {
          const widthPct = (c.total / max) * 100;
          const sharePct = total > 0 ? (c.total / total) * 100 : 0;
          return (
            <div
              key={c.cliente}
              className="grid items-center gap-3"
              style={{ gridTemplateColumns: '110px 1fr 90px 50px' }}
            >
              {/* Nome do cliente */}
              <span
                className="text-sm truncate font-medium"
                style={{ color: 'var(--ufly-navy)' }}
                title={c.cliente}
              >
                {shortName(c.cliente)}
              </span>

              {/* Barra de progresso */}
              <div
                className="relative h-2 rounded-full overflow-hidden"
                style={{ background: 'var(--neutral-100)' }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{
                    width: `${widthPct}%`,
                    background: 'var(--ufly-cyan)',
                  }}
                />
              </div>

              {/* Valor formatado */}
              <span
                className="text-sm font-mono tabular-nums text-right"
                style={{ color: 'var(--neutral-900)' }}
              >
                {fmtBRL(c.total)}
              </span>

              {/* Percentual do total */}
              <span
                className="text-xs tabular-nums text-right"
                style={{ color: 'var(--neutral-500)' }}
              >
                {sharePct.toFixed(1)}%
              </span>
            </div>
          );
        })}

        {data.length > limit && (
          <p
            className="text-xs text-center mt-3 pt-3"
            style={{
              color: 'var(--neutral-500)',
              borderTop: '1px solid var(--neutral-100)',
            }}
          >
            + {data.length - limit} outros clientes
          </p>
        )}
      </div>
    );

  return (
    <section>
      <div className="flex justify-between items-center mb-3">
        <h2
          className="text-lg font-medium"
          style={{ color: 'var(--neutral-700)' }}
        >
          Receita por cliente
        </h2>
        {!loading && data.length > 0 ? (
          <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            Total: {fmtBRL(total)}
          </span>
        ) : kpiLabel ? (
          <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            {kpiLabel}
          </span>
        ) : null}
      </div>

      <div style={cardStyle}>{content}</div>
    </section>
  );
}
