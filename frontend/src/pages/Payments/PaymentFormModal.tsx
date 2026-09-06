import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { paymentsService } from '../../services/payments.service';
import { getCustomers } from '../../services/customers.service';
import { invoicesService } from '../../services/invoices.service';
import { useAuthStore } from '../../store/auth.store';

const paymentSchema = z.object({
  customer_id: z.string().uuid('Please select a customer'),
  invoice_id: z.string().uuid().optional().or(z.literal('')),
  payment_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'BANK', 'PDC']),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentFormModal = ({ isOpen, onClose, onSuccess }: PaymentFormModalProps) => {
  const { user } = useAuthStore();
  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';
  const { data: customersResponse } = useQuery({
    queryKey: ['customers', { page: 1, limit: 100 }],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    enabled: isOpen,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesService.getInvoices,
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => paymentsService.createPayment({
      ...data,
      invoice_id: data.invoice_id || null, // Convert empty string back to null
    }),
    onSuccess,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      customer_id: '',
      invoice_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      amount: 0,
      payment_method: 'CASH',
      notes: '',
    },
  });

  const selectedCustomerId = watch('customer_id');
  const selectedInvoiceId = watch('invoice_id');

  // Filter invoices to only show UNPAID or PARTIAL invoices for the selected customer
  const availableInvoices = invoices.filter(
    (inv) => inv.customer_id === selectedCustomerId && ['UNPAID', 'PARTIAL'].includes(inv.status)
  );

  const selectedInvoice = availableInvoices.find((inv) => inv.id === selectedInvoiceId);
  const selectedInvoiceBalance = selectedInvoice
    ? Math.max(0, Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount))
    : 0;

  const handleClearFullBalance = () => {
    if (selectedInvoiceBalance > 0) {
      setValue('amount', Math.round(selectedInvoiceBalance * 100) / 100, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      reset({
        customer_id: '',
        invoice_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        amount: 0,
        payment_method: 'CASH',
        notes: '',
      });
    }
  }, [isOpen, reset]);

  const onSubmit = (data: PaymentFormData) => {
    createMutation.mutate(data);
  };

  if (!isOpen) return null;

  const inputCls = (hasError: boolean) =>
    `block w-full rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
    }`;

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(Number(val));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto pt-10 pb-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Receive Payment</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto max-h-[70vh]">
          <form id="payment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer</label>
                <select {...register('customer_id')} className={inputCls(!!errors.customer_id)}>
                  <option value="">Select a customer...</option>
                  {customersResponse?.data.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
                {errors.customer_id && <p className="mt-1 text-xs text-red-600">{errors.customer_id.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Link to Invoice (Optional)</label>
                <select {...register('invoice_id')} className={inputCls(!!errors.invoice_id)} disabled={!selectedCustomerId}>
                  <option value="">General Account Payment</option>
                  {availableInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} (Due: {formatCurrency(Number(inv.total_amount) - Number(inv.paid_amount))})
                    </option>
                  ))}
                </select>
                {errors.invoice_id && <p className="mt-1 text-xs text-red-600">{errors.invoice_id.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Payment Date</label>
                <input type="date" {...register('payment_date')} className={inputCls(!!errors.payment_date)} />
                {errors.payment_date && <p className="mt-1 text-xs text-red-600">{errors.payment_date.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Destination Bucket</label>
                <select
                  {...register('payment_method')}
                  disabled={isCashier}
                  className={inputCls(!!errors.payment_method) + (isCashier ? ' bg-slate-100 font-semibold text-slate-700 cursor-not-allowed' : '')}
                >
                  <option value="CASH">Cash in Drawer (Galla)</option>
                  {!isCashier && <option value="BANK">Bank Account</option>}
                  {!isCashier && <option value="PDC">PDC (Post-Dated Cheque)</option>}
                </select>
                {isCashier && (
                  <p className="mt-1 text-[11px] text-slate-500 font-medium">
                    Cashier payments are automatically routed to Cash in Drawer (Galla).
                  </p>
                )}
                {errors.payment_method && <p className="mt-1 text-xs text-red-600">{errors.payment_method.message}</p>}
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Amount Received</label>
                </div>
                <div className="relative w-full">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-slate-500 sm:text-sm">Rs.</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    {...register('amount')}
                    className={`block w-full rounded-xl border px-3 py-3 pl-10 text-lg font-medium transition-colors focus:outline-none focus:ring-2 ${
                      selectedInvoice && selectedInvoiceBalance > 0 ? 'pr-36' : ''
                    } ${
                      errors.amount
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20 text-red-900'
                        : 'border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 text-emerald-900 bg-emerald-50/50'
                    }`}
                  />
                  {selectedInvoice && selectedInvoiceBalance > 0 && (
                    <button
                      type="button"
                      onClick={handleClearFullBalance}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 transition-all cursor-pointer shadow-2xs"
                    >
                      Clear Full Balance
                    </button>
                  )}
                </div>
                {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Reference</label>
              <textarea {...register('notes')} rows={2} className={inputCls(false)} placeholder="Cheque number, transaction ID..."></textarea>
            </div>
          </form>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payment-form"
            disabled={createMutation.isPending}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition shadow-sm"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Payment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
