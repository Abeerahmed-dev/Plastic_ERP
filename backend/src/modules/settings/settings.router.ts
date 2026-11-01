import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  getFeatureAccessHandler,
  updateFeatureAccessHandler,
} from './settings.controller';

const router = Router();

// Publicly readable cashier feature flags (returns { customer_access, party_access })
router.get('/feature-access', getFeatureAccessHandler);

// Only Admin and Owner can update cashier feature access
router.put('/feature-access', requireAuth, verifyRole(['ADMIN', 'OWNER']), updateFeatureAccessHandler);

export default router;
