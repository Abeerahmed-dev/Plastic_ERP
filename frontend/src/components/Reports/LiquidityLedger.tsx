import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, Building2, Clock, TrendingUp, DollarSign,
  Boxes, CreditCard, ExternalLink, X, ArrowRightLeft, ShoppingCart,
} from 'lucide-react';
import { useReportStore } from '../../store/useReportStore';
import api from '../../services/api';
import { CashBookModal } from './CashBookModal';
import { PdcLedgerModal } from './PdcLedgerModal';
import { IssuedPdcLedgerModal } from './IssuedPdcLedgerModal';
import { BankAccountsModal } from './BankAccountsModal';
import { TransferFundsModal } from '../Modals/TransferFundsModal';

interface LiquidityModalData {
  type: 'receivables' | 'payables' | 'unsold-stock' | 'customer-advances' | 'supplier-advances';
  title: string;
  items: any[];
}

const formatPKR = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'Rs 0';
  const num = Number(val);
  return `Rs ${num.toLocaleString('en-PK', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatNumber = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(val);
};

export function LiquidityLedger() {
  const { liquidityLedger, isLoadingLiquidity, fetchAllReports } = useReportStore();

  const [modalData, setModalData] = useState<LiquidityModalData | null>(null);
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [isCashBookOpen, setIsCashBookOpen] = useState(false);
  const [isPdcModalOpen, setIsPdcModalOpen] = useState(false);
  const [isIssuedPdcModalOpen, setIsIssuedPdcModalOpen] = useState(false);
  const [isBankAccountsModalOpen, setIsBankAccountsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  useEffect(() => {
    fetchAllReports();
    const interval = setInterval(() => {
      useReportStore.getState().fetchLiquidityLedger(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

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
      title = 'Accounts Payable Detail (Money Owed to Parties)';
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

  return (
    <>
      <div className="rounded-2xl sm:rounded-3xl border border-slate-300/80 bg-white p-5 sm:p-6 shadow-[0_20px_50px_rgba(15,23,42,0.30),0_8px_20px_rgba(15,23,42,0.18)] space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 shadow-xs">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                Liquidity &amp; Working Capital
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Click cards to drill down
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20 active:scale-95 shrink-0 cursor-pointer"
              title="Move funds between Bank Accounts and Cash Drawer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-950" />
              Transfer Funds
            </button>
            {isLoadingLiquidity && (
              <span className="text-xs text-blue-600 animate-pulse font-medium">Loading...</span>
            )}
          </div>
        </div>

        {/* 8 Grid Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-2.5 w-full min-w-0">
          {/* Card 1: Cash in Drawer */}
          <button
            onClick={() => setIsCashBookOpen(true)}
            className="w-full text-left rounded-xl border border-slate-300 bg-[#f1f5f9] p-2.5 sm:p-3 space-y-1 hover:ring-2 hover:ring-slate-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm active:scale-[0.98] min-w-0 overflow-hidden"
            title={`Cash in Drawer: ${formatPKR(liquidityLedger?.cash_drawer)} (Click to audit)`}
          >
            <div className="flex items-center justify-between text-slate-700 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                CASH IN DRAWER
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </span>
              <DollarSign className="h-3.5 w-3.5 text-slate-600 shrink-0 ml-1" />
            </div>
            <p
              className="text-xs sm:text-sm xl:text-[13px] 2xl:text-sm font-extrabold text-slate-900 tabular-nums leading-tight truncate"
              title={formatPKR(liquidityLedger?.cash_drawer)}
            >
              {formatPKR(liquidityLedger?.cash_drawer)}
            </p>
          </button>

          {/* Card 2: Bank Balances */}
          <button
            type="button"
            onClick={() => setIsBankAccountsModalOpen(true)}
            className="w-full text-left rounded-xl border border-emerald-300 bg-[#eefaf4] p-2.5 sm:p-3 space-y-1 hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm active:scale-[0.98] min-w-0 overflow-hidden"
            title={`Bank Balances: ${formatPKR(liquidityLedger?.bank_balances)} (Click to open accounts)`}
          >
            <div className="flex items-center justify-between text-emerald-800 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                BANK BALANCES
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </span>
              <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 ml-1" />
            </div>
            <p
              className="text-xs sm:text-sm xl:text-[13px] 2xl:text-sm font-extrabold text-emerald-800 tabular-nums leading-tight truncate"
              title={formatPKR(liquidityLedger?.bank_balances)}
            >
              {formatPKR(liquidityLedger?.bank_balances)}
            </p>
          </button>

          {/* Card 3: Post-Dated Cheques */}
          <button
            type="button"
            onClick={() => openLiquidityModal('pdc')}
            title={`Pending PDC Receivable: ${formatPKR(liquidityLedger?.post_dated_cheques)} (Click to view)`}
            className="w-full text-left rounded-xl border border-amber-300 bg-[#fffbeb] p-2.5 sm:p-3 space-y-1 hover:ring-2 hover:ring-amber-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm active:scale-[0.98] min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between text-amber-800 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                PDC RECEIVABLE
                <ExternalLink className="w-2.5 h-2.5 text-amber-600 shrink-0" />
              </span>
              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 ml-1" />
            </div>
            <p
              className="text-xs sm:text-sm xl:text-[13px] 2xl:text-sm font-extrabold text-amber-800 tabular-nums leading-tight truncate"
              title={formatPKR(liquidityLedger?.post_dated_cheques)}
            >
              {formatPKR(liquidityLedger?.post_dated_cheques)}
            </p>
          </button>

          {/* Card 3B: Issued PDCs */}
          <button
            type="button"
            onClick={() => setIsIssuedPdcModalOpen(true)}
            title={`Issued PDC Liability: ${formatPKR(liquidityLedger?.post_dated_cheques)} (Click to view)`}
            className="w-full text-left rounded-xl border border-rose-300 bg-[#fff1f2] p-2.5 sm:p-3 space-y-1 hover:ring-2 hover:ring-rose-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm active:scale-[0.98] min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between text-rose-800 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                PDC LIABILITY
                <ExternalLink className="w-2.5 h-2.5 text-rose-600 shrink-0" />
              </span>
              <Clock className="h-3.5 w-3.5 text-rose-600 shrink-0 ml-1" />
            </div>
            <p
              className="text-xs sm:text-sm xl:text-[13px] 2xl:text-sm font-extrabold text-rose-800 tabular-nums leading-tight truncate"
              title={formatPKR(liquidityLedger?.issued_post_dated_cheques || liquidityLedger?.post_dated_cheques)}
            >
              {formatPKR(liquidityLedger?.issued_post_dated_cheques || liquidityLedger?.post_dated_cheques)}
            </p>
          </button>

          {/* Card 3C: Customer Advances Liability */}
          <button
            type="button"
            onClick={() => openLiquidityModal('customer-advances')}
            title="Click to view customer advance breakdown →"
            className="w-full text-left rounded-xl border border-amber-300 bg-amber-100/60 p-2.5 sm:p-3 space-y-1 hover:ring-2 hover:ring-amber-400 cursor-pointer transition-all shadow-2xs active:scale-[0.98] min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between text-amber-900 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                CUST. ADVANCES
                <ExternalLink className="w-2.5 h-2.5 text-amber-800 shrink-0" />
              </span>
              <Wallet className="h-3.5 w-3.5 text-amber-700 shrink-0 ml-1" />
            </div>
            <p className="text-xs sm:text-sm xl:text-[13px] 2xl:text-sm font-extrabold text-amber-900 tabular-nums leading-tight truncate">
              {formatPKR(liquidityLedger?.customer_advances_liability)}
            </p>
          </button>

          {/* Card 3D: Supplier Advances Asset */}
          <button
            type="button"
            onClick={() => openLiquidityModal('supplier-advances')}
            title="Click to view supplier advance breakdown →"
            className="w-full text-left rounded-xl border border-teal-300 bg-teal-100/60 p-2.5 sm:p-3 space-y-1 hover:ring-2 hover:ring-teal-400 cursor-pointer transition-all shadow-2xs active:scale-[0.98] min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between text-teal-900 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                SUPP. ADVANCES
                <ExternalLink className="w-2.5 h-2.5 text-teal-800 shrink-0" />
              </span>
              <Wallet className="h-3.5 w-3.5 text-teal-700 shrink-0 ml-1" />
            </div>
            <p className="text-xs sm:text-sm xl:text-[13px] 2xl:text-sm font-extrabold text-teal-900 tabular-nums leading-tight truncate">
              {formatPKR(liquidityLedger?.supplier_advances_asset)}
            </p>
          </button>

          {/* Card 4: Market Receivables */}
          <button
            onClick={() => openLiquidityModal('receivables')}
            title={`Market Receivables (Udhaar): ${formatPKR(liquidityLedger?.market_receivables)} (Click to view)`}
            className="w-full text-left rounded-xl border border-rose-300 bg-[#fff1f2] p-2.5 sm:p-3 space-y-1 hover:ring-2 hover:ring-rose-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm active:scale-[0.98] min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between text-rose-800 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                RECEIVABLES (UDHAAR)
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </span>
              <TrendingUp className="h-3.5 w-3.5 text-rose-600 shrink-0 ml-1" />
            </div>
            <p
              className="text-xs sm:text-sm xl:text-[13px] 2xl:text-sm font-extrabold text-rose-800 tabular-nums leading-tight truncate"
              title={formatPKR(liquidityLedger?.market_receivables)}
            >
              {formatPKR(liquidityLedger?.market_receivables)}
            </p>
          </button>

          {/* Card 5: Unsold Stock Value */}
          <button
            onClick={() => openLiquidityModal('unsold-stock')}
            title={`Unsold Stock Value: ${formatPKR(liquidityLedger?.total_inventory_value)} (Click to view)`}
            className="w-full text-left rounded-xl border border-blue-300 bg-[#eff6ff] p-2.5 sm:p-3 space-y-1 hover:ring-2 hover:ring-blue-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm active:scale-[0.98] min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between text-blue-800 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                UNSOLD STOCK
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </span>
              <Boxes className="h-3.5 w-3.5 text-blue-600 shrink-0 ml-1" />
            </div>
            <p
              className="text-xs sm:text-sm xl:text-[13px] 2xl:text-sm font-extrabold text-blue-800 tabular-nums leading-tight truncate"
              title={formatPKR(liquidityLedger?.total_inventory_value)}
            >
              {formatPKR(liquidityLedger?.total_inventory_value)}
            </p>
          </button>

          {/* Card 6: Accounts Payable */}
          <button
            onClick={() => openLiquidityModal('payables')}
            title={`Accounts Payable: ${formatPKR(liquidityLedger?.total_accounts_payable)} (Click to view)`}
            className="w-full text-left rounded-xl border border-rose-300 bg-[#ffe4e6] p-2.5 sm:p-3 space-y-1 hover:ring-2 hover:ring-rose-500 cursor-pointer transition-all shadow-2xs hover:shadow-sm active:scale-[0.98] min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between text-rose-900 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                ACCTS PAYABLE
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </span>
              <CreditCard className="h-3.5 w-3.5 text-rose-600 shrink-0 ml-1" />
            </div>
            <p
              className="text-xs sm:text-sm xl:text-[13px] 2xl:text-sm font-extrabold text-rose-900 tabular-nums leading-tight truncate"
              title={formatPKR(liquidityLedger?.total_accounts_payable)}
            >
              {formatPKR(liquidityLedger?.total_accounts_payable)}
            </p>
          </button>
        </div>

        {/* Footer Net Business Capital Bar */}
        <div className="px-5 py-3 rounded-2xl bg-[#14323c] text-white flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium">Liquid (Cash + Bank)</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{formatPKR(liquidityLedger?.total_liquid)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium">Net Capital:</span>
            <span className="font-black text-base text-white">{formatPKR(liquidityLedger?.net_business_capital)}</span>
          </div>
        </div>
      </div>

      {/* ─── Detail Drill-Down Modal ─── */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
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
                            <th className="py-3 px-4">Customer Name &amp; Code</th>
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
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{formatPKR(row.opening_balance)}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{formatPKR(row.invoice_balance)}</td>
                              <td className="py-3 px-4 text-right font-bold text-rose-600 font-mono">{formatPKR(row.total_receivable)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {modalData.type === 'payables' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Party Name &amp; Code</th>
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
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{formatPKR(row.opening_payable)}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{formatPKR(row.invoice_balance)}</td>
                              <td className="py-3 px-4 text-right font-bold text-rose-700 font-mono">{formatPKR(row.total_payable)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {modalData.type === 'unsold-stock' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Product Name &amp; Code</th>
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
                                <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">{row.category}</span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">{formatNumber(row.remaining_kg)} KG</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">{formatPKR(row.avg_cost)}</td>
                              <td className="py-3 px-4 text-right font-bold text-blue-700 font-mono">{formatPKR(row.total_asset_value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {modalData.type === 'customer-advances' && (
                      <>
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Customer Name &amp; Code</th>
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
                            <th className="py-3 px-4">Supplier Name &amp; Code</th>
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

      <CashBookModal isOpen={isCashBookOpen} onClose={() => setIsCashBookOpen(false)} />
      <PdcLedgerModal isOpen={isPdcModalOpen} onClose={() => setIsPdcModalOpen(false)} />
      <IssuedPdcLedgerModal isOpen={isIssuedPdcModalOpen} onClose={() => setIsIssuedPdcModalOpen(false)} />
      <BankAccountsModal isOpen={isBankAccountsModalOpen} onClose={() => setIsBankAccountsModalOpen(false)} />
      <TransferFundsModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => fetchAllReports()}
      />
    </>
  );
}
