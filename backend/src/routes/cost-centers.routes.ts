import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as controller from '../controllers/cost-centers.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', controller.list);
router.post('/', controller.upsert);
router.delete('/:id', controller.remove);
router.get('/comparison', controller.comparison);

export default router;
