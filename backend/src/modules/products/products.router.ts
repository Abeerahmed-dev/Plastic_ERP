import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  listProductsController,
  listPOSAvailableProductsController,
  getProductController,
  createProductController,
  updateProductController,
  updateProductPriceController,
  deleteProductController,
  getProductBatchesController,
} from './products.controller';

const router = Router();

router.get('/', requireAuth, listProductsController);
router.get('/pos-available', requireAuth, listPOSAvailableProductsController);
router.get('/:id/batches', requireAuth, getProductBatchesController);
router.get('/:id', requireAuth, getProductController);
router.post('/', requireAuth, verifyRole(['ADMIN', 'OWNER', 'CASHIER', 'ACCOUNTANT']), createProductController);
router.put('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER', 'ACCOUNTANT']), updateProductController);
router.patch('/:id/price', requireAuth, verifyRole(['ADMIN', 'OWNER', 'ACCOUNTANT']), updateProductPriceController);
router.delete('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER']), deleteProductController);

export default router;
