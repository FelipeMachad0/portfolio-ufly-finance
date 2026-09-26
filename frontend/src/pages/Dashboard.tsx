import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { getAccounts } from '../services/accounts.service';
import type { Account } from '@ufly/shared';
import { getTransactions, type TransactionRow } from '../services/transactions.service';
import { getSummary, getDRE, getRevenueVsExpense, type DreReport } from '../services/reports.service';
import { getBudgets, type BudgetWithStatus } from '../services/budgets.service';
import {
  PeriodoSelector,
  buildPeriodo,
  periodoLabel,
  type Periodo,
} from '../components/common/PeriodoSelector';
import { KpiCard } from '../components/common/KpiCard';
import { FluxoCaixaChart, granularityForPeriodo } from '../components/financial/FluxoCaixaChart';

// ─── Alertas ─────────────────────────────────────────────────────────────────

export interface Alerta {
  id: string;
  tipo: 'danger' | 'warning' | 'info';
  titulo: string;
  descricao: string;
}

const SALDO_BAIXO_THRESHOLD = 500; // R$ 500

function computeAlertas(params: {
  accounts: Account[];
  summary: { totalRevenue: number; totalExpense: number } | null;
  budgets: BudgetWithStatus[];
  semCategoria: number;
  futureTx: TransactionRow[];
}): Alerta[] {
  const { accounts, summary, budgets, semCategoria, futureTx } = params;
  const alertas: Alerta[] = [];

  // 1. Mês no negativo
  if (summary && summary.totalExpense > summary.totalRevenue) {
    const diff = fmtBRL(summary.totalExpense - summary.totalRevenue);
    alertas.push({
      id: 'mes_negativo',
      tipo: 'danger',
      titulo: 'Mês no negativo',
      descricao: `As saídas superam as entradas em ${diff} neste período.`,
    });
  }

  // 2. Saldo baixo em conta
  accounts.forEach((a) => {
    const bal = Number(a.balance ?? 0);
    if (bal < SALDO_BAIXO_THRESHOLD) {
      alertas.push({
        id: `saldo_baixo_${a.id}`,
        tipo: bal < 0 ? 'danger' : 'warning',
        titulo: `Saldo baixo — ${a.name}`,
        descricao: `Saldo atual de ${fmtBRL(bal)}. Verifique esta conta.`,
      });
    }
  });

  // 3. Orçamento excedido / quase excedido
  budgets.forEach((b) => {
    if (b.isExceeded) {
      alertas.push({
        id: `budget_excedido_${b.id}`,
        tipo: 'danger',
        titulo: `Orçamento excedido — ${b.category_name}`,
        descricao: `Gasto ${fmtBRL(b.spent)} de ${fmtBRL(b.limit_amount)} (${b.percentage.toFixed(0)}%).`,
      });
    } else if (b.isWarning) {
      alertas.push({
        id: `budget_aviso_${b.id}`,
        tipo: 'warning',
        titulo: `Orçamento quase no limite — ${b.category_name}`,
        descricao: `Gasto ${fmtBRL(b.spent)} de ${fmtBRL(b.limit_amount)} (${b.percentage.toFixed(0)}%).`,
      });
    }
  });

  // 4. Transações sem categoria
  if (semCategoria > 0) {
    alertas.push({
      id: 'sem_categoria',
      tipo: 'warning',
      titulo: `${semCategoria} transaç${semCategoria === 1 ? 'ão sem categoria' : 'ões sem categoria'}`,
      descricao: 'Classifique-as para relatórios mais precisos.',
    });
  }

  // 5. Transações com data futura chegando (próximos 7 dias)
  if (futureTx.length > 0) {
    futureTx.forEach((t) => {
      const d = new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      alertas.push({
        id: `futura_${t.id}`,
        tipo: 'info',
        titulo: `Transação agendada para ${d}`,
        descricao: t.description
          ? `"${t.description}" — ${fmtBRL(Number(t.amount))}`
          : `${fmtBRL(Number(t.amount))}`,
      });
    });
  }

  return alertas;
}

