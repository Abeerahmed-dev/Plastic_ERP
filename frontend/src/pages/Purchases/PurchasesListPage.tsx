import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText, ChevronLeft, ChevronRight, RefreshCw, Truck } from 'lucide-react';
import { purchasesService } from '../../services/purchases.service';
import { useAuthStore } from '../../store/auth.store';
import PurchaseFormModal from './PurchaseFormModal';
import InvoiceDetailModal, { InvoiceDetailData } from '../../components/InvoiceDetailModal';
import { CascadingFilterBar } from '../../components/CascadingFilterBar';
import { useCascadingFilters } from '../../hooks/useCascadingFilters';
import ProcessPurchaseReturnModal from '../Payments/ProcessPurchaseReturnModal';
import { RecordPaymentModal } from '../../components/Modals/RecordPaymentModal';
import { getSuppliers } from '../../services/suppliers.service';
import { Pagination } from '../../components/Common/Pagination';

const LIMIT = 100;

function formatRs(n: number | string) {
  return `Rs. ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export default function PurchasesListPage() {
  const { user, hasPermission } = useAuthStore();
  const userRole = (user?.roleName || user?.role || '').toUpperCase();
  const isOwner = userRole === 'OWNER' || userRole === 'ADMIN';
  const isCashier = userRole === 'CASHIER';
  const canWrite = isCashier || isOwner || hasPermission('purchases:write');

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [prefillProductId, setPrefillProductId] = useState<string | undefined>(undefined);

  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [detailModalInvoice, setDetailModalInvoice] = useState<InvoiceDetailData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnInvoiceId, setReturnInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    const orderProduct = searchParams.get('orderProduct') || (location.state as any)?.prefillVariantId;
    if (orderProduct) {
      setPrefillProductId(orderProduct);
      setModalOpen(true);
    }
  }, [searchParams, location.state]);

  const handleProcessReturn = (invoiceId: string) => {
    setReturnInvoiceId(invoiceId);
    setReturnModalOpen(true);
  };

  const renderCreatorBadge = (inv: any) => {
    const role = (inv.created_by_role || inv.creator?.role || 'ADMIN').toUpperCase();
    const name = inv.created_by_name || inv.creator?.name || 'User';

    if (role === 'CASHIER') {
      return (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200" title={`Created by Cashier: ${name}`}>
          Cashier
        </span>
      );
    }
    if (role === 'OWNER') {
      return (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200" title={`Created by Owner: ${name}`}>
          Owner
        </span>
      );
    }
    return (
      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200" title={`Created by Admin: ${name}`}>
        Admin
      </span>
    );
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchases', page],
    queryFn: () => purchasesService.getInvoices({ page, limit: LIMIT }),
    staleTime: 30000,
  });

  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers({ limit: 100 }),
    staleTime: 30000,
  });
  const suppliersList = suppliersResponse?.data || [];

  const invoices = data?.data || [];
  const meta = data?.meta;

  const normalizedInvoices = useMemo(() => {
    return invoices.map((inv: any) => ({
      ...inv,
      city: inv.city || inv.supplier_city || null,
      name: inv.supplier_name || inv.name || '',
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

  const handleOpenInvoice = async (id: string) => {
    try {
      const detail = await purchasesService.getInvoice(id);
      setDetailModalInvoice(detail as any);
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch purchase invoice details:', err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-purple-600" />
            Purchasing
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track inventory stock arrivals and supplier purchase bills. Click purple document icon to view details.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPaymentModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all cursor-pointer gap-2"
          >
            <Plus className="h-5 w-5 text-slate-500" />
            Record Payment
          </button>
          {canWrite && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 transition-all gap-2 cursor-pointer"
            >
              <Plus className="h-5 w-5 text-slate-950" />
              New Purchasing
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
          onCityChange={setSelectedCity}
          onNameChange={setSelectedName}
          onInvoiceChange={setSelectedInvoice}
          availableCities={availableCities}
          availableNames={availableNames}
          availableInvoices={availableInvoices}
          onReset={resetFilters}
          showInvoice={true}
          nameLabel="Supplier"
          namePlaceholder="Filter by supplier…"
          invoiceLabel="Purchase Invoice #"
          invoicePlaceholder="Filter by purchase invoice #…"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-white border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-600 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500 font-medium">Loading purchasing records...</p>
        </div>
      ) : isError ? (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center">
          <p className="text-sm font-medium text-red-800">Failed to load purchasing records.</p>
          <button onClick={() => refetch()} className="mt-2 text-xs font-semibold text-red-600 hover:underline">
            Try again
          </button>
        </div>
      ) : filteredTableRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white border border-slate-200 text-center">
          <FileText className="h-12 w-12 text-slate-300 mb-3" />
          <span className="text-slate-500 font-medium">
            {selectedCity || selectedName || selectedInvoice
              ? 'No purchase invoices match the active cascading filters. Try resetting filters.'
              : 'No purchase invoices found'}
          </span>
          {canWrite && !selectedCity && !selectedName && !selectedInvoice && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-semibold"
            >
              Create your first purchasing record
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">Invoice #</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Party / Supplier</th>
                  <th className="px-6 py-4 font-semibold">Billed By</th>
                  {!isCashier && <th className="px-6 py-4 font-semibold text-right">Total Amount</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTableRows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <button
                          onClick={() => handleOpenInvoice(inv.id)}
                          className="flex items-center text-left group p-1.5 -ml-1.5 rounded-xl hover:bg-purple-50 hover:dark:bg-purple-950/40 hover:dark:ring-1 hover:dark:ring-purple-500/30 transition-colors cursor-pointer"
                          title="Click to view purchase invoice details"
                        >
                          <div className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-200 dark:bg-purple-950/60 dark:text-purple-400 group-hover:dark:bg-purple-900/60 group-hover:scale-105 transition-all shadow-xs">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-bold text-slate-900 group-hover:text-purple-700 dark:text-white group-hover:dark:text-purple-300 group-hover:underline font-mono">
                              {inv.invoice_number}
                            </div>
                          </div>
                        </button>
                        {isOwner && renderCreatorBadge(inv)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{inv.supplier_name || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-800">
                          {inv.creator?.name || inv.created_by_name || 'System'}
                        </span>
                        {isOwner && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            {inv.created_by_role || inv.creator?.role || 'Staff'}
                          </span>
                        )}
                      </div>
                    </td>
                    {!isCashier && (
                      <td className="px-6 py-4 text-right font-medium text-slate-900">{formatRs(inv.total_amount)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && (
            <Pagination
              currentPage={page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              pageSize={LIMIT}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {modalOpen && (
        <PurchaseFormModal
          initialProductId={prefillProductId}
          onClose={() => {
            setModalOpen(false);
            setPrefillProductId(undefined);
            if (searchParams.has('orderProduct')) {
              searchParams.delete('orderProduct');
              setSearchParams(searchParams, { replace: true });
            }
          }}
          onSuccess={() => {
            refetch();
            setPrefillProductId(undefined);
            if (searchParams.has('orderProduct')) {
              searchParams.delete('orderProduct');
              setSearchParams(searchParams, { replace: true });
            }
          }}
        />
      )}

      <InvoiceDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        invoice={detailModalInvoice}
        type="purchase"
        onProcessReturn={canWrite ? handleProcessReturn : undefined}
      />

      {returnModalOpen && returnInvoiceId && (
        <ProcessPurchaseReturnModal
          parentInvoiceId={returnInvoiceId}
          onClose={() => {
            setReturnModalOpen(false);
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
        type="SUPPLIER"
        entityType="supplier"
        suppliers={suppliersList}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}
