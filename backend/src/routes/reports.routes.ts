import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as controller from '../controllers/reports.controller';

const router = Router();

router.use(authMiddleware);

router.get('/expenses-by-category', controller.expensesByCategory);
router.get('/revenue-vs-expense', controller.revenueVsExpense);
router.get('/revenue-by-client', controller.revenueByClient);
router.get('/summary', controller.summary);
router.get('/dre', controller.dre);

export default router;
