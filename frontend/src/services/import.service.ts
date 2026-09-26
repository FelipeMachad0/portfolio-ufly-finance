import api from './api';

export interface PreviewRow {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category?: string;
  account?: string;
  accountId: string | null;
  categoryId: string | null;
  isDuplicate: boolean;
  isValid: boolean;
}

export interface ImportPreview {
  totalRows: number;
  duplicates: number;
  rows: PreviewRow[];
}

export async function previewImport(formData: FormData): Promise<ImportPreview> {
  const res = await api.post<ImportPreview>('/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function confirmImport(rows: PreviewRow[]): Promise<{ imported: number; message: string }> {
  const res = await api.post<{ imported: number; message: string }>('/import/confirm', { rows });
  return res.data;
}
