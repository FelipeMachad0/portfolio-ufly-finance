import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/uploads.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

router.use(authMiddleware);

router.post('/', upload.single('file'), ctrl.upload);
router.get('/:id', ctrl.serve);

export default router;
