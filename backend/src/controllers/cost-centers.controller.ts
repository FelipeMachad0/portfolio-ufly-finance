import { Request, Response } from 'express';
import { parseDataOpcional } from '../utils/date-range';
import {
  listBudgets,
  upsertBudget,
  deleteBudget,
  getComparison,
} from '../services/cost-center.service';

export async function list(req: Request, res: Response) {
  try {
    const data = await listBudgets();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function upsert(req: Request, res: Response) {
  try {
    const { cost_center, label, monthly_amount, gestor_user_id } = req.body ?? {};
    if (!cost_center || typeof cost_center !== 'string') {
      return res.status(400).json({ error: 'cost_center é obrigatório' });
    }
    const amount = Number(monthly_amount);
    if (!isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'monthly_amount inválido' });
    }
    const result = await upsertBudget(
      req.userId!,
      String(cost_center).trim(),
      amount,
      label ? String(label).trim() : null,
      gestor_user_id ? String(gestor_user_id) : null
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const ok = await deleteBudget(id);
    if (!ok) return res.status(404).json({ error: 'Não encontrado' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function comparison(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const data = await getComparison(
      req.userId!,
      parseDataOpcional(startDate),
      parseDataOpcional(endDate)
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