// ────────────────────────────────────────────────────────────────────────────

function saudacaoPorHora(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function fmtBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
}

const TYPE_LABEL: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
};

const TYPE_COLOR: Record<string, string> = {
  income: 'var(--finance-income)',
  expense: 'var(--finance-expense)',
  transfer: 'var(--finance-transfer)',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTx, setRecentTx] = useState<TransactionRow[]>([]);
  const [summary, setSummary] = useState<{
    totalRevenue: number;
    totalExpense: number;
    balance: number;
    transactionCount: number;
  } | null>(null);
  const [dre, setDre] = useState<DreReport | null>(null);
  const [fluxo, setFluxo] = useState<{ month: string; revenue: number; expense: number }[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  // Altura da coluna direita — usada para limitar a tabela ao mesmo tamanho
  const rightColRef = useRef<HTMLDivElement>(null);
  const [rightColHeight, setRightColHeight] = useState<number | undefined>();
  useEffect(() => {
    const el = rightColRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setRightColHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Período selecionado — default: este mês
  const [periodo, setPeriodo] = useState<Periodo>(() => buildPeriodo('este_mes', 0, 0));

  // ── Dados NÃO afetados pelo filtro: carregados uma vez ──────────────────────
  const loadStaticData = useCallback(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const in7dStr  = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    Promise.allSettled([
      getAccounts(),
      getTransactions({ limit: 50 }),          // últimas 50, sem filtro de período
      getBudgets(),
      getTransactions({ startDate: todayStr, endDate: in7dStr, limit: 20 }),
    ]).then(([a, t, b, future]) => {
      const accs  = a.status === 'fulfilled' ? a.value : [];
      const txAll = t.status === 'fulfilled' ? (t.value.data ?? []) : [];
      const buds  = b.status === 'fulfilled' ? b.value : [];
      const fTx   = future.status === 'fulfilled' ? (future.value.data ?? []) : [];

      setAccounts(accs);
      setRecentTx(txAll);

      // Alertas dependem de contas + orçamentos + futuras (sem filtro de período)
      // O summary (mês no negativo) vem do loadData e é atualizado separadamente
      setAlertas(computeAlertas({
        accounts: accs,
        summary: null,   // será sobrescrito quando loadData terminar
        budgets: buds,
        semCategoria: txAll.filter((tx) => !tx.category_id).length,
        futureTx: fTx,
      }));
    });
  }, []);

  // ── Dados afetados pelo filtro de período ───────────────────────────────────
  const loadData = useCallback((p: Periodo) => {
    setLoading(true);
    setSummary(null);
    setDre(null);

    Promise.allSettled([
      getSummary(p.start, p.end),
      getDRE(p.start, p.end),
      getRevenueVsExpense(p.start, p.end, granularityForPeriodo(p)),
    ]).then(([s, d, rv]) => {
      const sum = s.status === 'fulfilled' ? s.value : null;
      if (sum) setSummary(sum);
      if (d.status === 'fulfilled') setDre(d.value);
      if (rv.status === 'fulfilled') setFluxo(rv.value);

      // Atualiza apenas o alerta de "mês no negativo" com o novo summary
      setAlertas((prev) => {
        const sem = prev.find((a) => a.id === 'sem_categoria');
        const semCat = sem ? 1 : 0;
        return computeAlertas({
          accounts,
          summary: sum,
          budgets: [],   // alertas de orçamento já vieram do loadStaticData
          semCategoria: semCat,
          futureTx: [],
        }).concat(prev.filter((a) => a.id !== 'mes_negativo'));
      });
    }).finally(() => setLoading(false));
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega estáticos uma vez + dados filtrados na montagem
  useEffect(() => {
    loadStaticData();
    loadData(periodo);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePeriodo = useCallback((p: Periodo) => {
    setPeriodo(p);
    loadData(p);
  }, [loadData]);

  // EBITDA = Receita Líquida − CPV − Despesas Operacionais (calculado sobre o período selecionado)
  const ebitda = dre
    ? (dre.totals.receita_servicos + dre.totals.receita_produtos) -
      dre.totals.deducoes -
      (dre.totals.cpv_terceiros + dre.totals.cpv_licencas + dre.totals.cpv_infra) -
      (dre.totals.desp_consultoria + dre.totals.desp_marketing + dre.totals.desp_outros)
    : 0;
  const receitaBruta = dre
    ? dre.totals.receita_servicos + dre.totals.receita_produtos
    : 0;
  const margemEbitda = receitaBruta > 0 ? (ebitda / receitaBruta) * 100 : 0;

  const kpiLabel = periodoLabel(periodo);
  const kpiPrep = periodo.preset === 'ultimos_3_meses' ? 'nos' : 'em';

  const firstName = (user?.name || user?.email?.split('@')[0] || '').split(' ')[0];

  const totalBalance = accounts.reduce(
    (acc, a) => acc + Number(a.balance ?? 0),
    0
  );

  const monthBalance = (summary?.totalRevenue ?? 0) - (summary?.totalExpense ?? 0);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6 animate-pulse">
          <div
            className="h-36 rounded-xl"
            style={{ background: 'var(--ufly-gradient)' }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl"
                style={{ background: 'var(--neutral-200)' }}
              />
            ))}
          </div>
          <div
            className="h-64 rounded-xl"
            style={{ background: 'var(--neutral-200)' }}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* HERO */}
        <div
          className="rounded-xl p-5 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white"
          style={{
            background: 'var(--ufly-gradient)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div>
            <h1 className="text-3xl font-light">
              {saudacaoPorHora()}
              {firstName ? `, ${firstName}` : ''}.
            </h1>
            <p className="mt-2 text-white/80 text-sm">
              {summary && summary.transactionCount > 0
                ? `${summary.transactionCount} ${summary.transactionCount === 1 ? 'transação' : 'transações'} ${kpiPrep} ${kpiLabel}.`
                : `Nenhuma transação ${kpiPrep} ${kpiLabel}.`}
            </p>
          </div>
          <button
            onClick={() => navigate('/transactions')}
            className="px-6 py-3 bg-white text-sm font-medium hover:-translate-y-0.5 transition-transform"
            style={{
              color: 'var(--ufly-navy)',
              boxShadow: 'var(--shadow-md)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            + Nova Transação
          </button>
        </div>

        {/* FILTRO DE PERÍODO */}
        <PeriodoSelector periodo={periodo} onChange={handlePeriodo} showTudo={false} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard
            titulo="Saldo em caixa"
            valor={fmtBRL(totalBalance)}
            sub={`${accounts.length} conta${accounts.length !== 1 ? 's' : ''}`}
            cor="var(--ufly-cyan)"
            onClick={() => navigate('/accounts')}
          />
          <KpiCard
            titulo="Entradas"
            valor={fmtBRL(summary?.totalRevenue ?? 0)}
            sub={kpiLabel}
            cor="var(--finance-income)"
            onClick={() => navigate('/transactions')}
          />
          <KpiCard
            titulo="Saídas"
            valor={fmtBRL(summary?.totalExpense ?? 0)}
            sub={kpiLabel}
            cor="var(--finance-expense)"
            onClick={() => navigate('/transactions')}
          />
          <KpiCard
            titulo="Saldo"
            valor={fmtBRL(monthBalance)}
            sub={kpiLabel}
            cor={monthBalance >= 0 ? 'var(--success)' : 'var(--warning)'}
            onClick={() => navigate('/reports')}
          />
          <KpiCard
            titulo="EBITDA"
            valor={fmtBRL(ebitda)}
            sub={
              receitaBruta > 0
                ? `Margem ${margemEbitda.toFixed(1).replace('.', ',')}%`
                : kpiLabel
            }
            cor="#7c3aed"
            valueColor="#7c3aed"
            onClick={() => navigate('/dre')}
          />
        </div>

        {/* FLUXO DE CAIXA */}
        <FluxoCaixaChart data={fluxo} loading={loading} kpiLabel={kpiLabel} periodo={periodo} />

        {/* DIVISOR — separa dados filtrados dos dados em tempo real */}
        <div className="h-px" style={{ background: 'var(--neutral-200)' }} />

        {/* 2 COLUNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* ESQUERDA — maxHeight sincronizado com a coluna direita via ResizeObserver */}
          <div className="lg:col-span-2">
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2
                  className="text-lg font-medium"
                  style={{ color: 'var(--neutral-700)' }}
                >
                  Últimas transações
                </h2>
                <button
                  onClick={() => navigate('/transactions')}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--ufly-mid)' }}
                >
                  Ver todas →
                </button>
              </div>
              <div
                className="bg-white overflow-x-auto overflow-y-auto"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid var(--neutral-200)',
                  maxHeight: rightColHeight ? `${rightColHeight}px` : '600px',
                }}
              >
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr
                      className="text-left text-xs border-b"
                      style={{
                        color: 'var(--neutral-500)',
                        borderColor: 'var(--neutral-100)',
                      }}
                    >
                      <th className="px-4 py-3 font-medium">Descrição</th>
                      <th className="px-3 py-3 font-medium">Tipo</th>
                      <th className="px-3 py-3 font-medium">Data</th>
                      <th className="px-3 py-3 font-medium text-right">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTx.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => navigate('/transactions')}
                        className="border-b cursor-pointer transition-colors"
                        style={{ borderColor: 'var(--neutral-100)' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            'var(--neutral-50)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = '')
                        }
                      >
                        <td className="px-4 py-3">
                          <p
                            className="text-sm font-medium truncate max-w-[220px]"
                            style={{ color: 'var(--neutral-900)' }}
                          >
                            {t.description || '—'}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background:
                                t.type === 'income'
                                  ? 'var(--success-soft)'
                                  : t.type === 'expense'
                                    ? 'var(--danger-soft)'
                                    : 'var(--ufly-ice)',
                              color: TYPE_COLOR[t.type],
                            }}
                          >
                            {TYPE_LABEL[t.type] ?? t.type}
                          </span>
                        </td>
                        <td
                          className="px-3 py-3 text-sm"
                          style={{ color: 'var(--neutral-500)' }}
                        >
                          {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </td>
                        <td
                          className="px-3 py-3 text-sm text-right font-medium tabular-nums font-mono"
                          style={{
                            color:
                              t.type === 'expense'
                                ? 'var(--finance-expense)'
                                : t.type === 'income'
                                  ? 'var(--finance-income)'
                                  : 'var(--neutral-900)',
                          }}
                        >
                          {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}
                          {fmtBRL(Number(t.amount))}
                        </td>
                      </tr>
                    ))}
                    {recentTx.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center">
                          <p style={{ color: 'var(--neutral-500)' }}>
                            Nenhuma transação ainda.
                          </p>
                          <button
                            onClick={() => navigate('/transactions')}
                            className="mt-3 px-4 py-2 text-sm text-white rounded-lg"
                            style={{ background: 'var(--ufly-cyan)' }}
                          >
                            + Registrar primeira transação
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* DIREITA — Contas + Alertas (altura medida pelo ResizeObserver) */}
          <div className="space-y-6" ref={rightColRef}>
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2
                  className="text-lg font-medium"
                  style={{ color: 'var(--neutral-700)' }}
                >
                  Minhas contas{' '}
                  {accounts.length > 0 && (
                    <span
                      className="text-xs font-normal px-2 py-0.5 rounded-full"
                      style={{
                        background: 'var(--ufly-ice)',
                        color: 'var(--ufly-deep)',
                      }}
                    >
                      {accounts.length}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => navigate('/accounts')}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--ufly-mid)' }}
                >
                  Ver →
                </button>
              </div>
              <div className="space-y-2">
                {accounts.slice(0, 5).map((a) => {
                  const bal = Number(a.balance ?? 0);
                  return (
                    <div
                      key={a.id}
                      onClick={() => navigate('/accounts')}
                      className="bg-white p-4 cursor-pointer hover:-translate-y-0.5 transition-all"
                      style={{
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-sm)',
                        border: '1px solid var(--neutral-200)',
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--neutral-900)' }}
                          >
                            {a.name}
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: 'var(--neutral-500)' }}
                          >
                            {a.type === 'bank'
                              ? 'Conta bancária'
                              : a.type === 'credit_card'
                                ? 'Cartão de crédito'
                                : 'Carteira'}
                          </p>
                        </div>
                        <span
                          className="text-sm font-semibold tabular-nums font-mono whitespace-nowrap"
                          style={{
                            color:
                              bal >= 0
                                ? 'var(--finance-income)'
                                : 'var(--finance-expense)',
                          }}
                        >
                          {fmtBRL(bal)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {accounts.length === 0 && (
                  <div
                    className="bg-white p-4 text-center"
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-sm)',
                      border: '1px solid var(--neutral-200)',
                    }}
                  >
                    <p
                      className="text-xs"
                      style={{ color: 'var(--neutral-500)' }}
                    >
                      Você ainda não cadastrou nenhuma conta.
                    </p>
                    <button
                      onClick={() => navigate('/accounts')}
                      className="mt-3 px-3 py-1.5 text-xs text-white rounded-md"
                      style={{ background: 'var(--ufly-cyan)' }}
                    >
                      + Nova conta
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2
                className="text-lg font-medium mb-3"
                style={{ color: 'var(--neutral-700)' }}
              >
                Alertas
              </h2>
              <AlertasPanel alertas={alertas} loading={loading} navigate={navigate} />
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}


// ─── AlertasPanel ────────────────────────────────────────────────────────────

const ALERTA_CFG = {
  danger: {
    bg: 'var(--danger-soft)',
    border: 'var(--danger)',
    iconBg: '#fef2f2',
    iconColor: 'var(--danger)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  warning: {
    bg: '#fffbeb',
    border: '#f59e0b',
    iconBg: '#fef3c7',
    iconColor: '#d97706',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    bg: '#eff6ff',
    border: '#3b82f6',
    iconBg: '#dbeafe',
    iconColor: '#2563eb',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
} as const;

interface AlertasPanelProps {
  alertas: Alerta[];
  loading: boolean;
  navigate: (path: string) => void;
}

function AlertasPanel({ alertas, loading, navigate }: AlertasPanelProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl animate-pulse"
            style={{ background: 'var(--neutral-100)' }}
          />
        ))}
      </div>
    );
  }

  if (alertas.length === 0) {
    return (
      <div
        className="bg-white p-5 text-center"
        style={{
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--neutral-200)',
        }}
      >
        <span style={{ fontSize: 28 }}>✅</span>
        <p className="text-sm mt-2 font-medium" style={{ color: 'var(--neutral-700)' }}>
          Tudo em ordem!
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--neutral-500)' }}>
          Nenhum alerta para este período.
        </p>
      </div>
    );
  }

  // Ordena: danger primeiro, depois warning, depois info
  const sorted = [...alertas].sort((a, b) => {
    const order = { danger: 0, warning: 1, info: 2 };
    return order[a.tipo] - order[b.tipo];
  });

  return (
    <div className="space-y-2">
      {sorted.map((al) => {
        const cfg = ALERTA_CFG[al.tipo];
        return (
          <div
            key={al.id}
            className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
            }}
          >
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
              style={{ background: cfg.iconBg, color: cfg.iconColor }}
            >
              {cfg.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--neutral-900)' }}>
                {al.titulo}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--neutral-600)' }}>
                {al.descricao}
              </p>
            </div>
            {al.id === 'sem_categoria' && (
              <button
                onClick={() => navigate('/transactions')}
                className="text-xs px-2 py-1 rounded flex-shrink-0"
                style={{ color: cfg.iconColor, background: cfg.iconBg }}
              >
                Corrigir →
              </button>
            )}
            {al.id.startsWith('budget_') && (
              <button
                onClick={() => navigate('/budgets')}
                className="text-xs px-2 py-1 rounded flex-shrink-0"
                style={{ color: cfg.iconColor, background: cfg.iconBg }}
              >
                Ver →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
