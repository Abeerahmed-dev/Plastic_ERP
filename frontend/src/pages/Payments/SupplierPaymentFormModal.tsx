import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, AlertCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supplierPaymentsService } from '../../services/supplier-payments.service';
import { getSuppliers } from '../../services/suppliers.service';
import { purchasesService } from '../../services/purchases.service';
import { bankAccountsService } from '../../services/bank-accounts.service';

const schema = z.object({
  supplier_id: z.string().min(1, 'Supplier / Party is required'),
  purchase_invoice_id: z.string().optional().nullable(),
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
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  supplierId?: string;
  purchaseInvoiceId?: string;
}

export const SupplierPaymentFormModal = ({
  isOpen = true,
  onClose,
  onSuccess,
  supplierId,
  purchaseInvoiceId,
}: Props) => {
  const qc = useQueryClient();

  const { data: suppliersResponse } = useQuery({ queryKey: ['suppliers'], queryFn: () => getSuppliers({ limit: 100 }) });
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplier_id: supplierId || '',
      purchase_invoice_id: purchaseInvoiceId || '',
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

  const invoices = (invoicesResponse?.data || []).filter((inv: any) => {
    if (inv.status === 'PAID') return false;
    const original = Number(inv.total_amount || 0);
    const returned = Number(inv.linked_returns_total || 0);
    const net = inv.net_invoice_total !== undefined ? Number(inv.net_invoice_total) : (original - returned);
    const paid = Number(inv.paid_amount || inv.amount_paid || 0);
    const balance = inv.balance_due !== undefined ? Number(inv.balance_due) : Math.round((net - paid) * 100) / 100;
    return balance > 0;
  });
  const currentInvoiceId = selectedInvoiceId;
  const activeInvoice = invoices.find((inv) => String(inv.id) === String(currentInvoiceId));
  const selectedBill = activeInvoice;
  const originalTotal = selectedBill ? Number(selectedBill.total_amount || 0) : 0;
  const returnedTotal = selectedBill ? Number((selectedBill as any).linked_returns_total || 0) : 0;
  const netTotal = selectedBill && (selectedBill as any).net_invoice_total !== undefined
    ? Number((selectedBill as any).net_invoice_total)
    : (originalTotal - returnedTotal);
  const paidTotal = selectedBill ? Number(selectedBill.paid_amount || (selectedBill as any).amount_paid || 0) : 0;
  const selectedBillBalance = selectedBill
    ? ((selectedBill as any).balance_due !== undefined ? Number((selectedBill as any).balance_due) : Math.round((netTotal - paidTotal) * 100) / 100)
    : 0;
  if (selectedBill && (selectedBill as any).balance_due === undefined) {
    (selectedBill as any).balance_due = selectedBillBalance;
  }

  const selectedSupplier = suppliersResponse?.data?.find((s) => s.id === selectedSupplierId);
  const supplierOutstanding = Number(selectedSupplier?.outstanding_payable ?? (selectedSupplier as any)?.outstanding_balance ?? 0);

  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(dateStr);
    }
  };

  const handleClearFullBalance = () => {
    const target = selectedBillBalance > 0 ? selectedBillBalance : (supplierOutstanding > 0 ? supplierOutstanding : 0);
    if (target > 0) {
      setValue('amount', Math.round(target * 100) / 100, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const cleanAmount = parseFloat(String(data.amount ?? '0').replace(/,/g, '').trim()) || 0;
      return supplierPaymentsService.createPayment({
        ...data,
        amount: cleanAmount,
        bank_account_id: data.bank_account_id || null,
        purchase_invoice_id: data.purchase_invoice_id || null,
        cheque_number: data.cheque_number || null,
        cheque_due_date: data.cheque_due_date || null,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-payments'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['issuedPdc'] });
      qc.invalidateQueries({ queryKey: ['liquidityLedger'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error.message || 'Failed to save payment');
    }
  });

  if (!isOpen) return null;

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
          <form
            id="payment-form"
            onSubmit={handleSubmit((d) => {
              if (selectedBill && selectedBillBalance > 0 && d.amount > selectedBillBalance) {
                alert(`Cannot overpay bill. Maximum balance due is PKR ${selectedBillBalance.toFixed(2)}`);
                return;
              }
              mutation.mutate(d);
            })}
            className="space-y-5"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Party</label>
              <select {...register('supplier_id')} className={inputCls(!!errors.supplier_id)}>
                <option value="">Select a party...</option>
                {suppliersResponse?.data.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.supplier_id && <p className="mt-1 text-xs text-red-600">{errors.supplier_id.message}</p>}
            </div>

            {selectedSupplierId && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Select Purchase Bill to Settle (Optional)
                </label>
                <select {...register('purchase_invoice_id')} className={inputCls(!!errors.purchase_invoice_id)}>
                  <option value="">-- No Specific Bill (On-Account / Closing Balance) --</option>
                  {invoices.map((invoice: any) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} — Total: Rs. {invoice.total_amount} | Due: Rs. {invoice.balance_due !== undefined ? invoice.balance_due : Math.max(0, Math.round((Number(invoice.total_amount) - Number(invoice.paid_amount || 0)) * 100) / 100)}
                    </option>
                  ))}
                </select>

                {activeInvoice && activeInvoice.payments && activeInvoice.payments.length > 0 && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md">
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Previous Payments on this Bill</p>
                    <ul className="space-y-1">
                      {activeInvoice.payments.map((pay: any, idx: number) => (
                        <li key={idx} className="text-sm flex justify-between items-center text-slate-700">
                          <span>{formatDate(pay.payment_date)} — {pay.payment_method} {pay.reference_number ? `(${pay.reference_number})` : ''}</span>
                          <span className="font-medium text-slate-900">Rs. {pay.amount}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {invoices.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    No unpaid bills found. Payment will be credited directly towards the supplier's closing ledger balance.
                  </p>
                )}
                {errors.purchase_invoice_id && <p className="mt-1 text-xs text-red-600">{errors.purchase_invoice_id.message}</p>}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Payment Date</label>
              <input type="date" {...register('payment_date')} className={inputCls(!!errors.payment_date)} />
              {errors.payment_date && <p className="mt-1 text-xs text-red-600">{errors.payment_date.message}</p>}
            </div>

            {selectedBill && selectedBillBalance <= 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span>
                    {selectedBillBalance < 0
                      ? `Bill is OVERPAID by PKR ${Math.abs(selectedBillBalance).toFixed(2)} (No payment due)`
                      : 'Bill is FULLY SETTLED (PKR 0.00 balance due)'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-amber-700">
                  Payment entry is disabled because this document has no remaining unpaid balance.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Amount</label>
                  {selectedBill ? (
                    <span className="text-xs font-bold text-slate-600">
                      Balance Due: <span className="font-mono text-blue-700 font-extrabold">PKR {selectedBillBalance.toFixed(2)}</span>
                    </span>
                  ) : supplierOutstanding > 0 ? (
                    <span className="text-xs font-bold text-slate-600">
                      Closing Balance: <span className="font-mono text-blue-700 font-extrabold">PKR {supplierOutstanding.toFixed(2)}</span>
                    </span>
                  ) : null}
                </div>
                <div className="relative w-full">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedBill ? Math.max(0, (selectedBill as any).balance_due) : undefined}
                    {...register('amount')}
                    className={inputCls(!!errors.amount) + ((selectedBill && selectedBillBalance > 0) || (!selectedBill && supplierOutstanding > 0) ? ' pr-36' : '')}
                  />
                  {((selectedBill && selectedBillBalance > 0) || (!selectedBill && supplierOutstanding > 0)) && (
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
            )}

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
            disabled={mutation.isPending || Boolean(selectedBill && selectedBillBalance <= 0)}
            title={selectedBill && selectedBillBalance <= 0 ? 'Cannot save payment on a settled or overpaid bill' : undefined}
            className="px-5 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center cursor-pointer"
          >
            {mutation.isPending ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};
