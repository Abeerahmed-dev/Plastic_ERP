import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, AlertCircle, AlertTriangle, Receipt } from 'lucide-react';
import { expensesService, CreateExpenseData } from '../../services/expenses.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { toast, handleApiError } from '../../utils/toast';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  'Rent',
  'Utilities',
  'Payroll',
  'Logistics',
  'Office Supplies',
  'General/Other',
  'Salaries',
  'Petty Cash',
  'Tea & Refreshments',
  'Maintenance',
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash in Drawer (Shift Cash)' },
  { value: 'BANK', label: 'Bank Account' },
];

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('General/Other');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(today);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch list of active bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankAccountsService.getBankAccounts,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setCategory('General/Other');
      setPaymentMethod('CASH');
      setSelectedBankId('');
      setDescription('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setErrorMsg(null);
    }
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: (data: CreateExpenseData) => expensesService.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      toast.success('Operating expense logged successfully');
      onClose();
    },
    onError: (err: any) => {
      const message = handleApiError(err);
      setErrorMsg(message);
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      const err = 'Please enter a valid expense amount greater than 0.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    if (!description.trim()) {
      const err = 'Description is required (e.g. Lunch for workers, Monthly bill).';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    // Strict validation: enforce selectedBankId being present if paymentMethod === 'BANK'
    if (paymentMethod === 'BANK' && !selectedBankId) {
      const err = 'Bank Account ID is required';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    createMutation.mutate({
      amount: numAmount,
      category,
      payment_method: paymentMethod,
      bank_account_id: paymentMethod === 'BANK' ? selectedBankId : null,
      description: description.trim(),
      expense_date: expenseDate || today,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Log Operating Expense</h3>
              <p className="text-xs text-slate-500">Add daily operational expense record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-center gap-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (Rs.) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="e.g. 2500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
                required
              />
            </div>
          </div>

          {/* Category & Payment Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  if (e.target.value !== 'BANK') {
                    setSelectedBankId('');
                  }
                }}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditional Bank Account Dropdown */}
          {paymentMethod === 'BANK' && (
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Bank Account <span className="text-red-500">*</span>
              </label>
              <select 
                value={selectedBankId} 
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
                required
              >
                <option value="">-- Choose a Bank --</option>
                {bankAccounts.map((bank: any) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bank_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Lunch for workers, Monthly K-Electric bill, Tea for guests"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
              required
            />
          </div>

          {/* Liquidity Warning Banner */}
          {(paymentMethod === 'CASH' || paymentMethod === 'Cash in Drawer') && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-3 text-xs text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-900 mb-0.5">Liquidity Impact Warning</span>
                Logging this expense as <span className="font-semibold underline">Cash in Drawer</span> will deduct{' '}
                <span className="font-bold text-amber-950">
                  Rs. {parseFloat(amount) > 0 ? parseFloat(amount).toLocaleString() : '0'}
                </span>{' '}
                from today's physical cash tally during shift-end audit.
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
