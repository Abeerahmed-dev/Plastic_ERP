import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, FileText, ChevronLeft, ChevronRight, RefreshCw, Truck } from 'lucide-react';
import { purchasesService } from '../../services/purchases.service';
import { useAuthStore } from '../../store/auth.store';
import PurchaseFormModal from './PurchaseFormModal';
import InvoiceDetailModal, { InvoiceDetailData } from '../../components/InvoiceDetailModal';
import { Pagination } from '../../components/Common/Pagination';

const LIMIT = 20;

function formatRs(n: number | string) {
  return `Rs. ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export default function PurchasesListPage() {
  const { user, hasPermission } = useAuthStore();
  const userRole = (user?.roleName || user?.role || '').toUpperCase();
  const isOwner = userRole === 'OWNER' || userRole === 'ADMIN';
  const isCashier = userRole === 'CASHIER';
  const canWrite = isCashier || isOwner || hasPermission('purchases:write');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetailData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

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

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._searchTimer);
    (window as any)._searchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchases', page, debouncedSearch],
    queryFn: () => purchasesService.getInvoices({ page, limit: LIMIT, search: debouncedSearch }),
    staleTime: 30000,
  });

  const invoices = data?.data || [];
  const meta = data?.meta;

  const handleOpenInvoice = async (id: string) => {
    try {
      const detail = await purchasesService.getInvoice(id);
      setSelectedInvoice(detail as any);
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
        {canWrite && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-all gap-2"
          >
            <Plus className="h-5 w-5" />
            New Purchasing
          </button>
        )}
      </div>

      {/* Search & Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by invoice number or supplier..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition shadow-sm"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
          title="Refresh List"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
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
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white border border-slate-200 text-center">
          <FileText className="h-12 w-12 text-slate-300 mb-3" />
          <span className="text-slate-500 font-medium">No purchasing records found</span>
          {canWrite && (
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
                  <th className="px-6 py-4 font-semibold">Party</th>
                  {!isCashier && <th className="px-6 py-4 font-semibold text-right">Total Amount</th>}
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <button
                          onClick={() => handleOpenInvoice(inv.id)}
                          className="flex items-center text-left group p-1.5 -ml-1.5 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer"
                          title="Click to view purchase invoice details"
                        >
                          <div className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-200 group-hover:scale-105 transition-all shadow-xs">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-bold text-slate-900 group-hover:text-purple-700 group-hover:underline font-mono">
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
                    {!isCashier && (
                      <td className="px-6 py-4 text-right font-medium text-slate-900">{formatRs(inv.total_amount)}</td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        inv.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
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
          onClose={() => setModalOpen(false)}
          onSuccess={() => refetch()}
        />
      )}

      <InvoiceDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        invoice={selectedInvoice}
        type="purchase"
      />
    </div>
  );
}
