import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  getDashboardController,
  getInventoryLedgerController,
  getLiquidityLedgerController,
  getLiquidityReceivablesController,
  getLiquidityPayablesController,
  getLiquidityUnsoldStockController,
  getProfitMatrixController,
  getSalesMarginController,
  getCashierTallyController,
} from './reports.controller';

const router = Router();

router.use(requireAuth);

router.get('/cashier-tally', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), getCashierTallyController);
router.get('/dashboard', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), getDashboardController);
router.get('/inventory', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), getInventoryLedgerController);

// Restricted reports for OWNER and ADMIN only
router.get('/liquidity/receivables', verifyRole(['OWNER', 'ADMIN']), getLiquidityReceivablesController);
router.get('/liquidity/payables', verifyRole(['OWNER', 'ADMIN']), getLiquidityPayablesController);
router.get('/liquidity/unsold-stock', verifyRole(['OWNER', 'ADMIN']), getLiquidityUnsoldStockController);
router.get('/liquidity', verifyRole(['OWNER', 'ADMIN']), getLiquidityLedgerController);
router.get('/profit', verifyRole(['OWNER', 'ADMIN']), getProfitMatrixController);
router.get('/sales-margin', verifyRole(['OWNER', 'ADMIN']), getSalesMarginController);

export { router as reportsRouter };
export default router;
