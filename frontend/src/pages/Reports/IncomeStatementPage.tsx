import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Calendar,
  RefreshCw,
  Printer,
  Loader2,
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
  ArrowRightLeft,
  ArrowDownRight,
  Search,
} from 'lucide-react';
import { reportsService, IncomeStatementData, SalesReturnDetailItem } from '../../services/reports.service';
import { SalesReturnsDetailModal } from '../../components/Reports/SalesReturnsDetailModal';

export default function IncomeStatementPage() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayDate = now.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<string>(todayDate);
  const [activePreset, setActivePreset] = useState<string>('thisMonth');

  // Drill-down returns modal state
  const [isReturnsModalOpen, setIsReturnsModalOpen] = useState<boolean>(false);
  const [returnsDetailData, setReturnsDetailData] = useState<SalesReturnDetailItem[]>([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState<boolean>(false);

  const handleOpenReturnsModal = async () => {
    setIsReturnsModalOpen(true);
    setIsLoadingReturns(true);
    try {
      const data = await reportsService.getIncomeStatementReturnsDetail(startDate, endDate);
      setReturnsDetailData(data);
    } catch (err) {
      console.error('Failed to fetch returns detail:', err);
    } finally {
      setIsLoadingReturns(false);
    }
  };

  const {
    data: statement,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<IncomeStatementData>({
    queryKey: ['incomeStatement', startDate, endDate],
    queryFn: () => reportsService.getIncomeStatement(startDate, endDate),
  });

  const handlePreset = (preset: string) => {
    setActivePreset(preset);
    const curr = new Date();
    if (preset === 'thisMonth') {
      setStartDate(new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().split('T')[0]);
      setEndDate(curr.toISOString().split('T')[0]);
    } else if (preset === 'lastMonth') {
      setStartDate(new Date(curr.getFullYear(), curr.getMonth() - 1, 1).toISOString().split('T')[0]);
      setEndDate(new Date(curr.getFullYear(), curr.getMonth(), 0).toISOString().split('T')[0]);
    } else if (preset === 'thisYear') {
      setStartDate(new Date(curr.getFullYear(), 0, 1).toISOString().split('T')[0]);
      setEndDate(curr.toISOString().split('T')[0]);
    } else if (preset === 'allTime') {
      setStartDate('2020-01-01');
      setEndDate(curr.toISOString().split('T')[0]);
    }
  };

  // Accounting formatting helper: parentheses for negative numbers/outflows
  const formatMoney = (num: number | undefined | null, isOutflow: boolean = false) => {
    if (num === undefined || num === null || isNaN(num)) return 'Rs. 0.00';
    const val = Number(num);
    const formatted = Math.abs(val).toLocaleString('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (val < 0 || (isOutflow && val > 0)) {
      return `(Rs. ${formatted})`;
    }
    return `Rs. ${formatted}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 print:bg-white print:py-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Sticky Header & Control Bar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 p-4 shadow-sm print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Income Statement (Profit & Loss)
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Financial Performance Report • Accrual & Cash Basis
                </p>
              </div>
            </div>

            {/* Date Filters & Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Presets */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  onClick={() => handlePreset('thisMonth')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activePreset === 'thisMonth' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => handlePreset('lastMonth')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activePreset === 'lastMonth' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Last Month
                </button>
                <button
                  onClick={() => handlePreset('thisYear')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activePreset === 'thisYear' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  This Year
                </button>
              </div>

              {/* Date Inputs */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="bg-transparent text-xs font-medium text-slate-800 outline-none"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="bg-transparent text-xs font-medium text-slate-800 outline-none"
                />
              </div>

              {/* Refetch / Print */}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition"
                title="Refresh Report Data"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 active:scale-95 transition"
              >
                <Printer className="h-3.5 w-3.5" />
                Print P&L
              </button>
            </div>
          </div>
        </div>

        {/* Printable P&L Statement Container */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-none print:rounded-none">
          {/* Statement Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white border-b border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-400 block mb-1">
                  Sabir Plastic ERP — Financial Reporting
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Statement of Profit & Loss</h2>
                <p className="text-xs text-slate-300 mt-1">
                  For the Period: <span className="font-semibold text-white">{startDate}</span> to{' '}
                  <span className="font-semibold text-white">{endDate}</span>
                </p>
              </div>

              {statement && (
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-right">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                      Net Profit Margin
                    </span>
                    <span
                      className={`text-xl font-black ${
                        statement.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {statement.net_margin_pct}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Statement Content */}
          <div className="p-6 sm:p-8">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm font-semibold">Generating Profit & Loss Statement...</p>
              </div>
            ) : isError ? (
              <div className="py-16 text-center text-red-500">
                Failed to load Income Statement.{' '}
                <button onClick={() => refetch()} className="underline font-bold ml-1">
                  Retry
                </button>
              </div>
            ) : !statement ? null : (
              <div className="space-y-6">
                {/* Master Waterfall Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-300 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Line Item / Accounting Category</th>
                        <th className="py-3 px-4 text-right">Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium divide-y divide-slate-100">
                      {/* ─── 1. REVENUE SECTION ──────────────────────── */}
                      <tr>
                        <td colSpan={2} className="pt-6 pb-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          1. REVENUE & TURNOVER
                        </td>
                      </tr>

                      {/* Gross Sales */}
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-4 pl-6 text-slate-800 font-medium">
                          Gross Wholesale & Walk-in Sales Subtotal
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatMoney(statement.gross_sales)}
                        </td>
                      </tr>

                      {/* Delivery / Freight Charge Revenue */}
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-4 pl-6 text-slate-800 font-medium">
                          Delivery & Freight Charge Revenue
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatMoney(statement.delivery_revenue)}
                        </td>
                      </tr>

                      {/* Sales Returns & Credit Notes (Interactive Drill-Down Trigger) */}
                      <tr
                        onClick={handleOpenReturnsModal}
                        className="hover:bg-blue-50/80 transition cursor-pointer group select-none"
                        title="Click to view itemized sales returns & credit notes for this period"
                      >
                        <td className="py-2.5 px-4 pl-6 text-slate-700 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="group-hover:text-blue-700 group-hover:underline transition-colors font-semibold">
                              Less: Sales Returns & Customer Credit Notes
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full opacity-80 group-hover:opacity-100 transition-opacity">
                              <Search className="w-3 h-3 text-blue-600" /> Drill-Down 🔍
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-red-600 tabular-nums">
                          {formatMoney(statement.sales_returns, true)}
                        </td>
                      </tr>

                      {/* TOTAL NET REVENUE (Calculated Row) */}
                      <tr className="bg-slate-100/90 font-bold border-t-2 border-b-2 border-slate-300">
                        <td className="py-3.5 px-4 text-slate-900 uppercase tracking-tight">
                          TOTAL NET REVENUE
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-base tabular-nums">
                          {formatMoney(statement.net_revenue)}
                        </td>
                      </tr>

                      {/* ─── 2. COST OF GOODS SOLD (COGS) ────────────── */}
                      <tr>
                        <td colSpan={2} className="pt-8 pb-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          2. COST OF GOODS SOLD (COGS)
                        </td>
                      </tr>

                      {/* Inventory Cost of Goods Sold */}
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-4 pl-6 text-slate-700">
                          Cost of Inventory Sold (Weighted Average Cost / WAC)
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-red-600 tabular-nums">
                          {formatMoney(statement.cogs, true)}
                        </td>
                      </tr>

                      {/* GROSS PROFIT (Calculated Row) */}
                      <tr className="bg-blue-50/90 border-t-2 border-b-2 border-blue-200">
                        <td className="py-3.5 px-4 text-blue-950 font-bold">
                          <div className="flex items-center gap-2">
                            <span>GROSS PROFIT</span>
                            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
                              Gross Margin: {statement.gross_margin_pct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-blue-950 text-base tabular-nums">
                          {formatMoney(statement.gross_profit)}
                        </td>
                      </tr>

                      {/* ─── 3. OPERATING EXPENSES (OPEX) ───────────── */}
                      <tr>
                        <td colSpan={2} className="pt-8 pb-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          3. OPERATING EXPENSES (OPEX)
                        </td>
                      </tr>

                      {/* Render Breakdown Categories if available */}
                      {statement.expenses_breakdown && statement.expenses_breakdown.length > 0 ? (
                        statement.expenses_breakdown.map((exp) => (
                          <tr key={exp.category} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-4 pl-6 text-slate-700">
                              Expense: {exp.category}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-red-600 tabular-nums">
                              {formatMoney(exp.amount, true)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-4 pl-6 text-slate-700">
                            General Operating Expenses Total
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-red-600 tabular-nums">
                            {formatMoney(statement.operating_expenses, true)}
                          </td>
                        </tr>
                      )}

                      {/* TOTAL OPERATING EXPENSES (Calculated Row) */}
                      <tr className="bg-amber-50/80 border-t border-b border-amber-200">
                        <td className="py-3.5 px-4 text-amber-950 font-bold">
                          TOTAL OPERATING EXPENSES (OPEX)
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-950 tabular-nums">
                          {formatMoney(statement.operating_expenses, true)}
                        </td>
                      </tr>

                      {/* ─── 4. NET PROFIT / LOSS (FINAL ROW) ────────── */}
                      <tr>
                        <td colSpan={2} className="pt-8"></td>
                      </tr>
                      <tr
                        className={`${
                          statement.net_profit >= 0
                            ? 'bg-emerald-50/90 border-t-2 border-b-2 border-emerald-400 text-emerald-950'
                            : 'bg-red-50/90 border-t-2 border-b-2 border-red-400 text-red-950'
                        }`}
                      >
                        <td className="py-4 px-4 font-black text-base">
                          <div className="flex items-center gap-2">
                            <span>{statement.net_profit >= 0 ? 'NET OPERATING PROFIT' : 'NET OPERATING LOSS'}</span>
                            <span
                              className={`text-xs font-bold px-3 py-0.5 rounded-full border ${
                                statement.net_profit >= 0
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-red-100 text-red-800 border-red-300'
                              }`}
                            >
                              Net Margin: {statement.net_margin_pct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-black text-xl tabular-nums">
                          {formatMoney(statement.net_profit)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Notes */}
                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
                  <p>Report Generated: {new Date().toLocaleString()}</p>
                  <p>Sabir Plastic Wholesale ERP • Confidential Financial Document</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drill-Down Returns Modal Overlay */}
        <SalesReturnsDetailModal
          isOpen={isReturnsModalOpen}
          onClose={() => setIsReturnsModalOpen(false)}
          startDate={startDate}
          endDate={endDate}
          items={returnsDetailData}
          isLoading={isLoadingReturns}
          onRefresh={handleOpenReturnsModal}
        />
      </div>
    </div>
  );
}
