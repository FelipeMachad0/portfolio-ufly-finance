import { BudgetCreate, BudgetUpdate } from '@ufly/shared';
import {
  findBudgets,
  findBudgetById,
  createBudget,
  updateBudget,
  softDeleteBudget,
  getCategorySpending,
} from '../models/budget.model';
import { registrarAuditoria } from './audit.service';

export interface BudgetStatus {
  spent: number;
  remaining: number;
  percentage: number;
  isWarning: boolean;
  isExceeded: boolean;
}

export async function getBudgetStatus(
  userId: string,
  categoryId: string,
  period: 'monthly' | 'yearly',
  limitAmount: number
): Promise<BudgetStatus> {
  const spent = await getCategorySpending(userId, categoryId, period);
  const percentage = limitAmount > 0 ? (spent / limitAmount) * 100 : 0;
  return {
    spent,
    remaining: Math.max(0, limitAmount - spent),
    percentage: Math.min(100, percentage),
    isWarning: percentage >= 80,
    isExceeded: percentage >= 100,
  };
}

export async function listBudgets(userId: string) {
  const budgets = await findBudgets();
  return Promise.all(
    budgets.map(async (b) => {
      const status = await getBudgetStatus(userId, b.category_id, b.period, Number(b.limit_amount));
      return { ...b, ...status };
    })
  );
}

export async function createBudgetService(userId: string, data: BudgetCreate) {
  const budget = await createBudget(userId, data);
  await registrarAuditoria(userId, 'ORCAMENTO_CRIADO', 'budgets', budget.id, null, budget);
  return budget;
}

export async function updateBudgetService(id: string, userId: string, data: BudgetUpdate) {
  const before = await findBudgetById(id, userId);
  if (!before) throw new Error('Orçamento não encontrado');

  const budget = await updateBudget(id, userId, data);
  if (budget) await registrarAuditoria(userId, 'ORCAMENTO_EDITADO', 'budgets', id, before, budget);
  return budget;
}

export async function deleteBudgetService(id: string, userId: string) {
  const before = await findBudgetById(id, userId);
  if (!before) throw new Error('Orçamento não encontrado');

  const deleted = await softDeleteBudget(id, userId);
  if (deleted) await registrarAuditoria(userId, 'ORCAMENTO_DELETADO', 'budgets', id, before, null);
  return deleted;
}
