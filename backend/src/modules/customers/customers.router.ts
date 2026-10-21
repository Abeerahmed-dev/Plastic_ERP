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
  getCustomerStatementController,
  getCustomerRefundableCreditsController,
} from './customers.controller';

const router = Router();

router.get('/', requireAuth, listCustomersController);
router.get('/:id', requireAuth, getCustomerController);
router.get('/:id/statement', requireAuth, getCustomerStatementController);
router.get('/:id/ledger', requireAuth, getCustomerLedgerController);
router.get('/:id/refundable-credits', requireAuth, getCustomerRefundableCreditsController);
router.post('/', requireAuth, verifyRole(['ADMIN', 'OWNER', 'CASHIER']), createCustomerController);
router.put('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER']), updateCustomerController);
router.delete('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER']), deleteCustomerController);

export default router;
