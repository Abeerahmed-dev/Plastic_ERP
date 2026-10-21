import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReportStore } from '../store/useReportStore';
import api from '../services/api';
import {
  RefreshCw,
  Wallet,
  Building2,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Boxes,
  CreditCard,
  Filter,
  AlertTriangle,
  X,
  UserCheck,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowRightLeft,
  ShoppingCart,
} from 'lucide-react';

import { BusinessPerformanceRow } from '../components/Reports/BusinessPerformanceRow';
import { CashBookModal } from '../components/Reports/CashBookModal';
import { PdcLedgerModal } from '../components/Reports/PdcLedgerModal';
import { IssuedPdcLedgerModal } from '../components/Reports/IssuedPdcLedgerModal';
import { BankAccountsModal } from '../components/Reports/BankAccountsModal';
import { TransferFundsModal } from '../components/Modals/TransferFundsModal';

interface LiquidityModalData {
  type: 'receivables' | 'payables' | 'unsold-stock' | 'customer-advances' | 'supplier-advances';
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

  const [modalData, setModalData] = useState<LiquidityModalData | null>(null);
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [isCashBookOpen, setIsCashBookOpen] = useState(false);
  const [isPdcModalOpen, setIsPdcModalOpen] = useState(false);
  const [isIssuedPdcModalOpen, setIsIssuedPdcModalOpen] = useState(false);
  const [isBankAccountsModalOpen, setIsBankAccountsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const toggleProductAccordion = (productId: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  useEffect(() => {
    fetchAllReports();
  }, []);

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
  const openLiquidityModal = async (type: 'receivables' | 'payables' | 'unsold-stock' | 'pdc' | 'customer-advances' | 'supplier-advances') => {
    if (type === 'pdc') {
      setIsPdcModalOpen(true);
      return;
    }

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
    } else if (type === 'customer-advances') {
      title = 'Customer Overpayment Advances (Unallocated Wallet Liability Detail)';
      endpoint = '/reports/liquidity/customer-advances';
    } else if (type === 'supplier-advances') {
      title = 'Supplier Prepaid Advances (Prepaid Cash Asset Detail)';
      endpoint = '/reports/liquidity/supplier-advances';
    }

    try {
      const response = await api.get(endpoint);
      setModalData({
        type: type as any,
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
            Weighted Average Costing (WAC) valuation, market liquidity drill-downs, and period sales margin pivots
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

      {/* ─── TIME-BOUND BUSINESS PERFORMANCE (P&L OVERVIEW) ─── */}
      <BusinessPerformanceRow />

      {/* ─── TIER 1: INVENTORY LEDGER (FLATTENED WAC MODEL - NO BATCH ACCORDIONS) ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">1. Inventory Ledger & WAC Asset Valuation</h2>
              <p className="text-xs text-slate-500">Flattened stock levels and rolling average cost valuation per product</p>
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
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Total Stock (KG)</th>
                <th className="py-3 px-4 text-right">Rolling Avg Cost/KG</th>
                <th className="py-3 px-4 text-right">Total Asset Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(selectedProductId ? safeInventory.filter((i) => i.product_id === selectedProductId) : safeInventory).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                    No active inventory products found matching the filter.
                  </td>
                </tr>
              ) : (
                (selectedProductId ? safeInventory.filter((i) => i.product_id === selectedProductId) : safeInventory).flatMap((item) => {
                  const isAccordionOpen = !!expandedProducts[item.product_id];
                  const kgSold = item.all_time_kg_sold || 0;
                  const kgPurchased = item.all_time_kg_purchased || 0;
                  const totalAcquired = Math.max(kgPurchased, kgSold + (item.total_kg || 0));
                  const turnoverPct = totalAcquired > 0 ? Math.min(100, Math.max(0, (kgSold / totalAcquired) * 100)) : 0;
                  const profit = item.all_time_profit || 0;
                  const isProfit = profit >= 0;
                  const batches = item.batches || [];

                  return [
                    /* ─── Top Level Row (Product Summary) ─── */
                    <tr
                      key={item.product_id}
                      onClick={() => toggleProductAccordion(item.product_id)}
                      className="hover:bg-slate-50/70 transition-colors border-t border-slate-200/60 cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProductAccordion(item.product_id);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            {isAccordionOpen ? (
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <span>{item.product_name}</span>
                          <span className="text-xs font-mono font-normal text-slate-400">({item.product_code})</span>
                          {batches.length > 0 && (
                            <span className="ml-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                              {batches.length} Buckets
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                        {formatNumber(item.total_kg)} KG
                        {item.secondary_units_summary && (
                          <span className="block text-[11px] font-normal text-slate-400">
                            {item.secondary_units_summary}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-700">
                        {formatPKR(item.avg_cost)} / KG
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 font-mono">
                        {formatPKR(item.total_asset_value)}
                      </td>
                    </tr>,

                    /* ─── Middle Accordion Row (Consolidated Price Buckets) ─── */
                    isAccordionOpen && (
                      <tr key={`buckets-${item.product_id}`} className="bg-indigo-50/30 border-b border-indigo-100">
                        <td colSpan={5} className="py-3 px-6">
                          <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                              <span className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                Active & Historical Price Buckets for {item.product_name} ({batches.length} Buckets)
                              </span>
                              <span className="text-slate-500 font-normal text-[11px]">
                                Auto-FIFO Stock Deduction Order (Oldest First)
                              </span>
                            </div>

                            {batches.length === 0 ? (
                              <div className="py-4 text-center text-xs text-slate-400 italic">
                                No granular price buckets found for this product.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
                                    <tr>
                                      <th className="py-2.5 px-3">Bucket #</th>
                                      <th className="py-2.5 px-3">Created Date</th>
                                      <th className="py-2.5 px-3 text-right">Buy Price / KG</th>
                                      <th className="py-2.5 px-3 text-right">Stock (Remaining / Original)</th>
                                      <th className="py-2.5 px-3 min-w-[180px]">Depletion Progress</th>
                                      <th className="py-2.5 px-3 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {batches.map((b: any) => {
                                      const orig = Number(b.original_qty || 0);
                                      const rem = Number(b.remaining_qty || 0);
                                      const sold = Number(b.total_kg_sold || Math.max(0, orig - rem));
                                      const depletionPct = orig > 0 ? Math.min(100, Math.max(0, (sold / orig) * 100)) : 0;
                                      const isDepleted = b.status === 'DEPLETED' || rem <= 0;

                                      return (
                                        <tr key={b.batch_id} className="hover:bg-slate-50/60">
                                          <td className="py-2 px-3 font-mono font-bold text-indigo-600">
                                            {b.batch_number}
                                          </td>
                                          <td className="py-2 px-3 font-mono text-slate-600">
                                            {b.date}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                                            {formatPKR(b.buy_price_per_kg)}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                            {formatNumber(rem)} / {formatNumber(orig)} KG
                                          </td>
                                          <td className="py-2 px-3">
                                            <div className="space-y-1">
                                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                                                <div
                                                  className={`h-2 rounded-full transition-all duration-300 ${
                                                    isDepleted ? 'bg-slate-400' : 'bg-emerald-500'
                                                  }`}
                                                  style={{ width: `${depletionPct}%` }}
                                                />
                                              </div>
                                              <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                                                <span>{formatNumber(sold)} KG Depleted</span>
                                                <span>{depletionPct.toFixed(1)}%</span>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {isDepleted ? (
                                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                DEPLETED
                                              </span>
                                            ) : (
                                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                ACTIVE
                                              </span>
                                            )}
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
                    ),

                    /* ─── Bottom Master Bar (All-Time Turnover & Margin) ─── */
                    <tr key={`turnover-${item.product_id}`} className="bg-slate-50/50 border-b border-slate-200">
                      <td colSpan={5} className="pb-3 pt-1 px-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          {/* Progress Bar & Lifetime Turnover */}
                          <div className="flex-1 space-y-1.5 min-w-[220px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                                Lifetime Inventory Turnover
                              </span>
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                {turnoverPct.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${turnoverPct}%` }}
                              />
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 flex justify-between">
                              <span>
                                Lifetime Turnover: <strong className="text-slate-800 font-mono">{formatNumber(kgSold)} KG</strong> Sold
                              </span>
                              <span>
                                <strong className="text-slate-800 font-mono">{formatNumber(kgPurchased > 0 ? kgPurchased : totalAcquired)} KG</strong> Total Acquired
                              </span>
                            </div>
                          </div>

                          {/* Vertical divider on sm screens */}
                          <div className="hidden sm:block w-px h-10 bg-slate-200" />

                          {/* Yield Metric: All-Time Gross Margin */}
                          <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center shrink-0">
                            <span className="text-xs font-semibold text-slate-500">All-Time Gross Margin</span>
                            <span className={`text-base font-black font-mono ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatPKR(profit)}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>,
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── TIER 2: INTERACTIVE LIQUIDITY & WORKING CAPITAL LEDGER ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">2. Liquidity & Working Capital Ledger</h2>
              <p className="text-xs text-slate-500">Click summary cards to open granular drill-down entity lists</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs active:scale-95 shrink-0"
              title="Move funds between Bank Accounts and Cash Drawer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              ⇄ Transfer Funds
            </button>
            <Link
              to="/pos"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-bold text-xs sm:text-sm shadow-sm hover:shadow transition-all active:scale-95 border border-amber-500/30"
              title="Open Walk-in POS"
            >
              <ShoppingCart className="w-4 h-4 text-slate-950" />
              <span>Walk-in POS</span>
            </Link>
            {isLoadingLiquidity && <span className="text-xs text-blue-600 animate-pulse font-medium">Loading liquidity...</span>}
          </div>
        </div>

        {/* 6 Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Cash in Drawer (GREEN - CLICKABLE AUDIT LEDGER) */}
          <button
            onClick={() => setIsCashBookOpen(true)}
            className="w-full text-left rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-2 hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
            title="Click to open Cash Drawer Audit Ledger"
          >
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Cash in Drawer
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-emerald-700 font-mono">
              {formatPKR(liquidityLedger?.cash_drawer)}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium underline">Click to view cash drawer audit statement →</p>
          </button>

          {/* Card 2: Bank Balances (GREEN - CLICKABLE MULTI-BANK BREAKDOWN MODAL) */}
          <button
            type="button"
            onClick={() => setIsBankAccountsModalOpen(true)}
            className="w-full text-left rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-2 hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
            title="Click to open Multi-Bank Accounts Management & Ledger"
          >
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Bank Balances
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-emerald-700 font-mono">
              {formatPKR(liquidityLedger?.bank_balances)}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium underline">Click to view bank accounts breakdown & management →</p>
          </button>

          {/* Card 3: Post-Dated Cheques (YELLOW - CLICKABLE DRILL-DOWN LEDGER) */}
          <button
            type="button"
            onClick={() => openLiquidityModal('pdc')}
            title="Click to open Pending Post-Dated Cheques Ledger"
            className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-2 hover:ring-2 hover:ring-amber-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Post-Dated Cheques (PDC)
                <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
              </span>
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-amber-700">
              {formatPKR(liquidityLedger?.post_dated_cheques)}
            </p>
            <p className="text-[11px] text-amber-600 font-medium flex items-center justify-between">
              <span>Uncleared pending cheques</span>
              <span className="text-amber-800 font-bold underline">Click to view pending PDC ledger →</span>
            </p>
          </button>

          {/* Card 3B: Issued Post-Dated Cheques (ROSE/WARNING - LIABILITY DRILL-DOWN LEDGER) */}
          <button
            type="button"
            onClick={() => setIsIssuedPdcModalOpen(true)}
            title="Click to open Issued Post-Dated Cheques Ledger"
            className="w-full text-left rounded-2xl border border-rose-200 bg-rose-50/50 p-5 space-y-2 hover:ring-2 hover:ring-rose-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-rose-700">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Issued PDCs (Liability)
                <ExternalLink className="w-3.5 h-3.5 text-rose-600" />
              </span>
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-rose-700 font-mono">
              {formatPKR(liquidityLedger?.issued_post_dated_cheques)}
            </p>
            <p className="text-[11px] text-rose-600 font-medium flex items-center justify-between">
              <span>Pending supplier cheques</span>
              <span className="text-rose-800 font-bold underline">Click to view issued PDC ledger →</span>
            </p>
          </button>

          {/* Card 3C: Customer Advances (Liability) */}
          <button
            type="button"
            onClick={() => openLiquidityModal('customer-advances')}
            title="Click to view customer advance breakdown →"
            className="w-full text-left rounded-2xl border border-amber-300 bg-amber-100/60 p-5 space-y-2 hover:ring-2 hover:ring-amber-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-amber-900">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Customer Advances (Liability)
                <ExternalLink className="w-3.5 h-3.5 text-amber-800" />
              </span>
              <Wallet className="h-5 w-5 text-amber-700" />
            </div>
            <p className="text-2xl font-black text-amber-900 font-mono">
              {formatPKR(liquidityLedger?.customer_advances_liability)}
            </p>
            <p className="text-[11px] text-amber-800 font-medium underline flex items-center justify-between">
              <span>Unallocated customer overpayments</span>
              <span className="text-amber-900 font-bold">Click to view breakdown →</span>
            </p>
          </button>

          {/* Card 3D: Supplier Advances (Asset) */}
          <button
            type="button"
            onClick={() => openLiquidityModal('supplier-advances')}
            title="Click to view supplier advance breakdown →"
            className="w-full text-left rounded-2xl border border-teal-300 bg-teal-100/60 p-5 space-y-2 hover:ring-2 hover:ring-teal-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-teal-900">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Supplier Advances (Asset)
                <ExternalLink className="w-3.5 h-3.5 text-teal-800" />
              </span>
              <Wallet className="h-5 w-5 text-teal-700" />
            </div>
            <p className="text-2xl font-black text-teal-900 font-mono">
              {formatPKR(liquidityLedger?.supplier_advances_asset)}
            </p>
            <p className="text-[11px] text-teal-800 font-medium underline flex items-center justify-between">
              <span>Prepaid supplier cash balances</span>
              <span className="text-teal-900 font-bold">Click to view breakdown →</span>
            </p>
          </button>

          {/* Card 4: Market Receivables / Udhaar */}
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

          {/* Card 5: Inventory Asset (Unsold Stock Value) */}
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

          {/* Card 6: Accounts Payable */}
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

      {/* ─── TIER 3: SALES & MARGIN REPORT ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">3. Sales & Margin Report (WAC COGS)</h2>
              <p className="text-xs text-slate-500">Period revenue, locked COGS at point of sale, net margin, and period cash vs udhaar ratio</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider">Total COGS (WAC)</span>
              <Package className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-slate-800">
              {formatPKR(totalCogsVal)}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">Applied average cost of sold inventory</p>
          </div>

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

                    {modalData.type === 'unsold-stock' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Product Name & Code</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4 text-right">Remaining Stock (KG)</th>
                            <th className="py-3 px-4 text-right">Rolling Avg Cost / KG</th>
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

                    {modalData.type === 'customer-advances' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Customer Name & Code</th>
                            <th className="py-3 px-4">Phone / Location</th>
                            <th className="py-3 px-4 text-right">Total Billed</th>
                            <th className="py-3 px-4 text-right">Total Paid</th>
                            <th className="py-3 px-4 text-right">Unallocated Advance (Rs)</th>
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
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{formatPKR(row.total_billed)}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{formatPKR(row.total_paid)}</td>
                              <td className="py-3 px-4 text-right font-bold text-amber-600 font-mono">{formatPKR(row.advance_credit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {modalData.type === 'supplier-advances' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Supplier Name & Code</th>
                            <th className="py-3 px-4">Phone / Location</th>
                            <th className="py-3 px-4 text-right">Total Billed</th>
                            <th className="py-3 px-4 text-right">Total Paid</th>
                            <th className="py-3 px-4 text-right">Prepaid Advance (Rs)</th>
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
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{formatPKR(row.total_billed)}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{formatPKR(row.total_paid)}</td>
                              <td className="py-3 px-4 text-right font-bold text-teal-600 font-mono">{formatPKR(row.advance_payable)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}
                  </table>
                </div>
              )}
            </div>

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

      {/* ─── CASH BOOK AUDIT MODAL ─── */}
      <CashBookModal isOpen={isCashBookOpen} onClose={() => setIsCashBookOpen(false)} />

      {/* ─── PDC DRILL-DOWN LEDGER MODAL ─── */}
      <PdcLedgerModal isOpen={isPdcModalOpen} onClose={() => setIsPdcModalOpen(false)} />

      {/* ─── ISSUED PDC DRILL-DOWN LEDGER MODAL ─── */}
      <IssuedPdcLedgerModal isOpen={isIssuedPdcModalOpen} onClose={() => setIsIssuedPdcModalOpen(false)} />

      {/* ─── MULTI-BANK ACCOUNTS BREAKDOWN & MANAGEMENT MODAL ─── */}
      <BankAccountsModal isOpen={isBankAccountsModalOpen} onClose={() => setIsBankAccountsModalOpen(false)} />

      {/* ─── INTERNAL FUNDS TRANSFER (CONTRA) MODAL ─── */}
      <TransferFundsModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => fetchAllReports()}
      />
    </div>
  );
}
