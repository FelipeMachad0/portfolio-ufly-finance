import { Prisma } from '@prisma/client';
import type { Transaction as PrismaTransaction } from '@prisma/client';
import { prisma } from '../database/prisma';
import type {
  TransactionCreate,
  TransactionMetadata,
  TransactionUpdate,
} from '@ufly/shared';

export interface Transaction {
  id: string;
  /** Quem cadastrou. Nulo quando a pessoa foi removida — o lançamento fica. */
  user_id: string | null;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  date: Date;
  status: 'pending' | 'completed' | 'cancelled';
  /** Valores dos campos dinâmicos da categoria (jsonb na DB → objeto em JS). */
  metadata: TransactionMetadata;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  /** Busca por descrição (ILIKE %search%) */
  search?: string;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function toTransaction(t: PrismaTransaction): Transaction {
  return {
    id: t.id,
    user_id: t.userId,
    account_id: t.accountId,
    category_id: t.categoryId,
    amount: t.amount.toFixed(2) as unknown as number,
    type: t.type as Transaction['type'],
    description: t.description,
    date: t.date,
    status: t.status as Transaction['status'],
    metadata: t.metadata as TransactionMetadata,
    created_at: t.createdAt as Date,
    updated_at: t.updatedAt as Date,
    deleted_at: t.deletedAt,
  };
}

export async function findTransactions(
  filters: TransactionFilters = {},
  page = 1,
  limit = 20
): Promise<PaginatedTransactions> {
  const where: Prisma.TransactionWhereInput = { deletedAt: null };
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  const dateFilter: Prisma.DateTimeFilter = {};
  if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
  if (filters.endDate) dateFilter.lte = new Date(filters.endDate);
  if (Object.keys(dateFilter).length) where.date = dateFilter;

  if (filters.search && filters.search.trim()) {
    where.description = { contains: filters.search.trim(), mode: 'insensitive' };
  }

  const offset = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { data: rows.map(toTransaction), total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Todos os lançamentos do usuário, sem paginação — usado pela exportação da
 * planilha completa. Ordenado por data crescente, como na planilha de controle.
 */
export async function findAllTransactions(): Promise<Transaction[]> {
  const rows = await prisma.transaction.findMany({
    where: { deletedAt: null },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toTransaction);
}

export async function findTransactionById(id: string, userId: string): Promise<Transaction | null> {
  const row = await prisma.transaction.findFirst({ where: { id, deletedAt: null } });
  return row ? toTransaction(row) : null;
}

export async function createTransaction(userId: string, data: TransactionCreate): Promise<Transaction> {
  const row = await prisma.transaction.create({
    data: {
      userId,
      accountId: data.accountId,
      categoryId: data.categoryId ?? null,
      amount: data.amount,
      type: data.type,
      description: data.description,
      date: new Date(data.date),
      status: data.status ?? 'completed',
      metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
  return toTransaction(row);
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: TransactionUpdate
): Promise<Transaction | null> {
  const patch: Prisma.TransactionUpdateManyMutationInput = {};
  if (data.categoryId !== undefined) patch.categoryId = data.categoryId ?? null;
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.description !== undefined) patch.description = data.description;
  if (data.date !== undefined) patch.date = new Date(data.date);
  if (data.status !== undefined) patch.status = data.status;
  if (data.metadata !== undefined) patch.metadata = data.metadata as Prisma.InputJsonValue;

  if (Object.keys(patch).length === 0) return findTransactionById(id, userId);

  const res = await prisma.transaction.updateMany({ where: { id, deletedAt: null }, data: patch });
  if (res.count === 0) return null;
  return findTransactionById(id, userId);
}

export async function softDeleteTransaction(id: string, userId: string): Promise<boolean> {
  const res = await prisma.transaction.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return res.count > 0;
}
