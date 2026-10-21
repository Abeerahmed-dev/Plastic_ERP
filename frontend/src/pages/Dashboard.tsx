import { useAuthStore } from '../store/auth.store';
import CashierDashboard from './CashierDashboard';
import { LiquidityLedger } from '../components/Reports/LiquidityLedger';
import { BusinessPerformanceCharts } from '../components/Reports/BusinessPerformanceCharts';
import { InventoryLedgerSection } from '../components/Reports/InventoryLedgerSection';
import { LowStockWidget } from '../components/Dashboard/LowStockWidget';

export const Dashboard = () => {
  const { user } = useAuthStore();
  const isCashier = (user?.role || '').toUpperCase() === 'CASHIER';

  if (isCashier) {
    return <CashierDashboard />;
  }

  return (
    <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0 space-y-8">

        {/* Low Stock Early Warnings Alert Engine */}
        <LowStockWidget />

        {/* Liquidity & Working Capital Ledger */}
        <div>
          <LiquidityLedger />
        </div>

        {/* Time-Bound Business Performance (P&L Overview) - 2 Graphs */}
        <div className="mb-8">
          <BusinessPerformanceCharts />
        </div>

        {/* 1. Inventory Ledger & WAC Asset Valuation */}
        <div className="mb-8">
          <InventoryLedgerSection />
        </div>

      </div>
    </main>
  );
};
