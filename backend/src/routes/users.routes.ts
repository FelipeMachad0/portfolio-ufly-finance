import { Router } from 'express';
import { authMiddleware, loadUserRole, requireRole } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/users.controller';

const router = Router();

router.use(authMiddleware);
router.use(loadUserRole);

router.get('/me', ctrl.me);
router.get('/', requireRole('GESTOR_GERAL', 'GESTOR_DEPARTAMENTO', 'AUDITOR'), ctrl.index);
router.get('/:id', requireRole('GESTOR_GERAL', 'AUDITOR'), ctrl.show);
router.post('/', requireRole('GESTOR_GERAL'), ctrl.create);
router.put('/:id', requireRole('GESTOR_GERAL'), ctrl.update);
router.delete('/:id', requireRole('GESTOR_GERAL'), ctrl.remove);

export default router;
