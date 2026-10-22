import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, ArrowUpRight, ArrowDownLeft, Plus } from 'lucide-react';
import { createSupplier, updateSupplier } from '../../services/suppliers.service';
import { Supplier } from '../../types/supplier.types';
import { LogAdvanceDepositModal } from '../../components/Modals/LogAdvanceDepositModal';
import { ProcessCashRefundModal } from '../../components/Modals/ProcessCashRefundModal';
import { RecordPaymentModal } from '../../components/Modals/RecordPaymentModal';
import { SupplierLedger } from './SupplierLedger';

const PAKISTAN_CITIES = [
  'Karachi', 'Lahore', 'Faisalabad', 'Rawalpindi', 'Gujranwala', 'Peshawar',
  'Multan', 'Hyderabad', 'Islamabad', 'Quetta', 'Sialkot', 'Sukkur',
  'Larkana', 'Mirpur Khas', 'Mardan', 'Abbottabad', 'Swat', 'Gwadar', 'Turbat', 'Khuzdar',
];

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  city: z.string().optional(),
  payment_terms: z.coerce.number().int().min(0).default(30),
  opening_payable: z.coerce.number().min(0).default(0),
  opening_advance: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  supplier?: Supplier;
  onClose: () => void;
}

export default function SupplierFormModal({ supplier, onClose }: Props) {
  const isEdit = Boolean(supplier);
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'LEDGER'>('DETAILS');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const advancePayable = Number((supplier as any)?.advance_payable || 0);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: supplier
      ? {
          name: supplier.name,
          city: supplier.city ?? '',
          payment_terms: supplier.payment_terms ?? 30,
          notes: supplier.notes ?? '',
        }
      : {
          name: '',
          city: '',
          payment_terms: 30,
          opening_payable: 0,
          opening_advance: 0,
          notes: '',
        },
  });

  const openingPayable = Number(watch('opening_payable') || 0);
  const openingAdvance = Number(watch('opening_advance') || 0);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? updateSupplier(supplier!.id, data) : createSupplier(data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); onClose(); },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setServerError(err?.response?.data?.error ?? 'Something went wrong.');
    },
  });

  const inputCls = (hasError: boolean) =>
    `w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 ${
      hasError ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-100'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`w-full rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] ${activeTab === 'LEDGER' ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Party Profile' : 'Add New Party'}
            </h2>
            {isEdit && (
              <div className="flex space-x-2">
                <button
                  type="button"
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
                  type="button"
                  onClick={() => setActiveTab('LEDGER')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'LEDGER'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Statement of Account
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
                  title="Record Payment against Purchase Bill"
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
                  Process Cash Refund {advancePayable > 0 ? `(PKR ${advancePayable.toLocaleString()})` : ''}
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
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{serverError}</div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                <input {...register('name')} placeholder="e.g. Pak Polythene Supplies" className={inputCls(!!errors.name)} />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">City</label>
                  <input
                    list="pakistan-cities"
                    {...register('city')}
                    placeholder="e.g. Karachi, Lahore, Gujranwala"
                    className={inputCls(false)}
                  />
                  <datalist id="pakistan-cities">
                    {PAKISTAN_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Payment Terms (days)
                  </label>
                  <input type="number" {...register('payment_terms')} placeholder="30" className={inputCls(false)} />
                </div>
              </div>

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
                      {...register('opening_payable')}
                      placeholder="0"
                      disabled={openingAdvance > 0}
                      className={`${inputCls(false)} ${
                        openingAdvance > 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : ''
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-500">You owe them (Accounts Payable)</p>
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
                      disabled={openingPayable > 0}
                      className={`${inputCls(false)} ${
                        openingPayable > 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : ''
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-500">You prepaid them (Wallet Asset)</p>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                <textarea {...register('notes')} rows={2} placeholder="Any remarks…" className={`${inputCls(false)} resize-none`} />
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={mutation.isPending} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition">
                  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? 'Save Changes' : 'Add Party'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6">
              {supplier && (
                <SupplierLedger
                  supplierId={supplier.id}
                  supplierName={supplier.name}
                  supplierCode={supplier.code}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <LogAdvanceDepositModal
        isOpen={advanceOpen}
        entityType="supplier"
        supplier={supplier}
        onClose={() => setAdvanceOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['suppliers'] });
        }}
      />

      <ProcessCashRefundModal
        isOpen={refundOpen}
        entityType="supplier"
        supplier={supplier}
        onClose={() => setRefundOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['suppliers'] });
        }}
      />

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        entityType="supplier"
        supplierId={supplier?.id}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['suppliers'] });
          qc.invalidateQueries({ queryKey: ['supplier-payments'] });
          qc.invalidateQueries({ queryKey: ['purchases'] });
          if (supplier?.id) {
            qc.invalidateQueries({ queryKey: ['suppliers', supplier.id, 'statement'] });
            qc.invalidateQueries({ queryKey: ['suppliers', supplier.id, 'ledger'] });
          }
        }}
      />
    </div>
  );
}
