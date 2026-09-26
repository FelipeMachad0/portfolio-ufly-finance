import api from './api';
import type { Cliente, ClienteCreate, ClienteUpdate } from '@ufly/shared';

export async function getClientes(): Promise<Cliente[]> {
  const res = await api.get<Cliente[]>('/clientes');
  return res.data;
}

export async function createCliente(data: ClienteCreate): Promise<Cliente> {
  const res = await api.post<Cliente>('/clientes', data);
  return res.data;
}

export async function updateCliente(id: string, data: ClienteUpdate): Promise<Cliente> {
  const res = await api.put<Cliente>(`/clientes/${id}`, data);
  return res.data;
}

export async function deleteCliente(id: string): Promise<void> {
  await api.delete(`/clientes/${id}`);
}
