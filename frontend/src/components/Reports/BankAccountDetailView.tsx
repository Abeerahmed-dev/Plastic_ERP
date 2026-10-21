import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Building2, Wallet, ArrowDownLeft, ArrowUpRight, FileText, ShoppingBag, Users, Layers, Filter } from 'lucide-react';
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

  // 3-Way Cash Flow Triangulation Filters
  const [filterPos, setFilterPos] = useState<boolean>(true);
  const [filterCust, setFilterCust] = useState<boolean>(true);
  const [filterOutflow, setFilterOutflow] = useState<boolean>(true);

  const formatPKR = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
    return `Rs. ${Number(val).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatOutflow = (val: number) => {
    const formatted = Math.abs(val).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `(Rs. ${formatted})`;
  };

  // Filter transactions based on 3-way segregation
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const isDeposit = tx.transaction_type === 'DEPOSIT' || tx.type === 'INFLOW';
      const isWithdrawal = tx.transaction_type === 'WITHDRAWAL' || tx.type === 'OUTFLOW';
      const isPos = tx.source === 'POS' || tx.source_type === 'POS';
      const isCust = tx.source === 'CUSTOMER_PAYMENT' || tx.source_type === 'CUSTOMER_PAYMENT' || (!isPos && isDeposit);

      if (isDeposit && isPos) return filterPos;
      if (isDeposit && isCust) return filterCust;
      if (isWithdrawal) return filterOutflow;
      return true;
    });
  }, [transactions, filterPos, filterCust, filterOutflow]);

  // Recalculate dynamic totals
  const stats = useMemo(() => {
    let posInflow = 0;
    let posCount = 0;
    let custInflow = 0;
    let custCount = 0;
    let totalOutflow = 0;
    let outflowCount = 0;

    for (const tx of transactions) {
      const isDeposit = tx.transaction_type === 'DEPOSIT' || tx.type === 'INFLOW';
      const isWithdrawal = tx.transaction_type === 'WITHDRAWAL' || tx.type === 'OUTFLOW';
      const isPos = tx.source === 'POS' || tx.source_type === 'POS';

      if (isDeposit && isPos) {
        posInflow += Number(tx.amount || 0);
        posCount++;
      } else if (isDeposit) {
        custInflow += Number(tx.amount || 0);
        custCount++;
      } else if (isWithdrawal) {
        totalOutflow += Number(tx.amount || 0);
        outflowCount++;
      }
    }

    let filteredInflow = 0;
    let filteredOutflow = 0;

    for (const tx of filteredTransactions) {
      const isDeposit = tx.transaction_type === 'DEPOSIT' || tx.type === 'INFLOW';
      const isWithdrawal = tx.transaction_type === 'WITHDRAWAL' || tx.type === 'OUTFLOW';

      if (isDeposit) {
        filteredInflow += Number(tx.amount || 0);
      } else if (isWithdrawal) {
        filteredOutflow += Number(tx.amount || 0);
      }
    }

    const netFilteredTotal = filteredInflow - filteredOutflow;

    return {
      posInflow: Math.round(posInflow * 100) / 100,
      posCount,
      custInflow: Math.round(custInflow * 100) / 100,
      custCount,
      totalOutflow: Math.round(totalOutflow * 100) / 100,
      outflowCount,
      filteredInflow: Math.round(filteredInflow * 100) / 100,
      filteredOutflow: Math.round(filteredOutflow * 100) / 100,
      netFilteredTotal: Math.round(netFilteredTotal * 100) / 100,
    };
  }, [transactions, filteredTransactions]);

  const selectOnly = (type: 'POS' | 'CUST' | 'OUTFLOW') => {
    setFilterPos(type === 'POS');
    setFilterCust(type === 'CUST');
    setFilterOutflow(type === 'OUTFLOW');
  };

  const selectAll = () => {
    setFilterPos(true);
    setFilterCust(true);
    setFilterOutflow(true);
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

      {/* 3-Way Cash Flow Triangulation Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Cash Flow Triangulation
              </h4>
              <p className="text-[11px] text-slate-500">
                Segregate transactions into walk-in POS, customer invoice payments, and business outflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => selectOnly('POS')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                filterPos && !filterCust && !filterOutflow
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Only POS
            </button>
            <button
              onClick={() => selectOnly('CUST')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                !filterPos && filterCust && !filterOutflow
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Only Customer
            </button>
            <button
              onClick={() => selectOnly('OUTFLOW')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                !filterPos && !filterCust && filterOutflow
                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Only Outflows
            </button>
            <button
              onClick={selectAll}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-100 transition cursor-pointer ml-1"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 3 Explicit Toggle Checkbox Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filter 1: Inflow: POS */}
          <button
            type="button"
            onClick={() => setFilterPos((v) => !v)}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
              filterPos
                ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 text-emerald-950'
                : 'bg-slate-50/60 border-slate-200 text-slate-400 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={filterPos}
                onChange={() => {}}
                className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 pointer-events-none"
              />
              <div>
                <span className="text-xs font-bold block flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                  Inflow: POS
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Walk-in retail cash</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-extrabold font-mono text-emerald-700 block tabular-nums">
                {formatPKR(stats.posInflow)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{stats.posCount} entries</span>
            </div>
          </button>

          {/* Filter 2: Inflow: Customer Payments */}
          <button
            type="button"
            onClick={() => setFilterCust((v) => !v)}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
              filterCust
                ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 text-blue-950'
                : 'bg-slate-50/60 border-slate-200 text-slate-400 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={filterCust}
                onChange={() => {}}
                className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 pointer-events-none"
              />
              <div>
                <span className="text-xs font-bold block flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Inflow: Customer Payments
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Invoiced customer deposits</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-extrabold font-mono text-blue-700 block tabular-nums">
                {formatPKR(stats.custInflow)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{stats.custCount} entries</span>
            </div>
          </button>

          {/* Filter 3: Outflows */}
          <button
            type="button"
            onClick={() => setFilterOutflow((v) => !v)}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
              filterOutflow
                ? 'bg-red-50/70 border-red-300 ring-2 ring-red-500/20 text-red-950'
                : 'bg-slate-50/60 border-slate-200 text-slate-400 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={filterOutflow}
                onChange={() => {}}
                className="w-4 h-4 text-red-600 rounded-md border-slate-300 focus:ring-red-500 pointer-events-none"
              />
              <div>
                <span className="text-xs font-bold block flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
                  Outflows
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Suppliers &amp; operating expenses</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-extrabold font-mono text-red-700 block tabular-nums">
                {stats.totalOutflow > 0 ? formatOutflow(stats.totalOutflow) : 'Rs. 0.00'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{stats.outflowCount} entries</span>
            </div>
          </button>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            Chronological Transaction Ledger
          </h4>
          <span className="text-xs font-mono font-semibold text-slate-500">
            Showing {filteredTransactions.length} of {transactions.length} Transaction(s)
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
        ) : filteredTransactions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">No transactions match the selected filters.</p>
            <p className="text-xs text-slate-400">
              Adjust your Cash Flow Triangulation checkboxes above to see other transaction streams.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold">Date</th>
                  <th className="py-3.5 px-4 font-bold">Category</th>
                  <th className="py-3.5 px-4 font-bold">Description</th>
                  <th className="py-3.5 px-4 text-right font-bold text-emerald-700">Inflow (Rs)</th>
                  <th className="py-3.5 px-4 text-right font-bold text-red-700">Outflow (Rs)</th>
                  <th className="py-3.5 px-4 text-right font-bold text-slate-900">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-medium">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 shrink-0 whitespace-nowrap">
                      {tx.date}
                    </td>

                    {/* Source Category Tag */}
                    <td className="py-3 px-4 shrink-0 whitespace-nowrap">
                      {tx.source === 'POS' || tx.source_type === 'POS' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ShoppingBag className="w-3 h-3" />
                          POS Walk-in
                        </span>
                      ) : tx.source === 'CUSTOMER_PAYMENT' || tx.source_type === 'CUSTOMER_PAYMENT' || (tx.type === 'INFLOW' && tx.transaction_type !== 'WITHDRAWAL') ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Users className="w-3 h-3" />
                          Customer Payment
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                          <ArrowUpRight className="w-3 h-3" />
                          Outflow
                        </span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-3 px-4 text-slate-900">
                      <div className="flex items-center gap-2">
                        {tx.type === 'INFLOW' || tx.transaction_type === 'DEPOSIT' ? (
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
                      {tx.type === 'INFLOW' || tx.transaction_type === 'DEPOSIT' ? formatPKR(tx.amount) : '—'}
                    </td>

                    {/* Outflow (Rs) */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-red-600 font-bold">
                      {tx.type === 'OUTFLOW' || tx.transaction_type === 'WITHDRAWAL' ? formatOutflow(tx.amount) : '—'}
                    </td>

                    {/* Running Balance */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatPKR(tx.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Dynamic Filtered Total Table Footer */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-800">
                  <td colSpan={3} className="py-4 px-4">
                    <div className="flex flex-col">
                      <span className="uppercase tracking-wider text-slate-300 text-[10px]">
                        Dynamic Filtered Total
                      </span>
                      <span className="text-xs font-normal text-slate-300 mt-1">
                        {filterPos && !filterCust && !filterOutflow ? (
                          <span className="text-emerald-400 font-bold text-sm">
                            We made {formatPKR(stats.posInflow)} strictly from walk-in POS today.
                          </span>
                        ) : !filterPos && filterCust && !filterOutflow ? (
                          <span className="text-blue-400 font-bold text-sm">
                            We received {formatPKR(stats.custInflow)} strictly from customer payments today.
                          </span>
                        ) : !filterPos && !filterCust && filterOutflow ? (
                          <span className="text-red-400 font-bold text-sm">
                            Total business outflows: {formatOutflow(stats.totalOutflow)}.
                          </span>
                        ) : (
                          <span>
                            Filtered Net Flow: <strong className="text-white">{formatPKR(stats.netFilteredTotal)}</strong> (Inflows: {formatPKR(stats.filteredInflow)} | Outflows: {formatOutflow(stats.filteredOutflow)})
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-emerald-400 tabular-nums text-sm font-extrabold">
                    {stats.filteredInflow > 0 ? formatPKR(stats.filteredInflow) : '—'}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-red-400 tabular-nums text-sm font-extrabold">
                    {stats.filteredOutflow > 0 ? formatOutflow(stats.filteredOutflow) : '—'}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-white tabular-nums text-base font-black bg-slate-950/60">
                    {formatPKR(stats.netFilteredTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
