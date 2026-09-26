import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/typefields.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.index);
router.put('/:tipo', ctrl.update);

export default router;
