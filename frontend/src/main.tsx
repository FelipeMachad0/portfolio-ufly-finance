import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PublicClientApplication,
  EventType,
  type AuthenticationResult,
} from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import '@fontsource/zalando-sans/400.css';
import '@fontsource/zalando-sans/500.css';
import '@fontsource/zalando-sans/600.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/globals.css';
import App from './App';
import { msalConfig, isMsalConfigured } from './lib/msal-config';
import { prepararInstanciaMsal } from './lib/msal-bootstrap';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

/**
 * O MSAL exige a Web Crypto API, que o navegador só expõe em contexto seguro
 * (HTTPS ou localhost). Construí-lo em HTTP puro lança
 * `BrowserAuthError: crypto_nonexistent` e derruba o módulo inteiro antes do
 * primeiro render — página branca, sem pista. Por isso decidimos ANTES de
 * instanciar, em vez de tentar e tratar.
 */
function podeUsarMsal(): boolean {
  const contextoSeguro =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof window.crypto?.subtle !== 'undefined';
  return isMsalConfigured() && contextoSeguro;
}

/**
 * Sem isto, qualquer exceção na inicialização deixa a página em branco, sem
 * nada no DOM e sem pista do motivo — foi o que aconteceu quando o MSAL recebeu
 * clientId vazio no container. Pelo menos o erro fica visível na tela.
 */
function renderFalhaDeBoot(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  root!.innerHTML =
    '<div style="font-family:system-ui;padding:2rem;max-width:40rem;margin:0 auto">' +
    '<h1 style="font-size:1.1rem;color:#b91c1c">Falha ao iniciar a aplicação</h1>' +
    '<p style="color:#374151;font-size:.9rem">Verifique a configuração do ambiente ' +
    '(config.js / variáveis do container).</p>' +
    '<pre style="background:#f3f4f6;padding:.75rem;border-radius:.375rem;' +
    'font-size:.8rem;white-space:pre-wrap">' +
    msg.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!) +
    '</pre></div>';
}

async function bootstrap(): Promise<void> {
  // Sem MSAL viável, a aplicação sobe sem o MsalProvider: os hooks do
  // msal-react caem no contexto padrão (instância stub) e todo uso de
  // `instance` no authContext já é guardado por isMsalConfigured(). A tela de
  // login informa que o Entra não está configurado.
  if (!podeUsarMsal()) {
    createRoot(root!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    return;
  }

  const pca = new PublicClientApplication(msalConfig);
  // Inicializa, processa o retorno do redirect e define a conta ativa.
  // Ver msal-bootstrap.ts: pular o handleRedirectPromise devolvia o usuário
  // para a tela de login depois de autenticar na Microsoft.
  await prepararInstanciaMsal(pca);
  pca.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const result = event.payload as AuthenticationResult;
      if (result.account) pca.setActiveAccount(result.account);
    }
  });

  createRoot(root!).render(
    <StrictMode>
      <MsalProvider instance={pca}>
        <App />
      </MsalProvider>
    </StrictMode>
  );
}

void bootstrap().catch(renderFalhaDeBoot);
