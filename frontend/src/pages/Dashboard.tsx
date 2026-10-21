import { useAuthStore } from '../store/auth.store';
import CashierDashboard from './CashierDashboard';
import { LiquidityLedger } from '../components/Reports/LiquidityLedger';
import { BusinessPerformanceCharts } from '../components/Reports/BusinessPerformanceCharts';
import { InventoryLedgerSection } from '../components/Reports/InventoryLedgerSection';

export const Dashboard = () => {
  const { user } = useAuthStore();
  const isCashier = (user?.role || '').toUpperCase() === 'CASHIER';

  if (isCashier) {
    return <CashierDashboard />;
  }

  return (
    <main className="w-full max-w-full py-4 sm:py-5 px-3 sm:px-5 space-y-4 min-w-0 overflow-x-hidden">
      {/* 1. Liquidity & Working Capital Top Card */}
      <div className="w-full min-w-0">
        <LiquidityLedger />
      </div>

      {/* 2. Side-by-Side: Time-Bound Business Performance (P&L Graphs) + 1. Inventory Ledger & WAC Asset Valuation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch w-full min-w-0">
        {/* Left Column: Graphs */}
        <div className="w-full min-w-0">
          <BusinessPerformanceCharts />
        </div>

        {/* Right Column: 1. Inventory Ledger & WAC Asset Valuation */}
        <div className="w-full min-w-0">
          <InventoryLedgerSection />
        </div>
      </div>
    </main>
  );
};
