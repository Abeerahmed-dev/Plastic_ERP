import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Search, Filter, Receipt, Loader2, Calendar, DollarSign, Wallet, Building2 } from 'lucide-react';
import { expensesService, Expense, ExpenseFilters } from '../../services/expenses.service';
import { useAuthStore } from '../../store/auth.store';
import { ExpenseFormModal } from './ExpenseFormModal';

const CATEGORIES = [
  'All',
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

export default function ExpensesListPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const userRole = (user?.role || '').toUpperCase();
  const isOwner = userRole === 'OWNER' || userRole === 'ADMIN';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filters: ExpenseFilters = useMemo(() => {
    const f: ExpenseFilters = {};
    if (selectedCategory !== 'All') f.category = selectedCategory;
    if (selectedPaymentMethod !== 'All') f.payment_method = selectedPaymentMethod;
    if (startDate) f.startDate = startDate;
    if (endDate) f.endDate = endDate;
    return f;
  }, [selectedCategory, selectedPaymentMethod, startDate, endDate]);

  const { data: expenses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => expensesService.getExpenses(filters),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesService.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
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
        e.created_by_name?.toLowerCase().includes(term)
    );
  }, [expenses, searchTerm]);

  // Calculate quick summary metrics
  const totalAmount = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );
  const cashAmount = useMemo(
    () =>
      filteredExpenses
        .filter((e) => e.payment_method?.toUpperCase().includes('CASH'))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );
  const bankAmount = useMemo(
    () =>
      filteredExpenses
        .filter((e) => !e.payment_method?.toUpperCase().includes('CASH'))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );

  const handleDelete = (id: string, desc?: string, amount?: number) => {
    if (confirm(`Are you sure you want to delete this expense record (${desc || 'Expense'} - Rs. ${amount})?`)) {
      deleteMutation.mutate(id);
    }
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
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operating Expenses (OPEX)</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Log & track daily operational expenses separate from inventory purchases
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 active:bg-red-800 transition"
          >
            <Plus className="h-4 w-4" />
             Expense
          </button>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total OPEX</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash in Drawer OPEX</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                Rs. {cashAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bank Account OPEX</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                Rs. {bankAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4 sm:flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search description, category, logged by..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  Category: {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <select
            value={selectedPaymentMethod}
            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
          >
            <option value="All">Method: All</option>
            <option value="Cash in Drawer">Cash in Drawer</option>
            <option value="Bank Account">Bank Account</option>
          </select>

          {/* Date Pickers */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition"
            />
          </div>
        </div>

        {/* Expenses Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Logged By</th>
                  {isOwner && <th className="py-3.5 px-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading && (
                  <tr>
                    <td colSpan={isOwner ? 7 : 6} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                        <span>Loading expense records...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {isError && (
                  <tr>
                    <td colSpan={isOwner ? 7 : 6} className="py-12 text-center text-red-500">
                      Failed to load expense records.{' '}
                      <button onClick={() => refetch()} className="underline font-semibold ml-1">
                        Retry
                      </button>
                    </td>
                  </tr>
                )}

                {!isLoading && !isError && filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={isOwner ? 7 : 6} className="py-12 text-center text-slate-400">
                      No operating expenses logged yet. Click "+ Log Expense" to create one.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !isError &&
                  filteredExpenses.map((expense: Expense) => {
                    const isCash = expense.payment_method?.toUpperCase().includes('CASH');

                    return (
                      <tr key={expense.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
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

                        <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate">
                          {expense.description || <span className="text-slate-400 italic">No description</span>}
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                          Rs. {Number(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isCash
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {isCash ? (
                              <Wallet className="h-3 w-3 text-amber-600" />
                            ) : (
                              <Building2 className="h-3 w-3 text-blue-600" />
                            )}
                            {expense.payment_method || 'Cash in Drawer'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {expense.created_by_name || 'System'}
                        </td>

                        {isOwner && (
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDelete(expense.id, expense.description, expense.amount)}
                              disabled={deleteMutation.isPending}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete Expense Record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Expense Log Modal */}
      <ExpenseFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
