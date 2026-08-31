import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { checkoutController } from './pos.controller';

const router = Router();

// Requires sales:write as POS is essentially a sale
router.post(
  '/checkout',
  requireAuth,
  requirePermission('sales:write'),
  checkoutController
);

export { router as posRouter };
