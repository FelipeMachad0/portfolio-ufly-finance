import api from './api';
import type { Account, AccountCreate, AccountUpdate } from '@ufly/shared';

export async function getAccounts(): Promise<Account[]> {
  const res = await api.get<Account[]>('/accounts');
  return res.data;
}

export async function getAccount(id: string): Promise<Account> {
  const res = await api.get<Account>(`/accounts/${id}`);
  return res.data;
}

export async function createAccount(data: AccountCreate): Promise<Account> {
  const res = await api.post<Account>('/accounts', data);
  return res.data;
}

export async function updateAccount(id: string, data: AccountUpdate): Promise<Account> {
  const res = await api.put<Account>(`/accounts/${id}`, data);
  return res.data;
}

export async function deleteAccount(id: string): Promise<void> {
  await api.delete(`/accounts/${id}`);
}
