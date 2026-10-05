import { useAuthStore } from '../store/auth.store';
import { Users, Truck, Tag, Box, FileText, Banknote, LayoutDashboard, TrendingUp, Sliders, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportsService } from '../services/reports.service';
import CashierDashboard from './CashierDashboard';

export const Dashboard = () => {
  const { user, hasPermission } = useAuthStore();
  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';

  if (isCashier) {
    return <CashierDashboard />;
  }

  const { data: metrics } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: () => reportsService.getDashboardMetrics(),
  });

  const navLinks = [
    { to: '/onboarding', label: 'Day Zero Setup', icon: Sliders, permission: 'settings:read', color: 'amber' },
    { to: '/users', label: 'Employees', icon: Users, permission: 'users:read', color: 'indigo' },
    { to: '/customers', label: 'Customers', icon: Users, permission: 'customers:read', color: 'blue' },
    { to: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers:read', color: 'emerald' },
    { to: '/products', label: 'Products', icon: Box, permission: 'products:read', color: 'violet' },
    { to: '/categories', label: 'Categories', icon: Tag, permission: 'products:read', color: 'slate' },
    { to: '/expenses', label: 'Expenses', icon: Receipt, permission: null, subtitle: 'Manage operating expenses', color: 'rose' },
    { to: '/purchases', label: 'Purchases', icon: Truck, permission: 'purchases:read', color: 'emerald' },
    { to: '/supplier-payments', label: 'Supp. Payments', icon: Banknote, permission: 'payments:read', color: 'emerald' },
    { to: '/invoices', label: 'Invoices', icon: FileText, permission: 'sales:read', color: 'indigo' },
    { to: '/payments', label: 'Cust. Payments', icon: Banknote, permission: 'payments:read', color: 'indigo' },
  ];

  return (
    <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {user?.role !== 'Cashier' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Walk-in POS Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">Today's Sales</p>
                <p className="text-2xl font-bold text-slate-900">Rs. {metrics?.todaySales || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">Today's Transactions</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.todayTransactions || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">This Week's Sales</p>
                <p className="text-2xl font-bold text-slate-900">Rs. {metrics?.weeklySales || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">This Month's Sales</p>
                <p className="text-2xl font-bold text-slate-900">Rs. {metrics?.monthlySales || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick-access cards */}
        <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-indigo-500" />
          Quick Access
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {navLinks.map(({ to, label, icon: Icon, permission, subtitle }) => {
            if (permission && !hasPermission(permission)) return null;
            return (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500">{subtitle || `Manage ${label.toLowerCase()}`}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
};
