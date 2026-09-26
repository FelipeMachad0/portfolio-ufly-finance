import { Prisma } from '@prisma/client';
import type { Category as PrismaCategory } from '@prisma/client';
import { prisma } from '../database/prisma';
import type { CategoryCreate, CategoryField, CategoryUpdate } from '@ufly/shared';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string | null;
  /** Lista ordenada de campos dinâmicos (jsonb na DB → array em JS). */
  fields_schema: CategoryField[];
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toCategory(c: PrismaCategory): Category {
  return {
    id: c.id,
    user_id: c.userId,
    name: c.name,
    type: c.type as Category['type'],
    color: c.color,
    icon: c.icon,
    fields_schema: c.fieldsSchema as CategoryField[],
    created_at: c.createdAt as Date,
    updated_at: c.updatedAt as Date,
    deleted_at: c.deletedAt,
  };
}

export async function findCategories(
  type?: 'income' | 'expense'
): Promise<Category[]> {
  const rows = await prisma.category.findMany({
    where: { deletedAt: null, ...(type ? { type } : {}) },
    orderBy: { name: 'asc' },
  });
  return rows.map(toCategory);
}

export async function findCategoryById(id: string, userId: string): Promise<Category | null> {
  const row = await prisma.category.findFirst({ where: { id, deletedAt: null } });
  return row ? toCategory(row) : null;
}

export async function createCategory(userId: string, data: CategoryCreate): Promise<Category> {
  const row = await prisma.category.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      color: data.color,
      icon: data.icon ?? null,
      fieldsSchema: (data.fieldsSchema ?? []) as Prisma.InputJsonValue,
    },
  });
  return toCategory(row);
}

export async function updateCategory(id: string, userId: string, data: CategoryUpdate): Promise<Category | null> {
  const patch: Prisma.CategoryUpdateManyMutationInput = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.color !== undefined) patch.color = data.color;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.fieldsSchema !== undefined) patch.fieldsSchema = data.fieldsSchema as Prisma.InputJsonValue;

  if (Object.keys(patch).length === 0) return findCategoryById(id, userId);

  const res = await prisma.category.updateMany({ where: { id, deletedAt: null }, data: patch });
  if (res.count === 0) return null;
  return findCategoryById(id, userId);
}

export async function softDeleteCategory(id: string, userId: string): Promise<boolean> {
  const res = await prisma.category.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return res.count > 0;
}
