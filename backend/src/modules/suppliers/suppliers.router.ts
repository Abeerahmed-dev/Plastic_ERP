import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  listSuppliersController,
  getSupplierController,
  createSupplierController,
  updateSupplierController,
  deleteSupplierController,
  getSupplierLedgerController,
  getSupplierStatementController,
  getSupplierRefundableCreditsController,
  recordSupplierPaymentController,
} from './suppliers.controller';

const router = Router();

router.get('/', requireAuth, listSuppliersController);
router.get('/:id', requireAuth, getSupplierController);
router.get('/:id/statement', requireAuth, getSupplierStatementController);
router.get('/:id/ledger', requireAuth, getSupplierLedgerController);
router.get('/:id/refundable-credits', requireAuth, getSupplierRefundableCreditsController);
router.post('/payments', requireAuth, verifyRole(['ADMIN', 'OWNER', 'CASHIER']), recordSupplierPaymentController);
router.post('/:id/payments', requireAuth, verifyRole(['ADMIN', 'OWNER', 'CASHIER']), recordSupplierPaymentController);
router.post('/', requireAuth, verifyRole(['ADMIN', 'OWNER', 'CASHIER']), createSupplierController);
router.put('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER']), updateSupplierController);
router.delete('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER']), deleteSupplierController);

export default router;
