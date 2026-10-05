import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import {
  createExpenseController,
  listExpensesController,
  deleteExpenseController,
} from './expenses.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listExpensesController);
router.post('/', createExpenseController);
router.delete('/:id', requireRole(['OWNER', 'ADMIN']), deleteExpenseController);

export { router as expensesRouter };
