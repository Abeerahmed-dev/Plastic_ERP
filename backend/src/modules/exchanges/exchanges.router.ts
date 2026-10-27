import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  createExchangeController,
  listExchangesController,
  getExchangeByIdController,
} from './exchanges.controller';

const router = Router();

router.use(requireAuth);

router.get('/', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), listExchangesController);
router.get('/:id', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), getExchangeByIdController);
router.post('/', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), createExchangeController);

export { router as exchangesRouter };
