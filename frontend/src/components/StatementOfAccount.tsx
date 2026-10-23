import React, { useState, useMemo } from 'react';
import {
  Printer,
  Calendar,
  FileText,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Plus,
} from 'lucide-react';
import { invoicesService } from '../services/invoices.service';
import { purchasesService } from '../services/purchases.service';
import InvoiceDetailModal, { InvoiceDetailData } from './InvoiceDetailModal';
import { PaymentReceiptModal } from './Modals/PaymentReceiptModal';

export interface StatementEntry {
  id: string;
  source_id?: string;
  date: string;
  type: 'INVOICE' | 'CREDIT_NOTE' | 'PAYMENT' | 'ADVANCE_DEPOSIT' | 'CASH_REFUND' | 'OPENING_BALANCE' | 'RETURN';
  reference_no?: string;
  reference: string;
  debit: number;
  credit: number;
  running_balance?: number;
  balance: number;
  payment_method?: string | null;
  notes?: string | null;
}

export interface StatementOfAccountProps {
  data?: StatementEntry[] | { data?: StatementEntry[]; transactions?: StatementEntry[] };
  isLoading?: boolean;
  entityType?: 'customer' | 'supplier';
  entityName?: string;
  entityCode?: string;
  onRefresh?: () => void;
  onRecordPayment?: () => void;
}

