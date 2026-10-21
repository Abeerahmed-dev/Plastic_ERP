import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, DollarSign, AlertCircle, Receipt } from 'lucide-react';
import { expensesService } from '../../services/expenses.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { toast, handleApiError } from '../../utils/toast';

interface LogExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseLogged?: () => void;
}

const EXPENSE_CATEGORIES = [
  'Tea & Refreshments',
  'Logistics & Loader Fees',
  'Petty Cash',
  'Salaries',
  'Utilities',
  'Maintenance',
  'Rent',
  'Other',
];

const getTodayLocalDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const LogExpenseModal: React.FC<LogExpenseModalProps> = ({
  isOpen,
  onClose,
  onExpenseLogged,
}) => {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<string>('Tea & Refreshments');
  const [description, setDescription] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(getTodayLocalDate());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch list of active bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankAccountsService.getBankAccounts,
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      const err = 'Please enter a valid expense amount';
      setError(err);
      toast.error(err);
      return;
    }

    if (!selectedBankId) {
      const err = 'Outflow Account is required';
      setError(err);
      toast.error(err);
      return;
    }

    const selectedAcc = bankAccounts.find((a: any) => a.id === selectedBankId);
    if (selectedAcc && Number(selectedAcc.current_balance) < Number(amount)) {
      const err = 'INSUFFICIENT_LIQUIDITY: Cannot log an expense larger than the account balance.';
      setError(err);
      toast.error(err);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await expensesService.createExpense({
        amount: Number(amount),
        category,
        description: description.trim() || undefined,
        expense_date: expenseDate,
        payment_method: selectedAcc?.account_title || selectedAcc?.bank_name || 'BANK',
        bank_account_id: selectedBankId,
      });

      // Invalidate all related financial and ledger queries
      queryClient.invalidateQueries({ queryKey: ['pnlReport'] });
      queryClient.invalidateQueries({ queryKey: ['expensesList'] });
      queryClient.invalidateQueries({ queryKey: ['cashLedger'] });
      queryClient.invalidateQueries({ queryKey: ['todayCashTally'] });
      queryClient.invalidateQueries({ queryKey: ['shiftAudit'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });

      toast.success('Expense recorded successfully');

      if (onExpenseLogged) {
        onExpenseLogged();
      }
      onClose();

      // Reset
      setAmount('');
      setDescription('');
      setSelectedBankId('');
    } catch (err: any) {
      const message = handleApiError(err);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Record Expense / Cash Out</h2>
              <p className="text-xs text-amber-100">Petty Cash & Operational Costs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Expense Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Amount (Rs.) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-sm">
                Rs.
              </span>
              <input
                type="number"
                min={1}
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 text-base font-black text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Outflow Account <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                required
              >
                <option value="">-- Choose Account --</option>
                {bankAccounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id} disabled={acc.current_balance <= 0}>
                    {acc.name || acc.account_title || acc.bank_name} (Balance: Rs. {acc.current_balance})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expense Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description / Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Tea for Ali Grocery client, Loader payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end items-center gap-3 pt-3 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
            >
              {isSubmitting ? 'Recording...' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
