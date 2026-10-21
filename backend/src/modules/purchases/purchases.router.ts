import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import * as purchasesController from './purchases.controller';

const router = Router();

router.use(requireAuth);
router.use(verifyRole(['OWNER', 'ADMIN', 'CASHIER']));

router.get('/', purchasesController.getPurchaseInvoices);
router.get('/unpaid', purchasesController.getUnpaidPurchaseInvoices);
router.get('/:id/returns/summary', purchasesController.getPurchaseInvoiceReturnSummary);
router.post('/:id/returns', purchasesController.createPurchaseReturn);
router.post('/returns', purchasesController.createPurchaseReturn);
router.get('/:id', purchasesController.getPurchaseInvoiceById);
router.post('/', purchasesController.createPurchaseInvoice);
router.patch('/:id/status', verifyRole(['OWNER', 'ADMIN']), purchasesController.updatePurchaseInvoiceStatus);

export { router as purchasesRouter };
