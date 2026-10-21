import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, UserX, ChevronLeft, ChevronRight, RefreshCw, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { getSuppliers, deactivateSupplier } from '../../services/suppliers.service';
import { Supplier } from '../../types/supplier.types';
import { useAuthStore } from '../../store/auth.store';
import SupplierFormModal from './SupplierFormModal';
import { LogAdvanceDepositModal } from '../../components/Modals/LogAdvanceDepositModal';
import { ProcessCashRefundModal } from '../../components/Modals/ProcessCashRefundModal';
import { CascadingFilterBar } from '../../components/CascadingFilterBar';
import { useCascadingFilters } from '../../hooks/useCascadingFilters';

const LIMIT = 100;

function formatRs(n: number | string) {
  return `Rs. ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export default function SuppliersListPage() {
  const { user, hasPermission } = useAuthStore();
  const userRole = (user?.roleName || user?.role || '').toUpperCase();
  const isCashier = userRole === 'CASHIER';
  const canWrite = isCashier || userRole === 'OWNER' || userRole === 'ADMIN' || hasPermission('suppliers:write');
  const canDelete = !isCashier && (userRole === 'OWNER' || userRole === 'ADMIN' || hasPermission('suppliers:delete'));
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | undefined>();
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceTargetSupplier, setAdvanceTargetSupplier] = useState<Supplier | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundTargetSupplier, setRefundTargetSupplier] = useState<Supplier | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['suppliers', page],
    queryFn: () => getSuppliers({ page, limit: LIMIT }),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const suppliers = data?.data ?? [];
  const meta = data?.meta;

  const normalizedSuppliers = useMemo(() => {
    return suppliers.map((s) => ({
      ...s,
      city: s.city || null,
      name: s.name || '',
      invoice_number: null,
    }));
  }, [suppliers]);

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
    resetFilters,
  } = useCascadingFilters(normalizedSuppliers);

  // Phase 3: Strict multi-condition filter before rendering
  const filteredTableRows = useMemo(() => {
    return normalizedSuppliers.filter((row: any) => {
      const matchesCity = selectedCity ? row.city === selectedCity : true;
      const matchesName = selectedName ? row.name === selectedName : true;
      const matchesInvoice = selectedInvoice ? row.invoice_number === selectedInvoice : true;
      return matchesCity && matchesName && matchesInvoice;
    });
  }, [normalizedSuppliers, selectedCity, selectedName, selectedInvoice]);

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
              <>
                <button
                  onClick={() => {
                    setAdvanceTargetSupplier(null);
                    setAdvanceModalOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition shadow-sm"
                  title="Log Advance Deposit"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Log Advance
                </button>
                <button
                  onClick={() => {
                    setRefundTargetSupplier(null);
                    setRefundModalOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 transition shadow-sm"
                  title="Process Cash Refund"
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  Process Refund
                </button>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Supplier
                </button>
              </>
            )}
          </div>
        </div>
        {/* Cascading Filter Bar */}
        <div className="mt-4">
          <CascadingFilterBar
            selectedCity={selectedCity}
            selectedName={selectedName}
            onCityChange={setSelectedCity}
            onNameChange={setSelectedName}
            availableCities={availableCities}
            availableNames={availableNames}
            onReset={resetFilters}
            showInvoice={false}
            nameLabel="Supplier Name"
            namePlaceholder="Filter by supplier name…"
          />
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
                {!isCashier && (
                  <>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-right">Outstanding</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-right">Advance (Credit)</th>
                  </>
                )}
                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                {(canWrite || canDelete) && <th className="px-4 py-3 font-semibold text-gray-600 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={isCashier ? 7 : 9} className="py-16 text-center text-gray-400">Loading suppliers…</td></tr>
              )}
              {isError && (
                <tr><td colSpan={isCashier ? 7 : 9} className="py-16 text-center text-red-500">Failed to load. <button onClick={() => refetch()} className="underline">Retry</button></td></tr>
              )}
              {!isLoading && !isError && filteredTableRows.length === 0 && (
                <tr><td colSpan={isCashier ? 7 : 9} className="py-16 text-center text-gray-400">
                  {selectedCity || selectedName
                    ? 'No suppliers match the active cascading filters. Try resetting filters.'
                    : 'No suppliers yet.'}
                </td></tr>
              )}
              {filteredTableRows.map((s, idx) => {
                const displayOutstanding = Number(s.outstanding_payable || 0);
                const displayAdvance = Number((s as any).advance_payable || 0);

                return (
                  <tr key={s.id} className={`border-b border-gray-50 hover:bg-blue-50/40 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-mono font-semibold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition cursor-pointer"
                        title="View Supplier Profile & Statement of Account"
                      >
                        {s.code}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="font-semibold text-gray-900 hover:text-blue-600 hover:underline cursor-pointer text-left transition"
                        title="View Supplier Profile & Statement of Account"
                      >
                        {s.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.city ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{s.payment_terms}d</td>
                    {!isCashier && (
                      <>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${displayOutstanding > 0 ? 'text-orange-600 font-bold' : 'text-gray-400'}`}>
                            {formatRs(displayOutstanding)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`font-semibold ${displayAdvance > 0 ? 'text-teal-600 font-bold' : 'text-gray-400'}`}>
                              {formatRs(displayAdvance)}
                            </span>
                            {displayAdvance > 0 && canWrite && (
                              <button
                                onClick={() => {
                                  setRefundTargetSupplier(s);
                                  setRefundModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 text-xs font-bold transition shadow-2xs cursor-pointer"
                                title="Issue Cash Refund from Advance Wallet"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5 text-red-600" />
                                Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {(canWrite || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => {
                                setAdvanceTargetSupplier(s);
                                setAdvanceModalOpen(true);
                              }}
                              className="rounded-lg border border-gray-200 p-1.5 text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition"
                              title="Log Advance Deposit"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => openEdit(s)} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition" title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </>
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
              );
            })}
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

      <LogAdvanceDepositModal
        isOpen={advanceModalOpen}
        entityType="supplier"
        supplier={advanceTargetSupplier}
        onClose={() => {
          setAdvanceModalOpen(false);
          setAdvanceTargetSupplier(null);
        }}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['suppliers'] })}
      />

      <ProcessCashRefundModal
        isOpen={refundModalOpen}
        entityType="supplier"
        supplier={refundTargetSupplier}
        onClose={() => {
          setRefundModalOpen(false);
          setRefundTargetSupplier(null);
        }}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['suppliers'] })}
      />
    </div>
  );
}
