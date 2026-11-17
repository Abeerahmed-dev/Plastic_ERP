import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Banknote, RefreshCw, HandCoins, Calendar, CheckCircle2, ShieldAlert, FileText, ArrowLeftRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { reportsService } from '../services/reports.service';

export default function CashierDashboard() {
  const { user } = useAuthStore();

  const { data: tally, isLoading, refetch } = useQuery({
    queryKey: ['cashierTally'],
    queryFn: () => reportsService.getCashierTally(),
    refetchInterval: 15000,
  });

  const formatPKR = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return 'Rs. 0';
    return `Rs. ${Number(val).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Cashier Active Shift
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome, {user?.name || 'Cashier'}
            </h1>
            <p className="text-sm text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Shift Date: {tally?.today_date || new Date().toLocaleDateString('en-PK')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition backdrop-blur-md"
              title="Refresh Cash Tally"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <Link
              to="/pos"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-bold shadow-lg shadow-amber-500/25 transition transform active:scale-95 text-sm cursor-pointer"
            >
              <ShoppingCart className="w-5 h-5 text-slate-950" />
              Open Walk-in POS
            </Link>
          </div>
        </div>
      </div>

      {/* Cash Tally Metric Cards */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-emerald-600" />
          Shift Cash Tally (Drawer Balance)
        </h2>

        {isLoading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
            Calculating shift cash tally...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Total Cash Tally Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-6 rounded-2xl text-white shadow-[0_8px_24px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_32px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 transition-all relative overflow-hidden">
              <div className="relative z-10">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 block mb-1">
                  Total Cash Collected
                </span>
                <p className="text-3xl font-black tracking-tight">
                  {formatPKR(tally?.total_cash_tally)}
                </p>
                <span className="text-xs text-emerald-100 mt-2 block font-medium">
                  {tally?.transaction_count || 0} Total Transactions Today
                </span>
              </div>
              <Banknote className="absolute right-3 bottom-3 w-20 h-20 text-white/10 pointer-events-none" />
            </div>

            {/* POS Sales Cash */}
            <div className="bg-white p-6 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.22),0_2px_8px_rgba(15,23,42,0.12)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.35)] hover:-translate-y-0.5 transition-all border border-slate-300 space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                POS Sales Cash
              </span>
              <p className="text-2xl font-bold text-slate-900">
                {formatPKR(tally?.pos_sales_cash)}
              </p>
              <p className="text-xs text-slate-500">Direct walk-in counter sales</p>
            </div>

            {/* Customer Debt Payments Cash */}
            <div className="bg-white p-6 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.22),0_2px_8px_rgba(15,23,42,0.12)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.35)] hover:-translate-y-0.5 transition-all border border-slate-300 space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Customer Payments Cash
              </span>
              <p className="text-2xl font-bold text-slate-900">
                {formatPKR(tally?.customer_payments_cash)}
              </p>
              <p className="text-xs text-slate-500">Udhaar recovery collected</p>
            </div>

            {/* Shift Status */}
            <div className="bg-slate-900 p-6 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.25)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.35)] hover:-translate-y-0.5 transition-all border border-slate-800 text-white space-y-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Safeguards Enforced
              </span>
              <p className="text-lg font-bold text-slate-100 flex items-center gap-1.5 pt-1">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Cashier Locked
              </p>
              <p className="text-xs text-slate-400">Price floors & credit limit active</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Cashier Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link
          to="/pos"
          className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-md hover:border-blue-500 hover:shadow-lg transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Launch Counter POS</h3>
              <p className="text-xs text-slate-500">Process quick walk-in sales & print receipts</p>
            </div>
          </div>
          <span className="text-sm font-bold text-blue-600 group-hover:translate-x-1 transition">→</span>
        </Link>

        <Link
          to="/invoices"
          className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-md hover:border-amber-500 hover:shadow-lg transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Sales Invoices</h3>
              <p className="text-xs text-slate-500">Create & manage wholesale customer invoices</p>
            </div>
          </div>
          <span className="text-sm font-bold text-amber-600 group-hover:translate-x-1 transition">→</span>
        </Link>

        <Link
          to="/exchange"
          className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-md hover:border-purple-500 hover:shadow-lg transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition">
              <ArrowLeftRight className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Product Exchange</h3>
              <p className="text-xs text-slate-500">Swap stock between warehouse products</p>
            </div>
          </div>
          <span className="text-sm font-bold text-purple-600 group-hover:translate-x-1 transition">→</span>
        </Link>

        <Link
          to="/payments"
          className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-md hover:border-emerald-500 hover:shadow-lg transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
              <HandCoins className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Receive Customer Udhaar</h3>
              <p className="text-xs text-slate-500">Collect cash payments & issue receipt</p>
            </div>
          </div>
          <span className="text-sm font-bold text-emerald-600 group-hover:translate-x-1 transition">→</span>
        </Link>
      </div>
    </div>
  );
}
