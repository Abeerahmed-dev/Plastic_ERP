import * as repo from './reports.repository';

export const reportsService = {
  getDashboardMetrics: async () => {
    return repo.getDashboardMetrics();
  },
  getInventoryLedgerReport: async () => {
    return repo.getInventoryLedgerReport();
  },
  getLiquidityLedgerReport: async () => {
    return repo.getLiquidityLedgerReport();
  },
  getLiquidityReceivablesDetail: async () => {
    return repo.getLiquidityReceivablesDetail();
  },
  getLiquidityPayablesDetail: async () => {
    return repo.getLiquidityPayablesDetail();
  },
  getLiquidityUnsoldStockDetail: async () => {
    return repo.getLiquidityUnsoldStockDetail();
  },
  getProfitMatrixReport: async (productId?: string, timeFilter?: string) => {
    return repo.getProfitMatrixReport(productId, timeFilter);
  },
  getSalesMarginReport: async (productId?: string, timeFilter?: string) => {
    return repo.getSalesMarginReport(productId, timeFilter);
  },
  getCashierTallyReport: async (userId: string) => {
    return repo.getCashierTallyReport(userId);
  },
};
