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
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { supplierPaymentsService } from '../../services/supplier-payments.service';
import { useAuthStore } from '../../store/auth.store';
import { SupplierPaymentFormModal } from './SupplierPaymentFormModal';
import { ProcessPurchaseReturnModal } from './ProcessPurchaseReturnModal';
import { CascadingFilterBar } from '../../components/CascadingFilterBar';
import { useCascadingFilters } from '../../hooks/useCascadingFilters';
import { Pagination } from '../../components/Common/Pagination';

export default function SupplierPaymentsListPage() {
  const { user, hasPermission } = useAuthStore();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [returnInvoiceId, setReturnInvoiceId] = useState<string | null>(null);

  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';
  const canWrite = !isCashier && hasPermission('payments:write');
  const canReturn = !isCashier;

  const { data: paymentsRes, isLoading, refetch } = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => supplierPaymentsService.getPayments({ limit: 100 }),
  });

  const payments = paymentsRes?.data || [];

  const [statusFilter, setStatusFilter] = useState<string>('All');

  const toggleRow = (purchaseId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [purchaseId]: !prev[purchaseId],
    }));
  };

  const normalizedPayments = useMemo(() => {
    return payments
      // ── Phase 3: Filter the top-level table rows: Hide Debit Notes ──
      .filter((row: any) => {
        if (row.invoice_type === 'DEBIT_NOTE') return false;
        return true;
      })
      .map((p: any) => {
        const isAccountDeposit =
          p.invoice_type === 'ACCOUNT_PAYMENT' ||
          !p.purchase_invoice_id ||
          p.purchase_invoice_number === 'Account Payment';

        // ── Phase 3: Dynamically calculate Living Invoice Totals ──
        const linkedReturnsTotal = (p.linked_debit_notes || []).reduce(
          (sum: number, dn: any) => sum + Math.abs(Number(dn.amount || dn.total_amount || 0)),
          0
        );
        const originalTotal = Number(p.original_total ?? p.invoice_total_amount ?? 0);
        const netInvoiceTotal = Math.max(0, originalTotal - linkedReturnsTotal);
        const netTotalPaid = Number(p.total_paid_against_invoice ?? p.total_paid ?? 0);

        // ── Phase 3: Map Dynamic Statuses ──
        let dynamic_status = 'Unpaid';
        if (isAccountDeposit) {
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
          city: p.city || p.supplier_city || null,
          name: p.supplier_name || p.name || '',
          invoice_number: p.purchase_invoice_number || p.invoice_number || '',
          original_total: originalTotal,
          linked_returns_total: linkedReturnsTotal,
          net_invoice_total: netInvoiceTotal,
          net_total_paid: netTotalPaid,
          dynamic_status,
        };
      });
  }, [payments]);

  // Cascading filters hook
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
  } = useCascadingFilters(normalizedPayments);

  // Strict multi-condition filter including dynamic status
  const filteredTableRows = useMemo(() => {
    return normalizedPayments.filter((row: any) => {
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
  }, [normalizedPayments, selectedCity, selectedName, selectedInvoice, statusFilter]);

  const totalPages = Math.ceil(filteredTableRows.length / PAGE_SIZE) || 1;
  const paginatedPayments = filteredTableRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Party Payments Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">
            Invoice-aggregated payment summaries with partial settlement transaction timelines and debit notes.
          </p>
        </div>
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
          nameLabel="Supplier"
          namePlaceholder="Filter by supplier…"
          invoiceLabel="Purchase Invoice #"
          invoicePlaceholder="Filter by purchase invoice #…"
        />
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-500 text-sm font-medium">
              Loading aggregated party payments...
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
                  : 'Get started by recording a new party payment.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Invoice #</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Party</th>
                  <th className="px-6 py-3.5 text-right text-sm font-semibold text-slate-900">Invoice Total</th>
                  <th className="px-6 py-3.5 text-right text-sm font-semibold text-slate-900">Total Paid</th>
                  <th className="px-6 py-3.5 text-center text-sm font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedPayments.flatMap((row) => {
                  const isExpanded = !!expandedRows[row.purchase_id];
                  const isAccountDeposit =
                    row.invoice_type === 'ACCOUNT_PAYMENT' ||
                    !row.purchase_invoice_id ||
                    row.invoice_number === 'Account Payment';

                  const linkedReturnsTotal = Number(row.linked_returns_total || 0);
                  const originalTotal = Number(row.original_total ?? row.invoice_total_amount ?? 0);
                  const netInvoiceTotal = Number(row.net_invoice_total ?? Math.max(0, originalTotal - linkedReturnsTotal));
                  const netTotalPaid = Number(row.net_total_paid ?? row.total_paid_against_invoice ?? 0);

                  // Dynamic Status Badge
                  let dynamicStatusBadge = null;
                  if (isAccountDeposit) {
                    dynamicStatusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        WALLET DEPOSIT
                      </span>
                    );
                  } else if (netInvoiceTotal === 0) {
                    dynamicStatusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                        Dead / Fully Returned
                      </span>
                    );
                  } else if (netTotalPaid > netInvoiceTotal) {
                    dynamicStatusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        Overpaid
                      </span>
                    );
                  } else if (netTotalPaid === netInvoiceTotal && netInvoiceTotal > 0) {
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

                  // Mixed timeline sorted chronologically
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
                      key={row.purchase_id}
                      onClick={() => toggleRow(row.purchase_id)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(row.purchase_id);
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
                        {isAccountDeposit ? (
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
                              {(row.linked_debit_notes || []).length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-rose-50 text-rose-700 rounded border border-rose-200">
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  {row.linked_debit_notes.length} Return
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="font-semibold text-slate-900">{row.supplier_name}</div>
                        {row.supplier_code && (
                          <div className="text-xs text-slate-400 font-mono">({row.supplier_code})</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-mono text-slate-900">
                        {isAccountDeposit ? (
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
                        {isAccountDeposit ? (
                          formatCurrency(netTotalPaid)
                        ) : (
                          <div>
                            <span className="text-emerald-700 font-bold">{formatCurrency(netTotalPaid)}</span>
                            {netTotalPaid > netInvoiceTotal && (
                              <div className="text-[11px] text-amber-600 font-semibold">
                                Overpaid: +{formatCurrency(netTotalPaid - netInvoiceTotal)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        {dynamicStatusBadge}
                      </td>
                    </tr>,

                    /* ─── Child Row (Accordion Drill-Down Sub-Table) ─── */
                    isExpanded && (
                      <tr key={`detail-${row.purchase_id}`} className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pb-3 border-b border-slate-100">
                              <span className="flex items-center gap-2 text-slate-900 font-bold">
                                <Receipt className="w-4 h-4 text-blue-600" />
                                {isAccountDeposit
                                  ? `Deposit Receipt Details (${timeline.length} transaction)`
                                  : `Living Invoice Timeline & Settlements (${timeline.length} events)`}
                              </span>

                              {!isAccountDeposit && (
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

                                  {/* Action: Initiate Purchase Return */}
                                  {canReturn && netInvoiceTotal > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReturnInvoiceId(row.purchase_invoice_id);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      Return Goods / Debit Note
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Line Items Grid */}
                            {!isAccountDeposit && row.line_items && row.line_items.length > 0 && (
                              <div className="space-y-1.5 pt-1 pb-2">
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  <span>Purchased Line Items ({row.line_items.length})</span>
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

                            {/* ─── Phase 3: Nested Timeline Sub-Table with Red Debit Notes ─── */}
                            {timeline.length === 0 ? (
                              <div className="py-4 text-center text-xs text-slate-400 italic">
                                No payment or return details recorded for this invoice.
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
                                      const isDebitNote =
                                        p?.type === 'DEBIT_NOTE' ||
                                        p?.method === 'DEBIT_NOTE' ||
                                        p?.payment_method === 'DEBIT_NOTE' ||
                                        !!p?.debit_note_number;

                                      const docNo =
                                        p?.debit_note_number ||
                                        p?.payment_no ||
                                        p?.payment_number ||
                                        (isDebitNote ? 'DN-RETURN' : 'PAY-OUT');

                                      return (
                                        <tr key={p?.id || idx} className="hover:bg-slate-50/50">
                                          <td className="py-2.5 px-4 font-mono font-semibold">
                                            {isDebitNote ? (
                                              <span className="text-rose-600 flex items-center gap-1">
                                                <RotateCcw className="w-3 h-3" />
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
                                            {isDebitNote ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                Goods Return (Debit Note)
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
                                            {/* Phase 3: Display red Debit Notes (e.g. - Rs 10,000 (Goods Returned to Supplier)) */}
                                            {isDebitNote ? (
                                              <span className="text-red-600">
                                                - {formatCurrency(p?.amount || 0)}{' '}
                                                <span className="text-[10px] font-normal text-red-500 uppercase tracking-tight">
                                                  (Goods Returned to Supplier)
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

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTableRows.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {isModalOpen && (
        <SupplierPaymentFormModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => refetch()}
        />
      )}

      {returnInvoiceId && (
        <ProcessPurchaseReturnModal
          parentInvoiceId={returnInvoiceId}
          isOpen={!!returnInvoiceId}
          onClose={() => setReturnInvoiceId(null)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
