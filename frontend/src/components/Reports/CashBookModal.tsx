import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, DollarSign, Calendar, ArrowDownLeft, ArrowUpRight, RefreshCw, ChevronDown, ChevronRight, ShoppingBag } from 'lucide-react';
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
  order_details: OrderDetailItem[];
}

type FilterType = 'today' | 'yesterday' | 'this_month' | 'custom' | 'all';

export const CashBookModal: React.FC<CashBookModalProps> = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState<FilterType>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

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

  if (!isOpen) return null;

  const totalCashIn = entries.reduce(
    (sum, e) => sum + (Number(e.cash_in || 0) > 0 ? Number(e.cash_in) : Number(e.amount || 0) > 0 ? Number(e.amount) : 0),
    0
  );
  const totalCashOut = entries.reduce(
    (sum, e) => sum + (Number(e.cash_out || 0) > 0 ? Number(e.cash_out) : Number(e.amount || 0) < 0 ? Math.abs(Number(e.amount)) : 0),
    0
  );
  const netCashBalance = totalCashIn - totalCashOut;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Cash Drawer Audit Ledger</h2>
              <p className="text-xs text-emerald-100 font-medium">Audit of physical cash sales, receipts & cash refunds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Summary Bar */}
        <div className="p-4 bg-emerald-50/80 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
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

          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 font-mono text-xs flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              Inflow: +Rs. {totalCashIn.toLocaleString()}
            </span>
            {totalCashOut > 0 && (
              <span className="px-3 py-1.5 rounded-xl bg-red-100 border border-red-300 text-red-900 font-mono text-xs flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-red-600" />
                Refunds: -Rs. {totalCashOut.toLocaleString()}
              </span>
            )}
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono text-xs flex items-center gap-1.5 shadow-xs">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Net Drawer: Rs. {netCashBalance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Ledger Table View */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-12 text-center text-emerald-600 font-medium animate-pulse">
              Loading cash ledger statement...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No cash transactions recorded for this period.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-8"></th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Transaction Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount (Rs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {entries.flatMap((item) => {
                    const isExpanded = !!expandedRows[item.id];
                    const hasLineItems = Array.isArray(item.order_details) && item.order_details.length > 0;
                    const isRefund = item.entry_type === 'CUSTOMER REFUND' || Number(item.amount) < 0;

                    const dateStr = item.date
                      ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                    const rawAmount = Number(item.amount || item.cash_in || 0);
                    const displayAmount = isRefund ? Math.abs(Number(item.cash_out || item.amount || 0)) : rawAmount;

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
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              isRefund
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isRefund ? 'CUSTOMER REFUND' : 'CASH SALE'}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-800">
                          {item.description}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                            isRefund ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {isRefund ? `-Rs. ${displayAmount.toLocaleString()}` : `+Rs. ${displayAmount.toLocaleString()}`}
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

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
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

