import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import {
  listProductsController,
  listPOSAvailableProductsController,
  getProductController,
  createProductController,
  updateProductController,
  deleteProductController,
} from './products.controller';

const router = Router();

router.get('/', requireAuth, requirePermission('products:read'), listProductsController);
router.get('/pos-available', requireAuth, requirePermission('sales:write'), listPOSAvailableProductsController);
router.get('/:id', requireAuth, requirePermission('products:read'), getProductController);
router.post('/', requireAuth, requirePermission('products:write'), createProductController);
router.put('/:id', requireAuth, requirePermission('products:write'), updateProductController);
router.delete('/:id', requireAuth, requirePermission('products:delete'), deleteProductController);

export default router;
