import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Clock, CheckCircle2, RefreshCw, Building2 } from 'lucide-react';
import api from '../../services/api';

interface IssuedPdcLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface IssuedPdcItem {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  cheque_number: string;
  cheque_bank_name: string;
  cheque_due_date: string;
  cheque_status: string;
  supplier_id: string;
  supplier_name: string;
  supplier_code?: string;
  invoice_number?: string | null;
}

export const IssuedPdcLedgerModal: React.FC<IssuedPdcLedgerModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();

  const { data: pdcItems = [], isLoading, refetch } = useQuery<IssuedPdcItem[]>({
    queryKey: ['issuedPdc'],
    queryFn: async () => {
      const response = await api.get<{ data: IssuedPdcItem[] }>('/reports/issued-pdc');
      return response.data.data;
    },
    enabled: isOpen,
  });

  const clearMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/supplier-payments/${id}/clear-cheque`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issuedPdc'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.message || 'Failed to clear supplier cheque');
    },
  });

  if (!isOpen) return null;

  const totalPendingAmount = pdcItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-rose-700 to-red-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Issued Post-Dated Cheques (Outgoing Liability)</h2>
              <p className="text-xs text-rose-100 font-medium">Audit of pending cheques issued to parties awaiting bank clearance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Bar */}
        <div className="p-4 bg-rose-50/80 border-b border-rose-100 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-rose-700" />
            <span className="text-xs font-bold text-rose-900">Total Issued Pending Cheques:</span>
            <span className="text-xs font-mono font-extrabold text-rose-950 bg-rose-200/70 px-2 py-0.5 rounded-md">
              {pdcItems.length}
            </span>
          </div>

          <div className="text-xs font-bold font-mono px-3 py-1.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 flex items-center gap-1.5">
            Total Pending Liability: Rs. {totalPendingAmount.toLocaleString()}
          </div>
        </div>

        {/* Table View */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-12 text-center text-rose-600 font-medium animate-pulse">
              Loading pending issued post-dated cheques...
            </div>
          ) : pdcItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No pending issued post-dated cheques found in accounts payable vault.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Party</th>
                    <th className="p-3">Bank & Cheque #</th>
                    <th className="p-3">Ref / Invoice</th>
                    <th className="p-3 text-right">Amount (PKR)</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {pdcItems.map((item) => {
                    const dueDateStr = item.cheque_due_date
                      ? new Date(item.cheque_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : new Date(item.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                    return (
                      <tr key={item.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="p-3 font-mono font-semibold text-rose-900 whitespace-nowrap">
                          {dueDateStr}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {item.supplier_name}
                          {item.supplier_code && (
                            <span className="ml-1 text-[11px] font-normal text-slate-400">({item.supplier_code})</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          <span className="font-semibold text-slate-900">{item.cheque_bank_name}</span>
                          <span className="ml-1 text-slate-500">#{item.cheque_number}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {item.invoice_number ? `Bill #${item.invoice_number}` : item.payment_number}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700 text-sm whitespace-nowrap">
                          Rs. {Number(item.amount).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => clearMutation.mutate(item.id)}
                            disabled={clearMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Cleared
                          </button>
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
            Refresh Vault
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Close Issued PDC Ledger
          </button>
        </div>
      </div>
    </div>
  );
};
