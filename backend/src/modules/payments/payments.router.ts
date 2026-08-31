import { Router } from 'express';
import * as paymentsController from './payments.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('customers:read'), paymentsController.listPayments);
router.post('/', requirePermission('customers:write'), paymentsController.createPayment);

export default router;
