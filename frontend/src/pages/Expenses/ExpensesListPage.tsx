import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Search,
  Filter,
  Receipt,
  Loader2,
  Calendar,
  DollarSign,
  Wallet,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  FileText,
} from 'lucide-react';
import { expensesService, Expense, ExpenseFilters } from '../../services/expenses.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { useAuthStore } from '../../store/auth.store';
import { ExpenseFormModal } from './ExpenseFormModal';

const CATEGORIES = [
  'All',
  'Logistics',
  'Rent',
  'Utilities',
  'Payroll',
  'Salaries',
  'Office Supplies',
  'General/Other',
  'Petty Cash',
  'Tea & Refreshments',
  'Maintenance',
];

const STATUSES = [
  { label: 'All Statuses', value: 'All' },
  { label: 'Pending / Unpaid', value: 'PENDING' },
  { label: 'Partially Paid', value: 'PARTIAL' },
  { label: 'Fully Paid', value: 'PAID' },
];

export default function ExpensesListPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const userRole = (user?.role || '').toUpperCase();
  const isOwner = userRole === 'OWNER' || userRole === 'ADMIN';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToPay, setExpenseToPay] = useState<Expense | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch active bank accounts for filtering
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankAccountsService.getBankAccounts,
  });

  const filters: ExpenseFilters = useMemo(() => {
    const f: ExpenseFilters = {};
    if (selectedCategory !== 'All') f.category = selectedCategory;
    if (selectedStatus !== 'All') f.status = selectedStatus;
    if (selectedBankAccountId !== 'All') f.bank_account_id = selectedBankAccountId;
    if (startDate) f.startDate = startDate;
    if (endDate) f.endDate = endDate;
    return f;
  }, [selectedCategory, selectedStatus, selectedBankAccountId, startDate, endDate]);

  const {
    data: expenses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => expensesService.getExpenses(filters),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesService.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-drawer-balance'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || err.message || 'Failed to delete expense record.');
    },
  });

  const filteredExpenses = useMemo(() => {
    if (!searchTerm.trim()) return expenses;
    const term = searchTerm.toLowerCase();
    return expenses.filter(
      (e) =>
        e.description?.toLowerCase().includes(term) ||
        e.category?.toLowerCase().includes(term) ||
        e.payment_method?.toLowerCase().includes(term) ||
        e.account_title?.toLowerCase().includes(term) ||
        e.bank_name?.toLowerCase().includes(term) ||
        e.purchase_invoice_number?.toLowerCase().includes(term) ||
        e.supplier_name?.toLowerCase().includes(term) ||
        e.created_by_name?.toLowerCase().includes(term)
    );
  }, [expenses, searchTerm]);

  // Accurate Summary Metrics
  const totalAmount = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );

  // Cash Outflow: only count actual paid amounts via cash
  const cashOutflow = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => {
      const isCash =
        e.payment_method?.toUpperCase().includes('CASH') &&
        e.payment_method?.toUpperCase() !== 'UNPAID';
      if (!isCash) return sum;
      if (e.status === 'PAID') return sum + Number(e.amount || 0);
      return sum + Number(e.paid_amount || 0);
    }, 0);
  }, [filteredExpenses]);

  // Bank Outflow: only count actual paid amounts via bank
  const bankOutflow = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => {
      const isBank =
        !e.payment_method?.toUpperCase().includes('CASH') &&
        e.payment_method?.toUpperCase() !== 'UNPAID';
      if (!isBank) return sum;
      if (e.status === 'PAID') return sum + Number(e.amount || 0);
      return sum + Number(e.paid_amount || 0);
    }, 0);
  }, [filteredExpenses]);

  // Outstanding / Pending Due
  const pendingAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => {
      const remaining =
        e.remaining_amount !== undefined
          ? Number(e.remaining_amount)
          : Math.max(0, Number(e.amount || 0) - Number(e.paid_amount || 0));
      if (e.status === 'PENDING' || e.status === 'PARTIAL' || e.status === 'UNPAID') {
        return sum + remaining;
      }
      return sum;
    }, 0);
  }, [filteredExpenses]);

  const handleDelete = (id: string, desc?: string, amount?: number) => {
    if (
      confirm(
        `Are you sure you want to delete this expense record (${desc || 'Expense'} - Rs. ${amount})?`
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenAdd = () => {
    setExpenseToPay(null);
    setIsModalOpen(true);
  };

  const handleOpenPay = (expense: Expense) => {
    setExpenseToPay(expense);
    setIsModalOpen(true);
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Rent':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Utilities':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Payroll':
      case 'Salaries':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Logistics':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Office Supplies':
      case 'Tea & Refreshments':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status?: string, remainingAmount?: number) => {
    const s = (status || 'PAID').toUpperCase();
    if (s === 'PENDING' || s === 'UNPAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Pending Due
        </span>
      );
    }
    if (s === 'PARTIAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <AlertCircle className="w-3 h-3 text-blue-600" />
          Partially Paid
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        Paid
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs">
                <Receipt className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Operating Expenses (OPEX)
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Log, track, and pay operational expenses separate from inventory purchases
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 transition cursor-pointer"
          >
            <Plus className="h-4 w-4 text-slate-950" />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-[#161925] p-5 rounded-2xl border border-slate-200 dark:border-[#23283B] shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total OPEX
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                Rs.{' '}
                {totalAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#161925] p-5 rounded-2xl border border-slate-200 dark:border-[#23283B] shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Cash in Drawer OPEX
              </p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
                Rs.{' '}
                {cashOutflow.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#161925] p-5 rounded-2xl border border-slate-200 dark:border-[#23283B] shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Bank Account OPEX
              </p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                Rs.{' '}
                {bankOutflow.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#161925] p-5 rounded-2xl border border-red-200 dark:border-rose-900/40 shadow-2xs flex items-center justify-between bg-red-50/20 dark:bg-rose-950/20">
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                Pending / Outstanding
              </p>
              <p className="text-2xl font-bold text-red-700 dark:text-rose-400 mt-1">
                Rs.{' '}
                {pendingAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-red-100 dark:bg-rose-950/60 text-red-600 dark:text-rose-400 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white dark:bg-[#161925] p-4 rounded-2xl border border-slate-200 dark:border-[#23283B] shadow-2xs mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3 sm:flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search description, invoice ref, supplier, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] text-slate-700 dark:text-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition cursor-pointer"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  Category: {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] text-slate-700 dark:text-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition cursor-pointer"
          >
            {STATUSES.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>

          {/* Outflow Account Filter */}
          <select
            value={selectedBankAccountId}
            onChange={(e) => setSelectedBankAccountId(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] text-slate-700 dark:text-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition cursor-pointer"
          >
            <option value="All">Account: All Accounts</option>
            {bankAccounts.map((acc: any) => (
              <option key={acc.id} value={acc.id}>
                {acc.name || acc.account_title || acc.bank_name}
              </option>
            ))}
          </select>

          {/* Date Pickers */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] text-slate-700 dark:text-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition cursor-pointer"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] text-slate-700 dark:text-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40 outline-none transition cursor-pointer"
            />
          </div>
        </div>

        {/* Expenses Data Table */}
        <div className="bg-white dark:bg-[#161925] rounded-2xl border border-slate-200 dark:border-[#23283B] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-[#0F111A] border-b border-slate-200 dark:border-[#23283B] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Description / Reference</th>
                  <th className="py-3.5 px-4 text-right">Amount (PKR)</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Outflow Account</th>
                  <th className="py-3.5 px-4">Logged By</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                        <span>Loading expense records...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {isError && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-red-500">
                      Failed to load expense records.{' '}
                      <button onClick={() => refetch()} className="underline font-semibold ml-1 cursor-pointer">
                        Retry
                      </button>
                    </td>
                  </tr>
                )}

                {!isLoading && !isError && filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No operating expenses found. Click "+ Add Expense" to log one.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !isError &&
                  filteredExpenses.map((expense: Expense) => {
                    const isPending =
                      expense.status === 'PENDING' ||
                      expense.status === 'UNPAID' ||
                      expense.payment_method === 'UNPAID';
                    const isPartial = expense.status === 'PARTIAL';
                    const isFullyPaid = expense.status === 'PAID';

                    const remainingDue =
                      expense.remaining_amount !== undefined
                        ? Number(expense.remaining_amount)
                        : Math.max(0, Number(expense.amount || 0) - Number(expense.paid_amount || 0));

                    const isCash =
                      !isPending && expense.payment_method?.toUpperCase().includes('CASH');

                    return (
                      <tr key={expense.id} className="hover:bg-slate-50/60 hover:dark:bg-[#1a1f33] transition">
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                          {expense.expense_date
                            ? new Date(expense.expense_date).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '-'}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getCategoryBadgeClass(
                              expense.category
                            )}`}
                          >
                            {expense.category}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 max-w-sm">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {expense.description || <span className="text-slate-400 italic">No description</span>}
                            </span>
                            {(expense.purchase_invoice_number || expense.supplier_name) && (
                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                {expense.purchase_invoice_number && (
                                  <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                    <FileText className="w-2.5 h-2.5" />
                                    {expense.purchase_invoice_number}
                                  </span>
                                )}
                                {expense.supplier_name && (
                                  <span>Party: {expense.supplier_name}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="block font-bold text-slate-900 dark:text-white">
                            Rs. {Number(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          {isPartial && (
                            <span className="block text-[11px] text-red-600 font-semibold">
                              Due: Rs. {remainingDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getStatusBadge(expense.status, remainingDue)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="h-3 w-3 text-amber-600" />
                              Unpaid (Pay Later)
                            </span>
                          ) : isCash ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Wallet className="h-3 w-3 text-amber-600" />
                              Cash in Drawer
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                              <Building2 className="h-3 w-3 text-blue-600" />
                              {expense.account_title || expense.bank_name || 'Bank Account'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {expense.created_by_name || 'System'}
                        </td>

                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isFullyPaid && (
                              <button
                                onClick={() => handleOpenPay(expense)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition active:scale-95 cursor-pointer"
                                title="Pay this outstanding expense"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay</span>
                              </button>
                            )}

                            {isOwner && (
                              <button
                                onClick={() => handleDelete(expense.id, expense.description, expense.amount)}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Delete Expense Record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Expense Modal (for both Add and Pay) */}
      <ExpenseFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setExpenseToPay(null);
        }}
        initialExpenseToPay={expenseToPay}
      />
    </div>
  );
}
