import type { Account as PrismaAccount } from '@prisma/client';
import { prisma } from '../database/prisma';
import { AccountCreate, AccountUpdate } from '@ufly/shared';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'bank' | 'credit_card' | 'wallet';
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// Mantém o contrato em snake_case e numeric como string (como o pg devolvia).
function toAccount(a: PrismaAccount): Account {
  return {
    id: a.id,
    user_id: a.userId,
    name: a.name,
    type: a.type as Account['type'],
    balance: a.balance.toFixed(2) as unknown as number,
    currency: a.currency,
    is_active: a.isActive,
    created_at: a.createdAt as Date,
    updated_at: a.updatedAt as Date,
    deleted_at: a.deletedAt,
  };
}

export async function findAccounts(): Promise<Account[]> {
  const rows = await prisma.account.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toAccount);
}

export async function findAccountById(id: string, userId: string): Promise<Account | null> {
  const row = await prisma.account.findFirst({ where: { id, deletedAt: null } });
  return row ? toAccount(row) : null;
}

export async function createAccount(userId: string, data: AccountCreate): Promise<Account> {
  const row = await prisma.account.create({
    data: { userId, name: data.name, type: data.type, balance: data.balance ?? 0 },
  });
  return toAccount(row);
}

export async function updateAccount(id: string, userId: string, data: AccountUpdate): Promise<Account | null> {
  const patch: { name?: string; balance?: number } = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.balance !== undefined) patch.balance = data.balance;

  if (Object.keys(patch).length === 0) return findAccountById(id, userId);

  const res = await prisma.account.updateMany({ where: { id, deletedAt: null }, data: patch });
  if (res.count === 0) return null;
  return findAccountById(id, userId);
}

export async function softDeleteAccount(id: string, userId: string): Promise<boolean> {
  const res = await prisma.account.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return res.count > 0;
}

export async function adjustAccountBalance(id: string, delta: number): Promise<void> {
  await prisma.account.update({ where: { id }, data: { balance: { increment: delta } } });
}
