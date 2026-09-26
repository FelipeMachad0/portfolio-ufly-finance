import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import type { CategoryField } from '@ufly/shared';

export type TipoLancamento = 'income' | 'expense';

/**
 * Campos padrão por tipo (Entrada/Saída) — CONFIGURAÇÃO DA PLATAFORMA, não de
 * cada usuário: todos veem e editam o mesmo conjunto.
 *
 * A tabela ainda carrega a unique (user_id, tipo) do desenho antigo, por
 * usuário. Para não duplicar configuração, a escrita reaproveita a linha que já
 * existe para o tipo — de qualquer autor — e só cria uma nova quando não há
 * nenhuma. Remover user_id da tabela é o passo definitivo, mas exige migration.
 */
export async function getTypeFields(): Promise<Record<TipoLancamento, CategoryField[]>> {
  const rows = await prisma.typeFieldSchema.findMany({ orderBy: { createdAt: 'asc' } });
  const out: Record<TipoLancamento, CategoryField[]> = { income: [], expense: [] };
  const vistos = new Set<string>();
  for (const r of rows) {
    if ((r.tipo === 'income' || r.tipo === 'expense') && !vistos.has(r.tipo)) {
      vistos.add(r.tipo);
      out[r.tipo] = (r.fieldsSchema as unknown as CategoryField[]) ?? [];
    }
  }
  return out;
}

export async function upsertTypeFields(
  userId: string,
  tipo: TipoLancamento,
  fields: CategoryField[]
): Promise<Record<TipoLancamento, CategoryField[]>> {
  const schema = fields as unknown as Prisma.InputJsonValue;
  // Edita a configuração existente do tipo, seja de quem for. userId entra só
  // como autoria, quando a configuração ainda não existe.
  const existente = await prisma.typeFieldSchema.findFirst({
    where: { tipo },
    orderBy: { createdAt: 'asc' },
  });
  if (existente) {
    await prisma.typeFieldSchema.update({
      where: { id: existente.id },
      data: { fieldsSchema: schema },
    });
  } else {
    await prisma.typeFieldSchema.create({ data: { userId, tipo, fieldsSchema: schema } });
  }
  return getTypeFields();
}
