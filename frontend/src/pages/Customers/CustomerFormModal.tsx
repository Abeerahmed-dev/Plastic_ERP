import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { createCustomer, updateCustomer } from '../../services/customers.service';
import { Customer } from '../../types/customer.types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  customer_type: z.enum(['CASH', 'CREDIT']).default('CREDIT'),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.enum(['Sindh', 'Punjab', 'KPK', 'Balochistan', 'Other']).optional(),
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
  const isEdit = Boolean(customer);
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');

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
          region: (customer.region as any) ?? undefined,
          credit_limit: customer.credit_limit ?? 0,
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
        ? updateCustomer(customer!.id, data as any)
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
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Customer Profile' : 'Add New Customer'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
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

            {/* City */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">City</label>
              <input {...register('city')} placeholder="Karachi" className={inputCls(false)} />
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
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition cursor-pointer"
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Add Customer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
