import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import {
  bulkCustomersController,
  bulkSuppliersController,
  bulkInventoryController,
} from './onboarding.controller';

const router = Router();

/**
 * POST /api/v1/onboarding/customers
 * Protected — bulk insert Day Zero customer udhaar / opening balances.
 */
router.post('/customers', requireAuth, bulkCustomersController);

/**
 * POST /api/v1/onboarding/suppliers
 * Protected — bulk insert Day Zero supplier debt / opening balances.
 */
router.post('/suppliers', requireAuth, bulkSuppliersController);

/**
 * POST /api/v1/onboarding/inventory
 * Protected — bulk insert Day Zero physical warehouse stock / opening stock.
 */
router.post('/inventory', requireAuth, bulkInventoryController);

export { router as onboardingRouter };
export default router;
