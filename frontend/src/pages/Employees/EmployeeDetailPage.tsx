import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  Wallet,
  PlusCircle,
  MinusCircle,
  Printer,
  Clock,
  Phone,
  Briefcase,
  IdCard,
  Building2,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { employeesService } from '../../services/employees.service';
import { EmployeePaymentModal } from './EmployeePaymentModal';
import { EmployeeTransactionType } from '../../types/employee.types';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const currentMonthStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<EmployeeTransactionType>('ADVANCE');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch Employee Ledger Data
  const {
    data: ledgerData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['employee-ledger', id, selectedMonth],
    queryFn: () => employeesService.getLedger(id!, selectedMonth),
    enabled: !!id,
  });

  // Delete transaction mutation
  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => employeesService.deleteLedgerEntry(id!, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-ledger', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['cash-drawer-balance'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['liquidity-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['cash-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['pnlReport'] });
      queryClient.invalidateQueries({ queryKey: ['marginAnalyticsTrend'] });
      queryClient.invalidateQueries({ queryKey: ['pnlExpensesList'] });
      queryClient.invalidateQueries({ queryKey: ['financial-overview'] });
      setDeleteConfirmId(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || err.message || 'Failed to delete entry');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-36 bg-slate-200 animate-pulse rounded-md" />
          </div>
          <button
            onClick={() => navigate('/employees')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-sm font-medium">Loading employee ledger...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !ledgerData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Employee Ledger</h1>
          <button
            onClick={() => navigate('/employees')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-3">
            <Briefcase className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Employee not found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            The employee record you requested could not be located or has been removed.
          </p>
          <button
            onClick={() => navigate('/employees')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Staff Directory
          </button>
        </div>
      </div>
    );
  }

  const { employee, transactions = [] } = ledgerData;
  const baseSalary = Number(ledgerData.monthly_salary || employee.salary || 0);
  const totalAccrued = Number(ledgerData.total_salary_accrued_this_month || baseSalary);
  const totalAdvances = Number(ledgerData.total_advances_this_month || 0);
  const remainingSalary = Number(ledgerData.remaining_salary_this_month ?? (totalAccrued - totalAdvances));
  const allTimeBalance = Number(ledgerData.all_time_balance || 0);

  const handleOpenPayment = (type: EmployeeTransactionType) => {
    setModalInitialType(type);
    setIsPaymentModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedJoinDate = employee.joining_date
    ? (employee.joining_date.includes('T') ? employee.joining_date.split('T')[0] : employee.joining_date)
    : 'N/A';

  return (
    <div className="min-h-screen bg-slate-50/60 pb-12">
      {/* Top Bar Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sm:px-6 lg:px-8 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/employees')}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
              title="Back to Staff"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">{employee.name}</h1>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {employee.employee_id}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    employee.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : employee.status === 'ON_LEAVE'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  {employee.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {employee.designation} {employee.phone ? `• ${employee.phone}` : ''}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Ledger</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenPayment('ADVANCE')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 text-xs font-black transition shadow-sm shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5 text-slate-950" />
              <span>Pay Advance / Cash</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 space-y-4">
        {/* Compact 4-Card Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Worker Profile */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Worker Profile</span>
                <span className="text-[10px] text-slate-500 font-medium">Joined: {formattedJoinDate}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                <div>
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider block">Role</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block">{employee.designation || 'Staff'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider block">Timing</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block">{employee.store_timing || 'Full Day'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider block">Phone</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block">{employee.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider block">CNIC</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block">{employee.cnic || 'N/A'}</span>
                </div>
              </div>
            </div>
            {employee.notes && (
              <div className="mt-1 pt-1 border-t border-slate-100 text-[10px] text-slate-500 truncate" title={employee.notes}>
                <span className="font-medium text-slate-600">Note:</span> {employee.notes}
              </div>
            )}
          </div>

          {/* Card 2: Monthly Base Salary */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Monthly Base Salary
                </span>
                <span className="text-[10px] text-slate-500 font-medium">{selectedMonth}</span>
              </div>
              <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
                Rs. {baseSalary.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Accrued entitlement</span>
            </div>
          </div>

          {/* Card 3: Advances / Weekly Paid */}
          <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/20 p-3 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                  Advances Paid
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                  Outflow
                </span>
              </div>
              <span className="text-xl font-black font-mono text-rose-600 mt-1 block">
                Rs. {totalAdvances.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-rose-700 font-semibold flex items-center gap-1">
              <TrendingDown className="w-3 h-3 shrink-0" />
              <span>Deducted from salary</span>
            </div>
          </div>

          {/* Card 4: Remaining Salary Payable */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-3 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Remaining Salary Due
                </span>
                <span className="text-[9px] font-semibold text-slate-400">Current Month</span>
              </div>
              <span className="text-xl font-black font-mono text-white mt-1 block">
                Rs. {remainingSalary.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-slate-300 flex items-center justify-between">
              <span>Net Payable</span>
              <span className="text-emerald-400 font-bold">Month End</span>
            </div>
          </div>
        </div>

        {/* Ledger Transactions Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4">
          {/* Table Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Salary & Advances Ledger</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {transactions.length} records
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Month:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              <button
                type="button"
                onClick={() => refetch()}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Refresh Ledger"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Salary Month</th>
                  <th className="px-5 py-3.5">Transaction Type</th>
                  <th className="px-5 py-3.5">Description / Notes</th>
                  <th className="px-5 py-3.5">Payment Mode</th>
                  <th className="px-5 py-3.5 text-right text-rose-700">Paid Out</th>
                  <th className="px-5 py-3.5 text-right text-emerald-700">Salary</th>
                  <th className="px-5 py-3.5 text-right font-black">Running Balance</th>
                  <th className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center">
                        <Wallet className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-sm font-semibold text-slate-600">No transactions recorded for {selectedMonth}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Click "Pay Advance / Weekly Cash" or "Post Monthly Salary" above to log transactions.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const isCredit = t.transaction_type === 'SALARY' || t.transaction_type === 'BONUS';
                    const isAdvance = t.transaction_type === 'ADVANCE' || t.transaction_type === 'PAYMENT';

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-800">
                          {new Date(t.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-500">
                          {t.reference_month}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {t.transaction_type === 'SALARY' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Monthly Salary
                            </span>
                          ) : t.transaction_type === 'ADVANCE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Wallet className="w-3 h-3 text-amber-700" />
                              Weekly Advance
                            </span>
                          ) : t.transaction_type === 'PAYMENT' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Salary Payment
                            </span>
                          ) : t.transaction_type === 'BONUS' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              Bonus / Incentive
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Deduction
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 font-medium max-w-xs truncate" title={t.description || ''}>
                          {t.description || '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">
                          {t.payment_method === 'BANK_TRANSFER' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                              <Building2 className="w-3 h-3" />
                              {t.bank_name || 'Bank Transfer'}
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-600">Cash Drawer</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right font-mono font-bold text-rose-600">
                          {t.debit > 0 ? `Rs. ${t.debit.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right font-mono font-bold text-emerald-600">
                          {t.credit > 0 ? `Rs. ${t.credit.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right font-mono font-black text-slate-900">
                          Rs. {t.running_balance.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                          {deleteConfirmId === t.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => deleteMutation.mutate(t.id)}
                                className="px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded hover:bg-red-700 transition cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(t.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment / Advance Modal */}
      {isPaymentModalOpen && (
        <EmployeePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          employee={employee}
          currentRemaining={remainingSalary}
          initialType={modalInitialType}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['employees'] });
          }}
        />
      )}
    </div>
  );
}
