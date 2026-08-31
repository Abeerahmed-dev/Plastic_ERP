import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { getDashboardController } from './reports.controller';

const router = Router();

router.get(
  '/dashboard',
  requireAuth,
  requirePermission('reports:read'),
  getDashboardController
);

export { router as reportsRouter };
