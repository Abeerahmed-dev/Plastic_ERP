import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, CreditCard, Building2, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsService } from '../../services/payments.service';
import { supplierPaymentsService } from '../../services/supplier-payments.service';
import { getCustomers } from '../../services/customers.service';
import { getSuppliers } from '../../services/suppliers.service';
import { invoicesService } from '../../services/invoices.service';
import { purchasesService } from '../../services/purchases.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { useAuthStore } from '../../store/auth.store';

const paymentFormSchema = z.object({
  entity_id: z.string().min(1, 'Entity is required'),
  invoice_id: z.string().min(1, 'Please select an invoice to settle'),
  payment_date: z.string().min(1, 'Payment date is required'),
  amount: z.preprocess((val) => {
    if (typeof val === 'string') {
      const clean = val.replace(/,/g, '').trim();
      return clean === '' ? 0 : Number(clean);
    }
    return Number(val);
  }, z.number().min(0.01, 'Amount must be greater than 0')),
  payment_method: z.string().min(1, 'Payment method is required'),
  bank_account_id: z.string().optional().or(z.literal('')),
  supplier_id: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
  cheque_number: z.string().optional(),
  cheque_bank_name: z.string().optional(),
  cheque_due_date: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  type?: 'customer' | 'supplier' | 'CUSTOMER' | 'SUPPLIER' | string;
  entityType?: 'customer' | 'supplier' | 'CUSTOMER' | 'SUPPLIER' | string;
  suppliers?: any[] | { data?: any[] };
  customers?: any[] | { data?: any[] };
  customerId?: string;
  supplierId?: string;
  entityId?: string;
  invoiceId?: string;
  purchaseInvoiceId?: string;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  type,
  entityType: initialEntityType,
  suppliers: suppliersProp,
  customers: customersProp,
  customerId,
  supplierId,
  entityId,
  invoiceId,
  purchaseInvoiceId,
}) => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isCashier = (user?.roleName || user?.role || '').toUpperCase() === 'CASHIER';
  const [serverError, setServerError] = useState<string | null>(null);

  // Determine effective entity type (handles type="SUPPLIER", entityType="supplier", or id props)
  const resolvedType = (type || initialEntityType || (supplierId ? 'SUPPLIER' : 'CUSTOMER')).toString().toUpperCase();
  const isSupplier = resolvedType === 'SUPPLIER' || !!supplierId;
  const effectiveEntityType: 'customer' | 'supplier' = isSupplier ? 'supplier' : 'customer';

  // Target entity ID passed as prop
  const preselectedEntityId = isSupplier
    ? supplierId || entityId || ''
    : customerId || entityId || '';

  const preselectedInvoiceId = isSupplier
    ? purchaseInvoiceId || invoiceId || ''
    : invoiceId || '';

  // Query Customers (limit 100 max per backend schema)
  const { data: fetchedCustomersResponse, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', { page: 1, limit: 100 }],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    enabled: isOpen && !isSupplier && !customersProp,
  });

  // Query Suppliers (limit 100 max per backend schema)
  const { data: fetchedSuppliersResponse, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers({ limit: 100 }),
    enabled: isOpen && (isSupplier || !suppliersProp),
  });

  // Unified suppliers array from props or fetched query
  const suppliers: any[] = useMemo(() => {
    if (suppliersProp) {
      if (Array.isArray(suppliersProp)) return suppliersProp;
      if (Array.isArray((suppliersProp as any)?.data)) return (suppliersProp as any).data;
    }
    if (Array.isArray(fetchedSuppliersResponse)) return fetchedSuppliersResponse;
    if (Array.isArray(fetchedSuppliersResponse?.data)) return fetchedSuppliersResponse.data;
    return [];
  }, [suppliersProp, fetchedSuppliersResponse]);

  // Unified customers array from props or fetched query
  const customers: any[] = useMemo(() => {
    if (customersProp) {
      if (Array.isArray(customersProp)) return customersProp;
      if (Array.isArray((customersProp as any)?.data)) return (customersProp as any).data;
    }
    if (Array.isArray(fetchedCustomersResponse)) return fetchedCustomersResponse;
    if (Array.isArray(fetchedCustomersResponse?.data)) return fetchedCustomersResponse.data;
    return [];
  }, [customersProp, fetchedCustomersResponse]);

  // Query Sales Invoices (for Customer payment)
  const { data: salesInvoices = [], isLoading: isLoadingSalesInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.getInvoices(),
    enabled: isOpen && !isSupplier,
  });

  // Query Bank Accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsService.getBankAccounts(),
    enabled: isOpen,
  });

  // Query Cash Drawer Balance
  const { data: cashDrawerData } = useQuery({
    queryKey: ['cash-drawer-balance'],
    queryFn: () => bankAccountsService.getCashDrawerBalance(),
    enabled: isOpen,
  });
  const cashDrawerBalance = cashDrawerData?.balance ?? 0;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      entity_id: preselectedEntityId,
      invoice_id: preselectedInvoiceId,
      payment_date: new Date().toISOString().split('T')[0],
      amount: 0,
      payment_method: isSupplier ? 'BANK_TRANSFER' : 'CASH',
      bank_account_id: '',
      supplier_id: '',
      notes: '',
      cheque_number: '',
      cheque_bank_name: '',
      cheque_due_date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedEntityId = watch('entity_id');
  const selectedInvoiceId = watch('invoice_id');
  const selectedPaymentMethod = watch('payment_method');
  const selectedBankAccountId = watch('bank_account_id');

  const selectedBankAccount = (bankAccounts || []).find((b) => b.id === selectedBankAccountId);

  // Liquidity Wall: Calculate maximum available balance for selected source account/drawer
  const availableOutflowBalance = useMemo(() => {
    if (!isSupplier) return Infinity;
    if (selectedPaymentMethod === 'CASH') return cashDrawerBalance;
    if (
      selectedPaymentMethod === 'BANK' ||
      selectedPaymentMethod === 'BANK_TRANSFER' ||
      selectedPaymentMethod === 'CHEQUE' ||
      selectedPaymentMethod === 'PDC'
    ) {
      return selectedBankAccount ? Number(selectedBankAccount.current_balance || 0) : 0;
    }
    return Infinity;
  }, [isSupplier, selectedPaymentMethod, cashDrawerBalance, selectedBankAccount]);

  // Query Purchases for Supplier payment when supplier is selected
  const { data: purchasesResponse, isLoading: isLoadingPurchases } = useQuery({
    queryKey: ['purchases', { supplier_id: selectedEntityId }],
    queryFn: () => purchasesService.getInvoices({ supplier_id: selectedEntityId, limit: 100 }),
    enabled: isOpen && isSupplier && !!selectedEntityId,
  });


  // Normalize available unpaid invoices for selected customer or supplier
  const availableInvoices = useMemo(() => {
    if (!selectedEntityId) return [];

    if (!isSupplier) {
      // Customer sales invoices
      const list = Array.isArray(salesInvoices) ? salesInvoices : [];
      return list
        .filter((inv) => inv && inv.customer_id === selectedEntityId && ['UNPAID', 'PARTIAL'].includes(inv.status))
        .map((inv) => {
          const original_total = Number(inv.total_amount || 0);
          const returned_total = Number((inv as any).linked_returns_total || 0);
          const net_invoice_total = (inv as any).net_invoice_total !== undefined
            ? Number((inv as any).net_invoice_total)
            : (original_total - returned_total);
          const amount_paid = Number(inv.paid_amount ?? (inv as any).amount_paid ?? 0);
          // CRITICAL: True net balance without Math.max(0, ...). Allow negative numbers for OVERPAID state.
          const balance_due = (inv as any).balance_due !== undefined
            ? Number((inv as any).balance_due)
            : Math.round((net_invoice_total - amount_paid) * 100) / 100;
          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            status: inv.status,
            total_amount: original_total,
            linked_returns_total: returned_total,
            net_invoice_total,
            paid_amount: amount_paid,
            amount_paid,
            balance_due,
            payments: (inv as any).payments || (inv as any).customer_payments || [],
          };
        });
    } else {
      // Supplier purchase bills
      const list = purchasesResponse?.data || [];
      return list
        .filter((inv) => inv && inv.status !== 'PAID')
        .map((inv) => {
          const original_total = Number(inv.total_amount || 0);
          const returned_total = Number((inv as any).linked_returns_total || 0);
          const net_invoice_total = (inv as any).net_invoice_total !== undefined
            ? Number((inv as any).net_invoice_total)
            : (original_total - returned_total);
          const amount_paid = Number(inv.paid_amount ?? (inv as any).amount_paid ?? 0);
          // CRITICAL: True net balance without Math.max(0, ...). Allow negative numbers for OVERPAID state.
          const balance_due = (inv as any).balance_due !== undefined
            ? Number((inv as any).balance_due)
            : Math.round((net_invoice_total - amount_paid) * 100) / 100;
          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            status: inv.status,
            total_amount: original_total,
            linked_returns_total: returned_total,
            net_invoice_total,
            paid_amount: amount_paid,
            amount_paid,
            balance_due,
            payments: (inv as any).payments || (inv as any).supplier_payments || [],
          };
        });
    }
  }, [isSupplier, selectedEntityId, salesInvoices, purchasesResponse]);

  // Extract the currently selected invoice object based on the active dropdown value
  const currentInvoiceId = selectedInvoiceId;
  const activeInvoice = availableInvoices.find((inv) => String(inv.id) === String(currentInvoiceId));
  const selectedInvoice = activeInvoice;
  const selectedInvoiceBalance = activeInvoice ? activeInvoice.balance_due : 0;

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

  const calculatedMaxAmount = useMemo(() => {
    let maxVal = Infinity;
    if (selectedInvoice && selectedInvoice.balance_due > 0) {
      maxVal = selectedInvoice.balance_due;
    }
    if (isSupplier && availableOutflowBalance !== Infinity) {
      maxVal = Math.min(maxVal, Math.max(0, availableOutflowBalance));
    }
    return maxVal === Infinity ? undefined : maxVal;
  }, [selectedInvoice, isSupplier, availableOutflowBalance]);

  // Clear Full Balance button handler
  const handleClearFullBalance = () => {
    if (selectedInvoice && selectedInvoice.balance_due > 0) {
      const targetAmount = calculatedMaxAmount !== undefined
        ? Math.min(selectedInvoice.balance_due, calculatedMaxAmount)
        : selectedInvoice.balance_due;
      setValue('amount', Math.round(targetAmount * 100) / 100, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  };


  // Reset or initialize values when modal opens or entity changes
  useEffect(() => {
    if (isOpen) {
      setServerError(null);
      reset({
        entity_id: preselectedEntityId,
        invoice_id: preselectedInvoiceId,
        payment_date: new Date().toISOString().split('T')[0],
        amount: 0,
        payment_method: isSupplier ? 'BANK_TRANSFER' : 'CASH',
        bank_account_id: '',
        supplier_id: '',
        notes: '',
        cheque_number: '',
        cheque_bank_name: '',
        cheque_due_date: new Date().toISOString().split('T')[0],
      });
    }
  }, [isOpen, preselectedEntityId, preselectedInvoiceId, isSupplier, reset]);

  // Auto-select first bank account with balance if supplier payment
  useEffect(() => {
    if (isOpen && isSupplier && bankAccounts && bankAccounts.length > 0 && !watch('bank_account_id')) {
      const activeAccount = bankAccounts.find((acc) => Number(acc.current_balance) > 0) || bankAccounts[0];
      if (activeAccount) {
        setValue('bank_account_id', activeAccount.id, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [isOpen, isSupplier, bankAccounts, setValue, watch]);

  // If preselected invoice is provided and found in available invoices, set it
  useEffect(() => {
    if (isOpen && preselectedInvoiceId && availableInvoices.some((inv) => inv.id === preselectedInvoiceId)) {
      setValue('invoice_id', preselectedInvoiceId);
    }
  }, [isOpen, preselectedInvoiceId, availableInvoices, setValue]);

  // Mutations
  const customerPaymentMutation = useMutation({
    mutationFn: (data: any) => {
      const rawAmount = String(data.amount ?? '0').replace(/,/g, '').trim();
      const cleanAmount = parseFloat(rawAmount) || 0;
      const targetBankAccountId = data.bank_account_id || selectedBankAccountId || null;

      return paymentsService.createPayment({
        customer_id: data.entity_id,
        invoice_id: data.invoice_id || null,
        payment_date: data.payment_date,
        amount: cleanAmount,
        payment_method: data.payment_method,
        bank_account_id: targetBankAccountId,
        supplier_id: data.supplier_id || null,
        notes: data.notes || null,
        cheque_number: data.cheque_number || null,
        cheque_bank_name: data.cheque_bank_name || null,
        cheque_due_date: data.cheque_due_date || null,
      });
    },
    onSuccess: () => {
      setServerError(null);
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      if (selectedEntityId) {
        qc.invalidateQueries({ queryKey: ['customers', selectedEntityId, 'statement'] });
        qc.invalidateQueries({ queryKey: ['customers', selectedEntityId, 'ledger'] });
      }
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      console.error('Customer payment creation failed:', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save customer payment';
      setServerError(msg);
    },
  });

  const supplierPaymentMutation = useMutation({
    mutationFn: (data: any) => {
      // Clean number coercion: strip out any commas
      const rawAmount = String(data.amount ?? '0').replace(/,/g, '').trim();
      const cleanAmount = parseFloat(rawAmount) || 0;
      const targetBankAccountId = data.bank_account_id || selectedBankAccountId || null;

      const payload = {
        supplier_id: data.entity_id,
        purchase_invoice_id: data.invoice_id || null,
        payment_date: data.payment_date,
        amount: cleanAmount,
        payment_method: data.payment_method,
        bank_account_id: targetBankAccountId,
        notes: data.notes || null,
        cheque_number: data.cheque_number || null,
        cheque_due_date: data.cheque_due_date || null,
      };

      return supplierPaymentsService.createPayment(payload as any);
    },
    onSuccess: () => {
      setServerError(null);
      qc.invalidateQueries({ queryKey: ['supplier-payments'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      if (selectedEntityId) {
        qc.invalidateQueries({ queryKey: ['suppliers', selectedEntityId, 'statement'] });
        qc.invalidateQueries({ queryKey: ['suppliers', selectedEntityId, 'ledger'] });
      }
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      console.error('Supplier payment creation failed:', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save supplier payment';
      setServerError(msg);
    },
  });

  const isPending = customerPaymentMutation.isPending || supplierPaymentMutation.isPending;

  const onSubmit = (data: PaymentFormValues) => {
    setServerError(null);

    const rawAmount = String(data.amount ?? '0').replace(/,/g, '').trim();
    const cleanAmount = parseFloat(rawAmount) || 0;

    // Validate bank account selection for bank or cheque payments
    const isBankOrCheque =
      data.payment_method === 'BANK' ||
      data.payment_method === 'BANK_TRANSFER' ||
      data.payment_method === 'CHEQUE' ||
      data.payment_method === 'PDC';

    const effectiveBankAccountId = data.bank_account_id || selectedBankAccountId;

    if (isBankOrCheque && !effectiveBankAccountId) {
      setServerError(`Please select a ${isSupplier ? 'source' : 'target'} bank account.`);
      return;
    }

    // Safeguard: Prevent payment entries on settled or overpaid invoices
    if (selectedInvoice && selectedInvoice.balance_due <= 0) {
      setServerError(
        selectedInvoice.balance_due < 0
          ? `Invoice is overpaid by Rs. ${Math.abs(selectedInvoice.balance_due).toLocaleString('en-PK', { minimumFractionDigits: 2 })}. Further payments cannot be recorded.`
          : 'Invoice is fully settled. Further payments cannot be recorded.'
      );
      return;
    }

    // Strict settlement limit check on client: do not allow overpayment beyond balance_due
    if (selectedInvoice && selectedInvoice.balance_due > 0 && cleanAmount > selectedInvoice.balance_due) {
      setServerError(
        `Cannot overpay ${isSupplier ? 'bill' : 'invoice'}. Maximum balance due is PKR ${selectedInvoice.balance_due.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`
      );
      return;
    }

    // Strict liquidity limit check on client: hard-cap outgoing payments to available balance
    if (isSupplier && availableOutflowBalance !== Infinity && cleanAmount > availableOutflowBalance) {
      setServerError(
        `INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds. Available balance is Rs. ${availableOutflowBalance.toLocaleString()}, requested Rs. ${cleanAmount.toLocaleString()}.`
      );
      return;
    }

    const payloadData = {
      ...data,
      amount: cleanAmount,
      bank_account_id: effectiveBankAccountId || '',
    };

    if (isSupplier) {
      supplierPaymentMutation.mutate(payloadData);
    } else {
      customerPaymentMutation.mutate(payloadData);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto pt-10 pb-10 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isSupplier ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {isSupplier ? 'Record Supplier Payment' : 'Record Customer Payment'}
              </h2>
              <p className="text-xs text-slate-500">
                {isSupplier
                  ? 'Settle supplier purchase bills with cash, bank transfer, or PDC.'
                  : 'Settle customer sales invoices with cash, bank, PDC, or supplier credit.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-6 overflow-y-auto">
          {serverError && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
              <span>{serverError}</span>
              <button type="button" onClick={() => setServerError(null)} className="text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form id="record-payment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Entity Selector (Customer or Supplier) */}
              <div>
                <label htmlFor="entity_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {isSupplier ? 'Supplier' : 'Customer'} <span className="text-red-500">*</span>
                </label>
                <select
                  id="entity_id"
                  {...register('entity_id')}
                  onChange={(e) => {
                    register('entity_id').onChange(e);
                    setValue('invoice_id', '', { shouldValidate: true });
                    setValue('amount', 0);
                  }}
                  disabled={!!preselectedEntityId}
                  className={inputCls(!!errors.entity_id) + (preselectedEntityId ? ' bg-slate-50 text-slate-700 cursor-not-allowed font-medium' : '')}
                >
                  <option value="">
                    {isSupplier
                      ? isLoadingSuppliers
                        ? 'Loading suppliers...'
                        : 'Select a supplier...'
                      : isLoadingCustomers
                      ? 'Loading customers...'
                      : 'Select a customer...'}
                  </option>
                  {isSupplier
                    ? suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} {supplier.code ? `(${supplier.code})` : ''}
                        </option>
                      ))
                    : customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} {customer.code ? `(${customer.code})` : ''}
                        </option>
                      ))}
                </select>
                {errors.entity_id && <p className="mt-1 text-xs text-red-600">{errors.entity_id.message}</p>}
              </div>

              {/* Link to Invoice Dropdown */}
              <div>
                <label htmlFor="invoice_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {isSupplier ? 'Link to Purchase Bill' : 'Link to Invoice'} <span className="text-red-500">*</span>
                </label>
                <select
                  id="invoice_id"
                  {...register('invoice_id')}
                  onChange={(e) => {
                    register('invoice_id').onChange(e);
                    const invId = e.target.value;
                    const matched = availableInvoices.find((inv) => inv.id === invId);
                    if (matched && matched.balance_due > 0) {
                      setValue('amount', Math.round(matched.balance_due * 100) / 100, {
                        shouldValidate: true,
                      });
                    }
                  }}
                  disabled={!selectedEntityId}
                  className={inputCls(!!errors.invoice_id)}
                >
                  <option value="">
                    {isSupplier ? '-- Choose a Purchase Bill to Settle --' : '-- Choose an Invoice to Settle --'}
                  </option>
                  {availableInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} — Total: Rs. {invoice.total_amount} | Due: Rs. {invoice.balance_due}
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
                {selectedEntityId && isSupplier && isLoadingPurchases && (
                  <p className="mt-1 text-xs text-blue-600 font-medium">
                    Loading unpaid purchase bills...
                  </p>
                )}
                {selectedEntityId && !(isSupplier && isLoadingPurchases) && availableInvoices.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600 font-medium">
                    No unpaid {isSupplier ? 'bills' : 'invoices'} found for this {isSupplier ? 'supplier' : 'customer'}. For advance payments, use "Log Advance Deposit".
                  </p>
                )}
                {errors.invoice_id && <p className="mt-1 text-xs text-red-600">{errors.invoice_id.message}</p>}
              </div>

              {/* Payment Date */}
              <div>
                <label htmlFor="payment_date" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="payment_date"
                  type="date"
                  {...register('payment_date')}
                  className={inputCls(!!errors.payment_date)}
                />
                {errors.payment_date && <p className="mt-1 text-xs text-red-600">{errors.payment_date.message}</p>}
              </div>

              {/* Payment Method */}
              <div>
                <label htmlFor="payment_method" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  id="payment_method"
                  {...register('payment_method')}
                  disabled={!isSupplier && isCashier}
                  className={
                    inputCls(!!errors.payment_method) +
                    (!isSupplier && isCashier ? ' bg-slate-100 font-semibold text-slate-700 cursor-not-allowed' : '')
                  }
                >
                  <option value="CASH" disabled={isSupplier && cashDrawerBalance <= 0}>
                    {isSupplier ? `Cash in Drawer (Balance: Rs. ${cashDrawerBalance.toLocaleString()})` : 'Cash in Drawer (Galla)'}
                  </option>
                  {isSupplier ? (
                    <>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Post-Dated Cheque (PDC)</option>
                    </>
                  ) : (
                    <>
                      {!isCashier && <option value="BANK">Bank Account</option>}
                      {!isCashier && <option value="CHEQUE">Post-Dated Cheque (PDC)</option>}
                      {!isCashier && <option value="DIRECT_TO_SUPPLIER">Direct to Supplier (Tripartite)</option>}
                    </>
                  )}
                </select>
                {!isSupplier && isCashier && (
                  <p className="mt-1 text-[11px] text-slate-500 font-medium">
                    Cashier payments are automatically routed to Cash in Drawer (Galla).
                  </p>
                )}
                {errors.payment_method && <p className="mt-1 text-xs text-red-600">{errors.payment_method.message}</p>}
              </div>

              {/* Direct to Supplier (Tripartite) selection */}
              {!isSupplier && selectedPaymentMethod === 'DIRECT_TO_SUPPLIER' && (
                <div className="md:col-span-2">
                  <label htmlFor="supplier_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Select Target Supplier <span className="text-red-500">*</span>
                  </label>
                  <select id="supplier_id" {...register('supplier_id')} className={inputCls(!!errors.supplier_id)}>
                    <option value="">Select Target Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) — Balance: Rs. {(Number(s?.outstanding_payable ?? (s as any)?.outstanding_balance) || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  {errors.supplier_id && <p className="mt-1 text-xs text-red-600">{errors.supplier_id.message}</p>}
                </div>
              )}

              {/* Bank Account Selection (for Bank or Cheque) */}
              {(selectedPaymentMethod === 'BANK' ||
                selectedPaymentMethod === 'BANK_TRANSFER' ||
                selectedPaymentMethod === 'CHEQUE' ||
                selectedPaymentMethod === 'PDC') && (
                <div className="md:col-span-2">
                  <label htmlFor="bank_account_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Select {isSupplier ? 'Source' : 'Target'} Bank Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="bank_account_id"
                    {...register('bank_account_id')}
                    value={selectedBankAccountId || ''}
                    onChange={(e) => {
                      setValue('bank_account_id', e.target.value, {
                        shouldValidate: true,
                        shouldDirty: true,
                        shouldTouch: true,
                      });
                    }}
                    className={inputCls(!!errors.bank_account_id)}
                  >
                    <option value="">Select Bank Account...</option>
                    {(bankAccounts || []).map((acc) => (
                      <option
                        key={acc.id}
                        value={acc.id}
                        disabled={isSupplier && Number(acc.current_balance) <= 0}
                      >
                        {acc.bank_name} — {acc.account_title} (Balance: Rs. {Number(acc.current_balance).toLocaleString()})
                      </option>
                    ))}
                  </select>
                  {errors.bank_account_id && <p className="mt-1 text-xs text-red-600">{errors.bank_account_id.message}</p>}
                </div>
              )}


              {/* Post-Dated Cheque (PDC) fields */}
              {(selectedPaymentMethod === 'CHEQUE' || selectedPaymentMethod === 'PDC') && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 md:col-span-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Post-Dated Cheque (PDC) Details
                  </h4>
                  <div className={`grid grid-cols-1 ${!isSupplier ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
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
                    {!isSupplier && (
                      <div>
                        <label htmlFor="cheque_bank_name" className="mb-1 block text-xs font-medium text-slate-700">Customer Origin Bank *</label>
                        <input
                          id="cheque_bank_name"
                          type="text"
                          {...register('cheque_bank_name')}
                          placeholder="e.g. Meezan Bank"
                          className={inputCls(!!errors.cheque_bank_name)}
                        />
                      </div>
                    )}
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

              {/* Amount Received / Paid with strict ceiling cap & settlement safeguard */}
              {selectedInvoice && selectedInvoice.balance_due <= 0 ? (
                <div className="md:col-span-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <span>
                      {selectedInvoice.balance_due < 0
                        ? `Invoice is OVERPAID by Rs. ${Math.abs(selectedInvoice.balance_due).toLocaleString('en-PK', { minimumFractionDigits: 2 })} (No payment due)`
                        : 'Invoice is FULLY SETTLED (Rs. 0.00 balance due)'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-amber-700">
                    Payment entry is disabled because this document has no remaining unpaid balance.
                  </p>
                </div>
              ) : (
                <div className="md:col-span-2">
                  {/* Outflow Liquidity Warning Banner */}
                  {isSupplier && availableOutflowBalance <= 0 && (
                    <div className="mb-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>
                        INSUFFICIENT LIQUIDITY: Selected account or drawer has Rs. {availableOutflowBalance.toLocaleString()} available. You cannot withdraw more cash than the account holds.
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                    <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
                      {isSupplier ? 'Amount to Pay' : 'Amount Received'} <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      {selectedInvoice && (
                        <span className="text-xs font-bold text-slate-600">
                          Balance Due: <span className="font-mono text-emerald-700 font-extrabold">{formatCurrency(selectedInvoice.balance_due)}</span>
                        </span>
                      )}
                      {isSupplier && availableOutflowBalance !== Infinity && (
                        <span className={`text-xs font-bold ${availableOutflowBalance <= 0 ? 'text-red-600' : 'text-slate-600'}`}>
                          Available Balance: <span className="font-mono">{formatCurrency(availableOutflowBalance)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative w-full">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-slate-500 sm:text-sm">Rs.</span>
                    </div>
                    <input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={calculatedMaxAmount !== undefined ? calculatedMaxAmount : (selectedInvoice ? Math.max(0, selectedInvoice.balance_due) : undefined)}
                      {...register('amount')}
                      className={`block w-full rounded-xl border px-3 py-3 pl-10 text-lg font-medium transition-colors focus:outline-none focus:ring-2 ${
                        selectedInvoice && selectedInvoice.balance_due > 0 ? 'pr-36' : ''
                      } ${

                        errors.amount
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20 text-red-900'
                          : 'border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 text-emerald-900 bg-emerald-50/50'
                      }`}
                    />
                    {selectedInvoice && selectedInvoice.balance_due > 0 && (
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
              )}
            </div>

            {/* Notes / Reference */}
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Reference</label>
              <textarea
                id="notes"
                {...register('notes')}
                rows={2}
                className={inputCls(false)}
                placeholder="Cheque number, transaction ID, bank reference..."
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
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
            form="record-payment-form"
            disabled={isPending || Boolean(selectedInvoice && selectedInvoice.balance_due <= 0)}
            title={selectedInvoice && selectedInvoice.balance_due <= 0 ? 'Cannot save payment on a settled or overpaid invoice' : undefined}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-950" />
                Saving Payment...
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

export default RecordPaymentModal;
