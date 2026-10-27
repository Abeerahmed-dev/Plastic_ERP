import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  DollarSign,
  Calendar,
  CreditCard,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Wallet,
  ArrowDownRight,
  PlusCircle,
} from 'lucide-react';
import { employeesService } from '../../services/employees.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import {
  Employee,
  EmployeeTransactionType,
  CreateEmployeeLedgerEntryPayload,
} from '../../types/employee.types';

interface EmployeePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  currentRemaining: number;
  onSuccess: () => void;
  initialType?: EmployeeTransactionType;
}

export const EmployeePaymentModal: React.FC<EmployeePaymentModalProps> = ({
  isOpen,
  onClose,
  employee,
  currentRemaining,
  onSuccess,
  initialType = 'ADVANCE',
}) => {
  const queryClient = useQueryClient();
  const currentMonthStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [transactionType, setTransactionType] = useState<EmployeeTransactionType>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceMonth, setReferenceMonth] = useState<string>(currentMonthStr);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Fetch Cash in Drawer Balance
  const { data: drawerData } = useQuery({
    queryKey: ['cash-drawer-balance'],
    queryFn: () => bankAccountsService.getCashDrawerBalance(),
    enabled: isOpen,
  });
  const cashDrawerBalance = Number(drawerData?.balance ?? 0);

  // Fetch Bank Accounts for Bank Transfer
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsService.getBankAccounts(),
    enabled: isOpen && paymentMethod === 'BANK_TRANSFER',
  });

  useEffect(() => {
    if (isOpen) {
      setTransactionType(initialType);
      setDate(new Date().toISOString().split('T')[0]);
      setReferenceMonth(currentMonthStr);
      setPaymentMethod('CASH');
      setError(null);

      if (initialType === 'ADVANCE') {
        setAmount('');
        setDescription('Weekly advance / partial salary cash payout');
      } else if (initialType === 'SALARY') {
        setAmount(String(employee.salary || ''));
        setDescription(`Monthly salary entitlement for ${currentMonthStr}`);
      } else if (initialType === 'BONUS') {
        setAmount('');
        setDescription('Performance bonus / overtime incentive');
      } else if (initialType === 'DEDUCTION') {
        setAmount('');
        setDescription('Leave deduction / fine');
      }
    }
  }, [isOpen, initialType, employee, currentMonthStr]);

  const mutation = useMutation({
    mutationFn: (payload: CreateEmployeeLedgerEntryPayload) =>
      employeesService.addLedgerEntry(employee.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-drawer-balance'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['liquidity-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['cash-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['employee-ledger', employee.id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['pnlReport'] });
      queryClient.invalidateQueries({ queryKey: ['marginAnalyticsTrend'] });
      queryClient.invalidateQueries({ queryKey: ['pnlExpensesList'] });
      queryClient.invalidateQueries({ queryKey: ['financial-overview'] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || err.message || 'Failed to record entry');
    },
  });

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  const isOutflow = transactionType === 'ADVANCE' || transactionType === 'PAYMENT' || transactionType === 'DEDUCTION';
  const newProjectedRemaining = isOutflow
    ? currentRemaining - numAmount
    : currentRemaining + numAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    if (paymentMethod === 'BANK_TRANSFER' && !bankAccountId && isOutflow) {
      setError('Please select a bank account to disburse funds from.');
      return;
    }

    mutation.mutate({
      transaction_type: transactionType,
      amount: numAmount,
      date,
      reference_month: referenceMonth,
      payment_method: paymentMethod,
      bank_account_id: paymentMethod === 'BANK_TRANSFER' ? bankAccountId : null,
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Record Employee Transaction</h2>
              <p className="text-xs text-slate-300">
                {employee.name} ({employee.employee_id}) • Monthly: Rs. {Number(employee.salary || 0).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4.5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Transaction Type Segmented Switcher */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setTransactionType('ADVANCE');
                  setDescription('Weekly advance / partial salary cash payout');
                }}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                  transactionType === 'ADVANCE'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Advance / Weekly
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransactionType('SALARY');
                  setAmount(String(employee.salary || ''));
                  setDescription(`Monthly salary entitlement for ${referenceMonth}`);
                }}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                  transactionType === 'SALARY'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Monthly Salary
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransactionType('BONUS');
                  setDescription('Performance bonus');
                }}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                  transactionType === 'BONUS'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Bonus
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransactionType('DEDUCTION');
                  setDescription('Salary deduction');
                }}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                  transactionType === 'DEDUCTION'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Deduction
              </button>
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Amount (PKR) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center font-bold text-slate-400 text-sm">
                  Rs.
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="e.g. 20000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Payment Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Reference Month & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Salary Month
              </label>
              <input
                type="month"
                required
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
              />
            </div>

            {isOutflow && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'BANK_TRANSFER')}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
                >
                  <option value="CASH">💵 Cash in Drawer (Available: Rs. {cashDrawerBalance.toLocaleString()})</option>
                  <option value="BANK_TRANSFER">🏦 Bank Account Transfer</option>
                </select>
              </div>
            )}
          </div>

          {/* Bank Account Selector if Bank Transfer */}
          {isOutflow && paymentMethod === 'BANK_TRANSFER' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Disburse From Bank Account <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
              >
                <option value="">-- Select Bank Account --</option>
                {bankAccounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} - {acc.account_title || acc.account_number} (Balance: Rs. {Number(acc.current_balance || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description / Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Week 1 advance payment on demand"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
            />
          </div>

          {/* Live Calculation / Impact Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Salary Balance Impact Preview ({referenceMonth})
            </span>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Current Remaining Salary:</span>
              <span className="font-bold text-slate-800">Rs. {currentRemaining.toLocaleString()}</span>
            </div>
            {numAmount > 0 && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    {isOutflow ? '(-) Advance / Deduction:' : '(+) Accrued / Bonus:'}
                  </span>
                  <span className={`font-bold ${isOutflow ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {isOutflow ? `- Rs. ${numAmount.toLocaleString()}` : `+ Rs. ${numAmount.toLocaleString()}`}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-900">New Remaining Payable:</span>
                  <span className="font-extrabold font-mono text-emerald-700 text-base">
                    Rs. {newProjectedRemaining.toLocaleString()}
                  </span>
                </div>
                {isOutflow && (
                  <div className="pt-2 border-t border-dashed border-slate-300 flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-500">
                      {paymentMethod === 'CASH' ? 'Cash in Drawer Impact:' : 'Bank Account Impact:'}
                    </span>
                    <span className="font-bold text-amber-700">
                      {paymentMethod === 'CASH'
                        ? `Rs. ${cashDrawerBalance.toLocaleString()} → Rs. ${(cashDrawerBalance - numAmount).toLocaleString()}`
                        : bankAccountId && bankAccounts.find((b: any) => b.id === bankAccountId)
                        ? `Rs. ${Number(bankAccounts.find((b: any) => b.id === bankAccountId)?.current_balance || 0).toLocaleString()} → Rs. ${(Number(bankAccounts.find((b: any) => b.id === bankAccountId)?.current_balance || 0) - numAmount).toLocaleString()}`
                        : `- Rs. ${numAmount.toLocaleString()} from Bank`}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Confirm & Post to Ledger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
