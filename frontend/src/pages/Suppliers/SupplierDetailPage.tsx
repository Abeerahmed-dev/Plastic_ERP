import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Edit2,
  RefreshCw,
  Building,
  Calendar,
  Wallet,
  Receipt,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { getSupplier, updateSupplier } from '../../services/suppliers.service';
import { SupplierLedger } from './SupplierLedger';
import { RecordPaymentModal } from '../../components/Modals/RecordPaymentModal';
import { LogAdvanceDepositModal } from '../../components/Modals/LogAdvanceDepositModal';
import { ProcessCashRefundModal } from '../../components/Modals/ProcessCashRefundModal';
import SupplierFormModal from './SupplierFormModal';

function formatRs(n: number | string | undefined | null) {
  if (n === undefined || n === null) return 'Rs. 0';
  const val = Number(n);
  return `Rs. ${val.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const {
    data: supplier,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => getSupplier(id!),
    enabled: !!id,
  });

  const advancePayable = Number((supplier as any)?.advance_payable || 0);
  const outstandingPayable = Number(supplier?.outstanding_payable || 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Top bar with back button */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-36 bg-slate-200 animate-pulse rounded-md" />
          </div>
          <button
            onClick={() => navigate('/suppliers')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-sm font-medium">Loading party details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Party Record</h1>
          <button
            onClick={() => navigate('/suppliers')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-3">
            <Building className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Party not found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            The party record you requested could not be located or has been deleted.
          </p>
          <button
            onClick={() => navigate('/suppliers')}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Parties
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ─── Party Header Bar ─── */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Party Name & Metadata */}
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/suppliers')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] cursor-pointer shrink-0"
              title="Back to Party List"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
              {supplier.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  {supplier.name}
                </h1>
                {supplier.city && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {supplier.city}
                  </span>
                )}
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    supplier.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {supplier.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {supplier.code}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
              title="Record Payment against Purchase Bill"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAdvanceModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Log Advance Deposit"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              <span>Log Advance</span>
            </button>

            {advancePayable > 0 && (
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Process Cash Refund"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                <span>Refund ({formatRs(advancePayable)})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Edit Party Details"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <SupplierLedger
          supplierId={supplier.id}
          supplierName={supplier.name}
          supplierCode={supplier.code}
        />
      </main>

      {/* ─── Modals ─── */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        entityType="supplier"
        supplierId={supplier.id}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['suppliers', supplier.id] });
          qc.invalidateQueries({ queryKey: ['suppliers', supplier.id, 'statement'] });
          refetch();
        }}
      />

      <LogAdvanceDepositModal
        isOpen={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        entityType="supplier"
        supplier={supplier}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['suppliers', supplier.id] });
          qc.invalidateQueries({ queryKey: ['suppliers', supplier.id, 'statement'] });
          refetch();
        }}
      />

      <ProcessCashRefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        entityType="supplier"
        supplier={supplier}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['suppliers', supplier.id] });
          qc.invalidateQueries({ queryKey: ['suppliers', supplier.id, 'statement'] });
          refetch();
        }}
      />

      {isEditModalOpen && (
        <SupplierFormModal
          supplier={supplier}
          onClose={() => {
            setIsEditModalOpen(false);
            qc.invalidateQueries({ queryKey: ['suppliers', supplier.id] });
            refetch();
          }}
        />
      )}
    </div>
  );
}
