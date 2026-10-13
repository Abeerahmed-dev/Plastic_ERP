import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { paymentsService } from '../../services/payments.service';
import { getCustomers } from '../../services/customers.service';
import { getSuppliers } from '../../services/suppliers.service';
import { invoicesService } from '../../services/invoices.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { useAuthStore } from '../../store/auth.store';

const paymentSchema = z.object({
  customer_id: z.string().uuid('Please select a customer'),
  supplier_id: z.string().optional().or(z.literal('')),
  invoice_id: z.string().uuid().optional().or(z.literal('')),
  payment_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'BANK', 'PDC', 'DIRECT_TO_SUPPLIER']),
  bank_account_id: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
  cheque_number: z.string().optional(),
  cheque_bank_name: z.string().optional(),
  cheque_due_date: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.payment_method === 'DIRECT_TO_SUPPLIER' && (!data.supplier_id || data.supplier_id.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['supplier_id'],
      message: 'Supplier selection is required for Direct to Supplier settlement',
    });
  }
  if ((data.payment_method === 'PDC' || data.payment_method === 'CHEQUE' || data.payment_method === 'BANK' || data.payment_method === 'BANK_TRANSFER') && (!data.bank_account_id || data.bank_account_id.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bank_account_id'],
      message: 'Destination bank account is required',
    });
  }
  if (data.payment_method === 'PDC' || data.payment_method === 'CHEQUE') {
    if (!data.cheque_number || data.cheque_number.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cheque_number'],
        message: 'Cheque number is required',
      });
    }
    if (!data.cheque_bank_name || data.cheque_bank_name.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cheque_bank_name'],
        message: 'Customer origin bank name is required',
      });
    }
    if (!data.cheque_due_date || data.cheque_due_date.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cheque_due_date'],
        message: 'Cheque due date is required',
      });
    }
  }
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
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: customersResponse } = useQuery({
    queryKey: ['customers', { page: 1, limit: 100 }],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    enabled: isOpen,
  });

  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers', { page: 1, limit: 100 }],
    queryFn: () => getSuppliers({ page: 1, limit: 100 }),
    enabled: isOpen,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.getInvoices(),
    enabled: isOpen,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsService.getBankAccounts(),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => paymentsService.createPayment({
      ...data,
      invoice_id: data.invoice_id || null,
      supplier_id: data.supplier_id || null,
      bank_account_id: data.bank_account_id || null,
      cheque_number: data.cheque_number || null,
      cheque_bank_name: data.cheque_bank_name || null,
      cheque_due_date: data.cheque_due_date || null,
    }),
    onSuccess: () => {
      setServerError(null);
      onSuccess();
    },
    onError: (err: any) => {
      console.error('Payment creation failed:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to save payment';
      setServerError(msg);
    },
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
      supplier_id: '',
      invoice_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      amount: 0,
      payment_method: 'CASH',
      bank_account_id: '',
      notes: '',
      cheque_number: '',
      cheque_bank_name: '',
      cheque_due_date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedCustomerId = watch('customer_id');
  const selectedInvoiceId = watch('invoice_id');
  const selectedPaymentMethod = watch('payment_method');

  // Filter invoices to only show UNPAID or PARTIAL invoices for the selected customer
  const invoicesList = Array.isArray(invoices) ? invoices : [];
  const availableInvoices = invoicesList.filter(
    (inv) => inv && inv.customer_id === selectedCustomerId && ['UNPAID', 'PARTIAL'].includes(inv.status)
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
      setServerError(null);
      reset({
        customer_id: '',
        supplier_id: '',
        invoice_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        amount: 0,
        payment_method: 'CASH',
        bank_account_id: '',
        notes: '',
        cheque_number: '',
        cheque_bank_name: '',
        cheque_due_date: new Date().toISOString().split('T')[0],
      });
    }
  }, [isOpen, reset]);

  const onSubmit = (data: PaymentFormData) => {
    setServerError(null);
    createMutation.mutate(data);
  };

  const onInvalid = (errors: any) => {
    console.warn('Form validation failed:', errors);
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
          {serverError && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
              <span>{serverError}</span>
              <button type="button" onClick={() => setServerError(null)} className="text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <form id="payment-form" onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="customer_id" className="mb-1.5 block text-sm font-medium text-slate-700">Customer</label>
                <select id="customer_id" {...register('customer_id')} className={inputCls(!!errors.customer_id)}>
                  <option value="">Select a customer...</option>
                  {Array.isArray(customersResponse?.data) && (
                    <>
                      <optgroup label="Credit Accounts">
                        {customersResponse.data.filter((c) => c.customer_type !== 'CASH').map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code || 'Credit'})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Cash Customers">
                        {customersResponse.data.filter((c) => c.customer_type === 'CASH').map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code || 'Cash'})</option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
                {errors.customer_id && <p className="mt-1 text-xs text-red-600">{errors.customer_id.message}</p>}
              </div>

              <div>
                <label htmlFor="invoice_id" className="mb-1.5 block text-sm font-medium text-slate-700">Link to Invoice (Optional)</label>
                <select id="invoice_id" {...register('invoice_id')} className={inputCls(!!errors.invoice_id)} disabled={!selectedCustomerId}>
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
                <label htmlFor="payment_date" className="mb-1.5 block text-sm font-medium text-slate-700">Payment Date</label>
                <input id="payment_date" type="date" {...register('payment_date')} className={inputCls(!!errors.payment_date)} />
                {errors.payment_date && <p className="mt-1 text-xs text-red-600">{errors.payment_date.message}</p>}
              </div>

              <div>
                <label htmlFor="payment_method" className="mb-1.5 block text-sm font-medium text-slate-700">Destination Bucket / Method</label>
                <select
                  id="payment_method"
                  {...register('payment_method')}
                  disabled={isCashier}
                  className={inputCls(!!errors.payment_method) + (isCashier ? ' bg-slate-100 font-semibold text-slate-700 cursor-not-allowed' : '')}
                >
                  <option value="CASH">Cash in Drawer (Galla)</option>
                  {!isCashier && <option value="BANK">Bank Account</option>}
                  {!isCashier && <option value="CHEQUE">Post-Dated Cheque (PDC)</option>}
                  {!isCashier && <option value="DIRECT_TO_SUPPLIER">Direct to Supplier (Tripartite)</option>}
                </select>
                {isCashier && (
                  <p className="mt-1 text-[11px] text-slate-500 font-medium">
                    Cashier payments are automatically routed to Cash in Drawer (Galla).
                  </p>
                )}
                {errors.payment_method && <p className="mt-1 text-xs text-red-600">{errors.payment_method.message}</p>}
              </div>

              {selectedPaymentMethod === 'DIRECT_TO_SUPPLIER' && (
                <div className="md:col-span-2">
                  <label htmlFor="supplier_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Select Target Supplier <span className="text-red-500">*</span>
                  </label>
                  <select id="supplier_id" {...register('supplier_id')} className={inputCls(!!errors.supplier_id)}>
                    <option value="">Select Target Supplier...</option>
                    {(suppliersResponse?.data || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) — Balance: Rs. {(Number(s?.outstanding_payable ?? (s as any)?.outstanding_balance) || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  {errors.supplier_id && <p className="mt-1 text-xs text-red-600">{errors.supplier_id.message}</p>}
                </div>
              )}

              {(selectedPaymentMethod === 'BANK' || selectedPaymentMethod === 'BANK_TRANSFER' || selectedPaymentMethod === 'CHEQUE' || selectedPaymentMethod === 'PDC') && (
                <div className="md:col-span-2">
                  <label htmlFor="bank_account_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Select Target Bank Account <span className="text-red-500">*</span>
                  </label>
                  <select id="bank_account_id" {...register('bank_account_id')} className={inputCls(!!errors.bank_account_id)}>
                    <option value="">Select Target Bank Account...</option>
                    {(bankAccounts || []).map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bank_name} — {acc.account_title} ({acc.account_number}) — Bal: Rs. {(Number(acc?.current_balance) || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  {errors.bank_account_id && <p className="mt-1 text-xs text-red-600">{errors.bank_account_id.message}</p>}
                </div>
              )}

              {(selectedPaymentMethod === 'CHEQUE' || selectedPaymentMethod === 'PDC') && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 md:col-span-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Post-Dated Cheque (PDC) Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="cheque_number" className="mb-1 block text-xs font-medium text-slate-700">Cheque Number *</label>
                      <input
                        id="cheque_number"
                        type="text"
                        {...register('cheque_number')}
                        placeholder="e.g. CHQ-99401"
                        className={inputCls(!!errors.cheque_number)}
                      />
                    </div>
                    <div>
                      <label htmlFor="cheque_bank_name" className="mb-1 block text-xs font-medium text-slate-700">Bank Name *</label>
                      <input
                        id="cheque_bank_name"
                        type="text"
                        {...register('cheque_bank_name')}
                        placeholder="e.g. Meezan Bank"
                        className={inputCls(!!errors.cheque_bank_name)}
                      />
                    </div>
                    <div>
                      <label htmlFor="cheque_due_date" className="mb-1 block text-xs font-medium text-slate-700">Cheque Due Date *</label>
                      <input
                        id="cheque_due_date"
                        type="date"
                        {...register('cheque_due_date')}
                        className={inputCls(!!errors.cheque_due_date)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="amount" className="block text-sm font-medium text-slate-700">Amount Received</label>
                </div>
                <div className="relative w-full">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-slate-500 sm:text-sm">Rs.</span>
                  </div>
                  <input
                    id="amount"
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
              <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Reference</label>
              <textarea id="notes" {...register('notes')} rows={2} className={inputCls(false)} placeholder="Cheque number, transaction ID..."></textarea>
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
