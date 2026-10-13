import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, HandCoins, ChevronDown, ChevronRight, CheckCircle2, Clock, Receipt } from 'lucide-react';
import { supplierPaymentsService } from '../../services/supplier-payments.service';
import { useAuthStore } from '../../store/auth.store';
import { SupplierPaymentFormModal } from './SupplierPaymentFormModal';
import { CascadingFilterBar } from '../../components/CascadingFilterBar';
import { useCascadingFilters } from '../../hooks/useCascadingFilters';

export default function SupplierPaymentsListPage() {
  const { user, hasPermission } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';
  const canWrite = !isCashier && hasPermission('payments:write');

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
    return payments.map((p: any) => {
      const totalPaid = Number(p.total_paid_against_invoice || 0);
      const totalInvoice = Number(p.invoice_total_amount || 0);
      const isAccountDeposit = p.invoice_type === 'ACCOUNT_PAYMENT' || !p.purchase_invoice_id;
      const isDead = !isAccountDeposit && totalInvoice === 0;
      const isOverpaid = !isAccountDeposit && totalInvoice > 0 && totalPaid > totalInvoice;
      const isFullyPaid = !isAccountDeposit && !isOverpaid && (p.invoice_status === 'PAID' || (totalInvoice > 0 && totalPaid >= totalInvoice));
      const isPartiallyPaid = !isAccountDeposit && !isFullyPaid && !isOverpaid && totalPaid > 0;

      let dynamic_status = 'Unpaid';
      if (isAccountDeposit) {
        dynamic_status = 'Wallet Deposit';
      } else if (isDead) {
        dynamic_status = 'Dead';
      } else if (isOverpaid) {
        dynamic_status = 'Overpaid';
      } else if (isFullyPaid) {
        dynamic_status = 'Fully Paid';
      } else if (isPartiallyPaid) {
        dynamic_status = 'Partially Paid';
      } else {
        dynamic_status = 'Unpaid';
      }

      return {
        ...p,
        city: p.city || p.supplier_city || null,
        name: p.supplier_name || p.name || '',
        invoice_number: p.purchase_invoice_number || p.invoice_number || '',
        dynamic_status,
      };
    });
  }, [payments]);

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
  } = useCascadingFilters(normalizedPayments);

  // Phase 2 & 3: Strict multi-condition filter including dynamic status
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supplier Payments Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">
            Invoice-aggregated payment summaries with partial settlement transaction timelines.
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
              Loading aggregated supplier payments...
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
                  : 'Get started by recording a new supplier payment.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Invoice #</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Supplier</th>
                  <th className="px-6 py-3.5 text-right text-sm font-semibold text-slate-900">Invoice Total</th>
                  <th className="px-6 py-3.5 text-right text-sm font-semibold text-slate-900">Total Paid</th>
                  <th className="px-6 py-3.5 text-center text-sm font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredTableRows.flatMap((row) => {
                  const isExpanded = !!expandedRows[row.purchase_id];
                  const totalPaid = Number(row.total_paid_against_invoice || 0);
                  const totalInvoice = Number(row.invoice_total_amount || 0);
                  const isAccountDeposit = (row as any).invoice_type === 'ACCOUNT_PAYMENT' || !row.purchase_invoice_id;
                  const isFullyPaid = !isAccountDeposit && (row.invoice_status === 'PAID' || (totalInvoice > 0 && totalPaid >= totalInvoice));
                  const isPartiallyPaid = !isAccountDeposit && !isFullyPaid && totalPaid > 0;

                  return [
                    /* ─── Parent Row (Invoice Summary) ─── */
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
                          <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                            Account Payment
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ACCOUNT DEPOSIT
                            </span>
                          </span>
                        ) : (
                          row.purchase_invoice_number
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="font-semibold text-slate-900">{row.supplier_name}</div>
                        {row.supplier_code && (
                          <div className="text-xs text-slate-400 font-mono">({row.supplier_code})</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-mono text-slate-600">
                        {isAccountDeposit ? '-' : formatCurrency(row.invoice_total_amount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-mono font-bold text-slate-900">
                        {formatCurrency(row.total_paid_against_invoice)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        {isAccountDeposit ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            WALLET DEPOSIT
                          </span>
                        ) : isFullyPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Fully Paid
                          </span>
                        ) : isPartiallyPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Partially Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
                            Unpaid
                          </span>
                        )}
                      </td>
                    </tr>,

                    /* ─── Child Row (Accordion Drill-Down Sub-Table) ─── */
                    isExpanded && (
                      <tr key={`detail-${row.purchase_id}`} className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
                              <span className="flex items-center gap-2 text-slate-900">
                                <Receipt className="w-4 h-4 text-blue-600" />
                                Partial Payment History Timeline ({row.payment_history.length} transactions)
                              </span>
                              <span className="text-slate-500 font-normal">
                                Total Settled: <strong className="text-slate-900 font-mono">{formatCurrency(row.total_paid_against_invoice)}</strong>
                              </span>
                            </div>

                            {/* ─── Inline Line Items Grid (Phase 3) ─── */}
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

                            {row.payment_history.length === 0 ? (
                              <div className="py-4 text-center text-xs text-slate-400 italic">
                                No payment details recorded for this invoice.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-slate-100">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
                                    <tr>
                                      <th className="py-2.5 px-4">Payment #</th>
                                      <th className="py-2.5 px-4">Date</th>
                                      <th className="py-2.5 px-4">Payment Method</th>
                                      <th className="py-2.5 px-4">Notes / Reference</th>
                                      <th className="py-2.5 px-4 text-right">Amount (PKR)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {row.payment_history.map((p) => (
                                      <tr key={p.id} className="hover:bg-slate-50/50">
                                        <td className="py-2.5 px-4 font-mono font-semibold text-blue-600">
                                          {p.payment_no || p.payment_number}
                                        </td>
                                        <td className="py-2.5 px-4 text-slate-600 font-mono">
                                          {new Date(p.date || p.payment_date || '').toLocaleDateString()}
                                        </td>
                                        <td className="py-2.5 px-4">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                            {(p.method || p.payment_method || 'CASH').replace('_', ' ')}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-4 text-slate-500 italic max-w-xs truncate">
                                          {p.notes || '-'}
                                        </td>
                                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                                          {formatCurrency(p.amount)}
                                        </td>
                                      </tr>
                                    ))}
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

      {isModalOpen && (
        <SupplierPaymentFormModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
