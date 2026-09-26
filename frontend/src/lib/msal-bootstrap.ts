import type { AuthenticationResult, IPublicClientApplication } from '@azure/msal-browser';

/**
 * Instância mínima de que o preparo precisa. Tipar assim (em vez de exigir a
 * `PublicClientApplication` inteira) é o que torna o teste possível sem subir
 * MSAL de verdade.
 */
export interface InstanciaMsal {
  initialize(): Promise<void>;
  handleRedirectPromise(): Promise<AuthenticationResult | null>;
  getAllAccounts(): IPublicClientApplication extends never ? never : ReturnType<
    IPublicClientApplication['getAllAccounts']
  >;
  getActiveAccount(): ReturnType<IPublicClientApplication['getActiveAccount']>;
  setActiveAccount(conta: Parameters<IPublicClientApplication['setActiveAccount']>[0]): void;
}

/**
 * Prepara a instância do MSAL para uso: inicializa, processa o retorno do
 * redirect e define a conta ativa.
 *
 * `handleRedirectPromise` é OBRIGATÓRIO e não acontece sozinho — `initialize()`
 * não redime a resposta que a Microsoft devolve na URL. Sem ele o login parecia
 * completo (a pessoa escolhia a conta e era redirecionada de volta) e a
 * aplicação voltava para a tela de login: o código de autorização ficava
 * pendurado na URL sem ninguém trocá-lo, nenhuma conta era registrada e o guard
 * de rota devolvia para /login. O backend nem chegava a ser chamado.
 *
 * Um erro vindo do Entra (consentimento negado, conta sem acesso ao app) é
 * registrado e engolido de propósito: derrubar o boot deixaria a pessoa sem a
 * tela de login para tentar de novo.
 */
export async function prepararInstanciaMsal(pca: InstanciaMsal): Promise<void> {
  await pca.initialize();

  let resposta: AuthenticationResult | null = null;
  try {
    resposta = await pca.handleRedirectPromise();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Falha ao processar o retorno do login Microsoft', err);
  }

  if (resposta?.account) {
    pca.setActiveAccount(resposta.account);
    return;
  }

  // Sessão anterior ainda no cache do navegador.
  const contas = pca.getAllAccounts();
  if (contas.length > 0 && !pca.getActiveAccount()) {
    pca.setActiveAccount(contas[0]);
  }
}
