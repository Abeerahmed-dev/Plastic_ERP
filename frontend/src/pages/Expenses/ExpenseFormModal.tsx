import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Receipt,
  ChevronDown,
  Clock,
  CheckCircle2,
  ArrowRight,
  Truck,
  Building2,
  DollarSign,
  FileText,
} from 'lucide-react';
import {
  expensesService,
  CreateExpenseData,
  OutstandingExpense,
  Expense,
} from '../../services/expenses.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { toast, handleApiError } from '../../utils/toast';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialExpenseToPay?: OutstandingExpense | Expense | null;
}

const CATEGORIES = [
  'Logistics',
  'Salaries',
  'Utilities',
  'Rent',
  'Payroll',
  'Office Supplies',
  'General/Other',
  'Petty Cash',
  'Tea & Refreshments',
  'Maintenance',
];

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  initialExpenseToPay,
}) => {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  // Selected mode: 'PAY_EXISTING' or 'CREATE_NEW'
  const [selectedOutstanding, setSelectedOutstanding] = useState<OutstandingExpense | null>(null);

  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('Logistics');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(today);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch active bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankAccountsService.getBankAccounts,
    enabled: isOpen,
  });

  // Fetch cash drawer balance
  const { data: cashDrawerData } = useQuery({
    queryKey: ['cash-drawer-balance'],
    queryFn: bankAccountsService.getCashDrawerBalance,
    enabled: isOpen,
  });

  const cashDrawerBalance = Number(cashDrawerData?.balance ?? 0);

  // Fetch outstanding expenses (e.g. delivery charges from purchases or unpaid logistics)
  const { data: outstandingExpenses = [], isLoading: isLoadingOutstanding } = useQuery({
    queryKey: ['outstanding-expenses'],
    queryFn: () => expensesService.getOutstandingExpenses(),
    enabled: isOpen,
  });

  // Relevant outstanding expenses filtered for current category (or all if none match)
  const relevantOutstanding = useMemo(() => {
    if (!outstandingExpenses || outstandingExpenses.length === 0) return [];
    if (category === 'Logistics') {
      return outstandingExpenses.filter((o) => o.category?.toLowerCase() === 'logistics');
    }
    return outstandingExpenses.filter((o) => o.category?.toLowerCase() === category.toLowerCase());
  }, [outstandingExpenses, category]);

  // Reset or initialize state whenever modal opens or initialExpenseToPay changes
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setExpenseDate(new Date().toISOString().split('T')[0]);

      if (initialExpenseToPay) {
        // Pre-select for payment
        const remaining =
          initialExpenseToPay.remaining_amount !== undefined
            ? Number(initialExpenseToPay.remaining_amount)
            : Number(initialExpenseToPay.amount || 0) - Number(initialExpenseToPay.paid_amount || 0);

        setSelectedOutstanding({
          id: initialExpenseToPay.id,
          amount: Number(initialExpenseToPay.amount || 0),
          paid_amount: Number(initialExpenseToPay.paid_amount || 0),
          remaining_amount: remaining,
          category: initialExpenseToPay.category || 'Logistics',
          description: initialExpenseToPay.description,
          expense_date: initialExpenseToPay.expense_date,
          status: initialExpenseToPay.status || 'PENDING',
          purchase_id: initialExpenseToPay.purchase_id,
          purchase_invoice_number: initialExpenseToPay.purchase_invoice_number,
          supplier_name: initialExpenseToPay.supplier_name,
        });

        setAmount(remaining.toString());
        setCategory(initialExpenseToPay.category || 'Logistics');
        setSelectedBankId('');
        setDescription(
          initialExpenseToPay.purchase_invoice_number
            ? `Payment for delivery charges - Purchase ${initialExpenseToPay.purchase_invoice_number}`
            : initialExpenseToPay.description || 'Payment for expense'
        );
      } else {
        setSelectedOutstanding(null);
        setAmount('');
        setCategory('Logistics');
        setSelectedBankId('');
        setDescription('');
      }
    }
  }, [isOpen, initialExpenseToPay]);

  const selectOutstandingItem = (item: OutstandingExpense) => {
    setSelectedOutstanding(item);
    setAmount(item.remaining_amount.toString());
    setCategory(item.category || 'Logistics');
    setDescription(
      item.purchase_invoice_number
        ? `Payment for delivery charges - Purchase ${item.purchase_invoice_number}`
        : item.description || `Payment for ${item.category}`
    );
    setErrorMsg(null);
  };

  const clearSelectedOutstanding = () => {
    setSelectedOutstanding(null);
    setAmount('');
    setDescription('');
    setSelectedBankId('');
    setErrorMsg(null);
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateExpenseData) => expensesService.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-drawer-balance'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      toast.success('Operating expense recorded successfully');
      onClose();
    },
    onError: (err: any) => {
      const message = handleApiError(err);
      setErrorMsg(message);
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      expensesService.payExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-drawer-balance'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      toast.success('Expense payment recorded successfully');
      onClose();
    },
    onError: (err: any) => {
      const message = handleApiError(err);
      setErrorMsg(message);
    },
  });

  if (!isOpen) return null;

  const isSubmitting = createMutation.isPending || payMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      const err = 'Please enter a valid amount greater than 0.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    if (!selectedBankId) {
      const err = 'Outflow Account / Payment Status is required.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    // MODE 1: Paying an existing outstanding expense
    if (selectedOutstanding) {
      if (selectedBankId === 'UNPAID') {
        const err = 'Please select a valid payment account (Cash or Bank) to record this payment.';
        setErrorMsg(err);
        toast.error(err);
        return;
      }

      if (numAmount > selectedOutstanding.remaining_amount + 0.01) {
        const err = `Payment amount cannot exceed the remaining due amount of Rs. ${selectedOutstanding.remaining_amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
        setErrorMsg(err);
        toast.error(err);
        return;
      }

      const isCash = selectedBankId === 'CASH_DRAWER';
      const selectedAcc = isCash
        ? { name: 'Cash in Drawer (Galla)', balance: cashDrawerBalance }
        : (() => {
            const acc = bankAccounts.find((a: any) => a.id === selectedBankId);
            return acc
              ? { name: acc.account_title || acc.bank_name || 'Bank Account', balance: Number(acc.current_balance || 0) }
              : null;
          })();

      if (!selectedAcc) {
        const err = 'Selected Outflow Account was not found.';
        setErrorMsg(err);
        toast.error(err);
        return;
      }

      if (selectedAcc.balance < numAmount) {
        const err = `INSUFFICIENT_LIQUIDITY: Cannot pay Rs. ${numAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}. Selected account ${selectedAcc.name} has only Rs. ${selectedAcc.balance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}.`;
        setErrorMsg(err);
        toast.error(err);
        return;
      }

      payMutation.mutate({
        id: selectedOutstanding.id,
        data: {
          amount: numAmount,
          payment_method: isCash ? 'CASH' : (selectedAcc.name || 'BANK'),
          bank_account_id: isCash ? null : selectedBankId,
          payment_date: expenseDate || today,
          notes: description.trim() || undefined,
        },
      });
      return;
    }

    // MODE 2: Creating a new expense
    const isPendingUnpaid = selectedBankId === 'UNPAID';

    if (isPendingUnpaid) {
      // Unpaid expense - do not check liquidity, do not deduct from drawer/bank
      createMutation.mutate({
        amount: numAmount,
        category,
        payment_method: 'UNPAID',
        status: 'PENDING',
        bank_account_id: null,
        description: description.trim(),
        expense_date: expenseDate || today,
      });
      return;
    }

    const isCash = selectedBankId === 'CASH_DRAWER';
    const selectedAcc = isCash
      ? { name: 'Cash in Drawer (Galla)', balance: cashDrawerBalance }
      : (() => {
          const acc = bankAccounts.find((a: any) => a.id === selectedBankId);
          return acc
            ? { name: acc.account_title || acc.bank_name || 'Bank Account', balance: Number(acc.current_balance || 0) }
            : null;
        })();

    if (!selectedAcc) {
      const err = 'Selected Outflow Account was not found.';
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    if (selectedAcc.balance < numAmount) {
      const err = `INSUFFICIENT_LIQUIDITY: Cannot log an expense larger than ${selectedAcc.name} balance (Rs. ${selectedAcc.balance.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`;
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

    createMutation.mutate({
      amount: numAmount,
      category,
      payment_method: isCash ? 'CASH' : (selectedAcc.name || 'BANK'),
      status: 'PAID',
      bank_account_id: isCash ? null : selectedBankId,
      description: description.trim(),
      expense_date: expenseDate || today,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 rounded-2xl bg-white dark:bg-[#161925] shadow-2xl border border-slate-100 dark:border-[#23283B] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#23283B] px-6 py-4 bg-slate-50/70 dark:bg-[#0F111A]">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                selectedOutstanding ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400' : 'bg-red-100 text-red-600 dark:bg-rose-950/60 dark:text-rose-400'
              }`}
            >
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedOutstanding ? 'Pay Outstanding Expense' : 'Log Operating Expense'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedOutstanding
                  ? 'Record payment against existing payable without creating a duplicate expense'
                  : 'Add operational expense record (Paid or Payable / Pending)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:dark:bg-slate-800 hover:text-slate-600 hover:dark:text-white transition cursor-pointer"
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

          {/* ACTIVE OUTSTANDING SELECTION BANNER */}
          {selectedOutstanding ? (
            <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700">
                    Paying Existing Payable
                  </span>
                  {selectedOutstanding.purchase_invoice_number && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                      <FileText className="w-3 h-3" />
                      Invoice: {selectedOutstanding.purchase_invoice_number}
                    </span>
                  )}
                  {selectedOutstanding.supplier_name && (
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      Party: <span className="font-semibold text-slate-900 dark:text-white">{selectedOutstanding.supplier_name}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearSelectedOutstanding}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-red-600 hover:dark:text-rose-400 underline cursor-pointer"
                >
                  Clear / Log Standalone Instead
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-white dark:bg-[#121520] p-3 rounded-xl border border-amber-200 dark:border-amber-800/40 text-center">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Total Amount
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-white">
                    Rs. {Number(selectedOutstanding.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Already Paid
                  </span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    Rs. {Number(selectedOutstanding.paid_amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Remaining Due
                  </span>
                  <span className="text-sm font-bold text-red-600 dark:text-rose-400">
                    Rs. {Number(selectedOutstanding.remaining_amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {selectedOutstanding.description && (
                <p className="text-xs text-slate-600 italic">
                  &ldquo;{selectedOutstanding.description}&rdquo;
                </p>
              )}
            </div>
          ) : (
            /* OUTSTANDING LOGISTICS / EXPENSES NOTIFICATION & LIST */
            relevantOutstanding.length > 0 && (
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/25 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                      {relevantOutstanding.length} Outstanding {category === 'Logistics' ? 'Delivery / Logistics' : category} Charge{relevantOutstanding.length > 1 ? 's' : ''} Found
                    </span>
                  </div>
                  <span className="text-[11px] text-blue-700 dark:text-blue-400/90 font-medium">
                    Select one to pay directly without duplicate records
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {relevantOutstanding.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => selectOutstandingItem(item)}
                      className="group flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#121520] border border-blue-100 dark:border-[#23283B] hover:border-blue-400 hover:dark:border-blue-500/50 hover:shadow-xs hover:dark:bg-[#161a29] transition cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          {item.purchase_invoice_number ? (
                            <span className="font-bold text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 dark:border dark:border-blue-800/60 px-1.5 py-0.5 rounded">
                              {item.purchase_invoice_number}
                            </span>
                          ) : null}
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {item.description || `${item.category} Expense`}
                          </span>
                        </div>
                        {item.supplier_name && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Supplier: {item.supplier_name}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="block text-xs font-bold text-red-600 dark:text-rose-400">
                            Due: Rs. {Number(item.remaining_amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            Total: Rs. {Number(item.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-300 group-hover:text-blue-800 group-hover:dark:text-blue-200 bg-blue-50 dark:bg-blue-950/70 dark:border dark:border-blue-800/50 group-hover:bg-blue-100 group-hover:dark:bg-blue-900/80 px-2.5 py-1 rounded-lg transition"
                        >
                          <span>Pay</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {selectedOutstanding ? 'Payment Amount (Rs.)' : 'Amount (Rs.)'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={selectedOutstanding ? selectedOutstanding.remaining_amount : undefined}
                  placeholder="e.g. 2500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition"
                  required
                />
                {selectedOutstanding && (
                  <button
                    type="button"
                    onClick={() => setAmount(selectedOutstanding.remaining_amount.toString())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition"
                  >
                    Full Due
                  </button>
                )}
              </div>
              {selectedOutstanding && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Remaining due: Rs.{' '}
                  {Number(selectedOutstanding.remaining_amount).toLocaleString('en-PK', {
                    minimumFractionDigits: 2,
                  })}
                  . Partial payment allowed.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition"
                required
              />
            </div>
          </div>

          {/* Category & Outflow Account Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={category}
                  disabled={Boolean(selectedOutstanding)}
                  onChange={(e) => {
                    setCategory(e.target.value);
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#121520] focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition cursor-pointer disabled:bg-slate-100 disabled:dark:bg-slate-800 disabled:text-slate-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {selectedOutstanding ? 'Payment Source (Outflow Account)' : 'Outflow Account / Status'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#121520] focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition cursor-pointer truncate"
                  required
                >
                  <option value="">-- Select Outflow Account --</option>
                  {!selectedOutstanding && (
                    <option value="UNPAID">
                      ⏳ Record as Unpaid / Payable (Pay Later - No Cash Deducted)
                    </option>
                  )}
                  <option value="CASH_DRAWER">
                    💵 Cash in Drawer (Balance: Rs.{' '}
                    {cashDrawerBalance.toLocaleString('en-PK', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    )
                  </option>
                  {bankAccounts.map((acc: any) => {
                    const bal = Number(acc.current_balance || 0);
                    return (
                      <option key={acc.id} value={acc.id}>
                        🏦 {acc.account_title || acc.bank_name} (Balance: Rs.{' '}
                        {bal.toLocaleString('en-PK', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        )
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Notes {selectedOutstanding ? '(Optional)' : <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={2}
              placeholder={
                selectedOutstanding
                  ? 'Payment reference notes or comments...'
                  : 'e.g. Lunch for workers, Monthly K-Electric bill, Tea for guests'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition"
              required={!selectedOutstanding}
            />
          </div>

          {/* Liquidity Wall Status Banner */}
          {selectedBankId &&
            selectedBankId !== 'UNPAID' &&
            (() => {
              const selectedAcc =
                selectedBankId === 'CASH_DRAWER'
                  ? { name: 'Cash in Drawer (Galla)', balance: cashDrawerBalance, isCash: true }
                  : (() => {
                      const acc = bankAccounts.find((a: any) => a.id === selectedBankId);
                      return acc
                        ? {
                            name: acc.account_title || acc.bank_name,
                            balance: Number(acc.current_balance || 0),
                            isCash: false,
                          }
                        : null;
                    })();

              if (!selectedAcc) return null;
              const bal = selectedAcc.balance;
              const numAmt = parseFloat(amount) || 0;
              const isInsufficient = numAmt > bal;

              return (
                <div
                  className={`rounded-xl border p-3.5 flex items-start gap-3 text-xs ${
                    isInsufficient
                      ? 'bg-red-50 dark:bg-rose-950/20 border-red-200 dark:border-rose-900/40 text-red-800 dark:text-rose-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      isInsufficient ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  />
                  <div>
                    <span
                      className={`font-bold block mb-0.5 ${
                        isInsufficient ? 'text-red-900' : 'text-emerald-900'
                      }`}
                    >
                      {isInsufficient
                        ? 'Insufficient Liquidity Warning'
                        : 'Account Balance Available'}
                    </span>
                    Available balance in <span className="font-semibold">{selectedAcc.name}</span> is{' '}
                    <span className="font-bold">
                      Rs.{' '}
                      {bal.toLocaleString('en-PK', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    .
                    {numAmt > 0 && !isInsufficient && (
                      <span>
                        {' '}
                        Balance after outflow:{' '}
                        <span className="font-bold">
                          Rs.{' '}
                          {(bal - numAmt).toLocaleString('en-PK', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        .
                      </span>
                    )}
                    {isInsufficient && (
                      <span className="block mt-1 font-semibold text-red-700">
                        Cannot pay Rs.{' '}
                        {numAmt.toLocaleString('en-PK', { minimumFractionDigits: 2 })}{' '}
                        from {selectedAcc.name}.
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

          {selectedBankId === 'UNPAID' && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3.5 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-300">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Recording as Unpaid Payable</span>
                This expense will be recorded in OPEX as <strong>PENDING</strong> without deducting
                any funds from Cash in Drawer or Bank Accounts. You can pay it later at any time.
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#23283B]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 hover:dark:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin text-slate-950" />}
              {selectedOutstanding ? 'Confirm Payment' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
