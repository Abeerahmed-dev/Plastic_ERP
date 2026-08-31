import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, UserX, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getSuppliers, deactivateSupplier } from '../../services/suppliers.service';
import { Supplier } from '../../types/supplier.types';
import { useAuthStore } from '../../store/auth.store';
import SupplierFormModal from './SupplierFormModal';

const LIMIT = 20;

function formatRs(n: number | string) {
  return `Rs. ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export default function SuppliersListPage() {
  const { hasPermission } = useAuthStore();
  const canWrite = hasPermission('suppliers:write');
  const canDelete = hasPermission('suppliers:delete');
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | undefined>();

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer);
    (window as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 350);
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['suppliers', page, debouncedSearch],
    queryFn: () => getSuppliers({ page, limit: LIMIT, search: debouncedSearch || undefined }),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const suppliers = data?.data ?? [];
  const meta = data?.meta;

  const openCreate = () => { setEditTarget(undefined); setModalOpen(true); };
  const openEdit = (s: Supplier) => { setEditTarget(s); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(undefined); };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {meta ? `${meta.total.toLocaleString()} suppliers` : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => refetch()} className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 transition" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
            {canWrite && (
              <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm">
                <Plus className="h-4 w-4" />
                Add Supplier
              </button>
            )}
          </div>
        </div>
        <div className="mt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, phone, or code…"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Code</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Terms</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Outstanding</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                {(canWrite || canDelete) && <th className="px-4 py-3 font-semibold text-gray-600 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="py-16 text-center text-gray-400">Loading suppliers…</td></tr>
              )}
              {isError && (
                <tr><td colSpan={8} className="py-16 text-center text-red-500">Failed to load. <button onClick={() => refetch()} className="underline">Retry</button></td></tr>
              )}
              {!isLoading && !isError && suppliers.length === 0 && (
                <tr><td colSpan={8} className="py-16 text-center text-gray-400">
                  {debouncedSearch ? `No suppliers matching "${debouncedSearch}"` : 'No suppliers yet.'}
                </td></tr>
              )}
              {suppliers.map((s, idx) => (
                <tr key={s.id} className={`border-b border-gray-50 hover:bg-blue-50/40 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-mono font-semibold text-emerald-700">{s.code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.city ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{s.payment_terms}d</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${Number(s.outstanding_payable) > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                      {formatRs(s.outstanding_payable)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {(canWrite || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canWrite && (
                          <button onClick={() => openEdit(s)} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && s.is_active && (
                          <button
                            onClick={() => { if (confirm(`Deactivate ${s.name}?`)) deactivateMutation.mutate(s.id); }}
                            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-red-400 hover:text-red-600 transition" title="Deactivate"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, meta.total)} of {meta.total}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 p-1.5 disabled:opacity-40 hover:bg-gray-50 transition">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-medium">Page {page} / {meta.totalPages}</span>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 p-1.5 disabled:opacity-40 hover:bg-gray-50 transition">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && <SupplierFormModal supplier={editTarget} onClose={closeModal} />}
    </div>
  );
}
