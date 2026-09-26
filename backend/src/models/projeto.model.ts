import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import type { ProjetoCreate, ProjetoUpdate } from '@ufly/shared';

const includeCliente = { cliente: { select: { id: true, nome: true } } } as const;

export async function findProjetos() {
  return prisma.projeto.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: includeCliente,
  });
}

export async function findProjetoById(id: string, userId: string) {
  return prisma.projeto.findFirst({
    where: { id, deletedAt: null },
    include: includeCliente,
  });
}

export async function createProjeto(userId: string, data: ProjetoCreate) {
  return prisma.projeto.create({
    data: {
      userId,
      clienteId: data.clienteId,
      nome: data.nome,
      descricao: data.descricao ?? null,
      contrato: data.contrato ? (data.contrato as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      inicioMaster: data.inicioMaster ?? null,
      fimMaster: data.fimMaster ?? null,
      itens: (data.itens ?? []) as unknown as Prisma.InputJsonValue,
    },
    include: includeCliente,
  });
}

export async function updateProjeto(id: string, userId: string, data: ProjetoUpdate) {
  const patch: Prisma.ProjetoUncheckedUpdateManyInput = {};
  if (data.clienteId !== undefined) patch.clienteId = data.clienteId;
  if (data.nome !== undefined) patch.nome = data.nome;
  if (data.descricao !== undefined) patch.descricao = data.descricao ?? null;
  if (data.contrato !== undefined)
    patch.contrato = data.contrato ? (data.contrato as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  if (data.inicioMaster !== undefined) patch.inicioMaster = data.inicioMaster ?? null;
  if (data.fimMaster !== undefined) patch.fimMaster = data.fimMaster ?? null;
  if (data.itens !== undefined) patch.itens = data.itens as unknown as Prisma.InputJsonValue;

  const res = await prisma.projeto.updateMany({ where: { id, deletedAt: null }, data: patch });
  if (res.count === 0) return null;
  return findProjetoById(id, userId);
}

export async function softDeleteProjeto(id: string, userId: string) {
  const res = await prisma.projeto.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return res.count > 0;
}
