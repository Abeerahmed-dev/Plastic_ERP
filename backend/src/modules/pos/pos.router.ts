import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import {
  checkoutController,
  getTodayCashTallyController,
  getCashierShiftAuditController,
  getPosInvoicesController,
  getHeldOrdersController,
  createHeldOrderController,
  deleteHeldOrderController,
} from './pos.controller';

const router = Router();

router.get(
  '/held-orders',
  requireAuth,
  requirePermission('sales:read'),
  getHeldOrdersController
);

router.post(
  '/held-orders',
  requireAuth,
  requirePermission('sales:write'),
  createHeldOrderController
);

router.delete(
  '/held-orders/:id',
  requireAuth,
  requirePermission('sales:write'),
  deleteHeldOrderController
);

router.get(
  '/',
  requireAuth,
  requirePermission('sales:read'),
  getPosInvoicesController
);

router.get(
  '/invoices',
  requireAuth,
  requirePermission('sales:read'),
  getPosInvoicesController
);

router.get(
  '/today-tally',
  requireAuth,
  requirePermission('sales:read'),
  getTodayCashTallyController
);

router.get(
  '/shift-audit',
  requireAuth,
  requirePermission('sales:read'),
  getCashierShiftAuditController
);

router.post(
  '/',
  requireAuth,
  requirePermission('sales:write'),
  checkoutController
);

router.post(
  '/checkout',
  requireAuth,
  requirePermission('sales:write'),
  checkoutController
);

export { router as posRouter };

