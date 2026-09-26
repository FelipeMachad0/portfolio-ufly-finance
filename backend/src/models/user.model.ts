import { Prisma } from '@prisma/client';
import type { User as PrismaUser } from '@prisma/client';
import { prisma } from '../database/prisma';

export type UserRole = 'USUARIO' | 'GESTOR_DEPARTAMENTO' | 'GESTOR_GERAL' | 'AUDITOR';
export type UserStatus = 'ATIVO' | 'INATIVO';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  entra_id: string | null;
  avatar_url: string | null;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface UserFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}

function toUser(u: PrismaUser): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    status: u.status as UserStatus,
    entra_id: u.entraId,
    avatar_url: u.avatarUrl,
    last_login: u.lastLogin,
    created_at: u.createdAt as Date,
    updated_at: u.updatedAt as Date,
    deleted_at: u.deletedAt,
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const row = await prisma.user.findUnique({ where: { email } });
  return row ? toUser(row) : null;
}

export async function createUser(data: Pick<User, 'email' | 'name'>): Promise<User> {
  const row = await prisma.user.create({ data: { email: data.email, name: data.name } });
  return toUser(row);
}

export async function findOrCreateUser(email: string, name: string): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  return createUser({ email, name });
}

export async function findUserById(id: string): Promise<User | null> {
  const row = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  return row ? toUser(row) : null;
}

export async function findUsers(filters: UserFilters = {}): Promise<User[]> {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (filters.role) where.role = filters.role;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
  return rows.map(toUser);
}

/**
 * Reativa um usuário que estava excluído, aplicando nome e papel informados.
 *
 * O e-mail tem índice único que NÃO conhece `deleted_at`, então recriar alguém
 * removido colidia no INSERT. Reativar em vez de inserir também é o que preserva
 * o histórico: o id continua o mesmo, e o que estava atribuído àquela pessoa
 * permanece coerente.
 */
export async function reactivateUser(data: {
  id: string;
  name: string;
  role: UserRole;
}): Promise<User> {
  const row = await prisma.user.update({
    where: { id: data.id },
    data: {
      name: data.name,
      role: data.role,
      status: 'ATIVO',
      deletedAt: null,
      // Senha antiga não volta: o acesso é pela conta Microsoft.
      passwordHash: null,
    },
  });
  return toUser(row);
}

export async function createUserWithRole(data: {
  email: string;
  name: string;
  role: UserRole;
  passwordHash?: string | null;
}): Promise<User> {
  const row = await prisma.user.create({
    data: { email: data.email, name: data.name, role: data.role, passwordHash: data.passwordHash ?? null },
  });
  return toUser(row);
}

/**
 * Retorna o password_hash de um usuário ativo, ou null se não tiver.
 * Não inclui hash em outros queries (User interface) para evitar leak acidental.
 */
export async function getUserPasswordHash(
  email: string
): Promise<{ id: string; name: string; hash: string | null } | null> {
  const row = await prisma.user.findFirst({
    where: { email, deletedAt: null, status: 'ATIVO' },
    select: { id: true, name: true, passwordHash: true },
  });
  if (!row) return null;
  return { id: row.id, name: row.name, hash: row.passwordHash };
}

export async function updateUserRecord(
  id: string,
  data: { name?: string; role?: UserRole; status?: UserStatus }
): Promise<User | null> {
  const patch: Prisma.UserUpdateManyMutationInput = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.role !== undefined) patch.role = data.role;
  if (data.status !== undefined) patch.status = data.status;

  if (Object.keys(patch).length === 0) return findUserById(id);

  const res = await prisma.user.updateMany({ where: { id, deletedAt: null }, data: patch });
  if (res.count === 0) return null;
  return findUserById(id);
}

export async function softDeleteUser(id: string): Promise<boolean> {
  const res = await prisma.user.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return res.count > 0;
}

export async function updateLastLogin(id: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { lastLogin: new Date() } });
}
