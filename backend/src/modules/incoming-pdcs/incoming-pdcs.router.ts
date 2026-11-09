import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  listIncomingPdcsController,
  createIncomingPdcController,
  clearIncomingPdcController,
  bounceIncomingPdcController,
} from './incoming-pdcs.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listIncomingPdcsController);
router.post('/', verifyRole(['OWNER', 'ADMIN', 'CASHIER', 'ACCOUNTANT']), createIncomingPdcController);
router.post('/:id/clear', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), clearIncomingPdcController);
router.post('/:id/bounce', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), bounceIncomingPdcController);

export default router;
