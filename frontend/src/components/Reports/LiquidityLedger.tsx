import { useState, useEffect } from 'react';
import {
  Wallet, Building2, Clock, TrendingUp, DollarSign,
  Boxes, CreditCard, ExternalLink, X,
} from 'lucide-react';
import { useReportStore } from '../../store/useReportStore';
import api from '../../services/api';
import { CashBookModal } from './CashBookModal';
import { PdcLedgerModal } from './PdcLedgerModal';
import { IssuedPdcLedgerModal } from './IssuedPdcLedgerModal';
import { BankAccountsModal } from './BankAccountsModal';

interface LiquidityModalData {
  type: 'receivables' | 'payables' | 'unsold-stock';
  title: string;
  items: any[];
}

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

export function LiquidityLedger() {
  const { liquidityLedger, isLoadingLiquidity, fetchAllReports } = useReportStore();

  const [modalData, setModalData] = useState<LiquidityModalData | null>(null);
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [isCashBookOpen, setIsCashBookOpen] = useState(false);
  const [isPdcModalOpen, setIsPdcModalOpen] = useState(false);
  const [isIssuedPdcModalOpen, setIsIssuedPdcModalOpen] = useState(false);
  const [isBankAccountsModalOpen, setIsBankAccountsModalOpen] = useState(false);

  useEffect(() => {
    // Fetch if data not already loaded
    if (!liquidityLedger) {
      fetchAllReports();
    }
  }, []);

  const openLiquidityModal = async (type: 'receivables' | 'payables' | 'unsold-stock' | 'pdc') => {
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
    }

    try {
      const response = await api.get(endpoint);
      setModalData({
        type: type as 'receivables' | 'payables' | 'unsold-stock',
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
      <div className="space-y-4">
        {/* Header (No Base Card Wrapper) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Liquidity &amp; Working Capital
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time cash balances, receivables, payables &amp; net working capital (click cards to drill down)
            </p>
          </div>
          {isLoadingLiquidity && (
            <span className="text-xs text-blue-600 animate-pulse font-medium">Loading...</span>
          )}
        </div>

        {/* 6 Grid Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Card 1: Cash in Drawer */}
          <button
            onClick={() => setIsCashBookOpen(true)}
            className="w-full text-left rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1 hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
            title="Click to open Cash Drawer Audit Ledger"
          >
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                Cash in Drawer
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
              <DollarSign className="h-3.5 w-3.5" />
            </div>
            <p className="text-base font-black text-emerald-700 font-mono leading-tight">
              {formatPKR(liquidityLedger?.cash_drawer)}
            </p>
          </button>

          {/* Card 2: Bank Balances */}
          <button
            type="button"
            onClick={() => setIsBankAccountsModalOpen(true)}
            className="w-full text-left rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1 hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
            title="Click to open Multi-Bank Accounts Management & Ledger"
          >
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                Bank Balances
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <p className="text-base font-black text-emerald-700 font-mono leading-tight">
              {formatPKR(liquidityLedger?.bank_balances)}
            </p>
          </button>

          {/* Card 3: Post-Dated Cheques */}
          <button
            type="button"
            onClick={() => openLiquidityModal('pdc')}
            title="Click to open Pending Post-Dated Cheques Ledger"
            className="w-full text-left rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-1 hover:ring-2 hover:ring-amber-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                PDC Receivable
                <ExternalLink className="w-2.5 h-2.5 text-amber-600" />
              </span>
              <Clock className="h-3.5 w-3.5" />
            </div>
            <p className="text-base font-black text-amber-700 leading-tight">
              {formatPKR(liquidityLedger?.post_dated_cheques)}
            </p>
          </button>

          {/* Card 3B: Issued PDCs */}
          <button
            type="button"
            onClick={() => setIsIssuedPdcModalOpen(true)}
            title="Click to open Issued Post-Dated Cheques Ledger"
            className="w-full text-left rounded-xl border border-rose-200 bg-rose-50/50 p-3 space-y-1 hover:ring-2 hover:ring-rose-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-rose-700">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                PDC Liability
                <ExternalLink className="w-2.5 h-2.5 text-rose-600" />
              </span>
              <Clock className="h-3.5 w-3.5" />
            </div>
            <p className="text-base font-black text-rose-700 font-mono leading-tight">
              {formatPKR(liquidityLedger?.post_dated_cheques)}
            </p>
          </button>

          {/* Card 4: Market Receivables */}
          <button
            onClick={() => openLiquidityModal('receivables')}
            className="w-full text-left rounded-xl border border-rose-200 bg-rose-50/50 p-3 space-y-1 hover:ring-2 hover:ring-rose-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-rose-700">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                Receivables (Udhaar)
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <p className="text-base font-black text-rose-700 leading-tight">
              {formatPKR(liquidityLedger?.market_receivables)}
            </p>
          </button>

          {/* Card 5: Unsold Stock Value */}
          <button
            onClick={() => openLiquidityModal('unsold-stock')}
            className="w-full text-left rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-1 hover:ring-2 hover:ring-blue-400 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-blue-700">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                Unsold Stock
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
              <Boxes className="h-3.5 w-3.5" />
            </div>
            <p className="text-base font-black text-blue-700 leading-tight">
              {formatPKR(liquidityLedger?.total_inventory_value)}
            </p>
          </button>

          {/* Card 6: Accounts Payable */}
          <button
            onClick={() => openLiquidityModal('payables')}
            className="w-full text-left rounded-xl border border-rose-300 bg-rose-100/50 p-3 space-y-1 hover:ring-2 hover:ring-rose-500 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-rose-900">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                Accts Payable
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
              <CreditCard className="h-3.5 w-3.5" />
            </div>
            <p className="text-base font-black text-rose-900 leading-tight">
              {formatPKR(liquidityLedger?.total_accounts_payable)}
            </p>
          </button>
        </div>

        {/* Footer Net Business Capital Bar */}
        <div className="px-3 py-2.5 rounded-lg bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs shadow-md">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-300">Liquid (Cash + Bank):</span>
            <span className="font-bold text-emerald-400">{formatPKR(liquidityLedger?.total_liquid)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-300">Net Capital:</span>
            <span className="font-black text-base text-blue-400">{formatPKR(liquidityLedger?.net_business_capital)}</span>
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
                            <th className="py-3 px-4">Supplier Name &amp; Code</th>
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
    </>
  );
}
