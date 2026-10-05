import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Building2, Wallet, ArrowDownLeft, ArrowUpRight, FileText } from 'lucide-react';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { BankAccount } from '../../types/bank-account.types';

interface BankAccountDetailViewProps {
  accountId: string;
  onBack: () => void;
  fallbackAccount?: BankAccount;
}

export const BankAccountDetailView: React.FC<BankAccountDetailViewProps> = ({
  accountId,
  onBack,
  fallbackAccount,
}) => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bank-account-transactions', accountId],
    queryFn: () => bankAccountsService.getBankAccountTransactions(accountId),
    enabled: !!accountId,
  });

  const account = data?.account || fallbackAccount;
  const transactions = data?.transactions || [];

  const formatPKR = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
    return `Rs. ${Number(val).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatOutflow = (val: number) => {
    const formatted = Math.abs(val).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `(Rs. ${formatted})`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Back Button & Sub-header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer bg-blue-50/60 hover:bg-blue-100/80 px-3 py-1.5 rounded-xl border border-blue-200/60"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Bank Accounts</span>
        </button>

        <span className="text-xs font-mono font-semibold text-slate-400">
          Account ID: {accountId}
        </span>
      </div>

      {/* Account Summary Header Card */}
      {account && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                {account.bank_name}
              </span>
              <span className="text-xs text-slate-300 font-mono">Acc No: {account.account_number}</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-white">{account.account_title}</h3>
            {account.iban_details && (
              <p className="text-xs text-slate-400 font-mono">IBAN: {account.iban_details}</p>
            )}
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-right">
            <div>
              <span className="text-[10px] text-slate-300 font-bold uppercase block tracking-wider">
                Current Net Balance
              </span>
              <span className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
                {formatPKR(account.current_balance)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            Chronological Transaction Ledger
          </h4>
          <span className="text-xs font-mono font-semibold text-slate-500">
            {transactions.length} Transaction(s)
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs font-semibold">Fetching bank account ledger entries...</p>
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-red-500 text-xs">
            Failed to load bank transaction ledger.{' '}
            <button onClick={() => refetch()} className="font-bold underline ml-1 cursor-pointer">
              Retry
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">No transactions recorded for this account.</p>
            <p className="text-xs text-slate-400">
              Customer deposits, supplier payments, and bank expenses routed to this account will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold">Date</th>
                  <th className="py-3.5 px-4 font-bold">Description</th>
                  <th className="py-3.5 px-4 text-right font-bold text-emerald-700">Inflow (Rs)</th>
                  <th className="py-3.5 px-4 text-right font-bold text-red-700">Outflow (Rs)</th>
                  <th className="py-3.5 px-4 text-right font-bold text-slate-900">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-medium">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 shrink-0 whitespace-nowrap">
                      {tx.date}
                    </td>

                    {/* Description */}
                    <td className="py-3 px-4 text-slate-900">
                      <div className="flex items-center gap-2">
                        {tx.type === 'INFLOW' ? (
                          <span className="p-1 rounded bg-emerald-50 text-emerald-600 shrink-0">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="p-1 rounded bg-red-50 text-red-600 shrink-0">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span>{tx.description}</span>
                      </div>
                    </td>

                    {/* Inflow (Rs) */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 font-bold">
                      {tx.type === 'INFLOW' ? formatPKR(tx.amount) : '—'}
                    </td>

                    {/* Outflow (Rs) */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-red-600 font-bold">
                      {tx.type === 'OUTFLOW' ? formatOutflow(tx.amount) : '—'}
                    </td>

                    {/* Running Balance */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatPKR(tx.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
