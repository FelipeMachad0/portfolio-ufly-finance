interface AppConfig {
  VITE_API_URL: string;
  VITE_APP_NAME: string;
  VITE_MSAL_CLIENT_ID: string;
  VITE_MSAL_AUTHORITY: string;
  VITE_MSAL_REDIRECT_URI: string;
  VITE_DEMO_MODE: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>;
  }
}

const buildTimeEnv: Partial<AppConfig> = {
  VITE_API_URL: import.meta.env.VITE_API_URL as string | undefined,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME as string | undefined,
  VITE_MSAL_CLIENT_ID: import.meta.env.VITE_MSAL_CLIENT_ID as string | undefined,
  VITE_MSAL_AUTHORITY: import.meta.env.VITE_MSAL_AUTHORITY as string | undefined,
  VITE_MSAL_REDIRECT_URI: import.meta.env.VITE_MSAL_REDIRECT_URI as string | undefined,
  VITE_DEMO_MODE: import.meta.env.VITE_DEMO_MODE as string | undefined,
};

function read(key: keyof AppConfig): string {
  const runtime = window.__APP_CONFIG__?.[key];
  if (runtime !== undefined && runtime !== '' && !runtime.startsWith('${')) {
    return runtime;
  }
  return buildTimeEnv[key] ?? '';
}

export const config = {
  apiUrl: read('VITE_API_URL') || '/api',
  appName: read('VITE_APP_NAME') || 'Ufly Controle Financeiro',
  msalClientId: read('VITE_MSAL_CLIENT_ID'),
  msalAuthority: read('VITE_MSAL_AUTHORITY'),
  msalRedirectUri: read('VITE_MSAL_REDIRECT_URI'),
  /** Mostra o botão "Entrar como demonstração" (o backend precisa de DEMO_MODE=true). */
  demoMode: read('VITE_DEMO_MODE') === 'true' || import.meta.env.VITE_STATIC_DEMO === 'true',
};
