import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { checkoutController, getTodayCashTallyController, getCashierShiftAuditController } from './pos.controller';

const router = Router();

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
  '/checkout',
  requireAuth,
  requirePermission('sales:write'),
  checkoutController
);

export { router as posRouter };

