import api from './api';
import type { UserCreate, UserUpdate } from '@ufly/shared';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'USUARIO' | 'GESTOR_DEPARTAMENTO' | 'GESTOR_GERAL' | 'AUDITOR';
  status: 'ATIVO' | 'INATIVO';
  entra_id: string | null;
  avatar_url: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUsers(filters?: { role?: string; status?: string; search?: string }): Promise<UserRow[]> {
  const res = await api.get<UserRow[]>('/users', { params: filters });
  return res.data;
}

export async function getMe(): Promise<UserRow> {
  const res = await api.get<UserRow>('/users/me');
  return res.data;
}

export interface CreatedUserRow extends UserRow {
  /** Senha padrão atribuída (somente no retorno da criação) */
  defaultPassword?: string;
}

export async function createUser(data: UserCreate): Promise<CreatedUserRow> {
  const res = await api.post<CreatedUserRow>('/users', data);
  return res.data;
}

export async function updateUser(id: string, data: UserUpdate): Promise<UserRow> {
  const res = await api.put<UserRow>(`/users/${id}`, data);
  return res.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
