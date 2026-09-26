import { Request, Response } from 'express';
import { AccountCreateSchema, AccountUpdateSchema } from '@ufly/shared';
import {
  listAccounts,
  getAccount,
  createAccountService,
  updateAccountService,
  deleteAccountService,
} from '../services/account.service';

export async function index(req: Request, res: Response): Promise<void> {
  try {
    const accounts = await listAccounts(req.userId!);
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const account = await getAccount(req.params.id as string, req.userId!);
    res.json(account);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = AccountCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    const account = await createAccountService(req.userId!, parsed.data);
    res.status(201).json(account);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const parsed = AccountUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    const account = await updateAccountService(req.params.id as string, req.userId!, parsed.data);
    res.json(account);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await deleteAccountService(req.params.id as string, req.userId!);
    res.json({ message: 'Conta removida com sucesso' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}
