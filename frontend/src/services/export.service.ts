import api from './api';
import { dateParams } from './dateParams';

/** Extrai o filename do Content-Disposition; usa o padrão se o header não vier. */
function filenameFrom(headerValue: unknown, fallback: string): string {
  const match = /filename="?([^"]+)"?/.exec(String(headerValue ?? ''));
  return match?.[1] ?? fallback;
}

/** Dispara o download de um blob já baixado, liberando a URL temporária. */
function saveBlob(data: BlobPart, filename: string): void {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

async function downloadXlsx(
  path: string,
  fallbackName: string,
  params?: Record<string, string>
): Promise<void> {
  const res = await api.get(path, { params, responseType: 'blob' });
  saveBlob(res.data as BlobPart, filenameFrom(res.headers['content-disposition'], fallbackName));
}

export async function downloadTransactions(startDate?: Date, endDate?: Date): Promise<void> {
  await downloadXlsx('/export/transactions', 'transacoes.xlsx', dateParams(startDate, endDate));
}

export async function downloadReport(startDate?: Date, endDate?: Date): Promise<void> {
  await downloadXlsx('/export/report', 'relatorio-financeiro.xlsx', dateParams(startDate, endDate));
}

/**
 * Planilha completa de controle financeiro: TODOS os lançamentos (entradas e
 * saídas), uma aba por categoria, independente dos filtros da tela.
 */
export async function downloadControleFinanceiro(): Promise<void> {
  await downloadXlsx('/export/completo', 'controle-financeiro.xlsx');
}
