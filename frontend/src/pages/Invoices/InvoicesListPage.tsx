import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText, RotateCcw } from 'lucide-react';
import { invoicesService } from '../../services/invoices.service';
import { useAuthStore } from '../../store/auth.store';
import { InvoiceFormModal } from './InvoiceFormModal';
import { ProcessReturnModal } from './ProcessReturnModal';
import InvoiceDetailModal, { InvoiceDetailData } from '../../components/InvoiceDetailModal';
import { CascadingFilterBar } from '../../components/CascadingFilterBar';
import { useCascadingFilters } from '../../hooks/useCascadingFilters';
import { RecordPaymentModal } from '../../components/Modals/RecordPaymentModal';
import { getCustomers } from '../../services/customers.service';
import { Pagination } from '../../components/Common/Pagination';

export default function InvoicesListPage() {
  const { user, hasPermission } = useAuthStore();
  const userRole = (user?.roleName || user?.role || '').toUpperCase();
  const isCashier = userRole === 'CASHIER';
  const isOwner = userRole === 'OWNER' || userRole === 'ADMIN';

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [detailModalInvoice, setDetailModalInvoice] = useState<InvoiceDetailData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [returnInvoiceId, setReturnInvoiceId] = useState<string | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  const canWrite = isCashier || isOwner || hasPermission('customers:write') || hasPermission('sales:write');

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesService.getInvoices,
  });

  const { data: customersResponse } = useQuery({
    queryKey: ['customers', { page: 1, limit: 100 }],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    staleTime: 30000,
  });
  const customersList = customersResponse?.data || [];

  const handleOpenInvoice = async (id: string) => {
    try {
      const detail = await invoicesService.getInvoice(id);
      setDetailModalInvoice(detail as any);
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch invoice details:', err);
    }
  };

  const handleInitiateReturn = (id: string) => {
    setReturnInvoiceId(id);
    setIsReturnModalOpen(true);
  };

  const normalizedInvoices = useMemo(() => {
    return invoices.map((inv: any) => ({
      ...inv,
      city: inv.city || inv.customer_city || null,
      name: inv.customer_name || inv.name || '',
      invoice_number: inv.invoice_number || '',
    }));
  }, [invoices]);

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
  } = useCascadingFilters(normalizedInvoices);

  // Phase 3: Strict multi-condition filter before rendering
  const filteredTableRows = useMemo(() => {
    return normalizedInvoices.filter((row: any) => {
      const matchesCity = selectedCity ? row.city === selectedCity : true;
      const matchesName = selectedName ? row.name === selectedName : true;
      const matchesInvoice = selectedInvoice ? row.invoice_number === selectedInvoice : true;
      return matchesCity && matchesName && matchesInvoice;
    });
  }, [normalizedInvoices, selectedCity, selectedName, selectedInvoice]);

  const totalPages = Math.ceil(filteredTableRows.length / PAGE_SIZE) || 1;
  const paginatedInvoices = filteredTableRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2,
    }).format(Number(val));
  };

  const renderCreatorBadge = (invoice: any) => {
    const role = (invoice.created_by_role || invoice.creator?.role || 'ADMIN').toUpperCase();
    const name = invoice.created_by_name || invoice.creator?.name || 'User';

    if (role === 'CASHIER') {
      return (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200" title={`Issued by Cashier: ${name}`}>
          Cashier
        </span>
      );
    }
    if (role === 'OWNER') {
      return (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200" title={`Issued by Owner: ${name}`}>
          Owner
        </span>
      );
    }
    return (
      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200" title={`Issued by Admin: ${name}`}>
        Admin
      </span>
    );
  };

  const getStatusBadge = (invoice: any) => {
    const isCreditNote = (invoice as any).invoice_type === 'CREDIT_NOTE' || invoice.invoice_number?.startsWith('CN-') || Number(invoice.total_amount) < 0;
    if (isCreditNote) {
      return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-800 border border-red-300">CREDIT NOTE</span>;
    }

    if (invoice.balance_due !== undefined && Number(invoice.balance_due) < 0) {
      return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">OVERPAID</span>;
    }

    const totalAmt = Number(invoice.total_amount || 0);
    const paidAmt = Number(invoice.paid_amount || 0);
    if (totalAmt > 0 && paidAmt >= totalAmt) {
      return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">Paid</span>;
    }

    switch (invoice.status) {
      case 'PAID':
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">Paid</span>;
      case 'PARTIAL':
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">Partial</span>;
      case 'UNPAID':
        return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">Unpaid</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 border border-slate-200">{invoice.status}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Invoices & Credit Notes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create sales invoices and process strict invoice-anchored returns (Credit Notes).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPaymentModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all cursor-pointer"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Record Payment
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Create Invoice
            </button>
          )}
        </div>
      </div>

      {/* Cascading Filter Bar */}
      <div className="mb-6">
        <CascadingFilterBar
          selectedCity={selectedCity}
          selectedName={selectedName}
          selectedInvoice={selectedInvoice}
          onCityChange={(c) => { setSelectedCity(c); setCurrentPage(1); }}
          onNameChange={(n) => { setSelectedName(n); setCurrentPage(1); }}
          onInvoiceChange={(inv) => { setSelectedInvoice(inv); setCurrentPage(1); }}
          availableCities={availableCities}
          availableNames={availableNames}
          availableInvoices={availableInvoices}
          onReset={() => { resetFilters(); setCurrentPage(1); }}
          showInvoice={true}
          nameLabel="Customer"
          namePlaceholder="Filter by customer…"
        />
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Invoice / Credit Note
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Billed By
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                {!isCashier && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Balance Due
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={isCashier ? 7 : 8} className="px-6 py-12 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <span className="mt-2">Loading invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTableRows.length === 0 ? (
                <tr>
                  <td colSpan={isCashier ? 7 : 8} className="px-6 py-12 text-center text-sm text-slate-500">
                    {selectedCity || selectedName || selectedInvoice
                      ? 'No invoices match the active cascading filters. Try resetting filters.'
                      : 'No invoices found.'}
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => {
                  const isCreditNote = (invoice as any).invoice_type === 'CREDIT_NOTE' || invoice.invoice_number?.startsWith('CN-') || Number(invoice.total_amount) < 0;
                  const balanceDue = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0));

                  return (
                    <tr
                      key={invoice.id}
                      className={`transition-colors ${
                        isCreditNote ? 'bg-red-50/70 border-l-4 border-l-red-500' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => handleOpenInvoice(invoice.id)}
                            className="flex items-center text-left group p-1.5 -ml-1.5 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer"
                            title="Click to view detailed line items"
                          >
                            <div className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl group-hover:scale-105 transition-all shadow-xs ${
                              isCreditNote ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {isCreditNote ? <RotateCcw className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                            </div>
                            <div className="ml-3">
                              <div className={`text-sm font-bold font-mono group-hover:underline flex items-center ${
                                isCreditNote ? 'text-red-900 group-hover:text-red-700' : 'text-slate-900 group-hover:text-purple-700'
                              }`}>
                                {invoice.invoice_number}
                              </div>
                              <div className="text-[10px] text-purple-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                View details →
                              </div>
                            </div>
                          </button>
                          {isOwner && renderCreatorBadge(invoice)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{invoice.customer_name}</div>
                        <div className="text-xs text-slate-500">{invoice.customer_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-800">
                            {invoice.creator?.name || invoice.created_by_name || 'System'}
                          </span>
                          {isOwner && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {invoice.created_by_role || invoice.creator?.role || 'Staff'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {new Date(invoice.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isCreditNote ? 'text-red-700 font-bold font-mono' : 'text-slate-900'}`}>
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      {!isCashier && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-rose-600">
                          {formatCurrency(balanceDue)}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(invoice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                        {!isCreditNote && canWrite && (
                          <button
                            onClick={() => handleInitiateReturn(invoice.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-all active:scale-95 shadow-2xs"
                            title="Process Sales Return & Issue Credit Note"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                            Return
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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

      <InvoiceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          refetch();
        }}
      />

      <InvoiceDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        invoice={detailModalInvoice}
        type="sales"
        onProcessReturn={(invId) => handleInitiateReturn(invId)}
      />

      {returnInvoiceId && (
        <ProcessReturnModal
          parentInvoiceId={returnInvoiceId}
          isOpen={isReturnModalOpen}
          onClose={() => {
            setIsReturnModalOpen(false);
            setReturnInvoiceId(null);
          }}
          onSuccess={() => {
            refetch();
          }}
        />
      )}

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        type="CUSTOMER"
        entityType="customer"
        customers={customersList}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}

