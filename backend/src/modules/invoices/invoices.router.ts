import { Router } from 'express';
import * as invoicesController from './invoices.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('customers:read'), invoicesController.listInvoices);
router.get('/:id', requirePermission('customers:read'), invoicesController.getInvoice);
router.post('/', requirePermission('customers:write'), invoicesController.createInvoice);

export default router;
