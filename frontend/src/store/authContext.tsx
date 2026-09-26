import {
  createContext,
  type ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest, isMsalConfigured } from '../lib/msal-config';
import { entraCallback as exchangeEntraToken } from '../services/auth.service';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  loginWithMicrosoft: () => Promise<void>;
  msalReady: boolean;
  /**
   * A Microsoft já autenticou, mas ainda não temos o JWT interno. Existe porque
   * essa troca é assíncrona: sem distinguir "não logado" de "logando", o guarda
   * de rota manda para a tela de login no meio do processo.
   */
  autenticando: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Sessão lida de forma SÍNCRONA na inicialização do estado.
 *
 * Restaurar dentro de um useEffect criava uma corrida com o guarda de rota
 * (`token ? children : <Navigate to="/login">`): no primeiro render o token
 * ainda era null, o redirect disparava, e quem recarregava a página logado caía
 * na tela de login mesmo com a sessão válida guardada.
 */
function lerSessaoSalva(): { token: string | null; user: AuthUser | null } {
  try {
    const token = sessionStorage.getItem('auth_token');
    const raw = sessionStorage.getItem('user');
    if (!token || !raw) return { token: null, user: null };
    return { token, user: JSON.parse(raw) as AuthUser };
  } catch {
    // sessionStorage indisponível ou JSON corrompido — trata como deslogado.
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => lerSessaoSalva().user);
  const [token, setToken] = useState<string | null>(() => lerSessaoSalva().token);
  const { instance } = useMsal();
  const isMsalAuthenticated = useIsAuthenticated();
  const exchangedRef = useRef(false);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    sessionStorage.setItem('auth_token', newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
    if (isMsalConfigured() && isMsalAuthenticated) {
      void instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
      });
    }
  }, [instance, isMsalAuthenticated]);

  const loginWithMicrosoft = useCallback(async () => {
    if (!isMsalConfigured()) {
      throw new Error('Login Microsoft não configurado');
    }
    await instance.loginRedirect(loginRequest);
  }, [instance]);

  // Após o MSAL autenticar, troca idToken por JWT interno (uma vez)
  useEffect(() => {
    if (!isMsalConfigured()) return;
    if (!isMsalAuthenticated) return;
    if (token) return; // já temos JWT interno
    if (exchangedRef.current) return;

    const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
    if (!account) return;
    exchangedRef.current = true;

    (async () => {
      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        if (!result.idToken) {
          throw new Error('idToken ausente na resposta do MSAL');
        }
        const exchanged = await exchangeEntraToken(result.idToken);
        login(exchanged.token, exchanged.user);
      } catch (err) {
        exchangedRef.current = false;
        if (err instanceof InteractionRequiredAuthError) {
          await instance.loginRedirect(loginRequest);
        } else {
          // eslint-disable-next-line no-console
          console.error('Falha ao trocar idToken por JWT interno', err);
        }
      }
    })();
  }, [isMsalAuthenticated, instance, token, login]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        loginWithMicrosoft,
        msalReady: isMsalConfigured(),
        autenticando: isMsalConfigured() && isMsalAuthenticated && !token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
