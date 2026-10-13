import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  HandCoins,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Receipt,
  ArrowDownLeft,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { paymentsService } from '../../services/payments.service';
import { CustomerPaymentSummary } from '../../types/payment.types';
import { useAuthStore } from '../../store/auth.store';
import { PaymentFormModal } from './PaymentFormModal';
import { CustomerRefundModal } from '../Customers/CustomerRefundModal';
import { CascadingFilterBar } from '../../components/CascadingFilterBar';
import { useCascadingFilters } from '../../hooks/useCascadingFilters';

export default function PaymentsListPage() {
  const { user, hasPermission } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';
  const canWrite = !isCashier && (hasPermission('customers:write') || hasPermission('payments:write'));
  const canRefund = hasPermission('payments:write') || hasPermission('customers:write') || isCashier;
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<{
    customer?: any;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
  } | null>(null);

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentsService.getPayments(),
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const paymentsList = Array.isArray(payments) ? payments : [];
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Filter out standalone Credit Notes and Cash Refunds from main ledger view
  const baseLedgerRows = useMemo(() => {
    return paymentsList
      .filter((p: CustomerPaymentSummary) => {
        if (!p) return false;
        const isCreditNote =
          p.type === 'CREDIT_NOTE' ||
          p.invoice_type === 'CREDIT_NOTE' ||
          p.invoice_status === 'CREDIT_NOTE';
        const isCashRefund =
          p.payment_method === 'CASH_REFUND' ||
          p.type === 'CASH_REFUND' ||
          p.invoice_type === 'CASH_REFUND' ||
          p.invoice_status === 'REFUND' ||
          p.invoice_number === 'Cash Refund';
        return !isCreditNote && !isCashRefund;
      })
      .map((p) => {
        const isStandalonePayment =
          !p.invoice_id ||
          p.invoice_type === 'ACCOUNT_PAYMENT' ||
          p.type === 'ACCOUNT_PAYMENT' ||
          p.invoice_number === 'Account Payment';

        const linkedReturnsTotal = (p.linked_credit_notes || []).reduce(
          (sum: number, cn: any) => sum + Math.abs(Number(cn.amount || cn.total_amount || 0)),
          0
        );
        const originalTotal = Number(p.original_total ?? p.invoice_total_amount ?? 0);
        const netInvoiceTotal = Math.max(0, originalTotal - linkedReturnsTotal);

        const linkedRefundsTotal = (p.linked_refunds || []).reduce(
          (sum: number, rf: any) => sum + Math.abs(Number(rf.amount || 0)),
          0
        );
        const grossPaid = Number(p.total_paid ?? p.total_paid_against_invoice ?? 0);
        const netTotalPaid = Math.max(0, grossPaid - linkedRefundsTotal);

        let dynamic_status = 'Unpaid';
        if (isStandalonePayment) {
          dynamic_status = 'Wallet Deposit';
        } else if (netInvoiceTotal === 0) {
          dynamic_status = 'Dead';
        } else if (netTotalPaid > netInvoiceTotal) {
          dynamic_status = 'Overpaid';
        } else if (netTotalPaid === netInvoiceTotal && netInvoiceTotal > 0) {
          dynamic_status = 'Fully Paid';
        } else if (netTotalPaid > 0 && netTotalPaid < netInvoiceTotal) {
          dynamic_status = 'Partially Paid';
        } else {
          dynamic_status = 'Unpaid';
        }

        return {
          ...p,
          city: (p as any).city || (p as any).customer_city || null,
          name: p.customer_name || (p as any).name || '',
          invoice_number: p.invoice_number || '',
          dynamic_status,
        };
      });
  }, [paymentsList]);

  // Phase 1: Cascading filters hook
  const {
    selectedCity,
    selectedName,
    selectedInvoice,
    setSelectedCity,
    setSelectedName,
    setSelectedInvoice,
    availableCities,
    availableNames,
    availableInvoices,
    resetFilters,
  } = useCascadingFilters(baseLedgerRows);

  // Phase 2 & 3: Strict multi-condition filter including dynamic status
  const filteredTableRows = useMemo(() => {
    return baseLedgerRows.filter((row: any) => {
      const matchesCity = selectedCity ? row.city === selectedCity : true;
      const matchesName = selectedName ? row.name === selectedName : true;
      const matchesInvoice = selectedInvoice ? row.invoice_number === selectedInvoice : true;
      const matchesStatus =
        statusFilter === 'All'
          ? true
          : statusFilter === 'Dead'
          ? row.dynamic_status === 'Dead' || row.dynamic_status === 'Dead / Fully Returned'
          : row.dynamic_status === statusFilter;
      return matchesCity && matchesName && matchesInvoice && matchesStatus;
    });
  }, [baseLedgerRows, selectedCity, selectedName, selectedInvoice, statusFilter]);

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
    }).format(Number(val));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Payments Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">
            Living invoice aggregation with dynamic net totals, linked return adjustments, and partial timelines.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canRefund && (
            <button
              onClick={() => {
                setRefundTarget(null);
                setIsRefundModalOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-all cursor-pointer"
            >
              <ArrowDownLeft className="-ml-1 mr-2 h-5 w-5" />
              Issue Cash Refund
            </button>
          )}
          {canWrite && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all cursor-pointer"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Cascading Filter Bar with Status Filtering */}
      <div className="mb-6">
        <CascadingFilterBar
          selectedCity={selectedCity}
          selectedName={selectedName}
          selectedInvoice={selectedInvoice}
          selectedStatus={statusFilter}
          onCityChange={setSelectedCity}
          onNameChange={setSelectedName}
          onInvoiceChange={setSelectedInvoice}
          onStatusChange={setStatusFilter}
          availableCities={availableCities}
          availableNames={availableNames}
          availableInvoices={availableInvoices}
          statusOptions={['All', 'Unpaid', 'Partially Paid', 'Fully Paid', 'Overpaid', 'Wallet Deposit', 'Dead']}
          onReset={() => {
            resetFilters();
            setStatusFilter('All');
          }}
          showInvoice={true}
          showStatus={true}
          nameLabel="Customer"
          namePlaceholder="Filter by customer…"
        />
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-500 text-sm font-medium">
              Loading aggregated customer payments...
            </div>
          ) : filteredTableRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <HandCoins className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900">No payment records found</h3>
              <p className="mt-1 text-sm text-slate-500">
                {selectedCity || selectedName || selectedInvoice
                  ? 'No records match the active cascading filters. Try resetting filters.'
                  : 'Get started by recording a new customer payment.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Invoice #</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Customer</th>
                  <th className="px-6 py-3.5 text-right text-sm font-semibold text-slate-900">Net Invoice Total</th>
                  <th className="px-6 py-3.5 text-right text-sm font-semibold text-slate-900">Net Paid</th>
                  <th className="px-6 py-3.5 text-center text-sm font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredTableRows.flatMap((row) => {
                  if (!row) return [];
                  const rowId = row.sales_id || row.id || Math.random().toString();
                  const isExpanded = !!expandedRows[rowId];

                  const isStandalonePayment =
                    !row.invoice_id ||
                    row.invoice_type === 'ACCOUNT_PAYMENT' ||
                    row.type === 'ACCOUNT_PAYMENT' ||
                    row.invoice_number === 'Account Payment';

                  // Phase 2 Living Invoice Metrics
                  const linkedReturnsTotal = (row.linked_credit_notes || []).reduce(
                    (sum: number, cn: any) => sum + Math.abs(Number(cn.amount || cn.total_amount || 0)),
                    0
                  );
                  const originalTotal = Number(row.original_total ?? row.invoice_total_amount ?? 0);
                  const netInvoiceTotal = Math.max(0, originalTotal - linkedReturnsTotal);

                  const linkedRefundsTotal = (row.linked_refunds || []).reduce(
                    (sum: number, rf: any) => sum + Math.abs(Number(rf.amount || 0)),
                    0
                  );
                  const grossPaid = Number(row.total_paid ?? row.total_paid_against_invoice ?? 0);
                  const netTotalPaid = Math.max(0, grossPaid - linkedRefundsTotal);

                  // Phase 2 Dynamic Status Logic
                  let dynamicStatusBadge = null;
                  if (isStandalonePayment) {
                    dynamicStatusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        WALLET DEPOSIT
                      </span>
                    );
                  } else if (netInvoiceTotal === 0) {
                    // if (netInvoiceTotal === 0) -> render a grey "Dead / Fully Returned" badge
                    dynamicStatusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                        Dead / Fully Returned
                      </span>
                    );
                  } else if (netTotalPaid > netInvoiceTotal) {
                    // if (netTotalPaid > netInvoiceTotal) -> render an orange "Overpaid" badge
                    dynamicStatusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        Overpaid
                      </span>
                    );
                  } else if (netTotalPaid === netInvoiceTotal && netInvoiceTotal > 0) {
                    // if (netTotalPaid === netInvoiceTotal && netInvoiceTotal > 0) -> render a green "Fully Paid" badge
                    dynamicStatusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        Fully Paid
                      </span>
                    );
                  } else if (netTotalPaid > 0 && netTotalPaid < netInvoiceTotal) {
                    dynamicStatusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Partially Paid
                      </span>
                    );
                  } else {
                    dynamicStatusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
                        Unpaid
                      </span>
                    );
                  }

                  // Phase 3 Mixed Timeline
                  const timeline = (Array.isArray(row.payment_history) ? row.payment_history : []).sort(
                    (a: any, b: any) => {
                      const timeA = new Date(a.created_at || a.date || a.payment_date || 0).getTime();
                      const timeB = new Date(b.created_at || b.date || b.payment_date || 0).getTime();
                      return timeA - timeB;
                    }
                  );

                  return [
                    /* ─── Parent Row (Living Invoice Summary) ─── */
                    <tr
                      key={rowId}
                      onClick={() => toggleRow(rowId)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(rowId);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-blue-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-blue-600">
                        {isStandalonePayment ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-800 font-semibold">
                            Account Payment
                            <span className="px-2 py-0.5 text-[10px] uppercase font-extrabold bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                              Wallet Deposit
                            </span>
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                              {row.invoice_number}
                              {(row.linked_credit_notes || []).length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-rose-50 text-rose-700 rounded border border-rose-200">
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  {row.linked_credit_notes.length} Return
                                </span>
                              )}
                              {(row.linked_refunds || []).length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-red-50 text-red-700 rounded border border-red-200">
                                  <ArrowDownLeft className="w-2.5 h-2.5" />
                                  {row.linked_refunds.length} Refund
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="font-semibold text-slate-900">{row.customer_name || 'N/A'}</div>
                        {row.customer_code && (
                          <div className="text-xs text-slate-400 font-mono">({row.customer_code})</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-mono text-slate-900">
                        {isStandalonePayment ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <div>
                            <span className={`font-bold ${netInvoiceTotal === 0 ? 'line-through text-slate-400' : ''}`}>
                              {formatCurrency(netInvoiceTotal)}
                            </span>
                            {linkedReturnsTotal > 0 && (
                              <div className="text-[11px] text-slate-400 font-normal">
                                Orig: {formatCurrency(originalTotal)} | Ret: -{formatCurrency(linkedReturnsTotal)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-mono font-bold text-slate-900">
                        {isStandalonePayment ? (
                          formatCurrency(grossPaid)
                        ) : (
                          <div>
                            <span className="text-emerald-700 font-bold">{formatCurrency(netTotalPaid)}</span>
                            {linkedRefundsTotal > 0 && (
                              <div className="text-[11px] text-slate-400 font-normal">
                                Paid: {formatCurrency(grossPaid)} | Rfd: -{formatCurrency(linkedRefundsTotal)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        {dynamicStatusBadge}
                      </td>
                    </tr>,

                    /* ─── Child Row (Phase 3: Nested Mixed Timeline Sub-Table) ─── */
                    isExpanded && (
                      <tr key={`detail-${rowId}`} className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pb-3 border-b border-slate-100">
                              <span className="flex items-center gap-2 text-slate-900 font-bold">
                                <Receipt className="w-4 h-4 text-blue-600" />
                                {isStandalonePayment
                                  ? `Deposit Receipt Details (${timeline.length} transaction)`
                                  : `Living Invoice Timeline & Settlements (${timeline.length} events)`}
                              </span>

                              {!isStandalonePayment && (
                                <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                                  <span className="text-slate-500">
                                    Net Invoice: <strong className="text-slate-900">{formatCurrency(netInvoiceTotal)}</strong>
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-slate-500">
                                    Net Paid: <strong className="text-emerald-700">{formatCurrency(netTotalPaid)}</strong>
                                  </span>
                                  {netTotalPaid > netInvoiceTotal && (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-300">
                                      Overpaid: +{formatCurrency(netTotalPaid - netInvoiceTotal)}
                                    </span>
                                  )}
                                  {canRefund && netTotalPaid > netInvoiceTotal && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRefundTarget({
                                          customer: { id: row.customer_id, name: row.customer_name },
                                          invoiceId: row.invoice_id,
                                          invoiceNumber: row.invoice_number,
                                        });
                                        setIsRefundModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition cursor-pointer"
                                    >
                                      <ArrowDownLeft className="w-3.5 h-3.5" />
                                      Refund Overpayment
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* ─── Inline Line Items Grid (Phase 3) ─── */}
                            {!isStandalonePayment && row.line_items && row.line_items.length > 0 && (
                              <div className="space-y-1.5 pt-1 pb-2">
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  <span>Billed Line Items ({row.line_items.length})</span>
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-semibold border-b border-slate-200">
                                      <tr>
                                        <th className="py-2 px-3">Product Name</th>
                                        <th className="py-2 px-3">Size</th>
                                        <th className="py-2 px-3 text-right">Net Qty</th>
                                        <th className="py-2 px-3 text-right">Unit Price</th>
                                        <th className="py-2 px-3 text-right">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {row.line_items.map((item: any, iIdx: number) => {
                                        const qty = item.net_qty ?? item.quantity ?? 0;
                                        const unit = item.selected_unit ? ` ${item.selected_unit}` : '';
                                        const unitPrice = Number(item.unit_price || 0);
                                        const lineTotal = Number(item.total ?? item.total_price ?? (qty * unitPrice));
                                        return (
                                          <tr key={item.id || iIdx} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-3 font-semibold text-slate-800">
                                              {item.product_name || 'Item'}
                                            </td>
                                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                                              {item.size || item.product_size || '—'}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-medium text-slate-700">
                                              {Number(qty).toLocaleString()}{unit}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                                              {formatCurrency(unitPrice)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                              {formatCurrency(lineTotal)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {timeline.length === 0 ? (
                              <div className="py-4 text-center text-xs text-slate-400 italic">
                                No payment, return, or refund details recorded for this invoice.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-slate-100">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
                                    <tr>
                                      <th className="py-2.5 px-4">Transaction / Ref #</th>
                                      <th className="py-2.5 px-4">Date</th>
                                      <th className="py-2.5 px-4">Event Type & Method</th>
                                      <th className="py-2.5 px-4">Notes / Reference</th>
                                      <th className="py-2.5 px-4 text-right">Polarity & Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {timeline.map((p: any, idx: number) => {
                                      const isCn =
                                        p?.type === 'CREDIT_NOTE' ||
                                        p?.method === 'CREDIT_NOTE' ||
                                        p?.payment_method === 'CREDIT_NOTE' ||
                                        !!p?.credit_note_number;
                                      const isRfd =
                                        p?.type === 'REFUND' ||
                                        p?.method === 'CASH_REFUND' ||
                                        p?.payment_method === 'CASH_REFUND';

                                      const docNo =
                                        p?.credit_note_number ||
                                        p?.payment_no ||
                                        p?.payment_number ||
                                        (isCn ? 'CN-RETURN' : isRfd ? 'RFD-CASH' : 'RCV-N/A');

                                      return (
                                        <tr key={p?.id || idx} className="hover:bg-slate-50/50">
                                          <td className="py-2.5 px-4 font-mono font-semibold">
                                            {isCn ? (
                                              <span className="text-rose-600 flex items-center gap-1">
                                                <RotateCcw className="w-3 h-3" />
                                                {docNo}
                                              </span>
                                            ) : isRfd ? (
                                              <span className="text-red-600 flex items-center gap-1">
                                                <ArrowDownLeft className="w-3 h-3" />
                                                {docNo}
                                              </span>
                                            ) : (
                                              <span className="text-blue-600">{docNo}</span>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-4 text-slate-600 font-mono">
                                            {p?.date || p?.payment_date
                                              ? new Date(p.date || p.payment_date).toLocaleDateString()
                                              : 'N/A'}
                                          </td>
                                          <td className="py-2.5 px-4">
                                            {isCn ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                Goods Return
                                              </span>
                                            ) : isRfd ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                                                Cash Refund
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                Payment ({(p?.method || p?.payment_method || 'CASH').replace('_', ' ')})
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-4 text-slate-500 italic max-w-xs truncate">
                                            {p?.notes || p?.return_reason || '-'}
                                          </td>
                                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                                            {isCn ? (
                                              <span className="text-red-600">
                                                - {formatCurrency(p?.amount || 0)}{' '}
                                                <span className="text-[10px] font-normal text-red-500 uppercase tracking-tight">
                                                  (Goods Returned)
                                                </span>
                                              </span>
                                            ) : isRfd ? (
                                              <span className="text-red-600">
                                                - {formatCurrency(p?.amount || 0)}{' '}
                                                <span className="text-[10px] font-normal text-red-500 uppercase tracking-tight">
                                                  (Cash Refunded to Customer)
                                                </span>
                                              </span>
                                            ) : (
                                              <span className="text-emerald-600">
                                                + {formatCurrency(p?.amount || 0)}
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
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PaymentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          refetch();
        }}
      />

      <CustomerRefundModal
        isOpen={isRefundModalOpen}
        customer={refundTarget?.customer}
        invoiceId={refundTarget?.invoiceId}
        invoiceNumber={refundTarget?.invoiceNumber}
        onClose={() => {
          setIsRefundModalOpen(false);
          setRefundTarget(null);
        }}
        onSuccess={() => {
          setIsRefundModalOpen(false);
          setRefundTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

