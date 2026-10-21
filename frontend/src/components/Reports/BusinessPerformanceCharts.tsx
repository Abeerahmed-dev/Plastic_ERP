import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Activity,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import api from '../../services/api';
import { reportsService } from '../../services/reports.service';

export type FilterOption = 'this_month' | 'today' | 'yesterday' | 'last_7_days' | 'custom';

export interface PnLData {
  total_sales: number;
  total_cogs: number;
  gross_profit: number;
  total_expenses: number;
  net_profit: number;
  net_profit_margin_percent?: number;
}

interface ExpenseItem {
  id: string;
  amount: number;
  expense_date?: string;
  created_at?: string;
  category?: string;
}

const formatPKR = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'Rs. 0';
  const absVal = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (absVal >= 10000000) {
    return `${sign}Rs. ${(absVal / 10000000).toFixed(1)}Cr`;
  }
  if (absVal >= 100000) {
    return `${sign}Rs. ${(absVal / 100000).toFixed(1)}L`;
  }
  if (absVal >= 1000) {
    return `${sign}Rs. ${(absVal / 1000).toFixed(0)}k`;
  }
  return `${sign}Rs. ${absVal.toLocaleString('en-PK')}`;
};

const formatFullPKR = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
  const num = Number(val);
  const sign = num < 0 ? '-' : '';
  return `${sign}Rs. ${Math.abs(num).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Line Chart Custom Tooltip
const LineChartCustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const revenue = payload.find((p: any) => p.dataKey === 'revenue')?.value ?? 0;
    const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value ?? 0;
    const netProfit = payload.find((p: any) => p.dataKey === 'net_profit')?.value ?? 0;
    const isProfit = netProfit >= 0;
    const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-800 text-xs space-y-2 font-mono min-w-[210px]">
        <p className="font-bold text-slate-300 border-b border-slate-700/80 pb-1.5 font-sans text-xs flex items-center justify-between">
          <span>📅 Date: {label}</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${isProfit ? 'bg-emerald-900/80 text-emerald-300' : 'bg-rose-900/80 text-rose-300'}`}>
            {isProfit ? 'Net Profit' : 'Net Loss'}
          </span>
        </p>

        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-blue-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
              Revenue (Sales):
            </span>
            <span className="font-bold tabular-nums text-white">{formatFullPKR(revenue)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
              Total Expenses:
            </span>
            <span className="font-bold tabular-nums text-white">{formatFullPKR(expenses)}</span>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
            <span className={`flex items-center gap-1.5 font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className={`h-2 w-2 rounded-full inline-block ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              Net Profit:
            </span>
            <span className={`font-black tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatFullPKR(netProfit)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
            <span>Net Margin:</span>
            <span className="font-bold font-mono">{marginPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Bar Chart Structure Custom Tooltip
const BarChartStructureTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const amount = Number(item.amount || 0);
    const isProfit = amount >= 0;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 font-mono min-w-[200px]">
        <p className="font-bold text-slate-200 border-b border-slate-700/80 pb-1 font-sans text-xs">
          {item.name}
        </p>
        <div className="flex items-center justify-between gap-4 pt-0.5">
          <span className="text-slate-400">Amount:</span>
          <span className={`font-black text-sm tabular-nums ${item.key === 'net_profit' ? (isProfit ? 'text-emerald-400' : 'text-rose-400') : 'text-white'}`}>
            {formatFullPKR(amount)}
          </span>
        </div>
        {item.percentage !== undefined && (
          <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
            <span>% of Revenue:</span>
            <span className="font-bold text-slate-200 font-mono">{item.percentage.toFixed(1)}%</span>
          </div>
        )}
        <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 font-sans">
          {item.desc}
        </p>
      </div>
    );
  }
  return null;
};

export const BusinessPerformanceCharts: React.FC = () => {
  const [filterOption, setFilterOption] = useState<FilterOption>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [barViewMode, setBarViewMode] = useState<'structure' | 'daily'>('structure');
  const [activeChartTab, setActiveChartTab] = useState<'trajectory' | 'breakdown' | 'both'>('trajectory');

  // Helper to compute date range
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

  // 1. Fetch P&L aggregate data for the period
  const {
    data: pnlData,
    isLoading: isPnLLoading,
    refetch: refetchPnL,
  } = useQuery<PnLData>({
    queryKey: ['pnlReport', filterOption, startDate, endDate],
    queryFn: async () => {
      const response = await api.get<{ data: PnLData }>('/reports/pnl', {
        params: { startDate, endDate },
      });
      return response.data.data;
    },
  });

  // 2. Fetch daily sales trend data from margin-analytics
  const {
    data: marginData,
    isLoading: isMarginLoading,
    refetch: refetchMargin,
  } = useQuery({
    queryKey: ['marginAnalyticsTrend', startDate, endDate],
    queryFn: () => reportsService.getMarginAnalytics(startDate, endDate),
  });

  // 3. Fetch itemized expenses to map daily expenses
  const {
    data: expensesData,
    isLoading: isExpensesLoading,
    refetch: refetchExpenses,
  } = useQuery<ExpenseItem[]>({
    queryKey: ['pnlExpensesList', startDate, endDate],
    queryFn: async () => {
      const response = await api.get<{ data: ExpenseItem[] }>('/expenses', {
        params: { startDate, endDate },
      });
      return response.data.data || [];
    },
  });

  const isLoading = isPnLLoading || isMarginLoading || isExpensesLoading;

  const handleRefresh = () => {
    refetchPnL();
    refetchMargin();
    refetchExpenses();
  };

  // Compile daily trend data for the Line Graph
  const dailyTimeSeries = useMemo(() => {
    const trendList = marginData?.trend_data || [];
    const expList = expensesData || [];

    // Map expenses by date string YYYY-MM-DD
    const expMap = new Map<string, number>();
    for (const exp of expList) {
      let dStr = '';
      if (exp.expense_date) {
        dStr = String(exp.expense_date).split('T')[0];
      } else if (exp.created_at) {
        dStr = new Date(exp.created_at).toISOString().split('T')[0];
      }
      if (dStr) {
        expMap.set(dStr, (expMap.get(dStr) || 0) + Number(exp.amount || 0));
      }
    }

    // Collect all dates
    const dateSet = new Set<string>();
    for (const t of trendList) {
      if (t.date) dateSet.add(t.date);
    }
    for (const [d] of expMap) {
      dateSet.add(d);
    }

    // If both are empty but pnlData has values, generate period point
    if (dateSet.size === 0 && pnlData && (pnlData.total_sales > 0 || pnlData.total_expenses > 0)) {
      const todayStr = new Date().toISOString().split('T')[0];
      return [
        {
          date: todayStr,
          revenue: pnlData.total_sales,
          cogs: pnlData.total_cogs,
          expenses: pnlData.total_expenses,
          net_profit: pnlData.net_profit,
        },
      ];
    }

    const sortedDates = Array.from(dateSet).sort();

    const result = sortedDates.map((dateStr) => {
      const t = trendList.find((item) => item.date === dateStr);
      const rev = Number(t?.daily_revenue || 0);
      const cogs = Number(t?.daily_cogs || 0);
      const exp = Number(expMap.get(dateStr) || 0);
      const net = rev - cogs - exp;

      // Format date for readable display (e.g. 05 Oct)
      let displayDate = dateStr;
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          displayDate = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
        }
      } catch {
        displayDate = dateStr;
      }

      return {
        date: displayDate,
        fullDate: dateStr,
        revenue: Math.round(rev * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        expenses: Math.round(exp * 100) / 100,
        net_profit: Math.round(net * 100) / 100,
      };
    });

    return result;
  }, [marginData?.trend_data, expensesData, pnlData]);

  // Compile Bar Graph Structure Data
  const pnlStructureBarData = useMemo(() => {
    const totalSales = Number(pnlData?.total_sales || 0);
    const totalCogs = Number(pnlData?.total_cogs || 0);
    const grossProfit = Number(pnlData?.gross_profit || (totalSales - totalCogs));
    const totalExpenses = Number(pnlData?.total_expenses || 0);
    const netProfit = Number(pnlData?.net_profit || (grossProfit - totalExpenses));

    const calcPct = (val: number) => (totalSales > 0 ? (val / totalSales) * 100 : 0);

    return [
      {
        key: 'sales',
        name: 'Total Sales',
        amount: totalSales,
        percentage: 100,
        fill: '#3b82f6', // blue
        desc: 'Gross revenue from completed sales invoices',
      },
      {
        key: 'cogs',
        name: 'COGS',
        amount: totalCogs,
        percentage: calcPct(totalCogs),
        fill: '#6366f1', // indigo
        desc: 'Weighted average cost of inventory sold',
      },
      {
        key: 'gross_profit',
        name: 'Gross Profit',
        amount: grossProfit,
        percentage: calcPct(grossProfit),
        fill: '#0d9488', // teal
        desc: 'Sales Revenue minus COGS',
      },
      {
        key: 'expenses',
        name: 'Expenses',
        amount: totalExpenses,
        percentage: calcPct(totalExpenses),
        fill: '#f59e0b', // amber
        desc: 'Operational overheads & administrative costs',
      },
      {
        key: 'net_profit',
        name: 'Net Profit',
        amount: netProfit,
        percentage: calcPct(netProfit),
        fill: netProfit >= 0 ? '#10b981' : '#ef4444', // emerald or rose
        desc: 'Net bottom line profit after all costs & expenses',
      },
    ];
  }, [pnlData]);

  return (
    <div className="rounded-2xl border border-slate-300/80 bg-white p-4 sm:p-5 shadow-[0_20px_50px_rgba(15,23,42,0.30),0_8px_20px_rgba(15,23,42,0.18)] transition-all space-y-3.5 w-full min-w-0 overflow-hidden flex flex-col justify-between">
      {/* ── Top Header with Title, Chart View Switcher & Date Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 min-w-0 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight">
              Time-Bound Business Performance
            </h2>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              {activeChartTab === 'trajectory'
                ? 'Sales, Expenses & Net Profit Trajectory'
                : activeChartTab === 'breakdown'
                ? 'Revenue vs. COGS vs. Expenses vs. Net Margin'
                : 'P&L Financial Overview'}
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 ml-auto">
          {/* Chart View Switcher */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveChartTab('trajectory')}
              className={`px-2 py-0.5 rounded-md transition ${
                activeChartTab === 'trajectory'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📈 Line
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('breakdown')}
              className={`px-2 py-0.5 rounded-md transition ${
                activeChartTab === 'breakdown'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Bar
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('both')}
              className={`px-2 py-0.5 rounded-md transition ${
                activeChartTab === 'both'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ↕️ Both
            </button>
          </div>

          {/* Global Date Range Controls */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
            <select
              value={filterOption}
              onChange={(e) => setFilterOption(e.target.value as FilterOption)}
              className="text-[11px] bg-transparent font-semibold text-slate-700 focus:outline-none"
            >
              <option value="this_month">This Month</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {filterOption === 'custom' && (
            <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-300">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-[10px] bg-transparent px-1 py-0.5 font-medium text-slate-700 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-[10px] bg-transparent px-1 py-0.5 font-medium text-slate-700 focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh P&L Data"
            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className={`w-full min-w-0 ${activeChartTab === 'both' ? 'space-y-4' : ''}`}>
        {/* ── Graph 1: Line Graph (Trajectory) ── */}
        {(activeChartTab === 'trajectory' || activeChartTab === 'both') && (
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                Revenue &amp; Profit Trajectory
              </span>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" /> Sales
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Expenses
                </span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" /> Profit
                </span>
              </div>
            </div>

            <div className={`w-full ${activeChartTab === 'both' ? 'h-[175px]' : 'h-[240px]'} min-w-0`}>
              {dailyTimeSeries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-medium space-y-1">
                  <TrendingUp className="w-7 h-7 text-slate-300 stroke-[1.5]" />
                  <p>No transactions recorded for the selected time period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="99%" height="100%">
                  <LineChart
                    data={dailyTimeSeries}
                    margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="pnlLineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />

                    <YAxis
                      tickFormatter={formatPKR}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />

                    <Tooltip content={<LineChartCustomTooltip />} />

                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Sales Revenue"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#2563eb', strokeWidth: 1.5, stroke: '#ffffff' }}
                      activeDot={{ r: 5 }}
                    />

                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="Operating Expenses"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#f59e0b', strokeWidth: 1.5, stroke: '#ffffff' }}
                      activeDot={{ r: 5 }}
                    />

                    <Line
                      type="monotone"
                      dataKey="net_profit"
                      name="Net Profit"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#10b981', strokeWidth: 1.5, stroke: '#ffffff' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* ── Graph 2: Bar Graph (Breakdown) ── */}
        {(activeChartTab === 'breakdown' || activeChartTab === 'both') && (
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                P&amp;L Overview Breakdown
              </span>

              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs text-[11px]">
                <button
                  type="button"
                  onClick={() => setBarViewMode('structure')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition ${
                    barViewMode === 'structure'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Structure
                </button>
                <button
                  type="button"
                  onClick={() => setBarViewMode('daily')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition ${
                    barViewMode === 'daily'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Daily
                </button>
              </div>
            </div>

            <div className={`w-full ${activeChartTab === 'both' ? 'h-[175px]' : 'h-[240px]'} min-w-0`}>
              {barViewMode === 'structure' ? (
                <ResponsiveContainer width="99%" height="100%">
                  <BarChart
                    data={pnlStructureBarData}
                    margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />

                    <YAxis
                      tickFormatter={formatPKR}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />

                    <Tooltip content={<BarChartStructureTooltip />} />

                    <Bar
                      dataKey="amount"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    >
                      {pnlStructureBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : dailyTimeSeries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-medium space-y-1">
                  <BarChart3 className="w-7 h-7 text-slate-300 stroke-[1.5]" />
                  <p>No daily comparison data recorded for this period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="99%" height="100%">
                  <BarChart
                    data={dailyTimeSeries}
                    margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />

                    <YAxis
                      tickFormatter={formatPKR}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />

                    <Tooltip content={<LineChartCustomTooltip />} />

                    <Legend
                      wrapperStyle={{ paddingTop: 6, fontSize: 11 }}
                      formatter={(value) => <span className="text-slate-700 font-semibold">{value}</span>}
                    />

                    <Bar dataKey="revenue" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="net_profit" name="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
