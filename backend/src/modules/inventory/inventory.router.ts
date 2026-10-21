import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { getLowStockController } from './inventory.controller';

const router = Router();

router.get('/low-stock', requireAuth, getLowStockController);

export default router;
