import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import CustomersListPage from './pages/Customers/CustomersListPage';
import CustomerDetailPage from './pages/Customers/CustomerDetailPage';
import SuppliersListPage from './pages/Suppliers/SuppliersListPage';
import SupplierDetailPage from './pages/Suppliers/SupplierDetailPage';
import ProductsListPage from './pages/Products/ProductsListPage';
import CategoriesPage from './pages/Categories/CategoriesPage';
import InvoicesListPage from './pages/Invoices/InvoicesListPage';
import PurchasesListPage from './pages/Purchases/PurchasesListPage';
import PaymentsListPage from './pages/Payments/PaymentsListPage';
import SupplierPaymentsListPage from './pages/Payments/SupplierPaymentsListPage';
import POSPage from './pages/POS/POSPage';
import { MainLayout } from './components/Layout/MainLayout';
import { useAuthStore } from './store/auth.store';
import FinancialReports from './pages/FinancialReports';
import ExpensesListPage from './pages/Expenses/ExpensesListPage';
import CashierStockPage from './pages/Cashier/CashierStockPage';
import IncomeStatementPage from './pages/Reports/IncomeStatementPage';
import MarginAnalyticsPage from './pages/Reports/MarginAnalyticsPage';
import InventoryValuationPage from './pages/Reports/InventoryValuationPage';
import SettingsPage from './pages/Settings/SettingsPage';
import EmployeesListPage from './pages/Employees/EmployeesListPage';
import ExchangePage from './pages/Exchange/ExchangePage';

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
          <Route path="/users" element={isCashier ? <Navigate to="/pos" replace /> : <Navigate to="/settings?tab=employees" replace />} />
          <Route path="/employees" element={isCashier ? <Navigate to="/pos" replace /> : <EmployeesListPage />} />
          <Route path="/settings" element={isCashier ? <Navigate to="/pos" replace /> : <SettingsPage />} />
          <Route path="/products" element={<ProductsListPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/uom" element={<Navigate to="/categories" replace />} />
          <Route path="/customers" element={<CustomersListPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/suppliers" element={isCashier ? <Navigate to="/pos" replace /> : <SuppliersListPage />} />
          <Route path="/suppliers/:id" element={isCashier ? <Navigate to="/pos" replace /> : <SupplierDetailPage />} />
          <Route path="/invoices" element={<InvoicesListPage />} />
          <Route path="/sales" element={<InvoicesListPage />} />
          <Route path="/pos/invoices" element={<InvoicesListPage defaultType="pos" />} />
          <Route path="/pos-invoices" element={<InvoicesListPage defaultType="pos" />} />
          <Route path="/purchases" element={<PurchasesListPage />} />
          <Route path="/exchange" element={<ExchangePage />} />
          <Route path="/exchanges" element={<ExchangePage />} />
          <Route path="/payments" element={isCashier ? <Navigate to="/pos" replace /> : <PaymentsListPage />} />
          <Route path="/customer-payments" element={isCashier ? <Navigate to="/pos" replace /> : <PaymentsListPage />} />
          <Route path="/supplier-payments" element={isCashier ? <Navigate to="/pos" replace /> : <SupplierPaymentsListPage />} />
          <Route path="/expenses" element={isCashier ? <Navigate to="/pos" replace /> : <ExpensesListPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/stock" element={<CashierStockPage />} />
          <Route path="/reports" element={isCashier ? <Navigate to="/pos" replace /> : <FinancialReports />} />
          <Route path="/reports/income-statement" element={isCashier ? <Navigate to="/pos" replace /> : <IncomeStatementPage />} />
          <Route path="/reports/pnl" element={isCashier ? <Navigate to="/pos" replace /> : <IncomeStatementPage />} />
          <Route path="/reports/margin-analytics" element={isCashier ? <Navigate to="/pos" replace /> : <MarginAnalyticsPage />} />
          <Route path="/reports/sales-margin" element={isCashier ? <Navigate to="/pos" replace /> : <MarginAnalyticsPage />} />
          <Route path="/stocks" element={isCashier ? <Navigate to="/pos" replace /> : <InventoryValuationPage />} />
          <Route path="/reports/inventory-valuation" element={<Navigate to="/stocks" replace />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={isCashier ? '/pos' : '/dashboard'} replace />} />
      <Route path="*" element={<Navigate to={isCashier ? '/pos' : '/dashboard'} replace />} />
    </Routes>
    </>
  );
}

export default App;
