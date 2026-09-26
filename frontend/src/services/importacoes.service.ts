import api from './api';
import type { NotaExtraction } from '@ufly/shared';

/**
 * Importação de documentos em segundo plano.
 *
 * O envio responde na hora e a leitura corre no servidor: a pessoa envia um
 * lote, continua trabalhando, e volta quando as leituras estiverem prontas.
 */

export type StatusImportacao =
  | 'na_fila'
  | 'lendo'
  | 'pronta'
  | 'falhou'
  | 'confirmada'
  | 'descartada';

export interface Importacao {
  id: string;
  arquivoId: string;
  nomeOriginal: string;
  mimetype: string;
  tamanho: number;
  status: StatusImportacao;
  resultado: NotaExtraction | null;
  erro: string | null;
  criadoEm: string;
}

/** Envia um ou mais documentos. Devolve as leituras enfileiradas. */
export async function enviarDocumentos(arquivos: File[]): Promise<Importacao[]> {
  const form = new FormData();
  for (const arquivo of arquivos) form.append('files', arquivo);
  const res = await api.post<{ importacoes: Importacao[] }>('/importacoes', form);
  return res.data.importacoes;
}

/** As leituras do próprio usuário que ainda pedem atenção. */
export async function listarImportacoes(): Promise<Importacao[]> {
  const res = await api.get<{ importacoes: Importacao[] }>('/importacoes');
  return res.data.importacoes;
}

/** Vincula a leitura ao lançamento criado, tirando-a da fila. */
export async function confirmarImportacao(id: string, transactionId: string): Promise<void> {
  await api.post(`/importacoes/${id}/confirmar`, { transactionId });
}

/** Descarta a leitura sem criar lançamento. O anexo não é apagado. */
export async function descartarImportacao(id: string): Promise<void> {
  await api.delete(`/importacoes/${id}`);
}
