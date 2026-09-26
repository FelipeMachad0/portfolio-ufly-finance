import type { Request, Response } from 'express';
import { generateToken } from '../utils/jwt';
import { getUserPasswordHash } from '../models/user.model';
import {
  handleEntraCallback,
  EntraNaoConfiguradoError,
  UsuarioSemAcessoError,
  ClaimDeGruposIndisponivelError,
} from '../services/msal-auth.service';
import { verifyPassword } from '../utils/password';
import { entrarComoDemo } from '../services/demo.service';

/**
 * Login por senha — break-glass.
 *
 * O dev-login foi removido: ele autenticava contra DEV_LOGIN_EMAIL/PASSWORD e,
 * sem essas variáveis, caía num default admin@exemplo.com.br / admin embutido no
 * código — credencial pública num serviço exposto na internet. A autenticação
 * normal da aplicação é pelo Entra ID.
 *
 * O que resta aqui confere apenas o password_hash de usuários cadastrados
 * (bcrypt). Não há tela para isso: existe como saída de emergência caso o Entra
 * fique indisponível, e é usado chamando a API diretamente.
 */
export async function loginComSenha(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' });
      return;
    }

    try {
      const record = await getUserPasswordHash(email);
      if (record && verifyPassword(password, record.hash)) {
        const token = generateToken({ userId: record.id, email });
        res.json({
          token,
          user: { id: record.id, email, name: record.name },
        });
        return;
      }
    } catch {
      // DB indisponível — cai no 401 abaixo
    }

    res.status(401).json({ error: 'Credenciais inválidas' });
  } catch {
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
}

/** POST /api/auth/demo — entra como o usuário fictício (só com DEMO_MODE=true). */
export async function entrarDemo(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await entrarComoDemo());
  } catch (err) {
    console.error('[demo] falha ao entrar:', (err as Error).message);
    res.status(500).json({ error: 'Não foi possível abrir a demonstração' });
  }
}

export async function entraCallback(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ error: 'idToken é obrigatório' });
    return;
  }
  try {
    const result = await handleEntraCallback(idToken);
    res.json(result);
  } catch (err) {
    // 503: falta configuração do ambiente, não é culpa do token.
    if (err instanceof EntraNaoConfiguradoError) {
      res.status(503).json({ error: (err as Error).message });
      return;
    }
    // 403: autenticou no Entra, mas não está em nenhum grupo de acesso.
    if (err instanceof UsuarioSemAcessoError) {
      res.status(403).json({ error: (err as Error).message });
      return;
    }
    // 503: o token é válido, mas o Entra não entregou a lista de grupos
    // (usuário em grupos demais). É limitação de ambiente, não token inválido —
    // devolver 401 mandaria o usuário tentar logar de novo em vão.
    if (err instanceof ClaimDeGruposIndisponivelError) {
      res.status(503).json({ error: (err as Error).message });
      return;
    }
    res.status(401).json({ error: (err as Error).message });
  }
}

export function logout(_req: Request, res: Response): void {
  res.json({ message: 'Logout realizado' });
}
