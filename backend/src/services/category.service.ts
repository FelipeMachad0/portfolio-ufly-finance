import { CategoryCreate, CategoryUpdate } from '@ufly/shared';
import {
  findCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  softDeleteCategory,
} from '../models/category.model';
import { registrarAuditoria } from './audit.service';

export async function listCategories(userId: string, type?: 'income' | 'expense') {
  return findCategories(type);
}

export async function getCategory(id: string, userId: string) {
  const category = await findCategoryById(id, userId);
  if (!category) throw new Error('Categoria não encontrada');
  return category;
}

export async function createCategoryService(userId: string, data: CategoryCreate) {
  const category = await createCategory(userId, data);
  await registrarAuditoria(userId, 'CATEGORIA_CRIADA', 'categories', category.id, null, category);
  return category;
}

export async function updateCategoryService(id: string, userId: string, data: CategoryUpdate) {
  const before = await findCategoryById(id, userId);
  if (!before) throw new Error('Categoria não encontrada');

  const category = await updateCategory(id, userId, data);
  if (category) await registrarAuditoria(userId, 'CATEGORIA_EDITADA', 'categories', id, before, category);
  return category;
}

export async function deleteCategoryService(id: string, userId: string) {
  const before = await findCategoryById(id, userId);
  if (!before) throw new Error('Categoria não encontrada');

  const deleted = await softDeleteCategory(id, userId);
  if (deleted) await registrarAuditoria(userId, 'CATEGORIA_DELETADA', 'categories', id, before, null);
  return deleted;
}
