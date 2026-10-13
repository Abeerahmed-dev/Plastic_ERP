import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, UserX, ChevronLeft, ChevronRight, RefreshCw, ArrowDownLeft } from 'lucide-react';
import { getCustomers, deactivateCustomer } from '../../services/customers.service';
import { Customer } from '../../types/customer.types';
import { useAuthStore } from '../../store/auth.store';
import CustomerFormModal from './CustomerFormModal';
import { CustomerRefundModal } from './CustomerRefundModal';
import { CascadingFilterBar } from '../../components/CascadingFilterBar';
import { useCascadingFilters } from '../../hooks/useCascadingFilters';

const LIMIT = 100;

function formatRs(n: number | string) {
  return `Rs. ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export default function CustomersListPage() {
  const { user, hasPermission } = useAuthStore();
  const userRole = (user?.role || '').toUpperCase();
  const isCashier = userRole === 'CASHIER';
  const canWrite = isCashier || userRole === 'OWNER' || userRole === 'ADMIN' || hasPermission('customers:write');
  const canDelete = !isCashier && (userRole === 'OWNER' || userRole === 'ADMIN' || hasPermission('customers:delete'));
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'CREDIT' | 'CASH'>('CREDIT');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | undefined>();
  const [refundTargetCustomer, setRefundTargetCustomer] = useState<Customer | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customers', page, activeTab],
    queryFn: () => getCustomers({ page, limit: LIMIT, customer_type: activeTab }),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;

  const normalizedCustomers = useMemo(() => {
    return customers.map((c) => ({
      ...c,
      city: c.city || null,
      name: c.name || '',
      invoice_number: null,
    }));
  }, [customers]);

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
  } = useCascadingFilters(normalizedCustomers);

  // Phase 3: Strict multi-condition filter before rendering
  const filteredTableRows = useMemo(() => {
    return normalizedCustomers.filter((row: any) => {
      const matchesCity = selectedCity ? row.city === selectedCity : true;
      const matchesName = selectedName ? row.name === selectedName : true;
      const matchesInvoice = selectedInvoice ? row.invoice_number === selectedInvoice : true;
      return matchesCity && matchesName && matchesInvoice;
    });
  }, [normalizedCustomers, selectedCity, selectedName, selectedInvoice]);

  const openCreate = () => { setEditTarget(undefined); setModalOpen(true); };
  const openEdit = (c: Customer) => { setEditTarget(c); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(undefined); };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {meta ? `${meta.total.toLocaleString()} customers` : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 transition"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {canWrite && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Add Customer
              </button>
            )}
          </div>
        </div>

        {/* Master List Segment Tabs */}
        <div className="flex border-b border-gray-200 mt-5 space-x-6">
          <button
            onClick={() => { setActiveTab('CREDIT'); setPage(1); }}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'CREDIT'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Credit Accounts (Udhaar)
          </button>
          <button
            onClick={() => { setActiveTab('CASH'); setPage(1); }}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'CASH'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Cash Customers
          </button>
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
            nameLabel="Customer Name"
            namePlaceholder="Filter by customer name…"
          />
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Code</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                {!isCashier && (
                  <>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-right">Outstanding</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-right">Advance (Credit)</th>
                  </>
                )}
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Net Volume (KG)</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                {(canWrite || canDelete) && (
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={isCashier ? 8 : 10} className="py-16 text-center text-gray-400">
                    Loading customers…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={isCashier ? 8 : 10} className="py-16 text-center text-red-500">
                    Failed to load customers.{' '}
                    <button onClick={() => refetch()} className="underline">Retry</button>
                  </td>
                </tr>
              )}
              {!isLoading && !isError && filteredTableRows.length === 0 && (
                <tr>
                  <td colSpan={isCashier ? 8 : 10} className="py-16 text-center text-gray-400">
                    {selectedCity || selectedName
                      ? 'No customers match the active cascading filters. Try resetting filters.'
                      : 'No customers yet. Add your first one.'}
                  </td>
                </tr>
              )}
              {filteredTableRows.map((c, idx) => {
                const displayOutstanding = Number(c.outstanding_balance || 0);
                const displayAdvance = Number(c.advance_credit || 0);

                return (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-50 transition hover:bg-blue-50/40 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-mono font-semibold text-blue-700">
                        {c.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          c.customer_type === 'CASH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {c.customer_type === 'CASH' ? 'Cash Entity' : 'Credit Account'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.city ?? '—'}</td>
                    {!isCashier && (
                      <>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-semibold ${
                              displayOutstanding > 0 ? 'text-red-600 font-bold' : 'text-gray-400'
                            }`}
                          >
                            {formatRs(displayOutstanding)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={`font-semibold ${
                                displayAdvance > 0 ? 'text-amber-600 font-bold' : 'text-gray-400'
                              }`}
                            >
                              {formatRs(displayAdvance)}
                            </span>
                            {displayAdvance > 0 && canWrite && (
                              <button
                                onClick={() => setRefundTargetCustomer(c)}
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
                  <td className="px-4 py-3 text-right font-mono font-medium text-purple-700">
                    {c.net_lifetime_volume_kg !== undefined ? `${c.net_lifetime_volume_kg.toLocaleString()} KG` : '0 KG'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {(canWrite || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canWrite && (
                          <button
                            onClick={() => openEdit(c)}
                            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && c.is_active && (
                          <button
                            onClick={() => {
                              if (confirm(`Deactivate ${c.name}?`)) {
                                deactivateMutation.mutate(c.id);
                              }
                            }}
                            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-red-400 hover:text-red-600 transition"
                            title="Deactivate"
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

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, meta.total)} of{' '}
              {meta.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 p-1.5 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-medium">Page {page} / {meta.totalPages}</span>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 p-1.5 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <CustomerFormModal customer={editTarget} onClose={closeModal} />
      )}

      <CustomerRefundModal
        isOpen={!!refundTargetCustomer}
        customer={refundTargetCustomer}
        onClose={() => setRefundTargetCustomer(null)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['customers'] })}
      />
    </div>
  );
}
