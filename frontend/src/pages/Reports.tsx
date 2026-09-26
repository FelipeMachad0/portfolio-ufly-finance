import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/layout/Layout';
import { ExpensesByCategoryChart } from '../components/financial/ExpensesByCategoryChart';
import {
  FluxoCaixaChart,
  granularityForPeriodo,
} from '../components/financial/FluxoCaixaChart';
import { RevenueByClientCard } from '../components/financial/RevenueByClientCard';
import { CostCenterChart } from '../components/financial/CostCenterChart';
import { ExportButtons } from '../components/financial/ExportButtons';
import {
  getCostCenterComparison,
  type CostCenterComparison,
} from '../services/cost-centers.service';
import {
  getExpensesByCategory,
  getRevenueVsExpense,
  getRevenueByClient,
  getSummary,
  type CategoryExpense,
  type ClientRevenue,
  type MonthlyData,
  type PeriodSummary,
} from '../services/reports.service';
import { getAccounts } from '../services/accounts.service';
import type { Account } from '@ufly/shared';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/common/PageHeader';
import {
  PeriodoSelector,
  defaultPeriodo,
  periodoLabel,
  type Periodo,
} from '../components/common/PeriodoSelector';

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Reports() {
  const [expenseData, setExpenseData] = useState<CategoryExpense[]>([]);
  const [revenueData, setRevenueData] = useState<MonthlyData[]>([]);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [clientData, setClientData] = useState<ClientRevenue[]>([]);
  const [ccData, setCcData] = useState<CostCenterComparison[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>(defaultPeriodo());

  // Saldo em caixa NÃO depende do período — sempre reflete o saldo atual
  // total das contas (soma dos balances). É carregado uma única vez.
  useEffect(() => {
    getAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const saldoEmCaixa = accounts.reduce(
    (sum, a) => sum + Number(a.balance ?? 0),
    0
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    // Promise.allSettled — falha em UM endpoint não derruba os demais
    const granularity = granularityForPeriodo(periodo);
    const [expensesR, revenueR, sumR, clientsR, ccR] = await Promise.allSettled([
      getExpensesByCategory(periodo.start, periodo.end),
      getRevenueVsExpense(periodo.start, periodo.end, granularity),
      getSummary(periodo.start, periodo.end),
      getRevenueByClient(periodo.start, periodo.end),
      getCostCenterComparison(periodo.start, periodo.end),
    ]);
    setExpenseData(expensesR.status === 'fulfilled' ? expensesR.value : []);
    setRevenueData(revenueR.status === 'fulfilled' ? revenueR.value : []);
    setSummary(sumR.status === 'fulfilled' ? sumR.value : null);
    setClientData(clientsR.status === 'fulfilled' ? clientsR.value : []);
    setCcData(ccR.status === 'fulfilled' ? ccR.value : []);
    setLoading(false);
  }, [periodo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <Layout>
      <PageHeader
        title="Relatórios"
        subtitle={`Análise financeira — ${periodoLabel(periodo)}`}
        actions={
          <div className="flex flex-col items-end gap-3">
            <ExportButtons startDate={periodo.start} endDate={periodo.end} />
          </div>
        }
      />

      {/* Filtro de período */}
      <div className="mb-6">
        <PeriodoSelector periodo={periodo} onChange={setPeriodo} />
      </div>

      {/* KPIs: Receita, Despesa, Saldo do período + Saldo em Caixa */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <p
            className="text-xs uppercase tracking-wide mb-1"
            style={{ color: 'var(--neutral-500)' }}
          >
            Receita Total
          </p>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: 'var(--finance-income)' }}
          >
            {loading ? '—' : fmt(summary?.totalRevenue ?? 0)}
          </p>
        </Card>
        <Card>
          <p
            className="text-xs uppercase tracking-wide mb-1"
            style={{ color: 'var(--neutral-500)' }}
          >
            Despesa Total
          </p>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: 'var(--finance-expense)' }}
          >
            {loading ? '—' : fmt(summary?.totalExpense ?? 0)}
          </p>
        </Card>
        <Card>
          <p
            className="text-xs uppercase tracking-wide mb-1"
            style={{ color: 'var(--neutral-500)' }}
          >
            Saldo do Período
          </p>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{
              color:
                (summary?.balance ?? 0) >= 0
                  ? 'var(--finance-income)'
                  : 'var(--finance-expense)',
            }}
          >
            {loading ? '—' : fmt(summary?.balance ?? 0)}
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-1.5 mb-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ufly-cyan)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="2" />
              <path d="M6 12h.01M18 12h.01" />
            </svg>
            <p
              className="text-xs uppercase tracking-wide"
              style={{ color: 'var(--neutral-500)' }}
            >
              Saldo em Caixa
            </p>
          </div>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{
              color:
                saldoEmCaixa >= 0
                  ? 'var(--ufly-navy)'
                  : 'var(--finance-expense)',
            }}
          >
            {fmt(saldoEmCaixa)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--neutral-500)' }}>
            {accounts.length}{' '}
            {accounts.length === 1 ? 'conta' : 'contas'} · saldo atual
          </p>
        </Card>
      </div>

      {/* Gráficos: Despesas por Categoria + Fluxo de Caixa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ExpensesByCategoryChart
          data={expenseData}
          loading={loading}
          kpiLabel={periodoLabel(periodo)}
        />
        <FluxoCaixaChart
          data={revenueData}
          loading={loading}
          kpiLabel={periodoLabel(periodo)}
          periodo={periodo}
        />
      </div>

      {/* Centro de Custo — Previsto x Realizado */}
      <div className="mb-6">
        <CostCenterChart
          data={ccData}
          loading={loading}
          kpiLabel={periodoLabel(periodo)}
        />
      </div>

      {/* Receita por cliente */}
      <RevenueByClientCard
        data={clientData}
        loading={loading}
        limit={10}
        kpiLabel={periodoLabel(periodo)}
      />
    </Layout>
  );
}
