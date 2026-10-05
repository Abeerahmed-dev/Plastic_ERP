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
  getCashierTallyController,
  getPnLController,
  getIncomeStatementController,
  getIncomeStatementReturnsDetailController,
  getMarginAnalyticsController,
  getInventoryValuationController,
  getCashLedgerController,
  getPdcController,
  getIssuedPdcController,
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
router.get('/pdc', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), getPdcController);
router.get('/issued-pdc', verifyRole(['OWNER', 'ADMIN', 'CASHIER']), getIssuedPdcController);
router.get('/pnl', verifyRole(['OWNER', 'ADMIN']), getPnLController);
router.get('/income-statement/returns-detail', verifyRole(['OWNER', 'ADMIN']), getIncomeStatementReturnsDetailController);
router.get('/income-statement', verifyRole(['OWNER', 'ADMIN']), getIncomeStatementController);
router.get('/margin-analytics', verifyRole(['OWNER', 'ADMIN']), getMarginAnalyticsController);
router.get('/inventory-valuation', verifyRole(['OWNER', 'ADMIN']), getInventoryValuationController);
router.get('/cash-ledger', verifyRole(['OWNER', 'ADMIN']), getCashLedgerController);
router.get('/profit', verifyRole(['OWNER', 'ADMIN']), getProfitMatrixController);
router.get('/sales-margin', verifyRole(['OWNER', 'ADMIN']), getMarginAnalyticsController);

export { router as reportsRouter };
export default router;

