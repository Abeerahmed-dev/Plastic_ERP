import { QueryClient } from '@tanstack/react-query';
import { useReportStore } from '../store/useReportStore';

/**
 * Trigger background update for Zustand-backed financial & inventory reports.
 */
function refreshZustandReports() {
  try {
    const store = useReportStore.getState();
    if (store && typeof store.fetchAllReports === 'function') {
      store.fetchAllReports(true).catch((err) => {
        console.warn('[querySync] Failed to refresh Zustand reports:', err);
      });
    }
  } catch (err) {
    console.warn('[querySync] Error accessing report store:', err);
  }
}

/**
 * Invalidate all queries intersecting with Sales Invoices & POS transactions:
 * Invoices, Products, Customers, Dashboard, P&L, Inventory Valuation, and Payments.
 */
export async function invalidateSalesInvoiceQueries(queryClient: QueryClient) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    queryClient.invalidateQueries({ queryKey: ['products'] }),
    queryClient.invalidateQueries({ queryKey: ['customers'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['pnl'] }),
    queryClient.invalidateQueries({ queryKey: ['inventory-valuation'] }),
    queryClient.invalidateQueries({ queryKey: ['payments'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Purchases & Stock Inward:
 * Purchases, Products, Suppliers, Dashboard, P&L, Inventory Valuation, and Payments.
 */
export async function invalidatePurchaseQueries(queryClient: QueryClient) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['purchases'] }),
    queryClient.invalidateQueries({ queryKey: ['products'] }),
    queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['pnl'] }),
    queryClient.invalidateQueries({ queryKey: ['inventory-valuation'] }),
    queryClient.invalidateQueries({ queryKey: ['payments'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Customer Payments & Ledger:
 * Customers, Payments, Invoices, Dashboard, P&L.
 */
export async function invalidateCustomerPaymentQueries(queryClient: QueryClient) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['customers'] }),
    queryClient.invalidateQueries({ queryKey: ['payments'] }),
    queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['pnl'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Supplier Payments & Ledger:
 * Suppliers, Payments, Purchases, Dashboard, P&L.
 */
export async function invalidateSupplierPaymentQueries(queryClient: QueryClient) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
    queryClient.invalidateQueries({ queryKey: ['payments'] }),
    queryClient.invalidateQueries({ queryKey: ['purchases'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['pnl'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Expenses:
 * Expenses, Dashboard, P&L.
 */
export async function invalidateExpenseQueries(queryClient: QueryClient) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['expenses'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['pnl'] }),
  ]);
  refreshZustandReports();
}

/**
 * Invalidate all queries intersecting with Product Catalogue & Inventory:
 * Products, Inventory Valuation, Dashboard.
 */
export async function invalidateProductQueries(queryClient: QueryClient) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['products'] }),
    queryClient.invalidateQueries({ queryKey: ['inventory-valuation'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
  refreshZustandReports();
}

/**
 * Omni-invalidation for critical actions or master data resets.
 */
export async function invalidateAllDomains(queryClient: QueryClient) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    queryClient.invalidateQueries({ queryKey: ['purchases'] }),
    queryClient.invalidateQueries({ queryKey: ['products'] }),
    queryClient.invalidateQueries({ queryKey: ['customers'] }),
    queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['pnl'] }),
    queryClient.invalidateQueries({ queryKey: ['inventory-valuation'] }),
    queryClient.invalidateQueries({ queryKey: ['payments'] }),
    queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  ]);
  refreshZustandReports();
}

