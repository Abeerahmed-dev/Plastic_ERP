import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import ProductsListPage from './pages/Products/ProductsListPage';
import CategoriesPage from './pages/Categories/CategoriesPage';
import CustomersListPage from './pages/Customers/CustomersListPage';
import CustomerDetailPage from './pages/Customers/CustomerDetailPage';
import SuppliersListPage from './pages/Suppliers/SuppliersListPage';
import SupplierDetailPage from './pages/Suppliers/SupplierDetailPage';
import InvoicesListPage from './pages/Invoices/InvoicesListPage';
import PurchasesListPage from './pages/Purchases/PurchasesListPage';
import PaymentsListPage from './pages/Payments/PaymentsListPage';
import SupplierPaymentsListPage from './pages/Payments/SupplierPaymentsListPage';
import ExpensesListPage from './pages/Expenses/ExpensesListPage';
import ExchangePage from './pages/Exchange/ExchangePage';
import FinancialReports from './pages/FinancialReports';
import IncomeStatementPage from './pages/Reports/IncomeStatementPage';
import MarginAnalyticsPage from './pages/Reports/MarginAnalyticsPage';
import InventoryValuationPage from './pages/Reports/InventoryValuationPage';
import POSPage from './pages/POS/POSPage';
import EmployeesListPage from './pages/Employees/EmployeesListPage';
import EmployeeDetailPage from './pages/Employees/EmployeeDetailPage';
import SettingsPage from './pages/Settings/SettingsPage';
import { MainLayout } from './components/Layout/MainLayout';
import { useAuthStore } from './store/auth.store';
import { settingsService } from './services/settings.service';

function App() {
  const { user } = useAuthStore();
  const role = (user?.roleName || user?.role || '').toUpperCase();
  const isCashier = role === 'CASHIER';
  const isAccountant = role === 'ACCOUNTANT';
  const defaultRoute = isCashier ? '/pos' : isAccountant ? '/customers' : '/dashboard';

  const { data: featureAccess } = useQuery({
    queryKey: ['cashier-feature-access'],
    queryFn: () => settingsService.getCashierFeatureAccess(),
    enabled: !!user,
    staleTime: 60000,
    retry: false,
  });

  const canCashierAccessCustomer = Boolean(featureAccess?.customer_access);
  const canCashierAccessParty = Boolean(featureAccess?.party_access);

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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <Dashboard />} />
            <Route path="/users" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <Navigate to="/settings?tab=employees" replace />} />
            <Route path="/employees" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <EmployeesListPage />} />
            <Route path="/employees/:id" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <EmployeeDetailPage />} />
            <Route path="/settings" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <SettingsPage />} />
            <Route path="/products" element={isCashier ? <Navigate to="/pos" replace /> : <ProductsListPage />} />
            <Route path="/categories" element={isCashier ? <Navigate to="/pos" replace /> : <CategoriesPage />} />
            <Route path="/uom" element={<Navigate to="/categories" replace />} />
            <Route
              path="/customers"
              element={isCashier && !canCashierAccessCustomer ? <Navigate to="/pos" replace /> : <CustomersListPage />}
            />
            <Route
              path="/customers/:id"
              element={isCashier && !canCashierAccessCustomer ? <Navigate to="/pos" replace /> : <CustomerDetailPage />}
            />
            <Route
              path="/suppliers"
              element={isCashier && !canCashierAccessParty ? <Navigate to="/pos" replace /> : <SuppliersListPage />}
            />
            <Route
              path="/suppliers/:id"
              element={isCashier && !canCashierAccessParty ? <Navigate to="/pos" replace /> : <SupplierDetailPage />}
            />
            <Route path="/invoices" element={isAccountant ? <Navigate to="/customers" replace /> : <InvoicesListPage />} />
            <Route path="/sales" element={isAccountant ? <Navigate to="/customers" replace /> : <InvoicesListPage />} />
            <Route path="/pos/invoices" element={isAccountant ? <Navigate to="/customers" replace /> : <InvoicesListPage defaultType="pos" />} />
            <Route path="/pos-invoices" element={isAccountant ? <Navigate to="/customers" replace /> : <InvoicesListPage defaultType="pos" />} />
            <Route path="/purchases" element={isCashier ? <Navigate to="/pos" replace /> : <PurchasesListPage />} />
            <Route path="/exchange" element={isAccountant ? <Navigate to="/customers" replace /> : <ExchangePage />} />
            <Route path="/exchanges" element={isAccountant ? <Navigate to="/customers" replace /> : <ExchangePage />} />
            <Route path="/payments" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <PaymentsListPage />} />
            <Route path="/customer-payments" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <PaymentsListPage />} />
            <Route path="/supplier-payments" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <SupplierPaymentsListPage />} />
            <Route path="/expenses" element={isCashier ? <Navigate to="/pos" replace /> : <ExpensesListPage />} />
            <Route path="/pos" element={isAccountant ? <Navigate to="/customers" replace /> : <POSPage />} />
            <Route path="/stock" element={<Navigate to="/stocks" replace />} />
            <Route path="/reports" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <FinancialReports />} />
            <Route path="/reports/income-statement" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <IncomeStatementPage />} />
            <Route path="/reports/pnl" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <IncomeStatementPage />} />
            <Route path="/reports/margin-analytics" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <MarginAnalyticsPage />} />
            <Route path="/reports/sales-margin" element={(isCashier || isAccountant) ? <Navigate to={defaultRoute} replace /> : <MarginAnalyticsPage />} />
            <Route path="/stocks" element={<InventoryValuationPage />} />
            <Route path="/reports/inventory-valuation" element={<Navigate to="/stocks" replace />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </>
  );
}

export default App;
