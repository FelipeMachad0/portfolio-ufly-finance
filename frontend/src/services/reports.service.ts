import api from './api';
import { dateParams } from './dateParams';

export interface CategoryExpense {
  id: string;
  name: string;
  color: string;
  total: number;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  expense: number;
}

export interface PeriodSummary {
  totalRevenue: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
}

export async function getExpensesByCategory(
  startDate?: Date,
  endDate?: Date
): Promise<CategoryExpense[]> {
  const res = await api.get<CategoryExpense[]>('/reports/expenses-by-category', {
    params: dateParams(startDate, endDate),
  });
  return res.data;
}

export async function getRevenueVsExpense(
  startDate?: Date,
  endDate?: Date,
  granularity: 'day' | 'month' = 'month'
): Promise<MonthlyData[]> {
  const res = await api.get<MonthlyData[]>('/reports/revenue-vs-expense', {
    params: dateParams(startDate, endDate, { granularity }),
  });
  return res.data;
}

export interface ClientRevenue {
  cliente: string;
  total: number;
}

export async function getRevenueByClient(
  startDate?: Date,
  endDate?: Date
): Promise<ClientRevenue[]> {
  const res = await api.get<ClientRevenue[]>('/reports/revenue-by-client', {
    params: dateParams(startDate, endDate),
  });
  return res.data;
}

export async function getSummary(startDate?: Date, endDate?: Date): Promise<PeriodSummary> {
  const res = await api.get<PeriodSummary>('/reports/summary', {
    params: dateParams(startDate, endDate),
  });
  return res.data;
}

// ════════════════════════════════════════════════════════════
// DRE — Demonstração do Resultado do Exercício
// ════════════════════════════════════════════════════════════

export type DreSection =
  | 'receita_servicos'
  | 'receita_produtos'
  | 'deducoes'
  | 'cpv_terceiros'
  | 'cpv_licencas'
  | 'cpv_infra'
  | 'desp_consultoria'
  | 'desp_marketing'
  | 'desp_outros'
  | 'distribuicao_socios'
  | 'emprestimos'
  | 'outros';

export interface DreMonthBucket {
  month: string;
  monthLabel: string;
  sections: Record<DreSection, number>;
}

export interface DreReport {
  months: DreMonthBucket[];
  totals: Record<DreSection, number>;
  computedAt: string;
}

export async function getDRE(startDate?: Date, endDate?: Date): Promise<DreReport> {
  const res = await api.get<DreReport>('/reports/dre', {
    params: dateParams(startDate, endDate),
  });
  return res.data;
}
