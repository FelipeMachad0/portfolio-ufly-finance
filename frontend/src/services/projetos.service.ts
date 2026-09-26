import api from './api';
import type { ProjetoCreate, ProjetoUpdate, ProjetoItem, ContratoRef } from '@ufly/shared';

export interface ProjetoRow {
  id: string;
  clienteId: string;
  cliente: { id: string; nome: string };
  nome: string;
  descricao: string | null;
  contrato: ContratoRef | null;
  inicioMaster: string | null;
  fimMaster: string | null;
  itens: ProjetoItem[];
  createdAt: string | null;
}

export async function getProjetos(): Promise<ProjetoRow[]> {
  const res = await api.get<ProjetoRow[]>('/projetos');
  return res.data;
}

export async function createProjeto(data: ProjetoCreate): Promise<ProjetoRow> {
  const res = await api.post<ProjetoRow>('/projetos', data);
  return res.data;
}

export async function updateProjeto(id: string, data: ProjetoUpdate): Promise<ProjetoRow> {
  const res = await api.put<ProjetoRow>(`/projetos/${id}`, data);
  return res.data;
}

export async function deleteProjeto(id: string): Promise<void> {
  await api.delete(`/projetos/${id}`);
}
