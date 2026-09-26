import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  exportTransactions,
  exportReport,
  exportControleFinanceiro,
} from '../controllers/export.controller';

const router = Router();
router.use(authMiddleware);
router.get('/transactions', exportTransactions);
router.get('/report', exportReport);
router.get('/completo', exportControleFinanceiro);

export default router;
