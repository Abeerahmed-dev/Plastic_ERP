import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { createSupplier, updateSupplier } from '../../services/suppliers.service';
import { Supplier } from '../../types/supplier.types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  city: z.string().optional(),
  payment_terms: z.coerce.number().int().min(0).default(30),
  opening_payable: z.coerce.number().min(0).default(0),
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

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: supplier
      ? {
          name: supplier.name,
          city: supplier.city ?? '',
          payment_terms: supplier.payment_terms,
          notes: supplier.notes ?? '',
        }
      : { payment_terms: 30 },
  });

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
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Party' : 'Add New Party'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="px-6 py-5 space-y-4">
          {serverError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{serverError}</div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
            <input {...register('name')} placeholder="Pak Polythene Supplies" className={inputCls(!!errors.name)} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">City</label>
            <input {...register('city')} placeholder="Karachi" className={inputCls(false)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Payment Terms (days)
              </label>
              <input type="number" {...register('payment_terms')} placeholder="30" className={inputCls(false)} />
            </div>
            {!isEdit && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Opening Payable (Rs.)
                  <span className="ml-1 text-xs font-normal text-gray-400">set once</span>
                </label>
                <input type="number" {...register('opening_payable')} placeholder="0" className={inputCls(false)} />
              </div>
            )}
          </div>

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
      </div>
    </div>
  );
}
