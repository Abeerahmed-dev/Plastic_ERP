import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Receipt, Calendar, Plus, Trash2, Tag, CreditCard } from 'lucide-react';
import { expensesService, Expense } from '../../services/expenses.service';
import { LogExpenseModal } from '../../pages/POS/LogExpenseModal';

interface ExpensesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate?: string;
  endDate?: string;
}

export const ExpensesListModal: React.FC<ExpensesListModalProps> = ({
  isOpen,
  onClose,
  startDate,
  endDate,
}) => {
  const queryClient = useQueryClient();
  const [isLogOpen, setIsLogOpen] = useState(false);

  const { data: expenses = [], isLoading, refetch } = useQuery({
    queryKey: ['expensesList', startDate, endDate],
    queryFn: () => expensesService.getExpenses({ startDate, endDate }),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const totalExpenseAmount = expenses.reduce((acc, exp) => acc + Number(exp.amount || 0), 0);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await expensesService.deleteExpense(id);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['pnlReport'] });
      queryClient.invalidateQueries({ queryKey: ['cashLedger'] });
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to delete expense');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] dark:bg-[#121520] dark:border-[#23283B]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between shrink-0 dark:from-[#251808] dark:to-[#381e05] dark:border-b dark:border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl dark:bg-amber-950/60 dark:border dark:border-amber-500/40">
              <Receipt className="w-6 h-6 text-white dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Operational Expenses Ledger</h2>
              <p className="text-xs text-amber-100 font-medium dark:text-amber-300/80">Itemized expenses for selected timeframe</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLogOpen(true)}
              className="px-3 py-1.5 bg-white text-amber-700 hover:bg-amber-50 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer dark:bg-amber-950/40 dark:text-amber-300 dark:border dark:border-amber-500/50 dark:hover:bg-amber-900/50"
            >
              <Plus className="w-4 h-4" />
              Log Expense
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Total Summary Bar */}
        <div className="p-4 bg-amber-50/80 border-b border-amber-100 flex items-center justify-between shrink-0 dark:bg-[#1a140d] dark:border-[#23283B]">
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block dark:text-amber-400">
              Total Expenses
            </span>
            <span className="text-2xl font-black text-amber-700 font-mono dark:text-amber-300">
              Rs. {totalExpenseAmount.toLocaleString()}
            </span>
          </div>
          <span className="text-xs font-bold text-amber-800 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs dark:bg-[#161925] dark:border-amber-800/60 dark:text-amber-300">
            {expenses.length} Records Listed
          </span>
        </div>

        {/* Expenses Table */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-12 text-center text-amber-600 dark:text-amber-400 font-medium animate-pulse">
              Loading expenses ledger...
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200 dark:bg-[#161925] dark:border-[#23283B] dark:text-slate-400">
              No expenses logged for this timeframe.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#23283B]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 dark:bg-[#161925] dark:text-slate-400 dark:border-[#23283B]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Method</th>
                    <th className="p-3 text-right">Amount (PKR)</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-[#23283B] dark:text-slate-200">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-[#181c2b]">
                      <td className="p-3 font-mono font-medium text-slate-600 dark:text-slate-400">
                        {exp.expense_date}
                      </td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300">
                          <Tag className="w-3 h-3" />
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {exp.description || 'N/A'}
                        {exp.created_by_name && (
                          <span className="block text-[10px] text-slate-400 dark:text-slate-500">By: {exp.created_by_name}</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                          {exp.payment_method}
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-amber-700 font-mono text-sm dark:text-amber-300">
                        Rs. {Number(exp.amount).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer dark:hover:bg-red-950/50 dark:hover:text-red-400"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0 dark:bg-[#161925] dark:border-[#23283B]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Close Expenses Ledger
          </button>
        </div>
      </div>

      {/* Quick Add Expense Modal */}
      <LogExpenseModal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        onExpenseLogged={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['pnlReport'] });
          queryClient.invalidateQueries({ queryKey: ['cashLedger'] });
        }}
      />
    </div>
  );
};
