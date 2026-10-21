import { Router } from 'express';
import * as paymentsController from './payments.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { forbidRole } from '../../middleware/requireRole';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('customers:read'), paymentsController.listPayments);
router.post('/', forbidRole(['CASHIER']), requirePermission('customers:write'), paymentsController.createPayment);
router.post('/refund', requirePermission('customers:write'), paymentsController.createRefund);
router.put('/:id/clear-cheque', forbidRole(['CASHIER']), requirePermission('customers:write'), paymentsController.clearCheque);

export default router;
