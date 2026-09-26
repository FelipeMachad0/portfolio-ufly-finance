import { Request, Response } from 'express';
import { CategoryCreateSchema, CategoryUpdateSchema } from '@ufly/shared';
import {
  listCategories,
  getCategory,
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
} from '../services/category.service';

export async function index(req: Request, res: Response): Promise<void> {
  try {
    const type = req.query.type as 'income' | 'expense' | undefined;
    const categories = await listCategories(req.userId!, type);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const category = await getCategory(req.params.id as string, req.userId!);
    res.json(category);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = CategoryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    const category = await createCategoryService(req.userId!, parsed.data);
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const parsed = CategoryUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    const category = await updateCategoryService(req.params.id as string, req.userId!, parsed.data);
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await deleteCategoryService(req.params.id as string, req.userId!);
    res.json({ message: 'Categoria removida com sucesso' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}
