import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import {
  createCustomerAdvanceController,
  createSupplierAdvanceController,
  createGeneralAdvanceController,
} from './advances.controller';

const router = Router();
router.use(requireAuth);

router.post('/customer', createCustomerAdvanceController);
router.post('/supplier', createSupplierAdvanceController);
router.post('/', createGeneralAdvanceController);

export default router;
