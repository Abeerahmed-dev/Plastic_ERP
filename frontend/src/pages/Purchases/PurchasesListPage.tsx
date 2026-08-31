import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, FileText, ChevronLeft, ChevronRight, RefreshCw, Truck } from 'lucide-react';
import { purchasesService } from '../../services/purchases.service';
import { useAuthStore } from '../../store/auth.store';
import PurchaseFormModal from './PurchaseFormModal';

const LIMIT = 20;

function formatRs(n: number | string) {
  return `Rs. ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export default function PurchasesListPage() {
  const { hasPermission } = useAuthStore();
  const canWrite = hasPermission('purchases:write');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

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

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none px-6 py-6 sm:px-8 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="h-6 w-6 text-emerald-600" />
              Purchases
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {meta ? `${meta.total.toLocaleString()} purchase invoices` : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {canWrite && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                New Purchase
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by invoice number or supplier..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 sm:px-8">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-slate-500">Loading purchases...</div>
        ) : isError ? (
          <div className="flex h-32 items-center justify-center text-red-500">Failed to load purchases.</div>
        ) : invoices.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
            <FileText className="h-10 w-10 text-slate-400 mb-2" />
            <span className="text-slate-500 font-medium">No purchase invoices found</span>
            {canWrite && (
              <button onClick={() => setModalOpen(true)} className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium text-sm">
                Create your first purchase invoice
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Invoice #</th>
                    <th className="px-6 py-4 font-semibold">Supplier</th>
                    <th className="px-6 py-4 font-semibold text-right">Total Amount</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{inv.invoice_number}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{inv.supplier_name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">{formatRs(inv.total_amount)}</td>
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
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50">
                <p className="text-sm text-slate-500">
                  Showing <span className="font-medium">{(meta.page - 1) * meta.limit + 1}</span> to <span className="font-medium">{Math.min(meta.page * meta.limit, meta.total)}</span> of <span className="font-medium">{meta.total}</span> results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 transition"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-medium text-slate-700">
                    Page {page} of {meta.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                    disabled={page === meta.totalPages}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 transition"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <PurchaseFormModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
