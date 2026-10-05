import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  listProductsController,
  listPOSAvailableProductsController,
  getProductController,
  createProductController,
  updateProductController,
  deleteProductController,
  getProductBatchesController,
} from './products.controller';

const router = Router();

router.get('/', requireAuth, listProductsController);
router.get('/pos-available', requireAuth, listPOSAvailableProductsController);
router.get('/:id/batches', requireAuth, getProductBatchesController);
router.get('/:id', requireAuth, getProductController);
router.post('/', requireAuth, verifyRole(['ADMIN', 'OWNER', 'CASHIER']), createProductController);
router.put('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER']), updateProductController);
router.delete('/:id', requireAuth, verifyRole(['ADMIN', 'OWNER']), deleteProductController);

export default router;
