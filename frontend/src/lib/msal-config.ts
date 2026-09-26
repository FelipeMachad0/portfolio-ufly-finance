import { type Configuration, LogLevel } from '@azure/msal-browser';
import { config } from '../config/runtimeConfig';

/**
 * Configuração do MSAL a partir do config de RUNTIME (window.__APP_CONFIG__),
 * não de import.meta.env. Lendo build-time, a mesma imagem de container nunca
 * conseguiria apontar para outro tenant — e, pior, os valores chegariam vazios,
 * porque o build acontece sem os arquivos .env. O config de runtime já cai de
 * volta para import.meta.env em dev local (ver runtimeConfig.ts).
 */
const PLACEHOLDERS = new Set(['your-tenant-id', 'your-client-id', '']);

export const isMsalConfigured = (): boolean => !PLACEHOLDERS.has(config.msalClientId);

/**
 * O construtor do PublicClientApplication REJEITA clientId vazio, e ele é
 * instanciado no topo do main.tsx — um clientId vazio derrubava o módulo inteiro
 * antes de renderizar, resultando em página branca. Quando o MSAL não está
 * configurado usamos um id inerte: o MsalProvider monta em vez de derrubar a
 * aplicação, e a tela de login informa que o Entra não está configurado.
 */
const CLIENT_ID_INERTE = 'msal-nao-configurado';

const authority = config.msalAuthority || 'https://login.microsoftonline.com/common';

export const msalConfig: Configuration = {
  auth: {
    clientId: isMsalConfigured() ? config.msalClientId : CLIENT_ID_INERTE,
    authority,
    redirectUri:
      config.msalRedirectUri ||
      (typeof window !== 'undefined' ? window.location.origin : ''),
    postLogoutRedirectUri:
      typeof window !== 'undefined' ? window.location.origin : '',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: () => {},
    },
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};
