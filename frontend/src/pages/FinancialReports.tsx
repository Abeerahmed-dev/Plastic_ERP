import React, { useEffect, useState } from 'react';
import { useReportStore, BatchItem } from '../store/useReportStore';
import api from '../services/api';
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Wallet,
  Building2,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Layers,
  Boxes,
  CreditCard,
  Filter,
  AlertTriangle,
  Info,
  X,
  UserCheck,
  Truck,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface LiquidityModalData {
  type: 'receivables' | 'payables' | 'unsold-stock';
  title: string;
  items: any[];
}

export default function FinancialReports() {
  const {
    inventoryLedger = [],
    liquidityLedger,
    profitMatrix,
    selectedProductId,
    timeFilter,
    isLoadingInventory,
    isLoadingLiquidity,
    isLoadingProfit,
    error,
    setSelectedProductId,
    setTimeFilter,
    fetchAllReports,
  } = useReportStore();

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [modalData, setModalData] = useState<LiquidityModalData | null>(null);
  const [isLoadingModal, setIsLoadingModal] = useState(false);

  useEffect(() => {
    fetchAllReports();
  }, []);

  const toggleRow = (productId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const formatPKR = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatNumber = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(val);
  };

  const safeInventory = Array.isArray(inventoryLedger) ? inventoryLedger : [];

  // Open Interactive Liquidity Drill-Down Modal
  const openLiquidityModal = async (type: 'receivables' | 'payables' | 'unsold-stock') => {
    setIsLoadingModal(true);
    let title = '';
    let endpoint = '';

    if (type === 'receivables') {
      title = 'Market Receivables Detail (Customers Owing Debt)';
      endpoint = '/reports/liquidity/receivables';
    } else if (type === 'payables') {
      title = 'Accounts Payable Detail (Money Owed to Suppliers)';
      endpoint = '/reports/liquidity/payables';
    } else if (type === 'unsold-stock') {
      title = 'Unsold Warehouse Stock Asset Detail';
      endpoint = '/reports/liquidity/unsold-stock';
    }

    try {
      const response = await api.get(endpoint);
      setModalData({
        type,
        title,
        items: response.data.data || [],
      });
    } catch (err) {
      console.error('Failed to fetch liquidity detail:', err);
    } finally {
      setIsLoadingModal(false);
    }
  };

  const { salesMargin } = useReportStore();
  const salesData = salesMargin || (profitMatrix as any);

  const totalSalesVal = Number(salesData?.total_sales_value || 0);
  const totalCogsVal = Number(salesData?.total_cogs || 0);
  const netMarginVal = Number(salesData?.net_margin || (totalSalesVal - totalCogsVal));
  const isNetLoss = netMarginVal < 0;

  const periodCash = Number(salesData?.period_cash_received || salesData?.cash_received || 0);
  const periodUdhaar = Number(salesData?.period_udhaar_generated || salesData?.pending_debt || (totalSalesVal - periodCash));

  const cashPct = totalSalesVal > 0 ? (periodCash / totalSalesVal) * 100 : 0;
  const udhaarPct = totalSalesVal > 0 ? (periodUdhaar / totalSalesVal) * 100 : 0;

  return (
    <div className="p-6 space-y-8 bg-slate-50 min-h-screen">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial & Inventory Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time batch yield analytics, market liquidity drill-downs, and period sales margin pivots
          </p>
        </div>

        <button
          onClick={() => fetchAllReports()}
          disabled={isLoadingInventory || isLoadingLiquidity || isLoadingProfit}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-blue-600 ${isLoadingInventory ? 'animate-spin' : ''}`} />
          Refresh Ledger
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* ─── TIER 1: INVENTORY LEDGER (WITH BATCH DRILL-DOWN & SUPPLIER TOOLTIPS) ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">1. Inventory Ledger & Batch Asset Value</h2>
              <p className="text-xs text-slate-500">Restricted top-level KG stock with granular batch supplier & yield drill-downs</p>
            </div>
          </div>

          {/* Global Product Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <label className="text-xs font-semibold text-slate-600 shrink-0">Filter by Product:</label>
            <select
              value={selectedProductId || ''}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Products ({safeInventory.length})</option>
              {safeInventory.map((item) => (
                <option key={item.product_id} value={item.product_id}>
                  {item.product_name} ({item.product_code})
                </option>
              ))}
            </select>
            {isLoadingInventory && <span className="text-xs text-blue-600 animate-pulse font-medium ml-2">Loading...</span>}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Total Stock (KG Only)</th>
                <th className="py-3 px-4 text-right">Rolling Avg Cost/KG</th>
                <th className="py-3 px-4 text-right">Total Asset Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(selectedProductId ? safeInventory.filter((i) => i.product_id === selectedProductId) : safeInventory).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                    No active inventory products found matching the filter.
                  </td>
                </tr>
              ) : (
                (selectedProductId ? safeInventory.filter((i) => i.product_id === selectedProductId) : safeInventory).map((item) => {
                  const isExpanded = !!expandedRows[item.product_id];
                  const batches = Array.isArray(item.batches) ? item.batches : [];

                  return (
                    <React.Fragment key={item.product_id}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleRow(item.product_id)}
                            className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition"
                            title="Toggle Purchase Batches"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {item.product_name}
                          <span className="ml-2 text-xs font-mono font-normal text-slate-400">({item.product_code})</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-700">
                            {item.category}
                          </span>
                        </td>
                        {/* Top-level stock restricted to KG only */}
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                          {formatNumber(item.total_kg)} KG
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-700">
                          {formatPKR(item.avg_cost)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                          {formatPKR(item.total_asset_value)}
                        </td>
                      </tr>

                      {/* Expandable Sub-Table Row for Purchase Batches */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50 p-4 border-t border-b border-slate-200">
                            <div className="pl-6 space-y-3">
                              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-blue-600" />
                                Specific Purchase Batches & Supplier Drill-Down ({batches.length} Batches)
                              </h4>
                              {batches.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No purchase batches recorded yet.</p>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                                      <tr>
                                        <th className="py-2.5 px-3">Batch Date / #</th>
                                        <th className="py-2.5 px-3 text-right">Buy Price / KG</th>
                                        <th className="py-2.5 px-3">Custom Batch Metrics</th>
                                        <th className="py-2.5 px-3 text-right">Original Qty & Bulk Units</th>
                                        <th className="py-2.5 px-3">Batch Lifecycle (Depletion)</th>
                                        <th className="py-2.5 px-3 text-right">Batch Profit (So Far)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {batches.map((batch: BatchItem & { supplier_name?: string }, idx: number) => {
                                        const customWeight = (batch as any).actual_weight_per_unit || 25.0;
                                        const unitName = (batch as any).selected_unit || 'Bora';
                                        const remQty = Number(batch.remaining_qty || 0);
                                        const totalKgSold = Number((batch as any).total_kg_sold || 0);
                                        const origQty = Number(batch.original_qty || (remQty + totalKgSold));
                                        const profit = Number((batch as any).batch_gross_profit || 0);
                                        const revenue = Number((batch as any).batch_revenue || 0);
                                        const cogs = Number((batch as any).batch_cogs || 0);

                                        const approxUnits = Math.round(origQty / (customWeight || 25));
                                        const pct = origQty > 0 ? Math.min(100, Math.max(0, Math.round((totalKgSold / origQty) * 100))) : 0;
                                        const supplierName = batch.supplier_name || 'Opening Stock / Primary Supplier';

                                        return (
                                          <tr key={batch.batch_id || idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2.5 px-3 font-mono text-slate-700">
                                              <div className="flex items-center gap-1">
                                                <span className="font-bold text-slate-900 block">{batch.batch_number || `BATCH-${idx + 1}`}</span>
                                                {/* Hoverable Supplier Info Icon */}
                                                <div className="group relative cursor-pointer">
                                                  <Info className="w-3.5 h-3.5 text-blue-500 hover:text-blue-700 transition" />
                                                  <div className="absolute left-5 bottom-0 hidden group-hover:block z-20 w-52 bg-slate-900 text-white text-[11px] p-2 rounded-lg shadow-xl font-sans">
                                                    <strong>Supplied by:</strong> {supplierName}
                                                  </div>
                                                </div>
                                              </div>
                                              <span className="text-[10px] text-slate-400 block">
                                                {batch.date ? new Date(batch.date).toLocaleDateString() : 'N/A'}
                                              </span>
                                            </td>

                                            <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                                              {formatPKR(batch.buy_price_per_kg)}
                                            </td>

                                            <td className="py-2.5 px-3 font-medium text-indigo-700">
                                              1 {unitName} = {customWeight} KG
                                            </td>

                                            {/* Original Qty + Unit Equivalents */}
                                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                              <span className="font-bold block">{formatNumber(origQty)} KG</span>
                                              <span className="text-[10px] text-slate-500 font-normal">
                                                (approx {approxUnits} {unitName}s)
                                              </span>
                                            </td>

                                            {/* Batch Lifecycle Depletion Progress Bar */}
                                            <td className="py-2.5 px-3">
                                              <div className="w-44 space-y-1">
                                                <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                                                  <span>{pct}% Sold</span>
                                                  <span className="text-slate-500 font-normal">{formatNumber(remQty)} KG Left</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                  <div
                                                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                  />
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono">
                                                  {formatNumber(totalKgSold)} KG Sold / {formatNumber(remQty)} KG Left
                                                </div>
                                              </div>
                                            </td>

                                            {/* Batch Profit Yield Metrics */}
                                            <td className="py-2.5 px-3 text-right">
                                              <div>
                                                <span className={`text-xs font-bold ${profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                                  {profit > 0 ? '+' : ''}{formatPKR(profit)}
                                                </span>
                                                <span className="block text-[10px] font-mono text-slate-400">
                                                  Rev: {formatPKR(revenue)} | Cost: {formatPKR(cogs)}
                                                </span>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── TIER 2: INTERACTIVE LIQUIDITY & WORKING CAPITAL LEDGER ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">2. Liquidity & Working Capital Ledger</h2>
              <p className="text-xs text-slate-500">Click summary cards to open granular drill-down entity lists</p>
            </div>
          </div>
          {isLoadingLiquidity && <span className="text-xs text-blue-600 animate-pulse font-medium">Loading liquidity...</span>}
        </div>

        {/* 6 Grid Cards - Target summary cards are interactive buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Cash in Drawer (GREEN) */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-2">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-xs font-bold uppercase tracking-wider">Cash in Drawer</span>
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-emerald-700">
              {formatPKR(liquidityLedger?.cash_drawer)}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium">Immediate liquid cash balance</p>
          </div>

          {/* Card 2: Bank Balances (GREEN) */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-2">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-xs font-bold uppercase tracking-wider">Bank Balances</span>
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-emerald-700">
              {formatPKR(liquidityLedger?.bank_balances)}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium">Verified bank deposits</p>
          </div>

          {/* Card 3: Post-Dated Cheques (YELLOW) */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-2">
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-xs font-bold uppercase tracking-wider">Post-Dated Cheques (PDC)</span>
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-amber-700">
              {formatPKR(liquidityLedger?.post_dated_cheques)}
            </p>
            <p className="text-[11px] text-amber-600 font-medium">Uncleared pending cheques</p>
          </div>

          {/* Card 4: Market Receivables / Udhaar (INTERACTIVE BUTTON - RED) */}
          <button
            onClick={() => openLiquidityModal('receivables')}
            className="w-full text-left rounded-2xl border border-rose-200 bg-rose-50/50 p-5 space-y-2 hover:ring-2 hover:ring-rose-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-rose-700">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Market Receivables (Udhaar)
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-rose-700">
              {formatPKR(liquidityLedger?.market_receivables)}
            </p>
            <p className="text-[11px] text-rose-600 font-medium underline">Click to view customer debt list →</p>
          </button>

          {/* Card 5: Inventory Asset (Unsold Stock Value) - INTERACTIVE BUTTON - BLUE */}
          <button
            onClick={() => openLiquidityModal('unsold-stock')}
            className="w-full text-left rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-2 hover:ring-2 hover:ring-blue-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-blue-700">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Unsold Stock Value
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <Boxes className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-blue-700">
              {formatPKR(liquidityLedger?.total_inventory_value)}
            </p>
            <p className="text-[11px] text-blue-600 font-medium underline">Click to view product stock asset breakdown →</p>
          </button>

          {/* Card 6: Accounts Payable (Supplier Debt) - INTERACTIVE BUTTON - DARK RED */}
          <button
            onClick={() => openLiquidityModal('payables')}
            className="w-full text-left rounded-2xl border border-rose-300 bg-rose-100/50 p-5 space-y-2 hover:ring-2 hover:ring-rose-500 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-rose-900">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Accounts Payable
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <CreditCard className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-rose-900">
              {formatPKR(liquidityLedger?.total_accounts_payable)}
            </p>
            <p className="text-[11px] text-rose-800 font-medium underline">Click to view supplier payables list →</p>
          </button>
        </div>

        {/* Footer Net Business Capital Bar */}
        <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 text-sm shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Total Liquid Funds (Cash + Bank):</span>
            <span className="font-bold text-emerald-400 text-base">{formatPKR(liquidityLedger?.total_liquid)}</span>
          </div>
          <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-700 pt-2 sm:pt-0 sm:pl-4">
            <span className="font-bold text-slate-200">Net Business Capital:</span>
            <span className="font-black text-xl text-blue-400">{formatPKR(liquidityLedger?.net_business_capital)}</span>
          </div>
        </div>
      </div>

      {/* ─── TIER 3: SALES & MARGIN REPORT (WITH TIME-SERIES & CASH-FLOW UX BADGE) ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">3. Sales & Margin Report</h2>
              <p className="text-xs text-slate-500">Period revenue, cost of goods sold, net profit/loss, and period-specific cash vs udhaar ratio</p>
            </div>
          </div>

          {/* Top Right Dual Filters: Product & Time Period */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Product Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Product:</span>
              <select
                value={selectedProductId || ''}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Products</option>
                {safeInventory.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name} ({p.product_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Time Period Filter */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Period:</span>
              <select
                value={timeFilter || 'all_time'}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="today">Today</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="this_month">This Month</option>
                <option value="all_time">All Time</option>
              </select>
            </div>

            {isLoadingProfit && <span className="text-xs text-blue-600 animate-pulse font-medium">Updating...</span>}
          </div>
        </div>

        {/* Flex Grid with 3 Main Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Sales (Revenue) */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-blue-700">
              <span className="text-xs font-bold uppercase tracking-wider">Total Sales</span>
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-blue-700">
              {formatPKR(totalSalesVal)}
            </p>
            <p className="text-[11px] text-blue-600 font-medium">Gross revenue for selected period</p>
          </div>

          {/* Card 2: Total COGS */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider">Total COGS</span>
              <Package className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-slate-800">
              {formatPKR(totalCogsVal)}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">Batch cost of sold inventory</p>
          </div>

          {/* Card 3: Net Margin (Net Profit or Net Loss) */}
          <div className={`rounded-2xl border p-5 space-y-3 shadow-sm ${isNetLoss ? 'border-red-200 bg-red-50/70' : 'border-emerald-200 bg-emerald-50/70'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${isNetLoss ? 'text-red-700' : 'text-emerald-700'}`}>
                {isNetLoss ? 'NET LOSS' : 'NET PROFIT'}
              </span>
              {isNetLoss ? <TrendingDown className="h-5 w-5 text-red-600" /> : <TrendingUp className="h-5 w-5 text-emerald-600" />}
            </div>
            <p className={`text-3xl font-black ${isNetLoss ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatPKR(netMarginVal)}
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 pt-1 border-t border-slate-200/60">
              <span>Margin Rate: {((salesData?.gross_margin_percent || 0) * 100).toFixed(2)}%</span>
              <span className={isNetLoss ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>
                {isNetLoss ? 'Result: Net Loss' : 'Result: Net Profit'}
              </span>
            </div>

            {/* Safety Badge (Period Cash vs Udhaar Split) */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-800 shadow-xs w-full justify-between">
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  Cash: {cashPct.toFixed(1)}% ({formatPKR(periodCash)})
                </span>
                <span className="text-rose-600 font-bold">
                  Udhaar: {udhaarPct.toFixed(1)}% ({formatPKR(periodUdhaar)})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── REUSABLE LIQUIDITY DETAIL MODAL ─── */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">{modalData.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{modalData.items.length} Records Found</p>
              </div>
              <button
                onClick={() => setModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Table */}
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingModal ? (
                <div className="py-12 text-center text-blue-600 animate-pulse font-medium text-sm">
                  Loading detailed list...
                </div>
              ) : modalData.items.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No entities found for this ledger query.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm text-left">
                    {/* Receivables Table */}
                    {modalData.type === 'receivables' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Customer Name & Code</th>
                            <th className="py-3 px-4">Phone / Location</th>
                            <th className="py-3 px-4 text-right">Opening Balance</th>
                            <th className="py-3 px-4 text-right">Sales Invoice Debt</th>
                            <th className="py-3 px-4 text-right">Total Owed (PKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {modalData.items.map((row: any) => (
                            <tr key={row.customer_id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {row.name}
                                <span className="ml-1.5 text-xs text-slate-400 font-mono">({row.code})</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 text-xs">
                                <div>{row.phone}</div>
                                <div className="text-slate-400">{row.city}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">
                                {formatPKR(row.opening_balance)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">
                                {formatPKR(row.invoice_balance)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-rose-600 font-mono">
                                {formatPKR(row.total_receivable)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {/* Payables Table */}
                    {modalData.type === 'payables' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Supplier Name & Code</th>
                            <th className="py-3 px-4">Phone / Location</th>
                            <th className="py-3 px-4 text-right">Opening Payable</th>
                            <th className="py-3 px-4 text-right">Purchase Debt</th>
                            <th className="py-3 px-4 text-right">Total Owed (PKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {modalData.items.map((row: any) => (
                            <tr key={row.supplier_id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {row.name}
                                <span className="ml-1.5 text-xs text-slate-400 font-mono">({row.code})</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 text-xs">
                                <div>{row.phone}</div>
                                <div className="text-slate-400">{row.city}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">
                                {formatPKR(row.opening_payable)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">
                                {formatPKR(row.invoice_balance)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-rose-700 font-mono">
                                {formatPKR(row.total_payable)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {/* Unsold Stock Table */}
                    {modalData.type === 'unsold-stock' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Product Name & Code</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4 text-right">Remaining Stock (KG)</th>
                            <th className="py-3 px-4 text-right">Avg Cost / KG</th>
                            <th className="py-3 px-4 text-right">Total Asset Value (PKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {modalData.items.map((row: any) => (
                            <tr key={row.product_id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {row.name}
                                <span className="ml-1.5 text-xs text-slate-400 font-mono">({row.code})</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 text-xs">
                                <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">
                                  {row.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                                {formatNumber(row.remaining_kg)} KG
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">
                                {formatPKR(row.avg_cost)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-blue-700 font-mono">
                                {formatPKR(row.total_asset_value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setModalData(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
