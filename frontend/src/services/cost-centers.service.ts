import api from './api';
import { dateParams } from './dateParams';

export interface CostCenterBudget {
  id: string;
  user_id: string;
  cost_center: string;
  label: string | null;
  monthly_amount: number;
  gestor_user_id: string | null;
  gestor_name: string | null;
  gestor_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface CostCenterComparison {
  cost_center: string;
  label: string | null;
  previsto: number;
  realizado: number;
  /** Total gasto histórico nesse CC (sem filtro de período). */
  acumulado: number;
  diferenca: number;
  /** % usado: (realizado / previsto) * 100. null se previsto = 0. */
  uso_pct: number | null;
}

export async function listCostCenters(): Promise<CostCenterBudget[]> {
  const r = await api.get<CostCenterBudget[]>('/cost-centers');
  return r.data;
}

export async function upsertCostCenter(payload: {
  cost_center: string;
  label?: string | null;
  monthly_amount: number;
  gestor_user_id?: string | null;
}): Promise<CostCenterBudget> {
  const r = await api.post<CostCenterBudget>('/cost-centers', payload);
  return r.data;
}

export async function deleteCostCenter(id: string): Promise<void> {
  await api.delete(`/cost-centers/${id}`);
}

export async function getCostCenterComparison(
  startDate?: Date,
  endDate?: Date
): Promise<CostCenterComparison[]> {
  const r = await api.get<CostCenterComparison[]>('/cost-centers/comparison', {
    params: dateParams(startDate, endDate),
  });
  return r.data;
}
