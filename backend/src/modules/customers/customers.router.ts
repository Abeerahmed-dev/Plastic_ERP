import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import {
  listCustomersController,
  getCustomerController,
  createCustomerController,
  updateCustomerController,
  deleteCustomerController,
  getCustomerLedgerController,
} from './customers.controller';

const router = Router();

router.get('/', requireAuth, requirePermission('customers:read'), listCustomersController);
router.get('/:id', requireAuth, requirePermission('customers:read'), getCustomerController);
router.get('/:id/ledger', requireAuth, requirePermission('customers:read'), getCustomerLedgerController);
router.post('/', requireAuth, requirePermission('customers:write'), createCustomerController);
router.put('/:id', requireAuth, requirePermission('customers:write'), updateCustomerController);
router.delete('/:id', requireAuth, requirePermission('customers:delete'), deleteCustomerController);

export default router;
