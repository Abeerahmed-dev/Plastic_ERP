import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ArrowRightLeft, Building2, Wallet, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { bankAccountsService } from '../../services/bank-accounts.service';

interface TransferFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface AccountOption {
  id: string;
  name: string;
  type: 'CASH' | 'BANK';
  balance: number;
  bankName?: string;
  accountNumber?: string;
}

export const TransferFundsModal: React.FC<TransferFundsModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();

  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch active bank accounts
  const { data: bankAccounts = [], isLoading: isLoadingBanks } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsService.getBankAccounts,
    enabled: isOpen,
  });

  // Fetch cash drawer balance
  const { data: cashDrawerData, isLoading: isLoadingCash } = useQuery({
    queryKey: ['cash-drawer-balance'],
    queryFn: bankAccountsService.getCashDrawerBalance,
    enabled: isOpen,
  });

  const cashDrawerBalance = Number(cashDrawerData?.balance ?? 0);

  // Combine into unified accounts list
  const allAccounts: AccountOption[] = [
    {
      id: 'CASH_DRAWER',
      name: 'Cash in Hand (Cash Drawer)',
      type: 'CASH',
      balance: cashDrawerBalance,
    },
    ...bankAccounts.map((acc) => ({
      id: acc.id,
      name: `${acc.account_title} (${acc.bank_name} - ${acc.account_number})`,
      type: 'BANK' as const,
      balance: Number(acc.current_balance || 0),
      bankName: acc.bank_name,
      accountNumber: acc.account_number,
    })),
  ];

  // Auto-select initial options if empty
  useEffect(() => {
    if (isOpen && allAccounts.length >= 2) {
      if (!fromAccountId) {
        setFromAccountId(allAccounts[0].id);
      }
      if (!toAccountId) {
        setToAccountId(allAccounts[1].id);
      }
    }
  }, [isOpen, allAccounts.length]);

  const selectedFromAccount = allAccounts.find((a) => a.id === fromAccountId);
  const selectedToAccount = allAccounts.find((a) => a.id === toAccountId);
  const fromBalance = selectedFromAccount?.balance ?? 0;
  const toBalance = selectedToAccount?.balance ?? 0;
  const numAmount = Number(amount) || 0;

  const transferMutation = useMutation({
    mutationFn: (data: {
      from_account_id: string;
      to_account_id: string;
      amount: number;
      notes?: string;
      date?: string;
    }) => bankAccountsService.transferFunds(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Funds transferred successfully');
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-drawer-balance'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      onSuccess?.();
      handleClose();
    },
    onError: (err: any) => {
      console.error('Transfer failed:', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Internal transfer failed';
      setFormError(msg);
    },
  });

  const handleClose = () => {
    setAmount('');
    setNotes('');
    setFormError(null);
    onClose();
  };

  const handleFromChange = (newFromId: string) => {
    setFromAccountId(newFromId);
    setFormError(null);
    if (newFromId === toAccountId) {
      // Pick another account for destination
      const other = allAccounts.find((a) => a.id !== newFromId);
      if (other) setToAccountId(other.id);
    }
  };

  const handleToChange = (newToId: string) => {
    if (newToId === fromAccountId) {
      setFormError('Source and destination accounts must be different');
      return;
    }
    setToAccountId(newToId);
    setFormError(null);
  };

  const handleQuickAmount = (ratio: number) => {
    if (fromBalance > 0) {
      const calculated = Math.round((fromBalance * ratio) * 100) / 100;
      setAmount(calculated.toString());
      setFormError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fromAccountId || !toAccountId) {
      setFormError('Please select both source and destination accounts.');
      return;
    }

    if (fromAccountId === toAccountId) {
      setFormError('Cannot transfer funds to the same account. Please choose a different destination.');
      return;
    }

    if (numAmount <= 0) {
      setFormError('Transfer amount must be greater than Rs. 0');
      return;
    }

    if (numAmount > fromBalance) {
      setFormError(`Insufficient liquidity. Selected source account only has Rs. ${fromBalance.toLocaleString()}`);
      return;
    }

    transferMutation.mutate({
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount: numAmount,
      notes: notes.trim() || undefined,
      date: transferDate,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl border border-white/20">
              <ArrowRightLeft className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">Transfer Funds (Contra Entry)</h2>
              <p className="text-xs text-blue-100">
                Move cash between Bank Accounts and the Cash Drawer
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs font-semibold animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Account Selectors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* From Account */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                From (Source Account) <span className="text-red-500">*</span>
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => handleFromChange(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-medium rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              >
                {allAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.type === 'CASH' ? '💵 ' : '🏦 '}
                    {acc.name} — (Rs. {acc.balance.toLocaleString()})
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between text-[11px] px-1">
                <span className="text-slate-500">Available Balance:</span>
                <span className={`font-bold font-mono ${fromBalance > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  Rs. {fromBalance.toLocaleString()}
                </span>
              </div>
            </div>

            {/* To Account */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                To (Destination Account) <span className="text-red-500">*</span>
              </label>
              <select
                value={toAccountId}
                onChange={(e) => handleToChange(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-medium rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              >
                {allAccounts.map((acc) => {
                  const isSame = acc.id === fromAccountId;
                  return (
                    <option key={acc.id} value={acc.id} disabled={isSame}>
                      {acc.type === 'CASH' ? '💵 ' : '🏦 '}
                      {acc.name} — (Rs. {acc.balance.toLocaleString()})
                      {isSame ? ' (Source)' : ''}
                    </option>
                  );
                })}
              </select>
              <div className="flex items-center justify-between text-[11px] px-1">
                <span className="text-slate-500">Current Balance:</span>
                <span className="font-bold font-mono text-slate-700">
                  Rs. {toBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Amount Section */}
          <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Transfer Amount (PKR) <span className="text-red-500">*</span>
              </label>
              {fromBalance > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(0.25)}
                    className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(0.5)}
                    className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(1)}
                    className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                  >
                    MAX
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rs.</span>
              <input
                type="number"
                required
                min={0.01}
                max={fromBalance}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setFormError(null);
                }}
                className="w-full pl-9 pr-3 py-2 text-sm font-bold font-mono rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Live Balance Impact Preview */}
            {numAmount > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-100">
                  <span className="text-[10px] font-semibold text-rose-600 block uppercase">
                    Source After Transfer
                  </span>
                  <span className="font-bold font-mono text-rose-700">
                    Rs. {(Math.max(0, fromBalance - numAmount)).toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <span className="text-[10px] font-semibold text-emerald-600 block uppercase">
                    Destination After Transfer
                  </span>
                  <span className="font-bold font-mono text-emerald-700">
                    Rs. {(toBalance + numAmount).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Date and Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Transfer Date
              </label>
              <input
                type="date"
                required
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reference / Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Cash withdrawal for daily payroll"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={transferMutation.isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferMutation.isPending || numAmount <= 0 || fromBalance < numAmount || fromAccountId === toAccountId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold text-xs hover:from-blue-700 hover:to-indigo-800 transition shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {transferMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  Execute Transfer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
