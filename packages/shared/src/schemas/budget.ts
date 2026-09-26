import { z } from 'zod';

export const BudgetPeriodEnum = z.enum(['monthly', 'yearly']);
export type BudgetPeriod = z.infer<typeof BudgetPeriodEnum>;

export const BudgetSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  categoryId: z.string().uuid(),
  limitAmount: z.number().positive('Limite deve ser maior que 0'),
  period: BudgetPeriodEnum,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const BudgetCreateSchema = z.object({
  categoryId: z.string().uuid('Selecione uma categoria válida'),
  limitAmount: z.number().positive('Limite deve ser maior que 0'),
  period: BudgetPeriodEnum,
});

export const BudgetUpdateSchema = z.object({
  limitAmount: z.number().positive().optional(),
  period: BudgetPeriodEnum.optional(),
});

export type Budget = z.infer<typeof BudgetSchema>;
export type BudgetCreate = z.infer<typeof BudgetCreateSchema>;
export type BudgetUpdate = z.infer<typeof BudgetUpdateSchema>;
