import { Router } from 'express';
import * as invoicesController from './invoices.controller';
import { getCashierShiftAuditController } from '../pos/pos.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';

const router = Router();

router.use(requireAuth);

router.get('/cashier/shift-audit', getCashierShiftAuditController);
router.get('/', invoicesController.listInvoices);
router.get('/unpaid', invoicesController.getUnpaidInvoices);
router.get('/pending-deliveries', invoicesController.getPendingDeliveries);
router.get('/:id/returns/summary', invoicesController.getInvoiceReturnSummary);
router.post('/:id/returns', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), invoicesController.createSalesReturn);
router.get('/:id', invoicesController.getInvoice);
router.post('/', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), invoicesController.createInvoice);
router.put('/:id', verifyRole(['OWNER', 'ADMIN']), invoicesController.createInvoice);
router.delete('/:id', verifyRole(['OWNER', 'ADMIN']), (_req, res) => res.json({ success: true, message: "Invoice deleted" }));

export default router;


