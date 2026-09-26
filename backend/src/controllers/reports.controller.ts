import { Request, Response } from 'express';
import { parseDataOpcional } from '../utils/date-range';
import {
  getExpensesByCategory,
  getRevenueVsExpense,
  getRevenueByClient,
  getSummary,
  getDRE,
} from '../services/report.service';

export async function expensesByCategory(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const data = await getExpensesByCategory(
      req.userId!,
      parseDataOpcional(startDate),
      parseDataOpcional(endDate)
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function revenueByClient(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const data = await getRevenueByClient(
      req.userId!,
      parseDataOpcional(startDate),
      parseDataOpcional(endDate)
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function revenueVsExpense(req: Request, res: Response) {
  try {
    const { startDate, endDate, granularity } = req.query;
    const gran = granularity === 'day' ? 'day' : 'month';
    const data = await getRevenueVsExpense(
      req.userId!,
      parseDataOpcional(startDate),
      parseDataOpcional(endDate),
      gran
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function summary(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const data = await getSummary(
      req.userId!,
      parseDataOpcional(startDate),
      parseDataOpcional(endDate)
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function dre(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const data = await getDRE(
      req.userId!,
      parseDataOpcional(startDate),
      parseDataOpcional(endDate),
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
