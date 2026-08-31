import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import * as supplierPaymentsController from './supplier-payments.controller';

const router = Router();

router.use(requireAuth);

router.post('/', requirePermission('payments:write'), supplierPaymentsController.createPaymentController);
router.get('/', requirePermission('payments:read'), supplierPaymentsController.listPaymentsController);
router.get('/:id', requirePermission('payments:read'), supplierPaymentsController.getPaymentController);

export default router;
