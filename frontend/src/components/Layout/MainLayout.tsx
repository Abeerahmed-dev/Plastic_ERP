import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut, Users, Box, FileText, Truck, Tag,
  ShoppingCart, LayoutDashboard, PieChart, Receipt, Boxes,
  ChevronDown, ChevronRight, TrendingUp, Menu, X, Settings,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { authService } from '../../services/auth.service';
import type { AuthUser } from '../../types/auth.types';
import sabirLogo from '../../assets/sabirlogo.png';

/* ─── Types ─── */
type NavItem = {
  to?: string;
  label: string;
  icon: React.ElementType;
  permission?: string | null;
  children?: NavItem[];
};

/* ─── Nav structure ─── */
const navSections: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null },
    ],
  },
  {
    heading: 'Sales',
    items: [
      { to: '/invoices', label: 'Sales Invoices', icon: FileText, permission: 'sales:read' },
      { to: '/customers', label: 'Customers', icon: Users, permission: 'customers:read' },
    ],
  },
  {
    heading: 'Purchases',
    items: [
      { to: '/purchases', label: 'Purchasing', icon: Truck, permission: 'purchases:read' },
      { to: '/suppliers', label: 'Party', icon: Truck, permission: 'suppliers:read' },
    ],
  },
  {
    heading: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Box, permission: 'products:read' },
      { to: '/categories', label: 'Categories', icon: Tag, permission: 'products:read' },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { to: '/expenses', label: 'Expenses', icon: Receipt, permission: null },
      {
        label: 'Reports',
        icon: PieChart,
        permission: null,
        children: [
          { to: '/reports/income-statement', label: 'Income Statement', icon: TrendingUp, permission: null },
          { to: '/reports/margin-analytics', label: 'Margin Analytics', icon: TrendingUp, permission: null },
          { to: '/reports/inventory-valuation', label: 'Inventory Valuation', icon: Boxes, permission: null },
          { to: '/reports', label: 'Financial Reports', icon: PieChart, permission: null },
        ],
      },
    ],
  },
  {
    heading: 'Management',
    items: [
      { to: '/employees', label: 'Store Staff', icon: Users, permission: null },
      { to: '/settings', label: 'Settings', icon: Settings, permission: null },
    ],
  },
];

/* ─── Leaf link ─── */
function SidebarLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const location = useLocation();
  if (!item.to) return null;

  const searchParams = new URLSearchParams(location.search);
  const isPosTab = searchParams.get('type') === 'pos';
  const isPosRoute =
    location.pathname.startsWith('/pos-invoices') ||
    location.pathname.startsWith('/pos/invoices') ||
    ((location.pathname.startsWith('/invoices') || location.pathname.startsWith('/sales')) && isPosTab);

  const isActive =
    item.to === '/pos-invoices' || item.to === '/invoices?type=pos'
      ? isPosRoute
      : item.to === '/invoices'
      ? (location.pathname.startsWith('/invoices') || location.pathname.startsWith('/sales')) && !isPosRoute
      : item.to === '/dashboard'
      ? location.pathname === '/dashboard' || location.pathname === '/'
      : location.pathname.startsWith(item.to);

  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150 ${
        isActive
          ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20'
          : 'text-slate-300 hover:bg-slate-800 hover:text-amber-300'
      }`}
    >
      <item.icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-amber-400'
        }`}
      />
      {item.label}
    </Link>
  );
}

