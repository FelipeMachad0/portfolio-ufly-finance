import type { Budget as PrismaBudget } from '@prisma/client';
import { prisma } from '../database/prisma';
import { BudgetCreate, BudgetUpdate } from '@ufly/shared';

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: number;
  period: 'monthly' | 'yearly';
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  /** Preenchidos apenas em findBudgets (join com categories). */
  category_name?: string;
  category_color?: string;
}

function toBudget(b: PrismaBudget): Budget {
  return {
    id: b.id,
    user_id: b.userId,
    category_id: b.categoryId,
    limit_amount: b.limitAmount.toFixed(2) as unknown as number,
    period: b.period as Budget['period'],
    created_at: b.createdAt as Date,
    updated_at: b.updatedAt as Date,
    deleted_at: b.deletedAt,
  };
}

export async function findBudgets(): Promise<Budget[]> {
  const rows = await prisma.budget.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { category: true },
  });
  return rows.map((r) => ({
    ...toBudget(r),
    category_name: r.category.name,
    category_color: r.category.color,
  }));
}

export async function findBudgetById(id: string, userId: string): Promise<Budget | null> {
  const row = await prisma.budget.findFirst({ where: { id, deletedAt: null } });
  return row ? toBudget(row) : null;
}

export async function findBudgetByCategory(
  userId: string,
  categoryId: string,
  period: string
): Promise<Budget | null> {
  const row = await prisma.budget.findFirst({
    where: { categoryId, period, deletedAt: null },
  });
  return row ? toBudget(row) : null;
}

export async function createBudget(userId: string, data: BudgetCreate): Promise<Budget> {
  const row = await prisma.budget.create({
    data: {
      userId,
      categoryId: data.categoryId,
      limitAmount: data.limitAmount,
      period: data.period,
    },
  });
  return toBudget(row);
}

export async function updateBudget(
  id: string,
  userId: string,
  data: BudgetUpdate
): Promise<Budget | null> {
  const patch: { limitAmount?: number; period?: string } = {};
  if (data.limitAmount !== undefined) patch.limitAmount = data.limitAmount;
  if (data.period !== undefined) patch.period = data.period;

  if (Object.keys(patch).length === 0) return findBudgetById(id, userId);

  const res = await prisma.budget.updateMany({ where: { id, deletedAt: null }, data: patch });
  if (res.count === 0) return null;
  return findBudgetById(id, userId);
}

export async function softDeleteBudget(id: string, userId: string): Promise<boolean> {
  const res = await prisma.budget.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return res.count > 0;
}

export async function getCategorySpending(
  userId: string,
  categoryId: string,
  period: 'monthly' | 'yearly'
): Promise<number> {
  const now = new Date();
  const startDate =
    period === 'monthly'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), 0, 1);

  const result = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      categoryId,
      type: 'expense',
      status: 'completed',
      date: { gte: startDate },
      deletedAt: null,
    },
  });
  return result._sum.amount ? Number(result._sum.amount) : 0;
}
