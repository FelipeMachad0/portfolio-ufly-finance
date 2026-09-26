import { prisma } from '../database/prisma';
import type { NotaExtraction } from '@ufly/shared';

/**
 * Fila de documentos enviados para leitura automática.
 *
 * A linha pertence a quem enviou — diferente de `transactions`, onde `user_id` é
 * só metadado. Uma leitura pendente é rascunho: quem não viu o documento chegar
 * não deve confirmar um lançamento a partir dele. Depois de confirmado, o
 * lançamento é da plataforma como qualquer outro.
 */

export type StatusImportacao =
  | 'na_fila'
  | 'lendo'
  | 'pronta'
  | 'falhou'
  | 'confirmada'
  | 'descartada';

export interface DocumentoImportado {
  id: string;
  userId: string;
  arquivoId: string;
  nomeOriginal: string;
  mimetype: string;
  tamanho: number;
  status: StatusImportacao;
  resultado: NotaExtraction | null;
  erro: string | null;
  transactionId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  iniciadoEm: Date | null;
}

/** Enfileira o documento já anexado. A leitura acontece em segundo plano. */
export async function enfileirar(dados: {
  userId: string;
  arquivoId: string;
  nomeOriginal: string;
  mimetype: string;
  tamanho: number;
}): Promise<DocumentoImportado> {
  return prisma.documentoImportado.create({ data: dados }) as unknown as Promise<DocumentoImportado>;
}

/** A bandeja de quem enviou: o que ainda espera atenção. */
export async function listarPendentes(userId: string): Promise<DocumentoImportado[]> {
  return prisma.documentoImportado.findMany({
    where: { userId, status: { in: ['na_fila', 'lendo', 'pronta', 'falhou'] } },
    orderBy: { criadoEm: 'asc' },
  }) as unknown as Promise<DocumentoImportado[]>;
}

export async function buscarDoUsuario(
  id: string,
  userId: string
): Promise<DocumentoImportado | null> {
  return prisma.documentoImportado.findFirst({
    where: { id, userId },
  }) as unknown as Promise<DocumentoImportado | null>;
}

/**
 * O que o processo em segundo plano precisa olhar, de todos os usuários.
 * `na_fila` para disparar, `lendo` para acompanhar.
 */
export async function listarParaProcessar(limite = 20): Promise<DocumentoImportado[]> {
  return prisma.documentoImportado.findMany({
    where: { status: { in: ['na_fila', 'lendo'] } },
    orderBy: { criadoEm: 'asc' },
    take: limite,
  }) as unknown as Promise<DocumentoImportado[]>;
}

export async function marcarLendo(id: string): Promise<void> {
  await prisma.documentoImportado.update({
    where: { id },
    data: { status: 'lendo', iniciadoEm: new Date() },
  });
}

export async function marcarPronta(id: string, resultado: NotaExtraction): Promise<void> {
  await prisma.documentoImportado.update({
    where: { id },
    data: { status: 'pronta', resultado: resultado as unknown as object, erro: null },
  });
}

export async function marcarFalhou(id: string, erro: string): Promise<void> {
  await prisma.documentoImportado.update({
    // VarChar(500) no banco: erro de biblioteca pode vir com stack enorme.
    where: { id },
    data: { status: 'falhou', erro: erro.slice(0, 500) },
  });
}

export async function marcarConfirmada(id: string, transactionId: string): Promise<void> {
  await prisma.documentoImportado.update({
    where: { id },
    data: { status: 'confirmada', transactionId },
  });
}

export async function marcarDescartada(id: string): Promise<void> {
  await prisma.documentoImportado.update({ where: { id }, data: { status: 'descartada' } });
}

/**
 * Volta para a fila o que ficou preso em `lendo` além do prazo.
 *
 * Chamado na subida do backend: um restart no meio da leitura deixaria a linha
 * em `lendo` para sempre, sem ninguém acompanhando. Reenfileirar é seguro porque
 * a leitura é idempotente: ler o mesmo arquivo de novo dá o mesmo resultado.
 */
export async function reenfileirarOrfas(idadeMinutos: number): Promise<number> {
  const limite = new Date(Date.now() - idadeMinutos * 60_000);
  const { count } = await prisma.documentoImportado.updateMany({
    where: { status: 'lendo', OR: [{ iniciadoEm: { lt: limite } }, { iniciadoEm: null }] },
    data: { status: 'na_fila', iniciadoEm: null },
  });
  return count;
}
