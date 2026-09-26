import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * O interceptor derruba a sessão uma vez só e depois marca um estado de módulo,
 * então cada teste precisa de uma instância nova.
 */
async function carregarApi() {
  vi.resetModules();
  const mod = await import('../services/api');
  return mod.default;
}

/** Dispara o handler de erro do interceptor de resposta como o axios faria. */
async function simular401(api: Awaited<ReturnType<typeof carregarApi>>, url: string) {
  const handlers = (
    api.interceptors.response as unknown as {
      handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }>;
    }
  ).handlers;
  const erro = { response: { status: 401 }, config: { url } };
  await expect(handlers[0].rejected(erro)).rejects.toEqual(erro);
}

describe('sessão expirada (401)', () => {
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockClear();
    sessionStorage.setItem('auth_token', 'token-velho');
    sessionStorage.setItem('user', '{"id":"1"}');
    Object.defineProperty(window, 'location', {
      value: { assign, search: '', pathname: '/transactions', origin: 'http://localhost' },
      writable: true,
    });
  });

  afterEach(() => sessionStorage.clear());

  it('limpa a sessão e volta para o login', async () => {
    const api = await carregarApi();
    await simular401(api, '/transactions');

    expect(sessionStorage.getItem('auth_token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login?sessao=expirada');
  });

  it('redireciona uma vez só, mesmo com várias chamadas falhando juntas', async () => {
    const api = await carregarApi();
    await simular401(api, '/transactions');
    await simular401(api, '/categories');
    await simular401(api, '/accounts');

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('não derruba a sessão quando o 401 vem do próprio login', async () => {
    const api = await carregarApi();
    await simular401(api, '/auth/entra/callback');

    // A tela de login precisa continuar de pé para mostrar o erro da tentativa.
    expect(sessionStorage.getItem('auth_token')).toBe('token-velho');
    expect(assign).not.toHaveBeenCalled();
  });

  it('deixa outros erros passarem sem mexer na sessão', async () => {
    const api = await carregarApi();
    const handlers = (
      api.interceptors.response as unknown as {
        handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }>;
      }
    ).handlers;
    const erro = { response: { status: 500 }, config: { url: '/transactions' } };
    await expect(handlers[0].rejected(erro)).rejects.toEqual(erro);

    expect(sessionStorage.getItem('auth_token')).toBe('token-velho');
    expect(assign).not.toHaveBeenCalled();
  });
});
