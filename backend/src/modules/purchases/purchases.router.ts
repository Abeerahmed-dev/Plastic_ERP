import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import * as purchasesController from './purchases.controller';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('purchases:read'), purchasesController.getPurchaseInvoices);
router.get('/:id', requirePermission('purchases:read'), purchasesController.getPurchaseInvoiceById);
router.post('/', requirePermission('purchases:write'), purchasesController.createPurchaseInvoice);
router.patch('/:id/status', requirePermission('purchases:write'), purchasesController.updatePurchaseInvoiceStatus);

export { router as purchasesRouter };
