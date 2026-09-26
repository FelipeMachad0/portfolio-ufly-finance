import api from './api';
import type { AuthUser } from '../store/authContext';

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function entraCallback(idToken: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/entra/callback', {
    idToken,
  });
  return response.data;
}

/** Sessão do usuário fictício — só responde com DEMO_MODE=true no backend. */
export async function entrarComoDemo(): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/demo');
  return response.data;
}

export async function logoutApi(): Promise<void> {
  await api.post('/auth/logout');
}
