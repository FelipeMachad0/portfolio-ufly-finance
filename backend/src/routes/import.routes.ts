import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import { previewImport, importTransactions } from '../controllers/import.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.use(authMiddleware);
router.post('/preview', upload.single('file'), previewImport);
router.post('/confirm', importTransactions);

export default router;