function formatRs(n: number | string | undefined | null) {
  if (n === undefined || n === null) return 'Rs. 0';
  const val = Number(n);
  return `Rs. ${val.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export const StatementOfAccount: React.FC<StatementOfAccountProps> = ({
  data,
  isLoading = false,
  entityType = 'customer',
  entityName,
  entityCode,
  onRefresh,
  onRecordPayment,
}) => {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drill-down modal states
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetailData | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState<boolean>(false);
  const [isFetchingInvoice, setIsFetchingInvoice] = useState<boolean>(false);

  const [selectedPayment, setSelectedPayment] = useState<StatementEntry | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);

  // Normalize incoming data (array or object wrapper)
  const transactions: StatementEntry[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any).data)) return (data as any).data;
    if (Array.isArray((data as any).transactions)) return (data as any).transactions;
    return [];
  }, [data]);

  // Compute summary metrics
  const { totalDebit, totalCredit, closingBalance } = useMemo(() => {
    let debitSum = 0;
    let creditSum = 0;
    for (const t of transactions) {
      if (t.type !== 'OPENING_BALANCE') {
        debitSum += Number(t.debit || 0);
        creditSum += Number(t.credit || 0);
      }
    }
    const lastRow = transactions.length > 0 ? transactions[transactions.length - 1] : null;
    const finalBal = lastRow ? Number(lastRow.running_balance ?? lastRow.balance ?? 0) : 0;
    return {
      totalDebit: debitSum,
      totalCredit: creditSum,
      closingBalance: finalBal,
    };
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'INVOICE' && t.type !== 'INVOICE') return false;
        if (typeFilter === 'PAYMENT' && t.type !== 'PAYMENT') return false;
        if (typeFilter === 'ADVANCE' && t.type !== 'ADVANCE_DEPOSIT') return false;
        if (typeFilter === 'RETURN' && t.type !== 'CREDIT_NOTE' && t.type !== 'RETURN') return false;
        if (typeFilter === 'REFUND' && t.type !== 'CASH_REFUND') return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const ref = (t.reference_no || t.reference || '').toLowerCase();
        const notes = (t.notes || '').toLowerCase();
        if (!ref.includes(query) && !notes.includes(query)) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  // Click on reference handler (Drill-Down)
  const handleReferenceClick = async (entry: StatementEntry) => {
    const isInv = entry.type === 'INVOICE' || entry.type === 'CREDIT_NOTE' || entry.type === 'RETURN';
    const isPay = entry.type === 'PAYMENT' || entry.type === 'ADVANCE_DEPOSIT' || entry.type === 'CASH_REFUND';

    if (isInv) {
      const targetId = entry.source_id || entry.id;
      if (!targetId || targetId === 'opening') return;

      try {
        setIsFetchingInvoice(true);
        if (entityType === 'supplier') {
          const purchaseInv = await purchasesService.getInvoice(targetId);
          setSelectedInvoice(purchaseInv as any);
        } else {
          const salesInv = await invoicesService.getInvoice(targetId);
          setSelectedInvoice(salesInv as any);
        }
        setInvoiceModalOpen(true);
      } catch (err) {
        console.error('Failed to fetch invoice for drill-down:', err);
      } finally {
        setIsFetchingInvoice(false);
      }
    } else if (isPay) {
      setSelectedPayment(entry);
      setPaymentModalOpen(true);
    }
  };

  // Render badge helper
  const renderTypeBadge = (type: string) => {
    switch (type) {
      case 'INVOICE':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">
            <FileText className="w-3 h-3 text-blue-600" />
            {entityType === 'supplier' ? 'Purchase Bill' : 'Sales Invoice'}
          </span>
        );
      case 'PAYMENT':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Payment (Paid)
          </span>
        );
      case 'ADVANCE_DEPOSIT':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
            <ArrowUpRight className="w-3 h-3 text-amber-600" />
            Advance Deposit
          </span>
        );
      case 'CREDIT_NOTE':
      case 'RETURN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-bold text-red-700">
            <ArrowDownLeft className="w-3 h-3 text-red-600" />
            Return / Credit Note
          </span>
        );
      case 'CASH_REFUND':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-semibold text-purple-700">
            <CreditCard className="w-3 h-3 text-purple-600" />
            Cash Refund
          </span>
        );
      case 'OPENING_BALANCE':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
            Opening Balance
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-gray-50 border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
            {type.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
      {/* Header & Metric Bar */}
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Statement of Account</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">
                General Ledger
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Unified chronological record of all invoices, returns, payments, advances, and running balance.
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {onRecordPayment && (
              <button
                type="button"
                onClick={onRecordPayment}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-3.5 py-2 text-xs font-bold text-slate-950 transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                title="Record Payment against Invoice"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                + Record Payment
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 transition"
                title="Refresh Statement"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Print / PDF
            </button>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Debits (Charged)</span>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5 font-mono">
              {formatRs(totalDebit)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Credits (Paid/Credited)</span>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5 font-mono">
              {formatRs(totalCredit)}
            </p>
          </div>

          <div className={`rounded-xl border p-3.5 ${
            closingBalance > 0
              ? 'bg-red-50/60 border-red-200'
              : closingBalance < 0
              ? 'bg-emerald-50/60 border-emerald-200'
              : 'bg-slate-50/60 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">Closing Balance</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                closingBalance > 0
                  ? 'bg-red-100 text-red-800'
                  : closingBalance < 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {closingBalance > 0
                  ? 'Outstanding (Udhaar)'
                  : closingBalance < 0
                  ? 'Advance Credit'
                  : 'Settled'}
              </span>
            </div>
            <p className={`text-xl font-extrabold mt-0.5 font-mono ${
              closingBalance > 0 ? 'text-red-700' : closingBalance < 0 ? 'text-emerald-700' : 'text-slate-900'
            }`}>
              {formatRs(Math.abs(closingBalance))} {closingBalance > 0 ? 'Dr' : closingBalance < 0 ? 'Cr' : ''}
            </p>
          </div>
        </div>

        {/* Filter Toolbar (print:hidden) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100 print:hidden">
          <div className="flex items-center space-x-1 overflow-x-auto text-xs">
            {['ALL', 'INVOICE', 'PAYMENT', 'ADVANCE', 'RETURN', 'REFUND'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTypeFilter(tab)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  typeFilter === tab
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab === 'ALL'
                  ? 'All Transactions'
                  : tab === 'INVOICE'
                  ? 'Invoices'
                  : tab === 'PAYMENT'
                  ? 'Payments'
                  : tab === 'ADVANCE'
                  ? 'Advances'
                  : tab === 'RETURN'
                  ? 'Returns'
                  : 'Refunds'}
              </button>
            ))}
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference or notes…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Printable Heading (print only) */}
      <div className="hidden print:block p-6 border-b border-gray-300">
        <h1 className="text-xl font-bold text-gray-900">
          Statement of Account - {entityName || 'Entity'} {entityCode ? `(${entityCode})` : ''}
        </h1>
        <p className="text-xs text-gray-500">
          Generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/90 text-xs font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-5 py-3.5 text-left">Date</th>
              <th className="px-5 py-3.5 text-left">Transaction Type</th>
              <th className="px-5 py-3.5 text-left">Reference</th>
              <th className="px-5 py-3.5 text-right font-mono">Debit (Rs)</th>
              <th className="px-5 py-3.5 text-right font-mono">Credit (Rs)</th>
              <th className="px-5 py-3.5 text-right font-mono">Running Balance (Rs)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading financial records…
                </td>
              </tr>
            )}

            {!isLoading && filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  No statement transactions found.
                </td>
              </tr>
            )}

            {!isLoading &&
              filteredTransactions.map((row, idx) => {
                const bal = Number(row.running_balance ?? row.balance ?? 0);
                const isClickable =
                  row.type === 'INVOICE' ||
                  row.type === 'CREDIT_NOTE' ||
                  row.type === 'RETURN' ||
                  row.type === 'PAYMENT' ||
                  row.type === 'ADVANCE_DEPOSIT' ||
                  row.type === 'CASH_REFUND';

                return (
                  <tr
                    key={row.id || idx}
                    className={`transition hover:bg-blue-50/40 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                    }`}
                  >
                    {/* Date */}
                    <td className="px-5 py-3 whitespace-nowrap text-xs font-mono font-medium text-slate-700">
                      {row.date
                        ? new Date(row.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>

                    {/* Transaction Type */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      {renderTypeBadge(row.type)}
                    </td>

                    {/* Reference (Clickable Drill-Down) */}
                    <td className="px-5 py-3 whitespace-nowrap text-xs">
                      {isClickable ? (
                        <button
                          type="button"
                          onClick={() => handleReferenceClick(row)}
                          className="group inline-flex items-center gap-1 font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition"
                          title={`Click to view drill-down details for ${row.reference_no || row.reference}`}
                        >
                          <span>{row.reference_no || row.reference}</span>
                          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition" />
                        </button>
                      ) : (
                        <span className="font-mono text-slate-700 font-medium">
                          {row.reference_no || row.reference}
                        </span>
                      )}
                    </td>

                    {/* Debit */}
                    <td className="px-5 py-3 whitespace-nowrap text-right font-mono text-xs text-slate-800">
                      {Number(row.debit) > 0 ? (
                        <span className="font-semibold text-slate-900">{formatRs(row.debit)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Credit */}
                    <td className="px-5 py-3 whitespace-nowrap text-right font-mono text-xs text-slate-800">
                      {Number(row.credit) > 0 ? (
                        <span className="font-semibold text-slate-900">{formatRs(row.credit)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Running Balance */}
                    <td className="px-5 py-3 whitespace-nowrap text-right font-mono text-xs">
                      {bal > 0 ? (
                        <span className="font-bold text-red-600 inline-flex items-center gap-1">
                          {formatRs(bal)} <span className="text-[10px] font-normal text-red-500">(Dr)</span>
                        </span>
                      ) : bal < 0 ? (
                        <span className="font-bold text-emerald-600 inline-flex items-center gap-1">
                          {formatRs(Math.abs(bal))} <span className="text-[10px] font-normal text-emerald-500">(Cr)</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">Rs. 0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Loading overlay indicator during invoice detail fetch */}
      {isFetchingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs">
          <div className="rounded-xl bg-white p-4 shadow-xl flex items-center gap-3 text-sm font-semibold text-slate-800">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            Loading transaction details…
          </div>
        </div>
      )}

      {/* Drill-Down Modals */}
      {invoiceModalOpen && selectedInvoice && (
        <InvoiceDetailModal
          isOpen={invoiceModalOpen}
          onClose={() => {
            setInvoiceModalOpen(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          type={entityType === 'supplier' ? 'purchase' : 'sales'}
        />
      )}

      {paymentModalOpen && selectedPayment && (
        <PaymentReceiptModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedPayment(null);
          }}
          payment={selectedPayment}
          entityType={entityType}
          entityName={entityName}
          entityCode={entityCode}
        />
      )}
    </div>
  );
};
