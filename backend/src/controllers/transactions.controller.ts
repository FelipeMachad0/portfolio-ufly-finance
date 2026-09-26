import { Request, Response } from 'express';
import { TransactionCreateSchema, TransactionUpdateSchema } from '@ufly/shared';
import {
  listTransactions,
  getTransaction,
  createTransactionService,
  updateTransactionService,
  deleteTransactionService,
} from '../services/transaction.service';

export async function index(req: Request, res: Response): Promise<void> {
  try {
    const { accountId, categoryId, type, status, startDate, endDate, search, page, limit } = req.query;
    const result = await listTransactions(
      req.userId!,
      {
        accountId: accountId as string,
        categoryId: categoryId as string,
        type: type as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
        search: search as string,
      },
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 20
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const tx = await getTransaction(req.params.id as string, req.userId!);
    res.json(tx);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = TransactionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    const tx = await createTransactionService(req.userId!, parsed.data);
    res.status(201).json(tx);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const parsed = TransactionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    const tx = await updateTransactionService(req.params.id as string, req.userId!, parsed.data);
    res.json(tx);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await deleteTransactionService(req.params.id as string, req.userId!);
    res.json({ message: 'Transação removida com sucesso' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}
