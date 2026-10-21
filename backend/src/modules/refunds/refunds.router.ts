import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import {
  createCustomerRefundController,
  createSupplierRefundController,
  createGeneralRefundController,
} from './refunds.controller';

const router = Router();
router.use(requireAuth);

router.post('/customer', createCustomerRefundController);
router.post('/supplier', createSupplierRefundController);
router.post('/', createGeneralRefundController);

export default router;
