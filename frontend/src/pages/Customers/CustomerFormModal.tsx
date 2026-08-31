import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { createCustomer, updateCustomer } from '../../services/customers.service';
import { Customer } from '../../types/customer.types';

import { CustomerLedger } from './CustomerLedger';

const REGIONS = ['Sindh', 'Punjab', 'KPK', 'Balochistan', 'Other'] as const;

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.enum(REGIONS).optional(),
  credit_limit: z.coerce.number().min(0).default(0),
  opening_balance: z.coerce.number().min(0).default(0),
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
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'LEDGER'>('DETAILS');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: customer
      ? {
          name: customer.name,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          address: customer.address ?? '',
          city: customer.city ?? '',
          region: (customer.region as (typeof REGIONS)[number]) ?? undefined,
          credit_limit: customer.credit_limit,
          notes: customer.notes ?? '',
        }
      : {},
  });

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
            {isEdit && (
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
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {activeTab === 'DETAILS' ? (
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="px-6 py-5 space-y-4">
              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input {...register('name')} placeholder="Ahmed Traders" className={inputCls(!!errors.name)} />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
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

              {/* Credit Limit + Opening Balance */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Credit Limit (Rs.)</label>
                  <input type="number" {...register('credit_limit')} placeholder="0" className={inputCls(!!errors.credit_limit)} />
                </div>
                {!isEdit && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Opening Balance (Rs.)
                      <span className="ml-1 text-xs font-normal text-gray-400">set once</span>
                    </label>
                    <input type="number" {...register('opening_balance')} placeholder="0" className={inputCls(!!errors.opening_balance)} />
                  </div>
                )}
              </div>

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
              {customer && <CustomerLedger customerId={customer.id} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
