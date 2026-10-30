import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Clock, CheckCircle2, AlertTriangle, RefreshCw, Building2, Banknote } from 'lucide-react';
import { incomingPdcsService, IncomingPdc } from '../../services/incoming-pdcs.service';

interface PdcLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PdcLedgerModal: React.FC<PdcLedgerModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'CLEARED' | 'BOUNCED' | 'ALL'>('PENDING');

  const { data: pdcItems = [], isLoading, refetch } = useQuery<IncomingPdc[]>({
    queryKey: ['incoming-pdcs', statusFilter],
    queryFn: async () => {
      const statusParam = statusFilter === 'ALL' ? undefined : statusFilter;
      return await incomingPdcsService.getIncomingPdcs(statusParam);
    },
    enabled: isOpen,
  });

  const clearMutation = useMutation({
    mutationFn: async (id: string) => {
      return await incomingPdcsService.clearPdc(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-pdcs'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.message || 'Failed to clear cheque');
    },
  });

  const bounceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await incomingPdcsService.bouncePdc(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-pdcs'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.message || 'Failed to bounce cheque');
    },
  });

  if (!isOpen) return null;

  const totalPendingAmount = pdcItems
    .filter((item) => item.status === 'PENDING')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const displayItems = pdcItems;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 flex flex-col max-h-[88vh] dark:bg-[#121520] dark:border-[#23283B]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between shrink-0 dark:from-[#251808] dark:to-[#381e05] dark:border-b dark:border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl dark:bg-amber-950/60 dark:border dark:border-amber-500/40">
              <Clock className="w-6 h-6 text-white dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Received PDCs (Pending Assets)</h2>
              <p className="text-xs text-amber-100 font-medium dark:text-amber-300/80">
                Vault audit & clearance of incoming customer post-dated cheques
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar & Summary */}
        <div className="p-4 bg-amber-50/80 border-b border-amber-100 flex flex-wrap items-center justify-between gap-4 shrink-0 dark:bg-[#1a140d] dark:border-[#23283B]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-400">Status Filter:</span>
            {(['PENDING', 'CLEARED', 'BOUNCED', 'ALL'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-100/50 dark:bg-[#161925] dark:text-slate-300 dark:border-[#23283B] hover:dark:bg-[#1e2337]'
                }`}
              >
                {st === 'PENDING' ? 'Pending Assets' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100/80 px-3 py-1.5 rounded-xl border border-amber-200 dark:bg-[#161925] dark:border-amber-800/60 dark:text-amber-300">
              <Building2 className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span>Count:</span>
              <span className="font-mono font-extrabold">{displayItems.length}</span>
            </div>

            <div className="text-xs font-bold font-mono px-3 py-1.5 rounded-xl bg-amber-200/80 border border-amber-300 text-amber-950 flex items-center gap-1.5 dark:bg-amber-950/40 dark:border-amber-700/60 dark:text-amber-300">
              <Banknote className="w-4 h-4 text-amber-800 dark:text-amber-400" />
              Pending Volume: Rs. {totalPendingAmount.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-12 text-center text-amber-600 dark:text-amber-400 font-medium animate-pulse">
              Loading received post-dated cheques...
            </div>
          ) : displayItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200 dark:bg-[#161925] dark:border-[#23283B] dark:text-slate-400">
              No post-dated cheques found in vault matching current filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs dark:border-[#23283B]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 dark:bg-[#161925] dark:text-slate-400 dark:border-[#23283B]">
                  <tr>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Customer Origin Bank & Cheque #</th>
                    <th className="p-3">Target Destination Bank</th>
                    <th className="p-3">Ref / Payment #</th>
                    <th className="p-3 text-right">Amount (PKR)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Clearance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-[#23283B] dark:text-slate-200">
                  {displayItems.map((item) => {
                    const dueDateStr = item.cheque_due_date
                      ? new Date(item.cheque_due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'N/A';

                    return (
                      <tr key={item.id} className="hover:bg-amber-50/30 transition-colors dark:hover:bg-[#181c2b]">
                        <td className="p-3 font-mono font-semibold text-amber-900 dark:text-amber-400 whitespace-nowrap">
                          {dueDateStr}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          {item.customer_name}
                          {item.customer_code && (
                            <span className="ml-1 text-[11px] font-normal text-slate-400 dark:text-slate-500">
                              ({item.customer_code})
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-900 dark:text-white">{item.cheque_bank_name}</span>
                          <span className="ml-1 text-slate-500 dark:text-slate-400">#{item.cheque_number}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {item.destination_bank_name ? (
                            <span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{item.destination_bank_name}</span>
                              {item.destination_account_title && (
                                <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                                  {item.destination_account_title} ({item.destination_account_number})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Primary Account</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                          {item.payment_number || 'Cheque Payment'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm whitespace-nowrap">
                          Rs. {Number(item.amount).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          {item.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                              <Clock className="w-3 h-3" /> PENDING
                            </span>
                          )}
                          {item.status === 'CLEARED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> CLEARED
                            </span>
                          )}
                          {item.status === 'BOUNCED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                              <AlertTriangle className="w-3 h-3" /> BOUNCED
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.status === 'PENDING' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => clearMutation.mutate(item.id)}
                                disabled={clearMutation.isPending || bounceMutation.isPending}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                title="Deposit cash into bank balance"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Clear
                              </button>
                              <button
                                onClick={() => bounceMutation.mutate(item.id)}
                                disabled={clearMutation.isPending || bounceMutation.isPending}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                title="Dishonor cheque & restore customer debt"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Bounce
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0 dark:bg-[#161925] dark:border-[#23283B]">
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer dark:bg-[#121520] dark:border-[#23283B] dark:text-slate-200 dark:hover:bg-[#181c2b]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Refresh Vault
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
};
