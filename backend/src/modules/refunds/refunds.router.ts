import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  createCustomerRefundController,
  createSupplierRefundController,
  createGeneralRefundController,
} from './refunds.controller';

const router = Router();
router.use(requireAuth);

router.post('/customer', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER']), createCustomerRefundController);
router.post('/supplier', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), createSupplierRefundController);
router.post('/', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), createGeneralRefundController);

export default router;
