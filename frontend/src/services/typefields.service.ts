import api from './api';
import type { CategoryField } from '@ufly/shared';

export interface TypeFields {
  income: CategoryField[];
  expense: CategoryField[];
}

export async function getTypeFields(): Promise<TypeFields> {
  const res = await api.get<TypeFields>('/type-fields');
  return res.data;
}

export async function updateTypeFields(
  tipo: 'income' | 'expense',
  fieldsSchema: CategoryField[]
): Promise<TypeFields> {
  const res = await api.put<TypeFields>(`/type-fields/${tipo}`, { fieldsSchema });
  return res.data;
}
