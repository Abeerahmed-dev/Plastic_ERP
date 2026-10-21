import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, ArrowDownLeft, ArrowUpRight, Wallet, Plus } from 'lucide-react';
import { createCustomer, updateCustomer } from '../../services/customers.service';
import { Customer } from '../../types/customer.types';

import { useAuthStore } from '../../store/auth.store';

import { CustomerLedger } from './CustomerLedger';
import { LogAdvanceDepositModal } from '../../components/Modals/LogAdvanceDepositModal';
import { ProcessCashRefundModal } from '../../components/Modals/ProcessCashRefundModal';
import { RecordPaymentModal } from '../../components/Modals/RecordPaymentModal';

const REGIONS = ['Sindh', 'Punjab', 'KPK', 'Balochistan', 'Other'] as const;

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  customer_type: z.enum(['CASH', 'CREDIT']).default('CREDIT'),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.enum(REGIONS).optional(),
  credit_limit: z.coerce.number().min(0).default(0),
  opening_balance: z.coerce.number().min(0).default(0),
  opening_advance: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  customer?: Customer;
  onClose: () => void;
}

export default function CustomerFormModal({ customer, onClose }: Props) {
  const { user } = useAuthStore();
  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';
  const isEdit = Boolean(customer);
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'LEDGER'>('DETAILS');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const advanceCredit = Number(customer?.advance_credit || customer?.advance || 0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: customer
      ? {
          name: customer.name,
          customer_type: (customer.customer_type === 'CASH' ? 'CASH' : 'CREDIT') as 'CASH' | 'CREDIT',
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          address: customer.address ?? '',
          city: customer.city ?? '',
          region: (customer.region as (typeof REGIONS)[number]) ?? undefined,
          credit_limit: customer.credit_limit,
          notes: customer.notes ?? '',
        }
      : {
          customer_type: 'CREDIT',
          credit_limit: 0,
          opening_balance: 0,
          opening_advance: 0,
        },
  });

  const openingBalance = Number(watch('opening_balance') || 0);
  const openingAdvance = Number(watch('opening_advance') || 0);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit
        ? updateCustomer(customer!.id, data)
        : createCustomer(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setServerError(err?.response?.data?.error ?? 'Something went wrong. Please try again.');
    },
  });

  const inputCls = (hasError: boolean) =>
    `w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 ${
      hasError
        ? 'border-red-400 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-100'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`w-full rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] ${activeTab === 'LEDGER' ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Customer Profile' : 'Add New Customer'}
            </h2>
            {isEdit && !isCashier && (
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('DETAILS')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'DETAILS'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('LEDGER')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'LEDGER'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Ledger Statement
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {isEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Record Payment against Invoice"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  + Record Payment
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Log Advance Deposit"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                  Log Advance Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setRefundOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Process Cash Refund"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-red-600" />
                  Process Cash Refund {advanceCredit > 0 ? `(PKR ${advanceCredit.toLocaleString()})` : ''}
                </button>
              </>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {activeTab === 'DETAILS' ? (
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="px-6 py-5 space-y-4">
              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              {/* Name & Customer Type */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input {...register('name')} placeholder="Ahmed Traders" className={inputCls(!!errors.name)} />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Customer Type
                  </label>
                  <select {...register('customer_type')} className={inputCls(false)}>
                    <option value="CREDIT">Credit Account (Udhaar)</option>
                    <option value="CASH">Walk-in Cash Entity</option>
                  </select>
                </div>
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone</label>
                  <input {...register('phone')} placeholder="0300-1234567" className={inputCls(!!errors.phone)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                  <input {...register('email')} placeholder="ahmed@example.com" className={inputCls(!!errors.email)} />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Address</label>
                <input {...register('address')} placeholder="Street, Area" className={inputCls(false)} />
              </div>

              {/* City + Region */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">City</label>
                  <input {...register('city')} placeholder="Karachi" className={inputCls(false)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Region</label>
                  <select {...register('region')} className={inputCls(false)}>
                    <option value="">— Select —</option>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Credit Limit */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Credit Limit (Rs.)</label>
                <input type="number" {...register('credit_limit')} placeholder="0" className={inputCls(!!errors.credit_limit)} />
              </div>

              {/* Day-Zero Dual Financial Inputs */}
              {!isEdit && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Opening Balance (Rs.)
                      <span className="ml-1 text-xs font-normal text-gray-400">set once</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      {...register('opening_balance')}
                      placeholder="0"
                      disabled={openingAdvance > 0}
                      className={`${inputCls(!!errors.opening_balance)} ${
                        openingAdvance > 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : ''
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-500">Customer owes you (Udhaar)</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Opening Advance (Rs.)
                      <span className="ml-1 text-xs font-normal text-gray-400">set once</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      {...register('opening_advance')}
                      placeholder="0"
                      disabled={openingBalance > 0}
                      className={`${inputCls(!!errors.opening_advance)} ${
                        openingBalance > 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : ''
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-500">Customer overpaid you (Wallet Liability)</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                <textarea {...register('notes')} rows={2} placeholder="Any remarks..." className={`${inputCls(false)} resize-none`} />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6">
              {customer && (
                <CustomerLedger
                  customerId={customer.id}
                  customerName={customer.name}
                  customerCode={customer.code}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <LogAdvanceDepositModal
        isOpen={advanceOpen}
        entityType="customer"
        customer={customer}
        onClose={() => setAdvanceOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customers'] });
          if (customer?.id) {
            qc.invalidateQueries({ queryKey: ['customers', customer.id, 'ledger'] });
          }
        }}
      />

      <ProcessCashRefundModal
        isOpen={refundOpen}
        entityType="customer"
        customer={customer}
        onClose={() => setRefundOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customers'] });
          if (customer?.id) {
            qc.invalidateQueries({ queryKey: ['customers', customer.id, 'ledger'] });
          }
        }}
      />

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        entityType="customer"
        customerId={customer?.id}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['customers'] });
          qc.invalidateQueries({ queryKey: ['payments'] });
          qc.invalidateQueries({ queryKey: ['invoices'] });
          if (customer?.id) {
            qc.invalidateQueries({ queryKey: ['customers', customer.id, 'statement'] });
            qc.invalidateQueries({ queryKey: ['customers', customer.id, 'ledger'] });
          }
        }}
      />
    </div>
  );
}
