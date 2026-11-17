import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { createCustomerRefundController } from './customer-refunds.controller';

const router = Router();
router.use(requireAuth);

router.post('/', requirePermission('payments:write'), createCustomerRefundController);

export default router;
