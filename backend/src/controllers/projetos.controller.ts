import { Request, Response } from 'express';
import { ProjetoCreateSchema, ProjetoUpdateSchema } from '@ufly/shared';
import {
  findProjetos,
  findProjetoById,
  createProjeto,
  updateProjeto,
  softDeleteProjeto,
} from '../models/projeto.model';

export async function index(req: Request, res: Response): Promise<void> {
  try {
    res.json(await findProjetos());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const projeto = await findProjetoById(req.params.id as string, req.userId!);
    if (!projeto) { res.status(404).json({ error: 'Projeto não encontrado' }); return; }
    res.json(projeto);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = ProjetoCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    res.status(201).json(await createProjeto(req.userId!, parsed.data));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const parsed = ProjetoUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    const projeto = await updateProjeto(req.params.id as string, req.userId!, parsed.data);
    if (!projeto) { res.status(404).json({ error: 'Projeto não encontrado' }); return; }
    res.json(projeto);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const ok = await softDeleteProjeto(req.params.id as string, req.userId!);
    if (!ok) { res.status(404).json({ error: 'Projeto não encontrado' }); return; }
    res.json({ message: 'Projeto removido com sucesso' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}
