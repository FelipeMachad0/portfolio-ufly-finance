import api from './api';
import type { BudgetCreate, BudgetUpdate } from '@ufly/shared';

export interface BudgetWithStatus {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  category_color: string;
  limit_amount: number;
  period: 'monthly' | 'yearly';
  spent: number;
  remaining: number;
  percentage: number;
  isWarning: boolean;
  isExceeded: boolean;
}

export async function getBudgets(): Promise<BudgetWithStatus[]> {
  const res = await api.get<BudgetWithStatus[]>('/budgets');
  return res.data;
}

export async function createBudget(data: BudgetCreate): Promise<BudgetWithStatus> {
  const res = await api.post<BudgetWithStatus>('/budgets', data);
  return res.data;
}

export async function updateBudget(id: string, data: BudgetUpdate): Promise<BudgetWithStatus> {
  const res = await api.put<BudgetWithStatus>(`/budgets/${id}`, data);
  return res.data;
}

export async function deleteBudget(id: string): Promise<void> {
  await api.delete(`/budgets/${id}`);
}
