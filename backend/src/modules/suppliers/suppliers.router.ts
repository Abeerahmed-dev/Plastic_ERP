import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import {
  listSuppliersController,
  getSupplierController,
  createSupplierController,
  updateSupplierController,
  deleteSupplierController,
  getSupplierLedgerController,
} from './suppliers.controller';

const router = Router();

router.get('/', requireAuth, requirePermission('suppliers:read'), listSuppliersController);
router.get('/:id', requireAuth, requirePermission('suppliers:read'), getSupplierController);
router.get('/:id/ledger', requireAuth, requirePermission('suppliers:read'), getSupplierLedgerController);
router.post('/', requireAuth, requirePermission('suppliers:write'), createSupplierController);
router.put('/:id', requireAuth, requirePermission('suppliers:write'), updateSupplierController);
router.delete('/:id', requireAuth, requirePermission('suppliers:delete'), deleteSupplierController);

export default router;
