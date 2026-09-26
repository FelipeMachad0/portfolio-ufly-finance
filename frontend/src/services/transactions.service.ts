import api from './api';
import type {
  TransactionCreate,
  TransactionMetadata,
  TransactionUpdate,
  PaginatedResponse,
} from '@ufly/shared';

export interface TransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  /** Valores dos campos dinâmicos da categoria. */
  metadata: TransactionMetadata;
  created_at: string;
  updated_at: string;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  /** Busca textual em descrição */
  search?: string;
  page?: number;
  limit?: number;
}

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<PaginatedResponse<TransactionRow>> {
  const res = await api.get<PaginatedResponse<TransactionRow>>('/transactions', { params: filters });
  return res.data;
}

export async function createTransaction(data: TransactionCreate): Promise<TransactionRow> {
  const res = await api.post<TransactionRow>('/transactions', data);
  return res.data;
}

export async function updateTransaction(id: string, data: TransactionUpdate): Promise<TransactionRow> {
  const res = await api.put<TransactionRow>(`/transactions/${id}`, data);
  return res.data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/transactions/${id}`);
}
