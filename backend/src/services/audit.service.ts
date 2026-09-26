import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';

type EventoAuditoria =
  | 'CONTA_CRIADA' | 'CONTA_EDITADA' | 'CONTA_DELETADA'
  | 'CATEGORIA_CRIADA' | 'CATEGORIA_EDITADA' | 'CATEGORIA_DELETADA'
  | 'TRANSACAO_CRIADA' | 'TRANSACAO_EDITADA' | 'TRANSACAO_DELETADA'
  | 'ORCAMENTO_CRIADO' | 'ORCAMENTO_EDITADO' | 'ORCAMENTO_DELETADO'
  | 'USUARIO_CRIADO' | 'USUARIO_EDITADO' | 'USUARIO_DELETADO';

export async function registrarAuditoria(
  usuarioId: string,
  tipoEvento: EventoAuditoria,
  entidade: string,
  entidadeId: string,
  payloadAntes: unknown = null,
  payloadDepois: unknown = null
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      usuarioId,
      tipoEvento,
      entidade,
      entidadeId,
      payloadAntes: payloadAntes == null ? Prisma.DbNull : (payloadAntes as Prisma.InputJsonValue),
      payloadDepois: payloadDepois == null ? Prisma.DbNull : (payloadDepois as Prisma.InputJsonValue),
    },
  });
}
