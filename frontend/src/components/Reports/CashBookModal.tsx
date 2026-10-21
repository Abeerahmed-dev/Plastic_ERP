import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  DollarSign,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  Users,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import api from '../../services/api';

interface CashBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface OrderDetailItem {
  product_name: string;
  qty: number;
  net_kg?: number;
  price: number;
  total?: number;
}

export interface CashLedgerEntry {
  id: string;
  date: string;
  created_at: string;
  entry_type: string;
  description: string;
  amount: number;
  cash_in?: number;
  cash_out?: number;
  running_balance?: number;
  source?: 'POS' | 'CUSTOMER_PAYMENT' | 'OUTFLOW';
  source_type?: 'POS' | 'CUSTOMER_PAYMENT' | 'OUTFLOW';
  transaction_type?: 'DEPOSIT' | 'WITHDRAWAL';
  order_details: OrderDetailItem[];
}

type FilterType = 'today' | 'yesterday' | 'this_month' | 'custom' | 'all';

export const CashBookModal: React.FC<CashBookModalProps> = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState<FilterType>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // 3-Way Cash Flow Triangulation Filters
  const [filterPos, setFilterPos] = useState<boolean>(true);
  const [filterCust, setFilterCust] = useState<boolean>(true);
  const [filterOutflows, setFilterOutflows] = useState<boolean>(true);

  const getDateRange = () => {
    const now = new Date();

    if (filter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filter === 'yesterday') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filter === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filter === 'custom' && customStartDate && customEndDate) {
      const [sYear, sMonth, sDay] = customStartDate.split('-').map(Number);
      const [eYear, eMonth, eDay] = customEndDate.split('-').map(Number);
      const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
      const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    return { startDate: undefined, endDate: undefined };
  };

  const { startDate, endDate } = getDateRange();

  const { data: entries = [], isLoading, refetch } = useQuery<CashLedgerEntry[]>({
    queryKey: ['cashLedger', filter, startDate, endDate],
    queryFn: async () => {
      const response = await api.get<{ data: CashLedgerEntry[] }>('/reports/cash-ledger', {
        params: { startDate, endDate },
      });
      return response.data.data;
    },
    enabled: isOpen,
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 3-Way Segregated Filtering
  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      const isDeposit = item.transaction_type === 'DEPOSIT' || Number(item.cash_in || 0) > 0 || (item.entry_type && item.entry_type.includes('SALE'));
      const isWithdrawal = item.transaction_type === 'WITHDRAWAL' || Number(item.cash_out || 0) > 0 || item.source === 'OUTFLOW';
      const isPos = item.source === 'POS' || item.source_type === 'POS' || (item.entry_type && item.entry_type.includes('POS'));
      const isCust = item.source === 'CUSTOMER_PAYMENT' || item.source_type === 'CUSTOMER_PAYMENT' || (!isPos && isDeposit);

      if (isDeposit && isPos) return filterPos;
      if (isDeposit && isCust) return filterCust;
      if (isWithdrawal) return filterOutflows;
      return true;
    });
  }, [entries, filterPos, filterCust, filterOutflows]);

  // Dynamic Cash Flow Stats & Insights
  const stats = useMemo(() => {
    let posTotal = 0;
    let posCount = 0;
    let custTotal = 0;
    let custCount = 0;
    let outflowTotal = 0;
    let outflowCount = 0;

    for (const item of entries) {
      const isDeposit = item.transaction_type === 'DEPOSIT' || Number(item.cash_in || 0) > 0 || (item.entry_type && item.entry_type.includes('SALE'));
      const isWithdrawal = item.transaction_type === 'WITHDRAWAL' || Number(item.cash_out || 0) > 0 || item.source === 'OUTFLOW';
      const isPos = item.source === 'POS' || item.source_type === 'POS' || (item.entry_type && item.entry_type.includes('POS'));

      const inAmt = Number(item.cash_in || (isDeposit ? item.amount : 0) || 0);
      const outAmt = Number(item.cash_out || (isWithdrawal ? item.amount : 0) || 0);

      if (isDeposit && isPos) {
        posTotal += inAmt;
        posCount++;
      } else if (isDeposit) {
        custTotal += inAmt;
        custCount++;
      } else if (isWithdrawal) {
        outflowTotal += outAmt;
        outflowCount++;
      }
    }

    let filteredInflow = 0;
    let filteredOutflow = 0;

    for (const item of filteredEntries) {
      const isDeposit = item.transaction_type === 'DEPOSIT' || Number(item.cash_in || 0) > 0 || (item.entry_type && item.entry_type.includes('SALE'));
      const isWithdrawal = item.transaction_type === 'WITHDRAWAL' || Number(item.cash_out || 0) > 0 || item.source === 'OUTFLOW';

      if (isDeposit) {
        filteredInflow += Number(item.cash_in || item.amount || 0);
      } else if (isWithdrawal) {
        filteredOutflow += Number(item.cash_out || item.amount || 0);
      }
    }

    return {
      posTotal: Math.round(posTotal * 100) / 100,
      posCount,
      custTotal: Math.round(custTotal * 100) / 100,
      custCount,
      outflowTotal: Math.round(outflowTotal * 100) / 100,
      outflowCount,
      filteredInflow: Math.round(filteredInflow * 100) / 100,
      filteredOutflow: Math.round(filteredOutflow * 100) / 100,
      netFilteredTotal: Math.round((filteredInflow - filteredOutflow) * 100) / 100,
    };
  }, [entries, filteredEntries]);

  const selectOnly = (type: 'POS' | 'CUST' | 'OUTFLOW') => {
    setFilterPos(type === 'POS');
    setFilterCust(type === 'CUST');
    setFilterOutflows(type === 'OUTFLOW');
  };

  const selectAll = () => {
    setFilterPos(true);
    setFilterCust(true);
    setFilterOutflows(true);
  };

  const periodLabel = filter === 'today' ? 'today' : filter === 'yesterday' ? 'yesterday' : 'this period';

  // Dynamic Owner Insight Text
  const getOwnerInsight = () => {
    if (filterPos && !filterCust && !filterOutflows) {
      return `We made Rs. ${stats.posTotal.toLocaleString()} strictly from walk-in POS ${periodLabel}.`;
    }
    if (!filterPos && filterCust && !filterOutflows) {
      return `We collected Rs. ${stats.custTotal.toLocaleString()} strictly from customer payments ${periodLabel}.`;
    }
    if (!filterPos && !filterCust && filterOutflows) {
      return `Total cash outflows were Rs. ${stats.outflowTotal.toLocaleString()} ${periodLabel}.`;
    }
    if (filterPos && filterCust && !filterOutflows) {
      return `Total gross cash collections: Rs. ${(stats.posTotal + stats.custTotal).toLocaleString()} ${periodLabel} (POS: Rs. ${stats.posTotal.toLocaleString()} + Customer: Rs. ${stats.custTotal.toLocaleString()}).`;
    }
    return `Net drawer cash flow ${periodLabel}: Rs. ${stats.netFilteredTotal.toLocaleString()} (Inflows: +Rs. ${stats.filteredInflow.toLocaleString()}, Outflows: -Rs. ${stats.filteredOutflow.toLocaleString()}).`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Cash Drawer Audit Ledger</h2>
              <p className="text-xs text-emerald-100 font-medium">
                Audit of physical cash sales, customer payments & outflows
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Period Selector Bar */}
        <div className="p-3 bg-emerald-50/80 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-emerald-900">Period:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="text-xs bg-white border border-emerald-300 rounded-lg px-3 py-1.5 font-bold text-emerald-900 focus:outline-none cursor-pointer"
            >
              <option value="today">Today (Shift Audit)</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
              <option value="all">All-Time History</option>
            </select>

            {filter === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs bg-white border border-emerald-300 rounded-lg px-2 py-1 font-medium text-emerald-900 focus:outline-none"
                />
                <span className="text-xs text-emerald-700 font-bold">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs bg-white border border-emerald-300 rounded-lg px-2 py-1 font-medium text-emerald-900 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-xs flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Inflow: Rs. {stats.filteredInflow.toLocaleString()}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 font-mono text-xs flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              Outflow: Rs. {stats.filteredOutflow.toLocaleString()}
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-900 text-white font-mono text-xs flex items-center gap-1.5 shadow-xs">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Net Drawer: Rs. {stats.netFilteredTotal.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 3-Way Cash Segregation Filters */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Cash Segregation Filters:
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => selectOnly('POS')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  filterPos && !filterCust && !filterOutflows
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Only POS
              </button>
              <button
                onClick={() => selectOnly('CUST')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  !filterPos && filterCust && !filterOutflows
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Only Customer
              </button>
              <button
                onClick={() => selectOnly('OUTFLOW')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  !filterPos && !filterCust && filterOutflows
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Only Outflows
              </button>
              <button
                onClick={selectAll}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-200 transition cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* 3 Explicit Toggle Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Filter 1: Inflow: POS */}
            <button
              type="button"
              onClick={() => setFilterPos((v) => !v)}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterPos
                  ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 text-emerald-950 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-400 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filterPos}
                  onChange={() => {}}
                  className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 pointer-events-none"
                />
                <div>
                  <span className="text-xs font-bold block flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                    Inflow: POS
                  </span>
                  <span className="text-[10px] text-slate-500">Walk-in counter sales</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold font-mono text-emerald-700 block">
                  Rs. {stats.posTotal.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">{stats.posCount} entries</span>
              </div>
            </button>

            {/* Filter 2: Inflow: Customer Payments */}
            <button
              type="button"
              onClick={() => setFilterCust((v) => !v)}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterCust
                  ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 text-blue-950 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-400 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filterCust}
                  onChange={() => {}}
                  className="w-4 h-4 text-blue-600 rounded-md border-slate-300 pointer-events-none"
                />
                <div>
                  <span className="text-xs font-bold block flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Inflow: Customer Payments
                  </span>
                  <span className="text-[10px] text-slate-500">Invoiced ledger payments</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold font-mono text-blue-700 block">
                  Rs. {stats.custTotal.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">{stats.custCount} entries</span>
              </div>
            </button>

            {/* Filter 3: Outflows */}
            <button
              type="button"
              onClick={() => setFilterOutflows((v) => !v)}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterOutflows
                  ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-500/20 text-rose-950 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-400 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filterOutflows}
                  onChange={() => {}}
                  className="w-4 h-4 text-rose-600 rounded-md border-slate-300 pointer-events-none"
                />
                <div>
                  <span className="text-xs font-bold block flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                    Outflows
                  </span>
                  <span className="text-[10px] text-slate-500">Expenses & supplier payouts</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold font-mono text-rose-700 block">
                  (Rs. {stats.outflowTotal.toLocaleString()})
                </span>
                <span className="text-[10px] text-slate-400">{stats.outflowCount} entries</span>
              </div>
            </button>
          </div>
        </div>

        {/* Ledger Table View */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-12 text-center text-emerald-600 font-medium animate-pulse">
              Loading cash ledger statement...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No transactions match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-8"></th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredEntries.flatMap((item) => {
                    const isExpanded = !!expandedRows[item.id];
                    const hasLineItems = Array.isArray(item.order_details) && item.order_details.length > 0;
                    const isRefund = item.entry_type === 'CUSTOMER REFUND' || Number(item.amount) < 0;

                    const dateStr = item.date
                      ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                    const isDeposit = item.transaction_type === 'DEPOSIT' || Number(item.cash_in || 0) > 0 || (item.entry_type && item.entry_type.includes('SALE'));
                    const isPos = item.source === 'POS' || item.source_type === 'POS' || (item.entry_type && item.entry_type.includes('POS'));
                    const isWithdrawal = item.transaction_type === 'WITHDRAWAL' || Number(item.cash_out || 0) > 0 || item.source === 'OUTFLOW';

                    const amountVal = isDeposit
                      ? Number(item.cash_in || item.amount || 0)
                      : Number(item.cash_out || item.amount || 0);

                    return [
                      /* Parent Row */
                      <tr
                        key={item.id}
                        onClick={() => toggleRow(item.id)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="p-3 text-center">
                          {hasLineItems ? (
                            isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-emerald-600 inline" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                            )
                          ) : (
                            <span className="w-4 h-4 inline-block" />
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="p-3 font-bold whitespace-nowrap">
                          {isDeposit && isPos ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold inline-flex items-center gap-1">
                              <ShoppingBag className="w-2.5 h-2.5" />
                              POS SALE
                            </span>
                          ) : isDeposit ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 border border-blue-200 font-semibold inline-flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" />
                              CUSTOMER INFLOW
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 border border-rose-200 font-semibold inline-flex items-center gap-1">
                              <ArrowUpRight className="w-2.5 h-2.5" />
                              {item.entry_type || 'OUTFLOW'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-medium text-slate-800">
                          {item.description}
                        </td>
                        <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                          {isDeposit ? (
                            <span className="text-emerald-600">
                              +Rs. {amountVal.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-rose-600">
                              -Rs. {amountVal.toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>,

                      /* Expanded Child Row */
                      isExpanded && (
                        <tr key={`detail-${item.id}`} className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={5} className="p-3">
                            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-inner space-y-2">
                              <div className="text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-100 pb-2">
                                <span className="flex items-center gap-1.5 text-emerald-800">
                                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                                  Line-Item Receipt Breakdown ({item.order_details.length} item{item.order_details.length > 1 ? 's' : ''})
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">Order Drill-Down</span>
                              </div>

                              {item.order_details.length === 0 ? (
                                <div className="text-xs text-slate-400 italic py-2">
                                  No specific product line-items associated with this transaction.
                                </div>
                              ) : (
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                    <tr>
                                      <th className="py-2 px-3">Product Name</th>
                                      <th className="py-2 px-3 text-right">Quantity / KG</th>
                                      <th className="py-2 px-3 text-right">Price per Unit (PKR)</th>
                                      <th className="py-2 px-3 text-right">Line Total (PKR)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {item.order_details.map((detail, idx) => {
                                      const qtyStr = detail.net_kg
                                        ? `${Number(detail.net_kg).toLocaleString()} KG`
                                        : `${Number(detail.qty).toLocaleString()}`;
                                      const price = Number(detail.price || 0);
                                      const total = Number(detail.total || (Number(detail.qty || detail.net_kg || 0) * price));

                                      return (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                          <td className="py-2 px-3 font-semibold text-slate-900">
                                            {detail.product_name}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-medium">
                                            {qtyStr}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                                            Rs. {price.toLocaleString()}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                                            Rs. {total.toLocaleString()}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dynamic Filtered Total & Owner Insight Bar */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border-t border-emerald-200 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Owner Cash Insights
                </span>
                <p className="text-xs font-bold text-slate-900">
                  {getOwnerInsight()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Dynamic Filtered Total ({filteredEntries.length} items)
                </span>
                <span className={`text-base font-black font-mono tabular-nums ${
                  stats.netFilteredTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {stats.netFilteredTotal >= 0 ? `+Rs. ${stats.netFilteredTotal.toLocaleString()}` : `-Rs. ${Math.abs(stats.netFilteredTotal).toLocaleString()}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            Refresh Statement
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Close Audit Statement
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashBookModal;
