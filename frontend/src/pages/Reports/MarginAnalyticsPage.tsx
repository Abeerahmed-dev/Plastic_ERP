import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Search,
  Calendar,
  RefreshCw,
  Loader2,
  Box,
  Users,
  Percent,
  DollarSign,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { reportsService, MarginAnalyticsData } from '../../services/reports.service';
import { SalesTrendChart } from '../../components/Reports/SalesTrendChart';

export default function MarginAnalyticsPage() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayDate = now.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<string>(todayDate);
  const [productSearch, setProductSearch] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');

  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<MarginAnalyticsData>({
    queryKey: ['marginAnalytics', startDate, endDate],
    queryFn: () => reportsService.getMarginAnalytics(startDate, endDate),
  });

  const productsList = useMemo(() => {
    if (!analytics?.products) return [];
    if (!productSearch.trim()) return analytics.products;
    const term = productSearch.toLowerCase();
    return analytics.products.filter(
      (p) => p.product_name.toLowerCase().includes(term) || p.category_name.toLowerCase().includes(term)
    );
  }, [analytics?.products, productSearch]);

  const customersList = useMemo(() => {
    if (!analytics?.customers) return [];
    if (!customerSearch.trim()) return analytics.customers;
    const term = customerSearch.toLowerCase();
    return analytics.customers.filter((c) => c.customer_name.toLowerCase().includes(term));
  }, [analytics?.customers, customerSearch]);

  // Macro KPI summary values
  const totalVolumeKg = useMemo(
    () => (analytics?.products || []).reduce((sum, p) => sum + p.total_kg_sold, 0),
    [analytics?.products]
  );
  const totalRevenue = useMemo(
    () => (analytics?.products || []).reduce((sum, p) => sum + p.total_revenue, 0),
    [analytics?.products]
  );
  const totalProfit = useMemo(
    () => (analytics?.products || []).reduce((sum, p) => sum + p.total_profit, 0),
    [analytics?.products]
  );
  const overallMargin = useMemo(
    () => (totalRevenue > 0 ? Math.round(((totalProfit / totalRevenue) * 100) * 10) / 10 : 0),
    [totalRevenue, totalProfit]
  );

  const formatPKR = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
    return `Rs. ${Number(val).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatKg = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0 KG';
    return `${Number(val).toLocaleString('en-PK', { maximumFractionDigits: 1 })} KG`;
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header & Date Controls */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sales & Margin Analytics</h1>
              <p className="text-xs text-slate-500">Unit economics & profitability split by product and customer</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent font-medium text-slate-800 outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent font-medium text-slate-800 outline-none"
              />
            </div>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-xl transition border border-slate-200 bg-white"
              title="Refresh Analytics"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Macro KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Revenue</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatPKR(totalRevenue)}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Volume Sold</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatKg(totalVolumeKg)}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Box className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Gross Margin Profit</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{formatPKR(totalProfit)}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Margin %</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{overallMargin}%</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Percent className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* ─── LAYER 2: THE ANALYTICAL SPLIT (SIDE-BY-SIDE GRID) ────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* ─── TABLE A: MARGIN BY PRODUCT (LEFT COLUMN) ──────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Box className="h-5 w-5 text-indigo-600" />
                <h2 className="font-bold text-slate-900 text-base">Margin by Product</h2>
                <span className="text-xs bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                  {productsList.length} Items
                </span>
              </div>
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter product..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4 text-right">Volume (KG)</th>
                    <th className="py-3 px-4 text-right">Avg Price</th>
                    <th className="py-3 px-4 text-right">Avg COGS</th>
                    <th className="py-3 px-4 text-right">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" />
                        Calculating product unit economics...
                      </td>
                    </tr>
                  )}

                  {!isLoading && productsList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                        No product sales recorded for this date range.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    productsList.map((p) => {
                      const margin = p.gross_margin_pct;
                      let marginClass = 'text-slate-900 font-medium';
                      if (margin < 10) {
                        marginClass = 'text-red-600 font-bold';
                      } else if (margin > 25) {
                        marginClass = 'text-emerald-600 font-bold';
                      }

                      return (
                        <tr key={p.product_id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 text-xs">{p.product_name}</div>
                            <div className="text-[11px] text-slate-400">{p.category_name}</div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 text-xs tabular-nums">
                            {formatKg(p.total_kg_sold)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 text-xs tabular-nums">
                            Rs. {p.avg_sell_price.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-500 text-xs tabular-nums">
                            Rs. {p.avg_wac_cogs.toFixed(2)}
                          </td>

                          <td className={`py-3 px-4 text-right font-mono text-xs tabular-nums ${marginClass}`}>
                            {margin.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── TABLE B: MARGIN BY CUSTOMER (RIGHT COLUMN) ─────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-base">Margin by Customer</h2>
                <span className="text-xs bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                  {customersList.length} Customers
                </span>
              </div>
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
                    <th className="py-3 px-4 text-left">Customer</th>
                    <th className="py-3 px-4 text-right">Volume (KG)</th>
                    <th className="py-3 px-4 text-right">Revenue</th>
                    <th className="py-3 px-4 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {isLoading && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600 mb-2" />
                        Aggregating customer margins...
                      </td>
                    </tr>
                  )}

                  {!isLoading && customersList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 text-xs">
                        No customer purchase records in this date range.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    customersList.map((c) => {
                      const profit = c.total_profit;
                      const profitClass = profit >= 0 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold';

                      return (
                        <tr key={c.customer_id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 text-left font-semibold text-slate-900 text-xs">
                            {c.customer_name}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 text-xs tabular-nums">
                            {formatKg(c.total_volume_kg)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 text-xs tabular-nums">
                            Rs. {c.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>

                          <td className={`py-3 px-4 text-right font-mono text-xs tabular-nums ${profitClass}`}>
                            Rs. {profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── LAYER 3: TIME-SERIES VISUALIZATION (FULL-WIDTH CHART) ─ */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
          <div className="flex items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Daily Operational Velocity (Sales vs. COGS)
                </h2>
                <p className="text-xs text-slate-500">
                  Chronological daily revenue, inventory WAC cost of goods sold, and gross profit trajectory
                </p>
              </div>
            </div>
          </div>

          <SalesTrendChart data={analytics?.trend_data || []} />
        </div>
      </div>
    </div>
  );
}
