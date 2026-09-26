import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Login } from '../pages/Login';

const estado = {
  token: null as string | null,
  autenticando: false,
};

vi.mock('../hooks/useAuth', () => ({ useAuth: () => estado }));
vi.mock('../components/auth/Login', () => ({
  Login: () => <div>formulário de login</div>,
}));

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>painel</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Login', () => {
  it('mostra o formulário quando não há sessão', () => {
    estado.token = null;
    estado.autenticando = false;
    renderizar();
    expect(screen.getByText('formulário de login')).toBeInTheDocument();
  });

  it('sai da tela de login assim que existe token', () => {
    // Regressão do defeito real: o SSO completava (backend registrava
    // last_login e vinculava a conta ao Entra) e a pessoa continuava vendo a
    // tela de login, já autenticada, sem nada acontecer.
    estado.token = 'jwt-interno';
    estado.autenticando = false;
    renderizar();
    expect(screen.getByText('painel')).toBeInTheDocument();
    expect(screen.queryByText('formulário de login')).not.toBeInTheDocument();
  });

  it('mostra carregamento enquanto a troca de token está em curso', () => {
    // Sem isto, a tela de login reaparecia no meio do processo e parecia falha.
    estado.token = null;
    estado.autenticando = true;
    renderizar();
    expect(screen.queryByText('formulário de login')).not.toBeInTheDocument();
  });
});
