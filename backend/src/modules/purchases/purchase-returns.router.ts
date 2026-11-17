import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import { createPurchaseReturn } from './purchases.controller';

const router = Router();

router.use(requireAuth);
router.use(verifyRole(['OWNER', 'ADMIN', 'CASHIER']));

router.post('/', createPurchaseReturn);

export default router;
