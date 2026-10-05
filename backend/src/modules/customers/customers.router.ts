import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  listCustomersController,
  getCustomerController,
  createCustomerController,
  updateCustomerController,
  deleteCustomerController,
  getCustomerLedgerController,
} from './customers.controller';

const router = Router();

router.get('/', requireAuth, listCustomersController);
router.get('/:id', requireAuth, getCustomerController);
router.get('/:id/ledger', requireAuth, getCustomerLedgerController);
router.post('/', requireAuth, verifyRole(['ADMIN', 'OWNER', 'CASHIER']), createCustomerController);
router.put('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER']), updateCustomerController);
router.delete('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER']), deleteCustomerController);

export default router;
