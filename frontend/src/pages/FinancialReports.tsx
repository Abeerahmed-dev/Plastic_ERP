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
  const [isCashBookOpen, setIsCashBookOpen] = useState(false);
  const [isPdcModalOpen, setIsPdcModalOpen] = useState(false);
  const [isIssuedPdcModalOpen, setIsIssuedPdcModalOpen] = useState(false);
  const [isBankAccountsModalOpen, setIsBankAccountsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

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
    <div className="p-6 space-y-8 bg-slate-50 min-h-screen dark:bg-[#0b0d14] dark:text-slate-100">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight dark:text-white">Financial & Working Capital Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
            Market liquidity drill-downs, working capital ledgers, and period sales margin pivots
          </p>
        </div>

        <button
          onClick={() => fetchAllReports()}
          disabled={isLoadingLiquidity || isLoadingProfit}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition shadow-sm active:scale-95 disabled:opacity-50 dark:bg-[#161925] dark:border-[#23283B] dark:text-slate-200 dark:hover:bg-[#1c2030]"
        >
          <RefreshCw className={`h-4 w-4 text-blue-600 dark:text-blue-400 ${isLoadingLiquidity ? 'animate-spin' : ''}`} />
          Refresh Ledger
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* ─── TIME-BOUND BUSINESS PERFORMANCE (P&L OVERVIEW) ─── */}
      <BusinessPerformanceRow />

      {/* ─── TIER 1: INTERACTIVE LIQUIDITY & WORKING CAPITAL LEDGER ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 dark:bg-[#0f111a] dark:border-[#1e2235]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Liquidity & Working Capital Ledger</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Click summary cards to open granular drill-down entity lists</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20 active:scale-95 shrink-0 cursor-pointer dark:from-amber-500 dark:to-amber-600 dark:text-slate-950"
              title="Move funds between Bank Accounts and Cash Drawer"
            >
              <ArrowRightLeft className="w-4 h-4 text-slate-950" />
              Transfer Funds
            </button>
            {isLoadingLiquidity && <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse font-medium">Loading liquidity...</span>}
          </div>
        </div>

        {/* 9 Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Cash in Drawer (GREEN - CLICKABLE AUDIT LEDGER) */}
          <button
            onClick={() => setIsCashBookOpen(true)}
            className="w-full text-left rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-2 hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all shadow-sm active:scale-[0.99] dark:bg-[#0c1b2b] dark:border-sky-400 dark:shadow-[0_0_14px_rgba(56,189,248,0.35)] hover:dark:shadow-[0_0_20px_rgba(56,189,248,0.55)]"
            title="Click to open Cash Drawer Audit Ledger"
          >
            <div className="flex items-center justify-between text-emerald-700 dark:text-sky-400">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Cash in Drawer
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-emerald-700 font-mono dark:text-sky-300">
              {formatPKR(liquidityLedger?.cash_drawer)}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium underline dark:text-sky-400/80">Click to view cash drawer audit statement →</p>
          </button>

          {/* Card 2: Bank Balances (GREEN - CLICKABLE MULTI-BANK BREAKDOWN MODAL) */}
          <button
            type="button"
            onClick={() => setIsBankAccountsModalOpen(true)}
            className="w-full text-left rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-2 hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all shadow-sm active:scale-[0.99] dark:bg-[#092218] dark:border-emerald-400 dark:shadow-[0_0_14px_rgba(52,211,153,0.35)] hover:dark:shadow-[0_0_20px_rgba(52,211,153,0.55)]"
            title="Click to open Multi-Bank Accounts Management & Ledger"
          >
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Bank Balances
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-emerald-700 font-mono dark:text-emerald-300">
              {formatPKR(liquidityLedger?.bank_balances)}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium underline dark:text-emerald-400/80">Click to view bank accounts breakdown & management →</p>
          </button>

          {/* Card 3: Post-Dated Cheques (YELLOW - CLICKABLE DRILL-DOWN LEDGER) */}
          <button
            type="button"
            onClick={() => openLiquidityModal('pdc')}
            title="Click to open Pending Post-Dated Cheques Ledger"
            className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-2 hover:ring-2 hover:ring-amber-400 cursor-pointer transition-all shadow-sm active:scale-[0.99] dark:bg-[#201c08] dark:border-yellow-400 dark:shadow-[0_0_14px_rgba(250,204,21,0.35)] hover:dark:shadow-[0_0_20px_rgba(250,204,21,0.55)]"
          >
            <div className="flex items-center justify-between text-amber-700 dark:text-yellow-400">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Post-Dated Cheques (PDC)
                <ExternalLink className="w-3.5 h-3.5 text-amber-600 dark:text-yellow-400" />
              </span>
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-amber-700 dark:text-yellow-300">
              {formatPKR(liquidityLedger?.post_dated_cheques)}
            </p>
            <p className="text-[11px] text-amber-600 font-medium flex items-center justify-between dark:text-yellow-400/80">
              <span>Uncleared pending cheques</span>
              <span className="text-amber-800 font-bold underline dark:text-yellow-400">Click to view pending PDC ledger →</span>
            </p>
          </button>

          {/* Card 3B: Issued Post-Dated Cheques (ROSE/WARNING - LIABILITY DRILL-DOWN LEDGER) */}
          <button
            type="button"
            onClick={() => setIsIssuedPdcModalOpen(true)}
            title="Click to open Issued Post-Dated Cheques Ledger"
            className="w-full text-left rounded-2xl border border-rose-200 bg-rose-50/50 p-5 space-y-2 hover:ring-2 hover:ring-rose-400 cursor-pointer transition-all shadow-sm active:scale-[0.99] dark:bg-[#25101a] dark:border-pink-400/90 dark:shadow-[0_0_14px_rgba(244,114,182,0.35)] hover:dark:shadow-[0_0_20px_rgba(244,114,182,0.55)]"
          >
            <div className="flex items-center justify-between text-rose-700 dark:text-pink-400">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Issued PDCs (Liability)
                <ExternalLink className="w-3.5 h-3.5 text-rose-600 dark:text-pink-400" />
              </span>
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-rose-700 font-mono dark:text-pink-300">
              {formatPKR(liquidityLedger?.issued_post_dated_cheques)}
            </p>
            <p className="text-[11px] text-rose-600 font-medium flex items-center justify-between dark:text-pink-400/80">
              <span>Pending supplier cheques</span>
              <span className="text-rose-800 font-bold underline dark:text-pink-400">Click to view issued PDC ledger →</span>
            </p>
          </button>

          {/* Card 3C: Customer Advances (Liability) */}
          <button
            type="button"
            onClick={() => openLiquidityModal('customer-advances')}
            title="Click to view customer advance breakdown →"
            className="w-full text-left rounded-2xl border border-amber-300 bg-amber-100/60 p-5 space-y-2 hover:ring-2 hover:ring-amber-400 cursor-pointer transition-all shadow-sm active:scale-[0.99] dark:bg-[#23170a] dark:border-amber-500 dark:shadow-[0_0_14px_rgba(245,158,11,0.35)] hover:dark:shadow-[0_0_20px_rgba(245,158,11,0.55)]"
          >
            <div className="flex items-center justify-between text-amber-900 dark:text-amber-400">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Customer Advances (Liability)
                <ExternalLink className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400" />
              </span>
              <Wallet className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-900 font-mono dark:text-amber-300">
              {formatPKR(liquidityLedger?.customer_advances_liability)}
            </p>
            <p className="text-[11px] text-amber-800 font-medium underline flex items-center justify-between dark:text-amber-400/80">
              <span>Unallocated customer overpayments</span>
              <span className="text-amber-900 font-bold dark:text-amber-400">Click to view breakdown →</span>
            </p>
          </button>

          {/* Card 3D: Supplier Advances (Asset) */}
          <button
            type="button"
            onClick={() => openLiquidityModal('supplier-advances')}
            title="Click to view supplier advance breakdown →"
            className="w-full text-left rounded-2xl border border-teal-300 bg-teal-100/60 p-5 space-y-2 hover:ring-2 hover:ring-teal-400 cursor-pointer transition-all shadow-sm active:scale-[0.99] dark:bg-gradient-to-b dark:from-cyan-900/40 dark:to-cyan-950/70 dark:border-cyan-400 dark:shadow-[0_0_14px_rgba(34,211,238,0.35)] hover:dark:shadow-[0_0_20px_rgba(34,211,238,0.55)]"
          >
            <div className="flex items-center justify-between text-teal-900 dark:text-cyan-300">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Supplier Advances (Asset)
                <ExternalLink className="w-3.5 h-3.5 text-teal-800 dark:text-cyan-300" />
              </span>
              <Wallet className="h-5 w-5 text-teal-700 dark:text-cyan-400" />
            </div>
            <p className="text-2xl font-black text-teal-900 font-mono dark:text-cyan-300">
              {formatPKR(liquidityLedger?.supplier_advances_asset)}
            </p>
            <p className="text-[11px] text-teal-800 font-medium underline flex items-center justify-between dark:text-cyan-300/80">
              <span>Prepaid supplier cash balances</span>
              <span className="text-teal-900 font-bold dark:text-cyan-300">Click to view breakdown →</span>
            </p>
          </button>

          {/* Card 4: Market Receivables / Udhaar */}
          <button
            onClick={() => openLiquidityModal('receivables')}
            className="w-full text-left rounded-2xl border border-rose-200 bg-rose-50/50 p-5 space-y-2 hover:ring-2 hover:ring-rose-400 cursor-pointer transition-all shadow-sm active:scale-[0.99] dark:bg-[#220c0f] dark:border-red-600/90 dark:shadow-[0_0_14px_rgba(239,68,68,0.35)] hover:dark:shadow-[0_0_20px_rgba(239,68,68,0.55)]"
          >
            <div className="flex items-center justify-between text-rose-700 dark:text-red-400">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Market Receivables (Udhaar)
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-rose-700 dark:text-red-400">
              {formatPKR(liquidityLedger?.market_receivables)}
            </p>
            <p className="text-[11px] text-rose-600 font-medium underline dark:text-red-400/80">Click to view customer debt list →</p>
          </button>

          {/* Card 5: Inventory Asset (Unsold Stock Value) */}
          <button
            onClick={() => openLiquidityModal('unsold-stock')}
            className="w-full text-left rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-2 hover:ring-2 hover:ring-blue-400 cursor-pointer transition-all shadow-sm active:scale-[0.99] dark:bg-[#1a0f2b] dark:border-purple-500 dark:shadow-[0_0_14px_rgba(168,85,247,0.35)] hover:dark:shadow-[0_0_20px_rgba(168,85,247,0.55)]"
          >
            <div className="flex items-center justify-between text-blue-700 dark:text-purple-300">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Unsold Stock Value
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <Boxes className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-blue-700 dark:text-purple-300">
              {formatPKR(liquidityLedger?.total_inventory_value)}
            </p>
            <p className="text-[11px] text-blue-600 font-medium underline dark:text-purple-300/80">Click to view product stock asset breakdown →</p>
          </button>

          {/* Card 6: Accounts Payable */}
          <button
            onClick={() => openLiquidityModal('payables')}
            className="w-full text-left rounded-2xl border border-rose-300 bg-rose-100/50 p-5 space-y-2 hover:ring-2 hover:ring-rose-500 cursor-pointer transition-all shadow-sm active:scale-[0.99] dark:bg-gradient-to-br dark:from-rose-950/60 dark:via-[#2b0c18] dark:to-rose-900/40 dark:border-rose-500 dark:shadow-[0_0_16px_rgba(244,63,94,0.4)] hover:dark:shadow-[0_0_22px_rgba(244,63,94,0.6)]"
          >
            <div className="flex items-center justify-between text-rose-900 dark:text-rose-300">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Accounts Payable
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
              <CreditCard className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-2xl font-black text-rose-900 dark:text-rose-400">
              {formatPKR(liquidityLedger?.total_accounts_payable)}
            </p>
            <p className="text-[11px] text-rose-800 font-medium underline dark:text-rose-400/80">Click to view supplier payables list →</p>
          </button>
        </div>

        {/* Footer Net Business Capital Bar */}
        <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 text-sm shadow-md dark:bg-[#0c2229] dark:border dark:border-teal-500/30 dark:shadow-[0_0_15px_rgba(20,184,166,0.15)]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300 dark:text-slate-400">Total Liquid Funds (Cash + Bank):</span>
            <span className="font-bold text-emerald-400 text-base">{formatPKR(liquidityLedger?.total_liquid)}</span>
          </div>
          <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-700 dark:border-slate-800 pt-2 sm:pt-0 sm:pl-4">
            <span className="font-bold text-slate-200 dark:text-slate-300">Net Business Capital:</span>
            <span className="font-black text-xl text-blue-400 dark:text-white">{formatPKR(liquidityLedger?.net_business_capital)}</span>
          </div>
        </div>
      </div>

      {/* ─── TIER 2: SALES & MARGIN REPORT ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 dark:bg-[#0f111a] dark:border-[#1e2235]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Sales & Margin Report (WAC COGS)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Period revenue, locked COGS at point of sale, net margin, and period cash vs udhaar ratio</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Product:</span>
              <select
                value={selectedProductId || ''}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-slate-200"
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
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Period:</span>
              <select
                value={timeFilter || 'all_time'}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-slate-200"
              >
                <option value="today">Today</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="this_month">This Month</option>
                <option value="all_time">All Time</option>
              </select>
            </div>

            {isLoadingProfit && <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse font-medium">Updating...</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-2 shadow-sm dark:bg-[#0c1b2b] dark:border-sky-500/40 dark:shadow-[0_0_14px_rgba(56,189,248,0.25)]">
            <div className="flex items-center justify-between text-blue-700 dark:text-sky-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total Sales</span>
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-blue-700 dark:text-sky-300">
              {formatPKR(totalSalesVal)}
            </p>
            <p className="text-[11px] text-blue-600 font-medium dark:text-sky-400/80">Gross revenue for selected period</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-2 shadow-sm dark:bg-[#121520] dark:border-[#23283B]">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span className="text-xs font-bold uppercase tracking-wider">Total COGS (WAC)</span>
              <Package className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {formatPKR(totalCogsVal)}
            </p>
            <p className="text-[11px] text-slate-500 font-medium dark:text-slate-400">Applied average cost of sold inventory</p>
          </div>

          <div className={`rounded-2xl border p-5 space-y-3 shadow-sm transition-all ${
            isNetLoss
              ? 'border-red-200 bg-red-50/70 dark:bg-[#220c0f] dark:border-rose-500 dark:shadow-[0_0_14px_rgba(244,63,94,0.35)]'
              : 'border-emerald-200 bg-emerald-50/70 dark:bg-[#092218] dark:border-emerald-400 dark:shadow-[0_0_14px_rgba(52,211,153,0.3)]'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${isNetLoss ? 'text-red-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {isNetLoss ? 'NET LOSS' : 'NET PROFIT'}
              </span>
              {isNetLoss ? <TrendingDown className="h-5 w-5 text-red-600 dark:text-rose-400" /> : <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            </div>
            <p className={`text-3xl font-black ${isNetLoss ? 'text-red-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-300'}`}>
              {formatPKR(netMarginVal)}
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 pt-1 border-t border-slate-200/60 dark:border-slate-800 dark:text-slate-400">
              <span>Margin Rate: {((salesData?.gross_margin_percent || 0) * 100).toFixed(2)}%</span>
              <span className={isNetLoss ? 'text-red-600 dark:text-rose-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                {isNetLoss ? 'Result: Net Loss' : 'Result: Net Profit'}
              </span>
            </div>

            <div className="pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-800 shadow-xs w-full justify-between dark:bg-[#161925] dark:border-[#23283B] dark:text-slate-200">
                <span className="text-emerald-600 font-bold flex items-center gap-1 dark:text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" />
                  Cash: {cashPct.toFixed(1)}% ({formatPKR(periodCash)})
                </span>
                <span className="text-rose-600 font-bold dark:text-rose-400">
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
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto max-h-[85vh] overflow-hidden dark:bg-[#121520] dark:border dark:border-[#23283B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 dark:bg-[#161925] dark:border-[#23283B]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{modalData.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{modalData.items.length} Records Found</p>
              </div>
              <button
                onClick={() => setModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition dark:hover:text-white dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingModal ? (
                <div className="py-12 text-center text-blue-600 dark:text-blue-400 animate-pulse font-medium text-sm">
                  Loading detailed list...
                </div>
              ) : modalData.items.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                  No entities found for this ledger query.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#23283B]">
                  <table className="w-full text-sm text-left">
                    {modalData.type === 'receivables' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200 dark:bg-[#161925] dark:text-slate-400 dark:border-[#23283B]">
                          <tr>
                            <th className="py-3 px-4">Customer Name & Code</th>
                            <th className="py-3 px-4">Phone / Location</th>
                            <th className="py-3 px-4 text-right">Opening Balance</th>
                            <th className="py-3 px-4 text-right">Sales Invoice Debt</th>
                            <th className="py-3 px-4 text-right">Total Owed (PKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#23283B]">
                          {modalData.items.map((row: any) => (
                            <tr key={row.customer_id} className="hover:bg-slate-50/70 dark:hover:bg-[#181c2b]">
                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                {row.name}
                                <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">({row.code})</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                                <div>{row.phone}</div>
                                <div className="text-slate-400 dark:text-slate-500">{row.city}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                                {formatPKR(row.opening_balance)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                                {formatPKR(row.invoice_balance)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-red-400 font-mono">
                                {formatPKR(row.total_receivable)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {modalData.type === 'payables' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200 dark:bg-[#161925] dark:text-slate-400 dark:border-[#23283B]">
                          <tr>
                            <th className="py-3 px-4">Supplier Name & Code</th>
                            <th className="py-3 px-4">Phone / Location</th>
                            <th className="py-3 px-4 text-right">Opening Payable</th>
                            <th className="py-3 px-4 text-right">Purchase Debt</th>
                            <th className="py-3 px-4 text-right">Total Owed (PKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#23283B]">
                          {modalData.items.map((row: any) => (
                            <tr key={row.supplier_id} className="hover:bg-slate-50/70 dark:hover:bg-[#181c2b]">
                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                {row.name}
                                <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">({row.code})</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                                <div>{row.phone}</div>
                                <div className="text-slate-400 dark:text-slate-500">{row.city}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                                {formatPKR(row.opening_payable)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                                {formatPKR(row.invoice_balance)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-rose-700 dark:text-rose-400 font-mono">
                                {formatPKR(row.total_payable)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {modalData.type === 'unsold-stock' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200 dark:bg-[#161925] dark:text-slate-400 dark:border-[#23283B]">
                          <tr>
                            <th className="py-3 px-4">Product Name & Code</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4 text-right">Remaining Stock (KG)</th>
                            <th className="py-3 px-4 text-right">Rolling Avg Cost / KG</th>
                            <th className="py-3 px-4 text-right">Total Asset Value (PKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#23283B]">
                          {modalData.items.map((row: any) => (
                            <tr key={row.product_id} className="hover:bg-slate-50/70 dark:hover:bg-[#181c2b]">
                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                {row.name}
                                <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">({row.code})</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-medium">
                                  {row.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold font-mono text-slate-900 dark:text-slate-100">
                                {formatNumber(row.remaining_kg)} KG
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                                {formatPKR(row.avg_cost)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-blue-700 dark:text-purple-300 font-mono">
                                {formatPKR(row.total_asset_value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {modalData.type === 'customer-advances' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200 dark:bg-[#161925] dark:text-slate-400 dark:border-[#23283B]">
                          <tr>
                            <th className="py-3 px-4">Customer Name & Code</th>
                            <th className="py-3 px-4">Phone / Location</th>
                            <th className="py-3 px-4 text-right">Total Billed</th>
                            <th className="py-3 px-4 text-right">Total Paid</th>
                            <th className="py-3 px-4 text-right">Unallocated Advance (Rs)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#23283B]">
                          {modalData.items.map((row: any) => (
                            <tr key={row.customer_id} className="hover:bg-slate-50/70 dark:hover:bg-[#181c2b]">
                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                {row.name}
                                <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">({row.code})</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                                <div>{row.phone}</div>
                                <div className="text-slate-400 dark:text-slate-500">{row.city}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatPKR(row.total_billed)}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatPKR(row.total_paid)}</td>
                              <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400 font-mono">{formatPKR(row.advance_credit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {modalData.type === 'supplier-advances' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200 dark:bg-[#161925] dark:text-slate-400 dark:border-[#23283B]">
                          <tr>
                            <th className="py-3 px-4">Supplier Name & Code</th>
                            <th className="py-3 px-4">Phone / Location</th>
                            <th className="py-3 px-4 text-right">Total Billed</th>
                            <th className="py-3 px-4 text-right">Total Paid</th>
                            <th className="py-3 px-4 text-right">Prepaid Advance (Rs)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#23283B]">
                          {modalData.items.map((row: any) => (
                            <tr key={row.supplier_id} className="hover:bg-slate-50/70 dark:hover:bg-[#181c2b]">
                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                {row.name}
                                <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">({row.code})</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                                <div>{row.phone}</div>
                                <div className="text-slate-400 dark:text-slate-500">{row.city}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatPKR(row.total_billed)}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatPKR(row.total_paid)}</td>
                              <td className="py-3 px-4 text-right font-bold text-teal-600 dark:text-cyan-300 font-mono">{formatPKR(row.advance_payable)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 dark:bg-[#161925] dark:border-[#23283B] flex justify-end">
              <button
                onClick={() => setModalData(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition cursor-pointer"
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
