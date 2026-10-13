import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supplierPaymentsService } from '../../services/supplier-payments.service';
import { getSuppliers } from '../../services/suppliers.service';
import { purchasesService } from '../../services/purchases.service';
import { bankAccountsService } from '../../services/bank-accounts.service';

const schema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  purchase_invoice_id: z.string().optional(),
  payment_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'PDC']),
  bank_account_id: z.string().optional(),
  notes: z.string().optional(),
  cheque_number: z.string().optional(),
  cheque_due_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export const SupplierPaymentFormModal = ({ onClose, onSuccess }: Props) => {
  const qc = useQueryClient();

  const { data: suppliersResponse } = useQuery({ queryKey: ['suppliers'], queryFn: () => getSuppliers({ limit: 100 }) });
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'CASH',
      bank_account_id: '',
      amount: 0,
      cheque_number: '',
      cheque_due_date: new Date().toISOString().split('T')[0],
    }
  });

  const selectedSupplierId = watch('supplier_id');
  const selectedInvoiceId = watch('purchase_invoice_id');
  const selectedPaymentMethod = watch('payment_method');

  const { data: invoicesResponse } = useQuery({ 
    queryKey: ['purchases', { supplier_id: selectedSupplierId, status: 'UNPAID,PARTIAL' }], 
    queryFn: () => purchasesService.getInvoices({ supplier_id: selectedSupplierId }),
    enabled: !!selectedSupplierId
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsService.getBankAccounts,
  });

  const invoices = invoicesResponse?.data?.filter(inv => inv.status !== 'PAID') || [];
  const selectedBill = invoices.find((inv) => inv.id === selectedInvoiceId);
  const selectedBillBalance = selectedBill
    ? Math.max(0, Number(selectedBill.total_amount) - Number(selectedBill.paid_amount))
    : 0;

  const handleClearFullBalance = () => {
    if (selectedBillBalance > 0) {
      setValue('amount', Math.round(selectedBillBalance * 100) / 100, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => supplierPaymentsService.createPayment({
      ...data,
      purchase_invoice_id: data.purchase_invoice_id || null,
      cheque_number: data.cheque_number || null,
      cheque_due_date: data.cheque_due_date || null,
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-payments'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['issuedPdc'] });
      qc.invalidateQueries({ queryKey: ['liquidityLedger'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error.message || 'Failed to save payment');
    }
  });

  const inputCls = (err?: boolean) => `w-full rounded-lg border ${err ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'} py-2.5 px-3 text-sm outline-none transition-all`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Record Supplier Payment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto">
          <form id="payment-form" onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier</label>
              <select {...register('supplier_id')} className={inputCls(!!errors.supplier_id)}>
                <option value="">Select a supplier...</option>
                {suppliersResponse?.data.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.supplier_id && <p className="mt-1 text-xs text-red-600">{errors.supplier_id.message}</p>}
            </div>

            {selectedSupplierId && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Link to Purchase Bill (Optional)</label>
                <select {...register('purchase_invoice_id')} className={inputCls(!!errors.purchase_invoice_id)}>
                  <option value="">No link (General payment)</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} (Unpaid: PKR {(Number(inv.total_amount) - Number(inv.paid_amount)).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Payment Date</label>
              <input type="date" {...register('payment_date')} className={inputCls(!!errors.payment_date)} />
              {errors.payment_date && <p className="mt-1 text-xs text-red-600">{errors.payment_date.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Amount</label>
              </div>
              <div className="relative w-full">
                <input
                  type="number"
                  step="0.01"
                  {...register('amount')}
                  className={inputCls(!!errors.amount) + (selectedBill && selectedBillBalance > 0 ? ' pr-36' : '')}
                />
                {selectedBill && selectedBillBalance > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFullBalance}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-all cursor-pointer shadow-2xs"
                  >
                    Clear Full Balance
                  </button>
                )}
              </div>
              {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Payment Method</label>
              <select {...register('payment_method')} className={inputCls(!!errors.payment_method)}>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Post-Dated Cheque (PDC)</option>
              </select>
            </div>

            {(selectedPaymentMethod === 'BANK_TRANSFER' || selectedPaymentMethod === 'CHEQUE' || selectedPaymentMethod === 'PDC') && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Select Source Bank Account <span className="text-red-500">*</span>
                </label>
                <select {...register('bank_account_id')} className={inputCls(!!errors.bank_account_id)}>
                  <option value="">Select Bank Account...</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} — {acc.account_title} ({acc.account_number}) — Bal: Rs. {acc.current_balance.toLocaleString()}
                    </option>
                  ))}
                </select>
                {errors.bank_account_id && <p className="mt-1 text-xs text-red-600">{errors.bank_account_id.message}</p>}
              </div>
            )}

            {(selectedPaymentMethod === 'CHEQUE' || selectedPaymentMethod === 'PDC') && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Post-Dated Cheque (PDC) Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Cheque Number</label>
                    <input
                      type="text"
                      {...register('cheque_number')}
                      placeholder="e.g. CHQ-10022"
                      className={inputCls(!!errors.cheque_number)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Cheque Due Date</label>
                    <input
                      type="date"
                      {...register('cheque_due_date')}
                      className={inputCls(!!errors.cheque_due_date)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Reference</label>
              <textarea {...register('notes')} rows={2} className={inputCls()} placeholder="E.g., Cheque number or memo" />
            </div>
          </form>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payment-form"
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 flex items-center"
          >
            {mutation.isPending ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};
