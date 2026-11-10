import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  createCustomerAdvanceController,
  createSupplierAdvanceController,
  createGeneralAdvanceController,
} from './advances.controller';

const router = Router();
router.use(requireAuth);

router.post('/customer', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER']), createCustomerAdvanceController);
router.post('/supplier', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), createSupplierAdvanceController);
router.post('/', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), createGeneralAdvanceController);

export default router;
