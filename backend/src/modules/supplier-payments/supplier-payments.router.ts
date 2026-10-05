import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { forbidRole } from '../../middleware/requireRole';
import * as supplierPaymentsController from './supplier-payments.controller';

const router = Router();

router.use(requireAuth);

router.post('/', forbidRole(['CASHIER']), requirePermission('payments:write'), supplierPaymentsController.createPaymentController);
router.get('/', requirePermission('payments:read'), supplierPaymentsController.listPaymentsController);
router.get('/:id', requirePermission('payments:read'), supplierPaymentsController.getPaymentController);
router.put('/:id/clear-cheque', forbidRole(['CASHIER']), requirePermission('payments:write'), supplierPaymentsController.clearChequeController);

export default router;
