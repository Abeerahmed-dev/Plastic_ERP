import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import CustomersListPage from './pages/Customers/CustomersListPage';
import SuppliersListPage from './pages/Suppliers/SuppliersListPage';
import UsersListPage from './pages/Users/UsersListPage';
import ProductsListPage from './pages/Products/ProductsListPage';
import UOMPage from './pages/UOM/UOMPage';
import InvoicesListPage from './pages/Invoices/InvoicesListPage';
import PaymentsListPage from './pages/Payments/PaymentsListPage';
import SupplierPaymentsListPage from './pages/Payments/SupplierPaymentsListPage';
import PurchasesListPage from './pages/Purchases/PurchasesListPage';
import POSPage from './pages/POS/POSPage';
import { MainLayout } from './components/Layout/MainLayout';
import { useAuthStore } from './store/auth.store';

/**
 * App — root router shell.
 *
 * Route structure by session:
 *   Session 02 → /login, /dashboard
 *   Session 03 → /customers, /suppliers
 *   Session 04 → /products
 *   …
 */
import FinancialReports from './pages/FinancialReports';
import SystemInitialization from './pages/SystemInitialization';

function App() {
  const { user } = useAuthStore();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/onboarding" element={<SystemInitialization />} />
          <Route path="/users" element={<ProtectedRoute requiredPermission="users:read" />}>
            <Route index element={<UsersListPage />} />
          </Route>
          <Route path="/products" element={<ProtectedRoute requiredPermission="products:read" />}>
            <Route index element={<ProductsListPage />} />
          </Route>
          <Route path="/customers" element={<CustomersListPage />} />
          <Route path="/suppliers" element={<SuppliersListPage />} />
          <Route path="/uom" element={<UOMPage />} />
          <Route path="/invoices" element={<InvoicesListPage />} />
          <Route path="/purchases" element={<PurchasesListPage />} />
          <Route path="/payments" element={<PaymentsListPage />} />
          <Route path="/supplier-payments" element={<SupplierPaymentsListPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/reports" element={<FinancialReports />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={user?.role === 'Cashier' ? '/pos' : '/dashboard'} replace />} />
      <Route path="*" element={<Navigate to={user?.role === 'Cashier' ? '/pos' : '/dashboard'} replace />} />
    </Routes>
  );
}

export default App;
