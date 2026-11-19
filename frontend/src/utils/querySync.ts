import { QueryClient } from '@tanstack/react-query';
import { queryClient as defaultQueryClient } from './queryClient';
import { useReportStore } from '../store/useReportStore';

/**
 * Trigger background update for Zustand-backed financial & inventory reports.
 */
export function refreshZustandReports() {
  try {
    const store = useReportStore.getState();
    if (store && typeof store.fetchAllReports === 'function') {
      store.fetchAllReports(true).catch((err) => {
        console.warn('[querySync] Failed to refresh Zustand reports:', err);
      });
    }
    if (store && typeof store.fetchLiquidityLedger === 'function') {
      store.fetchLiquidityLedger(true).catch((err) => {
        console.warn('[querySync] Failed to refresh Liquidity ledger:', err);
      });
    }
    if (store && typeof store.fetchInventoryLedger === 'function') {
      store.fetchInventoryLedger(true).catch((err) => {
        console.warn('[querySync] Failed to refresh Inventory ledger:', err);
      });
    }
  } catch (err) {
    console.warn('[querySync] Error accessing report store:', err);
  }
}

/**
 * Helper to get active queryClient
 */
function resolveQc(qc?: QueryClient): QueryClient {
  return qc || defaultQueryClient;
}

/**
 * Invalidate all queries intersecting with Sales Invoices & POS transactions:
 * Invoices, Products, Customers, Stocks / Inventory Valuation, Bank Accounts,
 * Cash Drawer, Dashboard, P&L, and Payments.
 */
