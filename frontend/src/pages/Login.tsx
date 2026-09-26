import { Navigate } from 'react-router-dom';
import { Login as LoginForm } from '../components/auth/Login';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

/**
 * Tela de login: "Entrar com Microsoft" e, na versão de demonstração, "Entrar
 * como demonstração". O dev-login por senha foi removido.
 *
 * As duas guardas abaixo existem porque o retorno do SSO cai na raiz do site, e
 * não numa rota própria de callback:
 *
 *  - `autenticando`: a Microsoft já autenticou, mas a troca do idToken pelo JWT
 *    interno é assíncrona. Nesse intervalo o guarda de rota manda para cá. Sem
 *    mostrar carregamento, a pessoa vê a tela de login reaparecer bem depois de
 *    ter escolhido a conta — parece que o login falhou.
 *
 *  - `token`: quando a troca termina, é preciso sair daqui. Sem isto o usuário
 *    ficava LOGADO parado na tela de login, sem nada acontecer: o backend
 *    registrava o acesso (last_login preenchido, conta vinculada ao Entra) e a
 *    interface continuava pedindo login.
 */
export function Login() {
  const { token, autenticando } = useAuth();

  if (token) return <Navigate to="/dashboard" replace />;
  if (autenticando) return <LoadingSpinner />;

  return <LoginForm />;
}
