import { Request, Response } from 'express';
import { ClienteCreateSchema, ClienteUpdateSchema } from '@ufly/shared';
import {
  findClientes,
  findClienteById,
  createCliente,
  updateCliente,
  softDeleteCliente,
} from '../models/cliente.model';

export async function index(req: Request, res: Response): Promise<void> {
  try {
    res.json(await findClientes());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const cliente = await findClienteById(req.params.id as string, req.userId!);
    if (!cliente) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = ClienteCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    res.status(201).json(await createCliente(req.userId!, parsed.data));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const parsed = ClienteUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    const cliente = await updateCliente(req.params.id as string, req.userId!, parsed.data);
    if (!cliente) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }
    res.json(cliente);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const ok = await softDeleteCliente(req.params.id as string, req.userId!);
    if (!ok) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }
    res.json({ message: 'Cliente removido com sucesso' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}
