import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import CustomersListPage from './pages/Customers/CustomersListPage';
import SuppliersListPage from './pages/Suppliers/SuppliersListPage';
import UsersListPage from './pages/Users/UsersListPage';
import ProductsListPage from './pages/Products/ProductsListPage';
import CategoriesPage from './pages/Categories/CategoriesPage';
import InvoicesListPage from './pages/Invoices/InvoicesListPage';
import PurchasesListPage from './pages/Purchases/PurchasesListPage';
import POSPage from './pages/POS/POSPage';
import { MainLayout } from './components/Layout/MainLayout';
import { useAuthStore } from './store/auth.store';
import FinancialReports from './pages/FinancialReports';
import ExpensesListPage from './pages/Expenses/ExpensesListPage';
import CashierStockPage from './pages/Cashier/CashierStockPage';
import IncomeStatementPage from './pages/Reports/IncomeStatementPage';
import MarginAnalyticsPage from './pages/Reports/MarginAnalyticsPage';
import InventoryValuationPage from './pages/Reports/InventoryValuationPage';

function App() {
  const { user } = useAuthStore();
  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';

  return (
    <>
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={4000}
      />
      <Routes>
        <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={isCashier ? <Navigate to="/pos" replace /> : <Dashboard />} />
          <Route path="/users" element={isCashier ? <Navigate to="/pos" replace /> : <UsersListPage />} />
          <Route path="/products" element={<ProductsListPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/uom" element={<Navigate to="/categories" replace />} />
          <Route path="/customers" element={<CustomersListPage />} />
          <Route path="/suppliers" element={isCashier ? <Navigate to="/pos" replace /> : <SuppliersListPage />} />
          <Route path="/invoices" element={<InvoicesListPage />} />
          <Route path="/sales" element={<InvoicesListPage />} />
          <Route path="/purchases" element={<PurchasesListPage />} />
          <Route path="/payments" element={<Navigate to="/customers" replace />} />
          <Route path="/customer-payments" element={<Navigate to="/customers" replace />} />
          <Route path="/supplier-payments" element={<Navigate to="/suppliers" replace />} />
          <Route path="/expenses" element={<ExpensesListPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/stock" element={<CashierStockPage />} />
          <Route path="/reports" element={isCashier ? <Navigate to="/pos" replace /> : <FinancialReports />} />
          <Route path="/reports/income-statement" element={isCashier ? <Navigate to="/pos" replace /> : <IncomeStatementPage />} />
          <Route path="/reports/pnl" element={isCashier ? <Navigate to="/pos" replace /> : <IncomeStatementPage />} />
          <Route path="/reports/margin-analytics" element={isCashier ? <Navigate to="/pos" replace /> : <MarginAnalyticsPage />} />
          <Route path="/reports/sales-margin" element={isCashier ? <Navigate to="/pos" replace /> : <MarginAnalyticsPage />} />
          <Route path="/reports/inventory-valuation" element={isCashier ? <Navigate to="/pos" replace /> : <InventoryValuationPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={isCashier ? '/pos' : '/dashboard'} replace />} />
      <Route path="*" element={<Navigate to={isCashier ? '/pos' : '/dashboard'} replace />} />
    </Routes>
    </>
  );
}

export default App;
