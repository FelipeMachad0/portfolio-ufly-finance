import { Request, Response } from 'express';
import { BudgetCreateSchema, BudgetUpdateSchema } from '@ufly/shared';
import {
  listBudgets,
  createBudgetService,
  updateBudgetService,
  deleteBudgetService,
} from '../services/budget.service';

export async function index(req: Request, res: Response) {
  try {
    const budgets = await listBudgets(req.userId!);
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function create(req: Request, res: Response) {
  const parsed = BudgetCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }
  try {
    const budget = await createBudgetService(req.userId!, parsed.data);
    res.status(201).json(budget);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function update(req: Request, res: Response) {
  const parsed = BudgetUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }
  try {
    const budget = await updateBudgetService(req.params['id'] as string, req.userId!, parsed.data);
    res.json(budget);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await deleteBudgetService(req.params['id'] as string, req.userId!);
    res.json({ message: 'Orçamento removido' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}
