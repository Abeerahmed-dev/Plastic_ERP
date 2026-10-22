import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Edit2,
  Building,
  Loader2,
} from 'lucide-react';
import { getCustomer } from '../../services/customers.service';
import { CustomerLedger } from './CustomerLedger';
import { RecordPaymentModal } from '../../components/Modals/RecordPaymentModal';
import { LogAdvanceDepositModal } from '../../components/Modals/LogAdvanceDepositModal';
import { ProcessCashRefundModal } from '../../components/Modals/ProcessCashRefundModal';
import CustomerFormModal from './CustomerFormModal';

function formatRs(n: number | string | undefined | null) {
  if (n === undefined || n === null) return 'Rs. 0';
  const val = Number(n);
  return `Rs. ${val.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const {
    data: customer,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['customers', id],
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  });

  const advanceCredit = Number(customer?.advance_credit || customer?.advance || 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-36 bg-slate-200 animate-pulse rounded-md" />
          </div>
          <button
            onClick={() => navigate('/customers')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-sm font-medium">Loading customer details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Customer Record</h1>
          <button
            onClick={() => navigate('/customers')}
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
          <h3 className="text-base font-bold text-slate-900">Customer not found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            The customer record you requested could not be located or has been deleted.
          </p>
          <button
            onClick={() => navigate('/customers')}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ─── Customer Header Bar ─── */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Customer Name & Metadata */}
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] cursor-pointer shrink-0"
              title="Back to Customer List"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  {customer.name}
                </h1>
                {customer.city && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {customer.city}
                  </span>
                )}
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    customer.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {customer.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {customer.code}
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
              title="Record Payment against Invoice"
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

            {advanceCredit > 0 && (
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Process Cash Refund"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                <span>Refund ({formatRs(advanceCredit)})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Edit Customer Details"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <CustomerLedger
          customerId={customer.id}
          customerName={customer.name}
          customerCode={customer.code}
        />
      </main>

      {/* ─── Modals ─── */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        entityType="customer"
        customerId={customer.id}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customers', customer.id] });
          qc.invalidateQueries({ queryKey: ['customers', customer.id, 'statement'] });
          refetch();
        }}
      />

      <LogAdvanceDepositModal
        isOpen={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        entityType="customer"
        customer={customer}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customers', customer.id] });
          qc.invalidateQueries({ queryKey: ['customers', customer.id, 'statement'] });
          refetch();
        }}
      />

      <ProcessCashRefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        entityType="customer"
        customer={customer}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customers', customer.id] });
          qc.invalidateQueries({ queryKey: ['customers', customer.id, 'statement'] });
          refetch();
        }}
      />

      {isEditModalOpen && (
        <CustomerFormModal
          customer={customer}
          onClose={() => {
            setIsEditModalOpen(false);
            qc.invalidateQueries({ queryKey: ['customers', customer.id] });
            refetch();
          }}
        />
      )}
    </div>
  );
}
