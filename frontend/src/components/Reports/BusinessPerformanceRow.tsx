import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, DollarSign, Receipt, Calendar, Filter, ExternalLink, Plus } from 'lucide-react';
import api from '../../services/api';
import { ExpensesListModal } from './ExpensesListModal';
import { LogExpenseModal } from '../../pages/POS/LogExpenseModal';

export type FilterOption = 'this_month' | 'today' | 'yesterday' | 'last_7_days' | 'custom';

export interface PnLData {
  total_sales: number;
  total_cogs: number;
  gross_profit: number;
  total_expenses: number;
  net_profit: number;
  net_profit_margin_percent?: number;
}

export const BusinessPerformanceRow: React.FC = () => {
  const [filterOption, setFilterOption] = useState<FilterOption>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);
  const [isLogExpenseOpen, setIsLogExpenseOpen] = useState(false);

  // Helper to get precise Start-of-Day (00:00:00.000) and End-of-Day (23:59:59.999) ISO strings in local timezone
  const getDateRange = (): { startDate?: string; endDate?: string } => {
    const now = new Date();

    if (filterOption === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filterOption === 'yesterday') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filterOption === 'last_7_days') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filterOption === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filterOption === 'custom') {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00.000`) : undefined;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : undefined;
      return {
        startDate: start ? start.toISOString() : undefined,
        endDate: end ? end.toISOString() : undefined,
      };
    }

    return {};
  };

  const { startDate, endDate } = getDateRange();

  const { data: pnlData, isLoading, error, refetch } = useQuery<PnLData>({
    queryKey: ['pnlReport', filterOption, startDate, endDate],
    queryFn: async () => {
      try {
        const response = await api.get<{ data: PnLData }>('/reports/pnl', {
          params: { startDate, endDate },
        });
        console.log("RAW P&L PAYLOAD:", response.data);
        return response.data.data;
      } catch (err: any) {
        console.error("DASHBOARD FETCH FAILED:", err?.response?.data || err.message);
        throw err;
      }
    },
  });

  const totalSales = pnlData?.total_sales ?? 0;
  const totalCogs = pnlData?.total_cogs ?? 0;
  const totalExpenses = pnlData?.total_expenses ?? 0;
  const netProfit = pnlData?.net_profit ?? 0;
  const isNetProfitPositive = netProfit >= 0;

  const profitMarginPct = pnlData?.net_profit_margin_percent !== undefined
    ? pnlData.net_profit_margin_percent * 100
    : (totalSales > 0 ? (netProfit / totalSales) * 100 : 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      {/* Section Header & Global Date Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Time-Bound Business Performance (P&L Overview)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational Revenue, Locked COGS, Operating Expenses, and Net Profit
          </p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0 ml-1" />
            <select
              value={filterOption}
              onChange={(e) => setFilterOption(e.target.value as FilterOption)}
              className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="this_month">This Month (Default)</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {filterOption === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700"
              />
            </div>
          )}

          <button
            onClick={() => setIsLogExpenseOpen(true)}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4 text-amber-600" />
            + Log Expense
          </button>

          {isLoading && <span className="text-xs text-blue-600 animate-pulse font-medium">Updating...</span>}
        </div>
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Sales (BLUE) */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-bold uppercase tracking-wider">Total Sales (Revenue)</span>
            <DollarSign className="h-5 w-5" />
          </div>
          <p className="text-2xl font-black text-blue-700 font-mono">
            Rs. {totalSales.toLocaleString()}
          </p>
          <p className="text-[11px] text-blue-600 font-medium flex justify-between">
            <span>Gross Revenue for period</span>
            <span className="font-mono font-bold">COGS: Rs. {totalCogs.toLocaleString()}</span>
          </p>
        </div>

        {/* Card 2: Total Expenses (ORANGE/WARNING - CLICKABLE) */}
        <div
          onClick={() => setIsExpensesModalOpen(true)}
          className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-2 shadow-2xs hover:ring-2 hover:ring-amber-400 cursor-pointer transition-all active:scale-[0.99]"
          title="Click to view itemized expenses ledger"
        >
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              Total Expenses
              <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
            </span>
            <Receipt className="h-5 w-5 text-amber-700" />
          </div>
          <p className="text-2xl font-black text-amber-800 font-mono">
            Rs. {totalExpenses.toLocaleString()}
          </p>
          <p className="text-[11px] text-amber-700 font-semibold underline">
            Click to view itemized expense records →
          </p>
        </div>

        {/* Card 3: Net Profit (GREEN IF POSITIVE, RED IF NEGATIVE) */}
        <div
          className={`rounded-2xl border p-5 space-y-2 shadow-2xs transition-all ${
            isNetProfitPositive ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isNetProfitPositive ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              {isNetProfitPositive ? 'NET PROFIT' : 'NET LOSS'}
            </span>
            {isNetProfitPositive ? (
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-rose-600" />
            )}
          </div>
          <p
            className={`text-2xl font-black font-mono ${
              isNetProfitPositive ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            Rs. {netProfit.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 pt-1 border-t border-slate-200/60">
            <span>Profit Margin: {profitMarginPct.toFixed(1)}%</span>
            <span className={isNetProfitPositive ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
              Net = (Sales - COGS) - Expenses
            </span>
          </div>
        </div>
      </div>

      {/* Itemized Expenses Modal */}
      <ExpensesListModal
        isOpen={isExpensesModalOpen}
        onClose={() => {
          setIsExpensesModalOpen(false);
          refetch();
        }}
        startDate={startDate}
        endDate={endDate}
      />

      {/* Log Expense Modal */}
      <LogExpenseModal
        isOpen={isLogExpenseOpen}
        onClose={() => setIsLogExpenseOpen(false)}
        onExpenseLogged={() => {
          refetch();
        }}
      />
    </div>
  );
};
