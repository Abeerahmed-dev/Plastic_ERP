import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ArrowDownLeft, Wallet, AlertCircle, Loader2, Link2 } from 'lucide-react';
import { paymentsService } from '../../services/payments.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { getCustomers, getCustomerRefundableCredits } from '../../services/customers.service';
import { Customer } from '../../types/customer.types';
import { RefundableCreditSource } from '../../types/payment.types';

interface CustomerRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  onSuccess?: () => void;
}

export const CustomerRefundModal: React.FC<CustomerRefundModalProps> = ({
  isOpen,
  onClose,
  customer,
  invoiceId,
  invoiceNumber,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customer?.id || '');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [refundDate, setRefundDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [source, setSource] = useState<string>('CASH_DRAWER');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { data: customersData } = useQuery({
    queryKey: ['customers', 'with-advances'],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    enabled: isOpen && !customer,
  });

  const availableCustomers = (customersData?.data || []).filter(
    (c) => Number(c.advance_credit || (c as any).advance || 0) > 0
  );

  useEffect(() => {
    if (customer) {
      setSelectedCustomerId(customer.id);
    } else if (availableCustomers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(availableCustomers[0].id);
    }
  }, [customer, availableCustomers]);

  const activeCustomer =
    customer ||
    availableCustomers.find((c) => c.id === selectedCustomerId) ||
    availableCustomers[0] ||
    null;

  const targetCustomerId = activeCustomer?.id || selectedCustomerId;
  const advanceCredit = Number(activeCustomer?.advance_credit || (activeCustomer as any)?.advance || 0);

  // Fetch refundable credit sources
  const { data: creditSources = [], isLoading: isLoadingCredits } = useQuery({
    queryKey: ['refundable-credits', 'customer', targetCustomerId],
    queryFn: () => getCustomerRefundableCredits(targetCustomerId),
    enabled: isOpen && !!targetCustomerId,
  });

  useEffect(() => {
    if (creditSources.length > 0) {
      // If invoiceId was passed via props, prioritize matching it
      if (invoiceId) {
        const matchingInv = creditSources.find((s) => s.id === invoiceId);
        if (matchingInv) {
          setSelectedSourceId(matchingInv.id);
          setAmount(matchingInv.available_credit.toString());
          return;
        }
      }
      const existing = creditSources.find((s) => s.id === selectedSourceId);
      if (!existing) {
        setSelectedSourceId(creditSources[0].id);
        setAmount(creditSources[0].available_credit.toString());
      }
    } else {
      setSelectedSourceId('');
      if (advanceCredit > 0) {
        setAmount(advanceCredit.toString());
      } else {
        setAmount('');
      }
    }
  }, [creditSources, targetCustomerId, invoiceId]);

  const selectedSource = creditSources.find((s) => s.id === selectedSourceId) || null;
  const effectiveMaxCredit = selectedSource ? selectedSource.available_credit : advanceCredit;

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sourceId = e.target.value;
    setSelectedSourceId(sourceId);
    const found = creditSources.find((s) => s.id === sourceId);
    if (found) {
      setAmount(found.available_credit.toString());
    } else {
      setAmount('');
    }
  };

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsService.getBankAccounts,
    enabled: isOpen,
  });

  const formatSourceDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCreditOptionText = (src: RefundableCreditSource) => {
    const formattedAmt = Number(src.available_credit || 0).toLocaleString('en-PK');
    if (src.type === 'OVERPAID_INVOICE') {
      return `Overpayment on ${src.reference} — Rs. ${formattedAmt} available`;
    }
    const dateFormatted = formatSourceDate(src.date);
    return `Advance Deposit (${dateFormatted}) — Rs. ${formattedAmt} available`;
  };

  const refundMutation = useMutation({
    mutationFn: (data: {
      customer_id: string;
      amount: number;
      refund_date: string;
      source: string;
      notes: string;
      source_id?: string | null;
      source_type?: string | null;
      linked_invoice_id?: string | null;
    }) => paymentsService.createRefund(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['liquidity-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['refundable-credits'] });
      if (activeCustomer?.id) {
        queryClient.invalidateQueries({ queryKey: ['customers', activeCustomer.id, 'ledger'] });
      }
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || 'Failed to process refund';
      setError(msg);
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeCustomer) {
      setError('Please select a customer with an active Advance Wallet balance.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid refund amount greater than 0.');
      return;
    }

    if (numAmount > effectiveMaxCredit) {
      setError(
        `Refund amount cannot exceed available credit of PKR ${effectiveMaxCredit.toLocaleString()}${
          selectedSource ? ` on ${selectedSource.reference}` : ''
        }.`
      );
      return;
    }

    refundMutation.mutate({
      customer_id: activeCustomer.id,
      amount: numAmount,
      refund_date: refundDate,
      source,
      notes: notes.trim(),
      source_id: selectedSource?.id || null,
      source_type: selectedSource?.type || null,
      linked_invoice_id: selectedSource?.type === 'OVERPAID_INVOICE' && selectedSource?.id ? selectedSource.id : (invoiceId || null),
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 flex min-h-full items-center justify-center">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header (Pinned) */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-3.5 sm:py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 text-red-700 rounded-xl">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Process Customer Refund</h3>
              <p className="text-xs text-slate-500">
                Traceable refund locked to specific invoice or advance credit
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
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

          {/* Customer Selection or Card */}
          {!customer ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Customer (with Wallet Balance)
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setAmount('');
                }}
                className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition bg-white"
              >
                {availableCustomers.length === 0 ? (
                  <option value="">No customers currently have advance wallet credit</option>
                ) : (
                  availableCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) — Wallet: {formatCurrency(Number(c.advance_credit || (c as any).advance || 0))}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Customer</p>
                  <p className="text-sm font-bold text-slate-900">{activeCustomer?.name}</p>
                  {activeCustomer?.code && (
                    <p className="text-xs text-slate-400 font-mono">({activeCustomer.code})</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="flex items-center justify-end gap-1 text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    <Wallet className="w-3.5 h-3.5 text-amber-700" />
                    Advance Wallet
                  </span>
                  <p className="text-base font-extrabold text-amber-900 font-mono mt-0.5">
                    {formatCurrency(advanceCredit)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Refund Source Dropdown (Traceable Credit Source) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Link2 className="w-3.5 h-3.5 text-blue-600" />
                Select Credit Source to Refund <span className="text-red-500">*</span>
              </label>
              {isLoadingCredits && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" /> Scanning ledger...
                </span>
              )}
            </div>
            <select
              value={selectedSourceId}
              onChange={handleSourceChange}
              disabled={isLoadingCredits || creditSources.length === 0}
              className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition bg-white disabled:bg-slate-50 disabled:text-slate-400 font-medium"
              required
            >
              {creditSources.length === 0 ? (
                <option value="">
                  {isLoadingCredits
                    ? 'Scanning ledger for refundable credits...'
                    : 'No specific refundable credits found'}
                </option>
              ) : (
                creditSources.map((src) => (
                  <option key={src.id} value={src.id}>
                    {formatCreditOptionText(src)}
                  </option>
                ))
              )}
            </select>
            {selectedSource && (
              <div className="mt-1.5 px-2.5 py-1.5 bg-blue-50/70 border border-blue-100 rounded-lg flex items-center justify-between text-[11px]">
                <span className="text-blue-900">
                  Locked to: <strong className="font-semibold">{selectedSource.type === 'OVERPAID_INVOICE' ? 'Invoice' : 'Advance'} ({selectedSource.reference})</strong>
                </span>
                <span className="font-mono font-bold text-blue-700">
                  Cap: Rs. {Number(selectedSource.available_credit).toLocaleString('en-PK')}
                </span>
              </div>
            )}
          </div>

          {/* Amount (PKR) with auto-fill & max check */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Refund Amount (PKR) <span className="text-red-500">*</span>
              </label>
              {effectiveMaxCredit > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(effectiveMaxCredit.toString())}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Max ({formatCurrency(effectiveMaxCredit)})
                </button>
              )}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-slate-400 font-bold sm:text-xs">Rs.</span>
              </div>
              <input
                type="number"
                step="any"
                min="1"
                max={effectiveMaxCredit}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3.5 text-sm font-mono font-bold text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                required
                autoFocus
              />
            </div>
            {selectedSource && parseFloat(amount) > selectedSource.available_credit && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                Amount cannot exceed the selected source balance of Rs. {Number(selectedSource.available_credit).toLocaleString('en-PK')}.
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Refund Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={refundDate}
              onChange={(e) => setRefundDate(e.target.value)}
              className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition bg-white"
              required
            />
          </div>

          {/* Bank / Cash Source */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Source (Outflow Drawer / Account)
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition bg-white"
            >
              <option value="CASH_DRAWER">Cash in Drawer (Physical Cash)</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  Bank: {acc.bank_name} - {acc.account_title || (acc as any).account_name} ({acc.account_number})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cash refund from customer advance"
              className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition resize-none"
            />
          </div>

          </div>

          {/* Actions (Pinned Footer) */}
          <div className="shrink-0 bg-slate-50/80 px-5 sm:px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={refundMutation.isPending}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                refundMutation.isPending ||
                !amount ||
                parseFloat(amount) <= 0 ||
                effectiveMaxCredit <= 0 ||
                parseFloat(amount) > effectiveMaxCredit ||
                !activeCustomer
              }
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition cursor-pointer"
            >
              {refundMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="w-4 h-4" />
                  Confirm Cash Refund
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
