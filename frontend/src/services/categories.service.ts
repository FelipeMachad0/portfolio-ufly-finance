import api from './api';
import type { Category, CategoryCreate, CategoryField, CategoryUpdate } from '@ufly/shared';

/**
 * Shape cru retornado pela API — colunas snake_case da DB. Normalizamos
 * para o tipo `Category` (camelCase, declarado em @ufly/shared) antes de
 * devolver para o app.
 */
interface CategoryApiRow extends Omit<Category, 'fieldsSchema' | 'userId' | 'createdAt' | 'updatedAt'> {
  user_id: string;
  fields_schema?: CategoryField[];
  created_at: string;
  updated_at: string;
}

function normalize(row: CategoryApiRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    color: row.color,
    icon: row.icon,
    fieldsSchema: row.fields_schema ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getCategories(type?: 'income' | 'expense'): Promise<Category[]> {
  const res = await api.get<CategoryApiRow[]>('/categories', {
    params: type ? { type } : undefined,
  });
  return res.data.map(normalize);
}

export async function createCategory(data: CategoryCreate): Promise<Category> {
  const res = await api.post<CategoryApiRow>('/categories', data);
  return normalize(res.data);
}

export async function updateCategory(id: string, data: CategoryUpdate): Promise<Category> {
  const res = await api.put<CategoryApiRow>(`/categories/${id}`, data);
  return normalize(res.data);
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`);
}
