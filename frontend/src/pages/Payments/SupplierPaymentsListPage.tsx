import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, HandCoins, ChevronDown, ChevronRight, CheckCircle2, Clock, Receipt } from 'lucide-react';
import { supplierPaymentsService, SupplierPaymentSummary } from '../../services/supplier-payments.service';
import { useAuthStore } from '../../store/auth.store';
import { SupplierPaymentFormModal } from './SupplierPaymentFormModal';
import { Pagination } from '../../components/Common/Pagination';

export default function SupplierPaymentsListPage() {
  const { user, hasPermission } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';
  const canWrite = !isCashier && hasPermission('payments:write');

  const { data: paymentsRes, isLoading, refetch } = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => supplierPaymentsService.getPayments({ limit: 100 }),
  });

  const payments = paymentsRes?.data || [];

  const toggleRow = (purchaseId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [purchaseId]: !prev[purchaseId],
    }));
  };

  const filteredPayments = payments.filter((p: SupplierPaymentSummary) => {
    const term = searchTerm.toLowerCase();
    const matchesInvoice = p.purchase_invoice_number?.toLowerCase().includes(term);
    const matchesSupplier = p.supplier_name?.toLowerCase().includes(term);
    const matchesHistory = p.payment_history?.some(
      (item) =>
        (item.payment_no || item.payment_number || '').toLowerCase().includes(term) ||
        (item.notes || '').toLowerCase().includes(term)
    );
    return matchesInvoice || matchesSupplier || matchesHistory;
  });

  const totalPages = Math.ceil(filteredPayments.length / PAGE_SIZE) || 1;
  const paginatedPayments = filteredPayments.slice(
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

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-xl border-0 py-2.5 pl-10 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all"
              placeholder="Search by invoice #, party, or payment #..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-500 text-sm font-medium">
              Loading aggregated party payments...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <HandCoins className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900">No payment records found</h3>
              <p className="mt-1 text-sm text-slate-500">Get started by recording a new party payment.</p>
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
                  const totalPaid = Number(row.total_paid_against_invoice || 0);
                  const totalInvoice = Number(row.invoice_total_amount || 0);
                  const isFullyPaid = row.invoice_status === 'PAID' || (totalInvoice > 0 && totalPaid >= totalInvoice);
                  const isPartiallyPaid = !isFullyPaid && totalPaid > 0;

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
                        {row.purchase_invoice_number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="font-semibold text-slate-900">{row.supplier_name}</div>
                        {row.supplier_code && (
                          <div className="text-xs text-slate-400 font-mono">({row.supplier_code})</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-mono text-slate-600">
                        {formatCurrency(row.invoice_total_amount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-mono font-bold text-slate-900">
                        {formatCurrency(row.total_paid_against_invoice)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        {isFullyPaid ? (
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

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredPayments.length}
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
    </div>
  );
}
