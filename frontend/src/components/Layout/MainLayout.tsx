import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Users, Box, FileText, Truck, Tag, Menu, X, HandCoins, ShoppingCart, LayoutDashboard, PieChart, Sliders, Receipt, Boxes } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { authService } from '../../services/auth.service';

export const MainLayout = () => {
  const { user, clearAuth, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null },
    { to: '/onboarding', label: 'Day Zero Setup', icon: Sliders, permission: null },
    { to: '/pos', label: 'Walk-in POS', icon: ShoppingCart, permission: 'sales:write' },
    { to: '/reports/income-statement', label: 'Income Statement', icon: PieChart, permission: null },
    { to: '/reports/margin-analytics', label: 'Margin Analytics', icon: PieChart, permission: null },
    { to: '/reports/inventory-valuation', label: 'Inventory Valuation', icon: Boxes, permission: null },
    { to: '/expenses', label: 'Expenses', icon: Receipt, permission: null },
    { to: '/reports', label: 'Financial Reports', icon: PieChart, permission: null },
    { to: '/users', label: 'Employees', icon: Users, permission: 'users:read' },
    { to: '/customers', label: 'Customers', icon: Users, permission: 'customers:read' },
    { to: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers:read' },
    { to: '/products', label: 'Products', icon: Box, permission: 'products:read' },
    { to: '/categories', label: 'Categories', icon: Tag, permission: 'products:read' },
    { to: '/invoices', label: 'Sales Invoices', icon: FileText, permission: 'sales:read' },
    { to: '/payments', label: 'Cust. Payments', icon: HandCoins, permission: 'payments:read' },
    { to: '/purchases', label: 'Purchases', icon: Truck, permission: 'purchases:read' },
    { to: '/supplier-payments', label: 'Supp. Payments', icon: HandCoins, permission: 'payments:read' },
  ];

  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Global Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              {!isCashier && (
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Menu className="h-6 w-6" />
                </button>
              )}

              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-md flex items-center justify-center transform rotate-3">
                  <span className="text-white font-bold text-sm tracking-tighter -rotate-3">SP</span>
                </div>
                <span className="font-bold text-xl text-slate-900 tracking-tight hidden sm:block">
                  {isCashier ? 'Sabir Plastic — Cashier Terminal' : 'Sabir Plastic'}
                </span>
              </div>

              {/* Cashier Top Nav Links */}
              {isCashier ? (
                <div className="flex items-center gap-1.5 ml-4 border-l border-slate-200 pl-4 overflow-x-auto">
                  <Link
                    to="/pos"
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 ${
                      location.pathname === '/pos' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    POS Billing
                  </Link>
                  <Link
                    to="/expenses"
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 ${
                      location.pathname.startsWith('/expenses') ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Expenses
                  </Link>
                  <Link
                    to="/invoices"
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 ${
                      location.pathname.startsWith('/invoices') || location.pathname.startsWith('/sales') ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Sales Invoices
                  </Link>
                  <Link
                    to="/purchases"
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 ${
                      location.pathname.startsWith('/purchases') ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Purchase Invoices
                  </Link>
                  <Link
                    to="/products"
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 ${
                      location.pathname.startsWith('/products') ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    Products
                  </Link>
                  <Link
                    to="/categories"
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 ${
                      location.pathname.startsWith('/categories') ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    Categories
                  </Link>
                  <Link
                    to="/stock"
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 ${
                      location.pathname === '/stock' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    Current Stock
                  </Link>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-1 ml-4 border-l border-slate-200 pl-4">
                  <Link to="/dashboard" className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname === '/dashboard' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>Dashboard</Link>
                  <Link to="/reports/income-statement" className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname.startsWith('/reports/income-statement') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>Income Statement</Link>
                  <Link to="/reports/margin-analytics" className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname.startsWith('/reports/margin-analytics') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>Margin Analytics</Link>
                  <Link to="/reports/inventory-valuation" className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname.startsWith('/reports/inventory-valuation') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>Inventory Valuation</Link>
                  <Link to="/expenses" className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname.startsWith('/expenses') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>Expenses</Link>
                  {user?.role !== 'CASHIER' && user?.roleName !== 'Cashier' && (
                    <>
                      <Link to="/reports" className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname === '/reports' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>Financial Reports</Link>
                      <Link to="/purchases" className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname.startsWith('/purchases') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>Purchases</Link>
                      <Link to="/invoices" className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname.startsWith('/invoices') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>Sales Invoices</Link>
                    </>
                  )}
                  <Link to="/pos" className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname.startsWith('/pos') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>POS</Link>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900">{user?.name}</span>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full capitalize">
                  {user?.roleName || user?.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors block"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          <div className="relative w-64 max-w-sm bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-slate-800">Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-2 overflow-y-auto">
              {navLinks.map(({ to, label, icon: Icon, permission }) => {
                const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';
                if (isCashier && ['/reports', '/purchases', '/onboarding', '/users', '/supplier-payments'].includes(to)) {
                  return null;
                }
                if (permission && !hasPermission(permission)) return null;

                const isActive = location.pathname.startsWith(to) || (to === '/dashboard' && location.pathname === '/');

                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto border-t border-slate-100 p-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
