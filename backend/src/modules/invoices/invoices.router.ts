import { Router } from 'express';
import * as invoicesController from './invoices.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { verifyRole } from '../../middleware/requireRole';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('customers:read'), invoicesController.listInvoices);
router.get('/:id', requirePermission('customers:read'), invoicesController.getInvoice);
router.post('/', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), requirePermission('customers:write'), invoicesController.createInvoice);
router.put('/:id', verifyRole(['OWNER', 'ADMIN']), invoicesController.createInvoice);
router.delete('/:id', verifyRole(['OWNER', 'ADMIN']), (_req, res) => res.json({ success: true, message: "Invoice deleted" }));

export default router;
