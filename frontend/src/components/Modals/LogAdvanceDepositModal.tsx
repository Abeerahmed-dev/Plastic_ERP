import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Wallet, AlertCircle, Loader2, ArrowUpRight } from 'lucide-react';
import { paymentsService } from '../../services/payments.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { getCustomers } from '../../services/customers.service';
import { getSuppliers } from '../../services/suppliers.service';
import { Customer } from '../../types/customer.types';
import { Supplier } from '../../types/supplier.types';

export interface LogAdvanceDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'customer' | 'supplier';
  customer?: Customer | null;
  supplier?: Supplier | null;
  onSuccess?: () => void;
}

export const LogAdvanceDepositModal: React.FC<LogAdvanceDepositModalProps> = ({
  isOpen,
  onClose,
  entityType,
  customer,
  supplier,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    entityType === 'customer' ? customer?.id || '' : supplier?.id || ''
  );
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [source, setSource] = useState<string>('CASH_DRAWER');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Fetch customers if entityType is customer and none preselected
  const { data: customersData } = useQuery({
    queryKey: ['customers', 'all-for-advance'],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    enabled: isOpen && entityType === 'customer' && !customer,
  });

  // Fetch suppliers if entityType is supplier and none preselected
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'all-for-advance'],
    queryFn: () => getSuppliers({ page: 1, limit: 100 }),
    enabled: isOpen && entityType === 'supplier' && !supplier,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsService.getBankAccounts,
    enabled: isOpen,
  });

  const customersList = customersData?.data || [];
  const suppliersList = suppliersData?.data || [];

  useEffect(() => {
    if (entityType === 'customer') {
      if (customer) {
        setSelectedEntityId(customer.id);
      } else if (customersList.length > 0 && !selectedEntityId) {
        setSelectedEntityId(customersList[0].id);
      }
    } else {
      if (supplier) {
        setSelectedEntityId(supplier.id);
      } else if (suppliersList.length > 0 && !selectedEntityId) {
        setSelectedEntityId(suppliersList[0].id);
      }
    }
  }, [customer, supplier, customersList, suppliersList, entityType]);

  const activeCustomer =
    customer ||
    customersList.find((c) => c.id === selectedEntityId) ||
    null;

  const activeSupplier =
    supplier ||
    suppliersList.find((s) => s.id === selectedEntityId) ||
    null;

  const currentWalletBalance =
    entityType === 'customer'
      ? Number(activeCustomer?.advance_credit || (activeCustomer as any)?.advance || 0)
      : Number((activeSupplier as any)?.advance_payable || 0);

  const advanceMutation = useMutation({
    mutationFn: (data: {
      entity_id: string;
      amount: number;
      payment_date: string;
      source: string;
      notes: string;
    }) => {
      if (entityType === 'customer') {
        return paymentsService.logCustomerAdvance({
          customer_id: data.entity_id,
          amount: data.amount,
          payment_date: data.payment_date,
          source: data.source,
          notes: data.notes,
        });
      } else {
        return paymentsService.logSupplierAdvance({
          supplier_id: data.entity_id,
          amount: data.amount,
          payment_date: data.payment_date,
          source: data.source,
          notes: data.notes,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['liquidity-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (activeCustomer?.id) {
        queryClient.invalidateQueries({ queryKey: ['customers', activeCustomer.id, 'ledger'] });
      }
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || 'Failed to log advance deposit';
      setError(msg);
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetId = entityType === 'customer' ? activeCustomer?.id : activeSupplier?.id;
    if (!targetId) {
      setError(`Please select a ${entityType === 'customer' ? 'customer' : 'supplier'}.`);
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    advanceMutation.mutate({
      entity_id: targetId,
      amount: numAmount,
      payment_date: paymentDate,
      source,
      notes: notes.trim() || `${entityType === 'customer' ? 'Customer' : 'Supplier'} Advance Deposit to Wallet`,
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
    }).format(val);
  };

  const entityTitle = entityType === 'customer' ? 'Customer' : 'Supplier';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Log Advance Deposit</h3>
              <p className="text-xs text-slate-500">
                Deposit cash/bank directly into {entityTitle} Advance Wallet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Entity Selection or Details Card */}
          {entityType === 'customer' ? (
            !customer ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Customer
                </label>
                <select
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition bg-white"
                >
                  <option value="">Select a customer...</option>
                  {customersList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-600">Customer</p>
                    <p className="text-sm font-bold text-slate-900">{activeCustomer?.name}</p>
                    {activeCustomer?.code && (
                      <p className="text-xs text-slate-400 font-mono">({activeCustomer.code})</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="flex items-center justify-end gap-1 text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                      Current Wallet
                    </span>
                    <p className="text-base font-extrabold text-emerald-900 font-mono mt-0.5">
                      {formatCurrency(currentWalletBalance)}
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : !supplier ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Supplier
              </label>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition bg-white"
              >
                <option value="">Select a supplier...</option>
                {suppliersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Supplier</p>
                  <p className="text-sm font-bold text-slate-900">{activeSupplier?.name}</p>
                  {activeSupplier?.code && (
                    <p className="text-xs text-slate-400 font-mono">({activeSupplier.code})</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="flex items-center justify-end gap-1 text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                    Current Advance
                  </span>
                  <p className="text-base font-extrabold text-emerald-900 font-mono mt-0.5">
                    {formatCurrency(currentWalletBalance)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Amount (PKR) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Deposit Amount (PKR) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-slate-400 font-bold sm:text-xs">Rs.</span>
              </div>
              <input
                type="number"
                step="any"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3.5 text-sm font-mono font-bold text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition bg-white"
              required
            />
          </div>

          {/* Bank / Cash Source */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Bank / Cash Source <span className="text-red-500">*</span>
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition bg-white"
            >
              <option value="CASH_DRAWER">Cash in Drawer (Physical Cash)</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  Bank: {acc.bank_name} - {acc.account_title || (acc as any).account_name} ({acc.account_number})
                </option>
              ))}
            </select>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Advance deposit for upcoming delivery"
              className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={advanceMutation.isPending}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                advanceMutation.isPending ||
                !amount ||
                parseFloat(amount) <= 0 ||
                (!activeCustomer && !activeSupplier)
              }
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              {advanceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Logging...
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  Confirm Advance Deposit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
