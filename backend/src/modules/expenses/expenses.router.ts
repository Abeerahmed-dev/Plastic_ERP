import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import {
  createExpenseController,
  payExpenseController,
  listOutstandingExpensesController,
  listExpensesController,
  deleteExpenseController,
} from './expenses.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listExpensesController);
router.get('/outstanding', listOutstandingExpensesController);
router.post('/', createExpenseController);
router.post('/:id/pay', payExpenseController);
router.delete('/:id', requireRole(['OWNER', 'ADMIN']), deleteExpenseController);

export { router as expensesRouter };
