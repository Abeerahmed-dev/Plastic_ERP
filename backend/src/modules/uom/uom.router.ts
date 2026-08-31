import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import {
  listUOMController,
  createUOMController,
  updateUOMController,
  deleteUOMController,
} from './uom.controller';

const router = Router();

// Note: UOM falls under the 'products' permission domain.
router.get('/', requireAuth, requirePermission('products:read'), listUOMController);
router.post('/', requireAuth, requirePermission('products:write'), createUOMController);
router.put('/:id', requireAuth, requirePermission('products:write'), updateUOMController);
router.delete('/:id', requireAuth, requirePermission('products:delete'), deleteUOMController);

export default router;