/* ─── Collapsible group ─── */
function SidebarGroup({ item, onLinkClick }: { item: NavItem; onLinkClick?: () => void }) {
  const location = useLocation();
  const childActive = item.children?.some(
    (c) => c.to && location.pathname.startsWith(c.to)
  ) ?? false;
  const [open, setOpen] = useState(childActive);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150 ${
          childActive
            ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
            : 'text-slate-300 hover:bg-slate-800 hover:text-amber-300'
        }`}
      >
        <item.icon className={`h-4 w-4 shrink-0 ${childActive ? 'text-amber-400' : 'text-slate-400'}`} />
        <span className="flex-1 text-left">{item.label}</span>
        {open
          ? <ChevronDown className={`h-3.5 w-3.5 ${childActive ? 'text-amber-400' : 'text-slate-400'}`} />
          : <ChevronRight className={`h-3.5 w-3.5 ${childActive ? 'text-amber-400' : 'text-slate-400'}`} />
        }
      </button>

      {open && (
        <div className="ml-4 mt-1 pl-3 border-l border-amber-500/30 flex flex-col gap-1">
          {item.children?.map((child) => (
            <SidebarLink key={child.to} item={child} onClick={onLinkClick} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Sidebar body (reused for desktop + mobile drawer) ─── */
type SidebarContentProps = {
  user: AuthUser | null;
  hasPermission: (permission: string) => boolean;
  onLinkClick?: () => void;
  handleLogout: () => void;
};

function SidebarContent({ user, hasPermission, onLinkClick, handleLogout }: SidebarContentProps) {
  const isCashierRole = (user?.role || '').toUpperCase() === 'CASHIER';

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-800 shrink-0 bg-slate-900">
        <img
          src={sabirLogo}
          alt="Sabir Plastic"
          className="h-10 w-auto object-contain shrink-0 drop-shadow"
        />
        <div>
          <p className="font-bold text-white text-sm leading-tight tracking-tight">Sabir Plastic Store</p>
          <p className="text-[11px] text-amber-400 font-medium leading-tight">ERP System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (isCashierRole) {
              const hidden = ['/reports', '/purchases', '/users', '/supplier-payments', '/suppliers', '/settings', '/expenses', '/employees'];
              if (item.to && hidden.some((h) => item.to!.startsWith(h))) return false;
              if (!item.to && item.label === 'Reports') return false;
            }
            if (item.permission && !hasPermission(item.permission)) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.heading}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {section.heading}
              </p>
              <div className="flex flex-col gap-1">
                {visibleItems.map((item) =>
                  item.children ? (
                    <SidebarGroup key={item.label} item={item} onLinkClick={onLinkClick} />
                  ) : (
                    <SidebarLink key={item.to} item={item} onClick={onLinkClick} />
                  )
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-slate-800 px-3 py-4 shrink-0 bg-slate-900">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-slate-950 font-black text-xs">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-amber-400 font-semibold capitalize truncate">
              {user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

/* ─── Route Title Mapping Helper ─── */
const getPageTitle = (pathname: string, search?: string): { title: string; subtitle?: string } => {
  const isPosInvoices =
    pathname.startsWith('/pos-invoices') ||
    pathname.startsWith('/pos/invoices') ||
    ((pathname.startsWith('/invoices') || pathname.startsWith('/sales')) && new URLSearchParams(search || '').get('type') === 'pos');
  if (isPosInvoices) {
    return { title: 'POS Sale Invoices', subtitle: 'Retail Walk-in Counter Sale History' };
  }
  if (pathname === '/dashboard' || pathname === '/') {
    return { title: 'Dashboard', subtitle: 'Overview & Business Analytics' };
  }
  if (pathname.startsWith('/pos')) {
    return { title: 'Walk-in POS Billing', subtitle: 'Point of Sale Terminal' };
  }
  if (pathname.startsWith('/invoices') || pathname.startsWith('/sales')) {
    return { title: 'Sales Invoices', subtitle: 'Customer Invoices & Billing' };
  }
  if (pathname.startsWith('/payments')) {
    return { title: 'Customer Payments', subtitle: 'Receipts & Accounts Receivable' };
  }
  if (pathname.startsWith('/customers')) {
    return { title: 'Customers', subtitle: 'Customer Directory & Accounts' };
  }
  if (pathname.startsWith('/purchases')) {
    return { title: 'Purchasing', subtitle: 'Party Purchases & Bills' };
  }
  if (pathname.startsWith('/supplier-payments')) {
    return { title: 'Party Payments', subtitle: 'Accounts Payable & Disbursals' };
  }
  if (pathname.startsWith('/suppliers')) {
    return { title: 'Parties', subtitle: 'Party Management' };
  }
  if (pathname.startsWith('/products')) {
    return { title: 'Products', subtitle: 'Inventory Catalog & Pricing' };
  }
  if (pathname.startsWith('/categories') || pathname.startsWith('/uom')) {
    return { title: 'Categories', subtitle: 'Product Classifications' };
  }
  if (pathname.startsWith('/expenses')) {
    return { title: 'Operating Expenses', subtitle: 'Overheads & Expense Ledger' };
  }
  if (pathname.startsWith('/reports/income-statement') || pathname.startsWith('/reports/pnl')) {
    return { title: 'Income Statement (P&L)', subtitle: 'Profit & Loss Statement' };
  }
  if (pathname.startsWith('/reports/margin-analytics') || pathname.startsWith('/reports/sales-margin')) {
    return { title: 'Margin Analytics', subtitle: 'Sales & Profit Margin Analytics' };
  }
  if (pathname.startsWith('/reports/inventory-valuation')) {
    return { title: 'Inventory Valuation', subtitle: 'WAC Valuation & FIFO Batches' };
  }
  if (pathname.startsWith('/reports')) {
    return { title: 'Financial Reports', subtitle: 'Financial & Inventory Intelligence' };
  }
  if (pathname.startsWith('/employees')) {
    return { title: 'Store Employees', subtitle: 'Workers Directory, Timings & Payroll' };
  }
  if (pathname.startsWith('/settings')) {
    return { title: 'Settings', subtitle: 'System & Business Configuration' };
  }
  if (pathname.startsWith('/stock')) {
    return { title: 'Cashier Stock', subtitle: 'Available Inventory' };
  }

  return { title: 'ERP MANAGEMENT SYSTEM' };
};

/* ─── Main Layout ─── */
export const MainLayout = () => {
  const { user, clearAuth, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isCashier = (user?.role || '').toUpperCase() === 'CASHIER';
  const currentPage = getPageTitle(location.pathname, location.search);

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

  const isPOSPage = location.pathname.startsWith('/pos');
  const hideSidebar = isPOSPage;

  /* ─── Cashier: horizontal top-nav ─── */
  if (isCashier) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col print:bg-white print:m-0 print:p-0">
        <nav className="bg-slate-900 shadow-md border-b border-slate-800 shrink-0 print:hidden">
            <div className="w-full px-4 sm:px-6">
              <div className="flex items-center justify-between h-16 gap-4">
                {/* Brand Logo & Title */}
                <div className="flex items-center gap-3 shrink-0">
                  <img
                    src={sabirLogo}
                    alt="Sabir Plastic"
                    className="h-9 w-auto object-contain shrink-0 drop-shadow"
                  />
                  <div className="hidden sm:flex flex-col">
                    <span className="font-bold text-sm text-white tracking-tight leading-none">
                      Sabir Plastic Store
                    </span>
                    <span className="text-[11px] font-semibold text-amber-400 leading-none mt-1">
                      Cashier Terminal
                    </span>
                  </div>
                </div>

                {/* Navigation Links */}
                <div className="flex items-center gap-2 overflow-x-auto min-w-0 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {[
                    { to: '/pos', label: 'POS Billing', icon: ShoppingCart },
                    { to: '/pos-invoices', label: 'POS Sale Invoices', icon: FileText },
                    { to: '/purchases', label: 'Purchasing', icon: Truck },
                    { to: '/products', label: 'Products', icon: Box },
                    { to: '/categories', label: 'Categories', icon: Tag },
                  ].map(({ to, label, icon: Icon }) => {
                    const isActive = to === '/pos' ? location.pathname === '/pos' : location.pathname.startsWith(to);
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                          isActive
                            ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-amber-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* User Profile & Logout */}
                <div className="flex items-center gap-3 shrink-0 pl-3 border-l border-slate-800">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-xs font-semibold text-slate-200 leading-none">{user?.name}</span>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider leading-none mt-1">
                      {user?.role}
                    </span>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xs shadow-sm shrink-0">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </nav>

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    );
  }

  /* ─── Owner / Admin: fixed sidebar layout ─── */
  return (
    <div className="min-h-screen bg-slate-50 flex print:bg-white print:m-0 print:p-0">
      {/* Desktop fixed sidebar - hidden on POS page */}
      {!hideSidebar && (
        <aside className="hidden lg:flex flex-col w-60 shrink-0 fixed top-0 left-0 h-screen bg-slate-900 border-r border-slate-800 z-30 shadow-md print:hidden">
          <SidebarContent
            user={user}
            hasPermission={hasPermission}
            handleLogout={handleLogout}
          />
        </aside>
      )}

      {/* Mobile sidebar overlay - hidden on POS page */}
      {!hideSidebar && mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex print:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative w-60 bg-slate-900 shadow-2xl flex flex-col h-full z-10 border-r border-slate-800">
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              user={user}
              hasPermission={hasPermission}
              onLinkClick={() => setMobileSidebarOpen(false)}
              handleLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      {/* Right: slim topbar + page content (full width when on POS) */}
      <div className={`flex flex-col flex-1 ${!hideSidebar ? 'lg:ml-60' : ''} min-h-screen min-w-0 overflow-x-hidden print:ml-0 print:p-0`}>
        {/* Top bar */}
        <header className="relative sticky top-0 z-20 bg-slate-900 border-b border-slate-800 h-16 flex items-center px-4 sm:px-6 justify-between shrink-0 shadow-sm print:hidden">
          {/* Left: Hamburger & Brand logo */}
          <div className="flex items-center gap-2.5 z-10">
            {!isPOSPage && (
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <div className={`${isPOSPage ? 'flex' : 'lg:hidden flex'} items-center gap-2.5 mr-1`}>
              <img
                src={sabirLogo}
                alt="Sabir Plastic"
                className="h-9 w-auto object-contain shrink-0 drop-shadow"
              />
              <div className="hidden sm:flex flex-col">
                <span className="font-bold text-sm text-white tracking-tight leading-none">Sabir Plastic Store</span>
                {!isPOSPage && (
                  <span className="text-[11px] font-semibold text-amber-400 leading-none mt-1">
                    ERP System
                  </span>
                )}
              </div>
            </div>

            {/* Dynamic Page Heading when NOT on POS */}
            {!isPOSPage && (
              <div className="flex flex-col justify-center ml-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
                  {currentPage.title}
                </h1>
                {currentPage.subtitle && (
                  <p className="hidden md:block text-[11px] text-slate-400 font-medium mt-1 leading-none">
                    {currentPage.subtitle}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Centered Dynamic Page Heading when ON POS */}
          {isPOSPage && (
            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center text-center z-0 pointer-events-none">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
                {currentPage.title}
              </h1>
              {currentPage.subtitle && (
                <p className="hidden md:block text-[11px] text-amber-400/90 font-medium mt-1 leading-none">
                  {currentPage.subtitle}
                </p>
              )}
            </div>
          )}

          {/* Right: POS Sale Invoices + Go to SBS ERP + User info chip */}
          <div className="flex items-center gap-2.5 z-10">
            {/* POS Sale Invoices button: directly beside Go to SBS ERP */}
            {isPOSPage && (
              <Link
                to="/pos-invoices"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-100 border border-amber-500/40 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
                title="View POS Sale Invoices History"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>POS Sale Invoices</span>
              </Link>
            )}

            {/* Go to SPS ERP button: Only for Admin / Owner on POS screen */}
            {isPOSPage && !isCashier && (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 mr-1"
                title="Return to SPS ERP Dashboard"
              >
                <LayoutDashboard className="w-4 h-4 text-slate-950" />
                <span>Go to SPS ERP</span>
              </Link>
            )}

            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-200">{user?.name}</span>
              <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                {user?.role}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xs">
              <span className="text-slate-950 font-black text-xs">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
