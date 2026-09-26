import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isMsalConfigured } from '../../lib/msal-config';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { config } from '../../config/runtimeConfig';
import { entrarComoDemo } from '../../services/auth.service';

/**
 * Tela de login. A autenticação é exclusivamente pelo Entra ID (Microsoft).
 *
 * O antigo dev-login (usuário e senha em formulário) foi removido: era previsto
 * apenas para desenvolvimento local e, publicado, expunha login por senha na
 * internet.
 *
 * Na versão de demonstração (`VITE_DEMO_MODE=true`) aparece também o botão
 * "Entrar como demonstração", que abre a sessão de um usuário fictício. Sem o
 * Entra configurado, o botão da Microsoft some e fica só o da demo.
 */
export function Login() {
  const { loginWithMicrosoft, login } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const msalPronto = isMsalConfigured();
  const mostrarMicrosoft = msalPronto || !config.demoMode;

  // Quem chegou aqui por sessão expirada não errou nada: o aviso explica por que
  // foi interrompido, em vez de a tela simplesmente reaparecer sem motivo.
  const sessaoExpirada =
    new URLSearchParams(window.location.search).get('sessao') === 'expirada';

  const entrarComMicrosoft = async () => {
    setCarregando(true);
    setErro('');
    try {
      await loginWithMicrosoft();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Erro ao iniciar login com Microsoft.'
      );
      setCarregando(false);
    }
  };

  const entrarNaDemo = async () => {
    setCarregando(true);
    setErro('');
    try {
      const sessao = await entrarComoDemo();
      login(sessao.token, sessao.user);
    } catch {
      setErro('Não foi possível abrir a demonstração. Tente novamente em instantes.');
      setCarregando(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--ufly-gradient)' }}
    >
      <Card padding="lg" className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center px-6 py-4 rounded-xl mb-3"
            style={{ background: 'var(--ufly-gradient)' }}
          >
            <img src={`${import.meta.env.BASE_URL}brand/logo-ufly-mark-white.svg`} alt="Ufly" className="h-9" />
          </div>
          <p
            className="text-sm tracking-[0.16em] uppercase font-medium"
            style={{ color: 'var(--neutral-500)' }}
          >
            Controle Financeiro
          </p>
        </div>

        {sessaoExpirada && !erro && (
          <p
            className="text-sm mb-4 px-3 py-2"
            style={{
              color: 'var(--warning-dark)',
              background: 'var(--warning-soft)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        )}

        {erro && (
          <p
            className="text-sm mb-4 px-3 py-2"
            style={{
              color: 'var(--danger-dark)',
              background: 'var(--danger-soft)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {erro}
          </p>
        )}

        {config.demoMode && (
          <>
            <Button
              type="button"
              onClick={entrarNaDemo}
              disabled={carregando}
              className="w-full"
              size="lg"
            >
              {carregando ? 'Entrando...' : 'Entrar como demonstração'}
            </Button>
            <p className="text-xs mt-3 text-center" style={{ color: 'var(--neutral-500)' }}>
              Acesso com um usuário e dados fictícios — sem cadastro.
            </p>
          </>
        )}

        {mostrarMicrosoft && (
        <Button
          type="button"
          onClick={entrarComMicrosoft}
          disabled={!msalPronto || carregando}
          className={config.demoMode ? 'w-full mt-4' : 'w-full'}
          size="lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
            <path fill="#f25022" d="M0 0h11v11H0z" />
            <path fill="#00a4ef" d="M0 12h11v11H0z" />
            <path fill="#7fba00" d="M12 0h11v11H12z" />
            <path fill="#ffb900" d="M12 12h11v11H12z" />
          </svg>
          {carregando ? 'Redirecionando...' : 'Entrar com Microsoft 365'}
        </Button>
        )}

        {mostrarMicrosoft && !msalPronto && (
          <p className="text-xs mt-3 text-center" style={{ color: 'var(--neutral-500)' }}>
            Login Microsoft não configurado neste ambiente. Defina as variáveis do
            Entra ID (client id e tenant id) para habilitar o acesso.
          </p>
        )}
      </Card>
    </div>
  );
}