export async function invalidateSalesInvoiceQueries(qc?: QueryClient) {
  const client = resolveQc(qc);
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: ['invoices'] }),
    client.invalidateQueries({ queryKey: ['posHeldOrders'] }),
    client.invalidateQueries({ queryKey: ['products'] }),
    client.invalidateQueries({ queryKey: ['posProducts'] }),
    client.invalidateQueries({ queryKey: ['lowStockAlerts'] }),
    client.invalidateQueries({ queryKey: ['customers'] }),
    client.invalidateQueries({ queryKey: ['customersSelect'] }),
    client.invalidateQueries({ queryKey: ['stocks'] }),
    client.invalidateQueries({ queryKey: ['inventoryValuation'] }),
    client.invalidateQueries({ queryKey: ['inventory-valuation'] }),
    client.invalidateQueries({ queryKey: ['bank-accounts'] }),
    client.invalidateQueries({ queryKey: ['bankAccounts'] }),
    client.invalidateQueries({ queryKey: ['cash-drawer-balance'] }),
    client.invalidateQueries({ queryKey: ['todayCashTally'] }),
    client.invalidateQueries({ queryKey: ['cashierTally'] }),
    client.invalidateQueries({ queryKey: ['shiftAudit'] }),
    client.invalidateQueries({ queryKey: ['cashLedger'] }),
    client.invalidateQueries({ queryKey: ['liquidityLedger'] }),
    client.invalidateQueries({ queryKey: ['liquidity-ledger'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
    client.invalidateQueries({ queryKey: ['dashboardMetrics'] }),
    client.invalidateQueries({ queryKey: ['pnl'] }),
    client.invalidateQueries({ queryKey: ['pnlReport'] }),
    client.invalidateQueries({ queryKey: ['incomeStatement'] }),
    client.invalidateQueries({ queryKey: ['marginAnalytics'] }),
    client.invalidateQueries({ queryKey: ['marginAnalyticsTrend'] }),
    client.invalidateQueries({ queryKey: ['pnlExpensesList'] }),
    client.invalidateQueries({ queryKey: ['payments'] }),
    client.invalidateQueries({ queryKey: ['reports'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Purchases & Stock Inward:
 * Purchases, Products, Suppliers, Stocks, Dashboard, P&L, Bank Accounts, and Payments.
 */
export async function invalidatePurchaseQueries(qc?: QueryClient) {
  const client = resolveQc(qc);
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: ['purchases'] }),
    client.invalidateQueries({ queryKey: ['recentPurchasesForStockUpdate'] }),
    client.invalidateQueries({ queryKey: ['products'] }),
    client.invalidateQueries({ queryKey: ['posProducts'] }),
    client.invalidateQueries({ queryKey: ['lowStockAlerts'] }),
    client.invalidateQueries({ queryKey: ['suppliers'] }),
    client.invalidateQueries({ queryKey: ['suppliersSelect'] }),
    client.invalidateQueries({ queryKey: ['stocks'] }),
    client.invalidateQueries({ queryKey: ['inventoryValuation'] }),
    client.invalidateQueries({ queryKey: ['inventory-valuation'] }),
    client.invalidateQueries({ queryKey: ['bank-accounts'] }),
    client.invalidateQueries({ queryKey: ['bankAccounts'] }),
    client.invalidateQueries({ queryKey: ['cash-drawer-balance'] }),
    client.invalidateQueries({ queryKey: ['issuedPdc'] }),
    client.invalidateQueries({ queryKey: ['liquidityLedger'] }),
    client.invalidateQueries({ queryKey: ['liquidity-ledger'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
    client.invalidateQueries({ queryKey: ['dashboardMetrics'] }),
    client.invalidateQueries({ queryKey: ['pnl'] }),
    client.invalidateQueries({ queryKey: ['pnlReport'] }),
    client.invalidateQueries({ queryKey: ['incomeStatement'] }),
    client.invalidateQueries({ queryKey: ['marginAnalytics'] }),
    client.invalidateQueries({ queryKey: ['marginAnalyticsTrend'] }),
    client.invalidateQueries({ queryKey: ['pnlExpensesList'] }),
    client.invalidateQueries({ queryKey: ['payments'] }),
    client.invalidateQueries({ queryKey: ['supplier-payments'] }),
    client.invalidateQueries({ queryKey: ['reports'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Customer Payments & Ledger:
 * Customers, Payments, Invoices, Bank Accounts, Cash Drawer, Dashboard, P&L.
 */
export async function invalidateCustomerPaymentQueries(qc?: QueryClient) {
  const client = resolveQc(qc);
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: ['customers'] }),
    client.invalidateQueries({ queryKey: ['customersSelect'] }),
    client.invalidateQueries({ queryKey: ['refundable-credits'] }),
    client.invalidateQueries({ queryKey: ['payments'] }),
    client.invalidateQueries({ queryKey: ['invoices'] }),
    client.invalidateQueries({ queryKey: ['bank-accounts'] }),
    client.invalidateQueries({ queryKey: ['bankAccounts'] }),
    client.invalidateQueries({ queryKey: ['cash-drawer-balance'] }),
    client.invalidateQueries({ queryKey: ['todayCashTally'] }),
    client.invalidateQueries({ queryKey: ['cashierTally'] }),
    client.invalidateQueries({ queryKey: ['shiftAudit'] }),
    client.invalidateQueries({ queryKey: ['cashLedger'] }),
    client.invalidateQueries({ queryKey: ['liquidityLedger'] }),
    client.invalidateQueries({ queryKey: ['liquidity-ledger'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
    client.invalidateQueries({ queryKey: ['dashboardMetrics'] }),
    client.invalidateQueries({ queryKey: ['pnl'] }),
    client.invalidateQueries({ queryKey: ['pnlReport'] }),
    client.invalidateQueries({ queryKey: ['reports'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Supplier Payments & Ledger:
 * Suppliers, Payments, Purchases, Bank Accounts, Cash Drawer, Dashboard, P&L.
 */
export async function invalidateSupplierPaymentQueries(qc?: QueryClient) {
  const client = resolveQc(qc);
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: ['suppliers'] }),
    client.invalidateQueries({ queryKey: ['suppliersSelect'] }),
    client.invalidateQueries({ queryKey: ['payments'] }),
    client.invalidateQueries({ queryKey: ['supplier-payments'] }),
    client.invalidateQueries({ queryKey: ['purchases'] }),
    client.invalidateQueries({ queryKey: ['issuedPdc'] }),
    client.invalidateQueries({ queryKey: ['bank-accounts'] }),
    client.invalidateQueries({ queryKey: ['bankAccounts'] }),
    client.invalidateQueries({ queryKey: ['cash-drawer-balance'] }),
    client.invalidateQueries({ queryKey: ['liquidityLedger'] }),
    client.invalidateQueries({ queryKey: ['liquidity-ledger'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
    client.invalidateQueries({ queryKey: ['dashboardMetrics'] }),
    client.invalidateQueries({ queryKey: ['pnl'] }),
    client.invalidateQueries({ queryKey: ['pnlReport'] }),
    client.invalidateQueries({ queryKey: ['reports'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Expenses:
 * Expenses, Bank Accounts, Cash Drawer, Dashboard, P&L.
 */
export async function invalidateExpenseQueries(qc?: QueryClient) {
  const client = resolveQc(qc);
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: ['expenses'] }),
    client.invalidateQueries({ queryKey: ['outstanding-expenses'] }),
    client.invalidateQueries({ queryKey: ['bank-accounts'] }),
    client.invalidateQueries({ queryKey: ['bankAccounts'] }),
    client.invalidateQueries({ queryKey: ['cash-drawer-balance'] }),
    client.invalidateQueries({ queryKey: ['liquidityLedger'] }),
    client.invalidateQueries({ queryKey: ['liquidity-ledger'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
    client.invalidateQueries({ queryKey: ['dashboardMetrics'] }),
    client.invalidateQueries({ queryKey: ['pnl'] }),
    client.invalidateQueries({ queryKey: ['pnlReport'] }),
    client.invalidateQueries({ queryKey: ['pnlExpensesList'] }),
    client.invalidateQueries({ queryKey: ['reports'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Product Catalogue & Inventory:
 * Products, Inventory Valuation / Stocks, Categories, Dashboard.
 */
export async function invalidateProductQueries(qc?: QueryClient) {
  const client = resolveQc(qc);
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: ['products'] }),
    client.invalidateQueries({ queryKey: ['posProducts'] }),
    client.invalidateQueries({ queryKey: ['lowStockAlerts'] }),
    client.invalidateQueries({ queryKey: ['categories'] }),
    client.invalidateQueries({ queryKey: ['stocks'] }),
    client.invalidateQueries({ queryKey: ['inventoryValuation'] }),
    client.invalidateQueries({ queryKey: ['inventory-valuation'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
    client.invalidateQueries({ queryKey: ['dashboardMetrics'] }),
    client.invalidateQueries({ queryKey: ['reports'] }),
  ]);
  refreshZustandReports();
}

/**
 * Omni-invalidation for critical actions or master data resets / offline replays.
 */
export async function invalidateAllDomains(qc?: QueryClient) {
  const client = resolveQc(qc);
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: ['invoices'] }),
    client.invalidateQueries({ queryKey: ['posHeldOrders'] }),
    client.invalidateQueries({ queryKey: ['purchases'] }),
    client.invalidateQueries({ queryKey: ['recentPurchasesForStockUpdate'] }),
    client.invalidateQueries({ queryKey: ['products'] }),
    client.invalidateQueries({ queryKey: ['posProducts'] }),
    client.invalidateQueries({ queryKey: ['lowStockAlerts'] }),
    client.invalidateQueries({ queryKey: ['categories'] }),
    client.invalidateQueries({ queryKey: ['customers'] }),
    client.invalidateQueries({ queryKey: ['customersSelect'] }),
    client.invalidateQueries({ queryKey: ['refundable-credits'] }),
    client.invalidateQueries({ queryKey: ['suppliers'] }),
    client.invalidateQueries({ queryKey: ['suppliersSelect'] }),
    client.invalidateQueries({ queryKey: ['stocks'] }),
    client.invalidateQueries({ queryKey: ['inventoryValuation'] }),
    client.invalidateQueries({ queryKey: ['inventory-valuation'] }),
    client.invalidateQueries({ queryKey: ['bank-accounts'] }),
    client.invalidateQueries({ queryKey: ['bankAccounts'] }),
    client.invalidateQueries({ queryKey: ['bank-account-transactions'] }),
    client.invalidateQueries({ queryKey: ['cash-drawer-balance'] }),
    client.invalidateQueries({ queryKey: ['todayCashTally'] }),
    client.invalidateQueries({ queryKey: ['cashierTally'] }),
    client.invalidateQueries({ queryKey: ['shiftAudit'] }),
    client.invalidateQueries({ queryKey: ['cashLedger'] }),
    client.invalidateQueries({ queryKey: ['liquidityLedger'] }),
    client.invalidateQueries({ queryKey: ['liquidity-ledger'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
    client.invalidateQueries({ queryKey: ['dashboardMetrics'] }),
    client.invalidateQueries({ queryKey: ['pnl'] }),
    client.invalidateQueries({ queryKey: ['pnlReport'] }),
    client.invalidateQueries({ queryKey: ['incomeStatement'] }),
    client.invalidateQueries({ queryKey: ['marginAnalytics'] }),
    client.invalidateQueries({ queryKey: ['marginAnalyticsTrend'] }),
    client.invalidateQueries({ queryKey: ['pnlExpensesList'] }),
    client.invalidateQueries({ queryKey: ['payments'] }),
    client.invalidateQueries({ queryKey: ['supplier-payments'] }),
    client.invalidateQueries({ queryKey: ['expenses'] }),
    client.invalidateQueries({ queryKey: ['outstanding-expenses'] }),
    client.invalidateQueries({ queryKey: ['reports'] }),
  ]);
  refreshZustandReports();
}
