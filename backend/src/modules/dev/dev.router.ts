import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import { resetDatabaseController } from './dev.controller';

const devRouter = Router();

devRouter.post(
  '/reset-database',
  requireAuth,
  verifyRole(['OWNER', 'ADMIN']),
  resetDatabaseController,
);

export default devRouter;
