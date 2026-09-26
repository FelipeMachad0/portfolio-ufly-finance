import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepararInstanciaMsal, type InstanciaMsal } from '../lib/msal-bootstrap';

type Conta = { username: string };

/** Instância falsa: o preparo só depende destes cinco métodos. */
function instanciaFalsa(over: Partial<Record<keyof InstanciaMsal, unknown>> = {}) {
  let ativa: Conta | null = null;
  const pca = {
    initialize: vi.fn().mockResolvedValue(undefined),
    handleRedirectPromise: vi.fn().mockResolvedValue(null),
    getAllAccounts: vi.fn().mockReturnValue([]),
    getActiveAccount: vi.fn(() => ativa),
    setActiveAccount: vi.fn((c: Conta) => {
      ativa = c;
    }),
    ...over,
  };
  return pca as unknown as InstanciaMsal & typeof pca;
}

describe('prepararInstanciaMsal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('processa o retorno do redirect — sem isso o login volta para a tela de login', async () => {
    // Regressão do defeito real: `initialize()` não redime a resposta que a
    // Microsoft devolve na URL. Pular esta chamada fazia o usuário autenticar,
    // ser redirecionado de volta e cair na tela de login de novo, sem o backend
    // sequer ser chamado.
    const pca = instanciaFalsa();
    await prepararInstanciaMsal(pca);
    expect(pca.handleRedirectPromise).toHaveBeenCalledOnce();
  });

  it('inicializa antes de processar o redirect', async () => {
    const ordem: string[] = [];
    const pca = instanciaFalsa({
      initialize: vi.fn(async () => {
        ordem.push('initialize');
      }),
      handleRedirectPromise: vi.fn(async () => {
        ordem.push('handleRedirect');
        return null;
      }),
    });
    await prepararInstanciaMsal(pca);
    expect(ordem).toEqual(['initialize', 'handleRedirect']);
  });

  it('define como ativa a conta que veio do redirect', async () => {
    const conta = { username: 'maria.souza@exemplo.com.br' };
    const pca = instanciaFalsa({
      handleRedirectPromise: vi.fn().mockResolvedValue({ account: conta }),
    });
    await prepararInstanciaMsal(pca);
    expect(pca.setActiveAccount).toHaveBeenCalledWith(conta);
  });

  it('sem redirect, aproveita a sessão em cache do navegador', async () => {
    const conta = { username: 'volta@exemplo.com.br' };
    const pca = instanciaFalsa({ getAllAccounts: vi.fn().mockReturnValue([conta]) });
    await prepararInstanciaMsal(pca);
    expect(pca.setActiveAccount).toHaveBeenCalledWith(conta);
  });

  it('não sobrescreve uma conta ativa já existente', async () => {
    const emCache = { username: 'outra@exemplo.com.br' };
    const pca = instanciaFalsa({
      getAllAccounts: vi.fn().mockReturnValue([emCache]),
      getActiveAccount: vi.fn().mockReturnValue({ username: 'ativa@exemplo.com.br' }),
    });
    await prepararInstanciaMsal(pca);
    expect(pca.setActiveAccount).not.toHaveBeenCalled();
  });

  it('erro do Entra não derruba o boot — a tela de login precisa aparecer', async () => {
    // Consentimento negado, conta sem acesso ao app: se a exceção subisse, o
    // bootstrap falharia e a pessoa ficaria sem tela para tentar de novo.
    const pca = instanciaFalsa({
      handleRedirectPromise: vi.fn().mockRejectedValue(new Error('AADSTS65004')),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(prepararInstanciaMsal(pca)).resolves.toBeUndefined();
  });
});
