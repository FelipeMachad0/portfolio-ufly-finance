import { Router } from 'express';
import { loginComSenha, entraCallback, logout, entrarDemo } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { demoHabilitado } from '../services/demo.service';

const router = Router();

// Sem tela correspondente: acesso normal é pelo Entra ID. Mantido como
// break-glass, conferindo apenas password_hash de usuários cadastrados.
router.post('/login', loginComSenha);
router.post('/entra/callback', entraCallback);
router.post('/logout', authMiddleware, logout);

// Modo demonstração: só existe com DEMO_MODE=true (ver services/demo.service).
if (demoHabilitado()) router.post('/demo', entrarDemo);

export default router;
