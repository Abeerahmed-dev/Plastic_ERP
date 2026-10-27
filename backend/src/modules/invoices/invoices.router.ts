import { Router } from 'express';
import * as invoicesController from './invoices.controller';
import { getCashierShiftAuditController } from '../pos/pos.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { verifyRole } from '../../middleware/requireRole';

const router = Router();

router.use(requireAuth);

router.get('/cashier/shift-audit', getCashierShiftAuditController);
router.get('/', requirePermission('sales:read'), invoicesController.listInvoices);
router.get('/unpaid', requirePermission('sales:read'), invoicesController.getUnpaidInvoices);
router.get('/pending-deliveries', requirePermission('sales:read'), invoicesController.getPendingDeliveries);
router.get('/:id/returns/summary', requirePermission('sales:read'), invoicesController.getInvoiceReturnSummary);
router.post('/:id/returns', requirePermission('sales:write'), verifyRole(['OWNER', 'ADMIN', 'CASHIER']), invoicesController.createSalesReturn);
router.get('/:id', requirePermission('sales:read'), invoicesController.getInvoice);
router.post('/', requirePermission('sales:write'), verifyRole(['OWNER', 'ADMIN', 'CASHIER']), invoicesController.createInvoice);
router.put('/:id', verifyRole(['OWNER', 'ADMIN']), invoicesController.createInvoice);
router.delete('/:id', verifyRole(['OWNER', 'ADMIN']), (_req, res) => res.json({ success: true, message: "Invoice deleted" }));

export default router;


