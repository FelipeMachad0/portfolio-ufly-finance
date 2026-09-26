import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import type { ClienteCreate, ClienteUpdate } from '@ufly/shared';

export async function findClientes() {
  return prisma.cliente.findMany({
    where: { deletedAt: null },
    orderBy: { nome: 'asc' },
  });
}

export async function findClienteById(id: string, userId: string) {
  return prisma.cliente.findFirst({ where: { id, deletedAt: null } });
}

export async function createCliente(userId: string, data: ClienteCreate) {
  return prisma.cliente.create({
    data: {
      userId,
      nome: data.nome,
      empresas: (data.empresas ?? []) as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function updateCliente(id: string, userId: string, data: ClienteUpdate) {
  const patch: { nome?: string; empresas?: Prisma.InputJsonValue } = {};
  if (data.nome !== undefined) patch.nome = data.nome;
  if (data.empresas !== undefined) patch.empresas = data.empresas as unknown as Prisma.InputJsonValue;

  const res = await prisma.cliente.updateMany({ where: { id, deletedAt: null }, data: patch });
  if (res.count === 0) return null;
  return findClienteById(id, userId);
}

export async function softDeleteCliente(id: string, userId: string) {
  const res = await prisma.cliente.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return res.count > 0;
}
