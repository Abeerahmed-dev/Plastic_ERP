import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ArrowDownLeft, Wallet, AlertCircle, Loader2 } from 'lucide-react';
import { paymentsService } from '../../services/payments.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { getCustomers } from '../../services/customers.service';
import { invoicesService } from '../../services/invoices.service';
import { Customer } from '../../types/customer.types';
import { useReportStore } from '../../store/useReportStore';
import { toast } from '../../utils/toast';

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
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string>(invoiceId || '');
  const [amount, setAmount] = useState<string>('');
  const [source, setSource] = useState<string>('CASH_DRAWER');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { data: customersData } = useQuery({
    queryKey: ['customers', 'with-advances'],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    enabled: isOpen && !customer,
  });

  const availableCustomers = (customersData?.data || []).filter(
    (c) => Number(c.advance_credit || c.advance || 0) > 0
  );

  useEffect(() => {
    if (customer) {
      setSelectedCustomerId(customer.id);
    } else if (availableCustomers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(availableCustomers[0].id);
    }
  }, [customer, availableCustomers]);

  useEffect(() => {
    if (invoiceId) {
      setLinkedInvoiceId(invoiceId);
    }
  }, [invoiceId]);

  const activeCustomer =
    customer ||
    availableCustomers.find((c) => c.id === selectedCustomerId) ||
    availableCustomers[0] ||
    null;

  const advanceCredit = Number(activeCustomer?.advance_credit || activeCustomer?.advance || 0);

  const { data: customerInvoices = [] } = useQuery({
    queryKey: ['customer-invoices-for-refund', activeCustomer?.id],
    queryFn: async () => {
      const all = await invoicesService.getInvoices();
      return (all || []).filter(
        (inv: any) =>
          inv.customer_id === activeCustomer?.id &&
          inv.invoice_type !== 'CREDIT_NOTE' &&
          inv.status !== 'CANCELLED'
      );
    },
    enabled: isOpen && !!activeCustomer?.id,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsService.getBankAccounts,
    enabled: isOpen,
  });

  const refundMutation = useMutation({
    mutationFn: (data: {
      customer_id: string;
      amount: number;
      source: string;
      notes: string;
      linked_invoice_id?: string | null;
    }) => paymentsService.createRefund(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['liquidity-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['todayCashTally'] });
      queryClient.invalidateQueries({ queryKey: ['shiftAudit'] });
      queryClient.invalidateQueries({ queryKey: ['cashierTally'] });
      queryClient.invalidateQueries({ queryKey: ['cashLedger'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      useReportStore.getState().fetchLiquidityLedger();
      useReportStore.getState().fetchAllReports();
      toast.success('Cash refund successfully processed and deducted from Cash Drawer.');
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

    if (numAmount > advanceCredit) {
      setError(
        `Refund amount cannot exceed available Advance Wallet credit of PKR ${advanceCredit.toLocaleString()}.`
      );
      return;
    }

    refundMutation.mutate({
      customer_id: activeCustomer.id,
      amount: numAmount,
      source,
      notes: notes.trim() || 'Refunded cash to customer from Advance Wallet',
      linked_invoice_id: linkedInvoiceId || null,
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 text-red-700 rounded-xl">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Issue Cash Refund</h3>
              <p className="text-xs text-slate-500">Deduct cash from Customer Advance Wallet</p>
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

          {/* Customer Selection or Banner */}
          {!customer ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Customer (with Wallet Credit)
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
                  <option value="">No customers currently have advance credit</option>
                ) : (
                  availableCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) — Wallet: {formatCurrency(Number(c.advance_credit || c.advance || 0))}
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
                  <p className="text-sm font-bold text-slate-900">{activeCustomer.name}</p>
                  {activeCustomer.code && (
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

          {/* Wallet Balance Display if selected via dropdown */}
          {!customer && activeCustomer && (
            <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3.5 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-amber-700" />
                Available Wallet Balance:
              </span>
              <span className="text-sm font-extrabold text-amber-900 font-mono">
                {formatCurrency(advanceCredit)}
              </span>
            </div>
          )}

          {/* Refund Amount (Rs) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Refund Amount (PKR) <span className="text-red-500">*</span>
              </label>
              {advanceCredit > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(advanceCredit.toString())}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Max ({formatCurrency(advanceCredit)})
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="1"
                max={advanceCredit}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-mono font-bold text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Source Dropdown */}
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

          {/* Link to Parent Sales Invoice (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Link to Parent Sales Invoice (Optional)
            </label>
            {invoiceId ? (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800">
                Linked to: {invoiceNumber || invoiceId}
              </div>
            ) : (
              <select
                value={linkedInvoiceId}
                onChange={(e) => setLinkedInvoiceId(e.target.value)}
                className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition bg-white"
              >
                <option value="">-- General Advance Refund (No specific invoice) --</option>
                {customerInvoices.map((inv: any) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} (Invoice Total: PKR {Number(inv.total_amount || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              When linked, this cash refund nests directly under the invoice partial payment timeline.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Refunded cash for returned Korean newspaper"
              className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={refundMutation.isPending}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                refundMutation.isPending ||
                !amount ||
                parseFloat(amount) <= 0 ||
                !activeCustomer ||
                advanceCredit <= 0
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
