import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  bulkCustomersController,
  bulkSuppliersController,
  bulkInventoryController,
} from './onboarding.controller';

const router = Router();

/**
 * POST /api/v1/onboarding/customers
 * Protected — bulk insert Day Zero customer udhaar / opening balances (Owner/Admin only).
 */
router.post('/customers', requireAuth, verifyRole(['OWNER', 'ADMIN']), bulkCustomersController);

/**
 * POST /api/v1/onboarding/suppliers
 * Protected — bulk insert Day Zero supplier debt / opening balances (Owner/Admin only).
 */
router.post('/suppliers', requireAuth, verifyRole(['OWNER', 'ADMIN']), bulkSuppliersController);

/**
 * POST /api/v1/onboarding/inventory
 * Protected — bulk insert Day Zero physical warehouse stock / opening stock (Owner/Admin only).
 */
router.post('/inventory', requireAuth, verifyRole(['OWNER', 'ADMIN']), bulkInventoryController);

export { router as onboardingRouter };
export default router;
