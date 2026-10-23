import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Building2, Plus, Edit2, Loader2, DollarSign, CreditCard, ShieldCheck, ArrowRight, ArrowRightLeft } from 'lucide-react';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { BankAccount } from '../../types/bank-account.types';
import { BankAccountDetailView } from './BankAccountDetailView';
import { TransferFundsModal } from '../Modals/TransferFundsModal';

interface BankAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BankAccountsModal = ({ isOpen, onClose }: BankAccountsModalProps) => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const [accountTitle, setAccountTitle] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ibanDetails, setIbanDetails] = useState('');
  const [initialBalance, setInitialBalance] = useState<number | ''>(0);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsService.getBankAccounts,
    enabled: isOpen,
  });

  const totalCombinedBalance = accounts.reduce((sum, acc) => sum + Number(acc.current_balance || 0), 0);

  const createMutation = useMutation({
    mutationFn: (data: any) => bankAccountsService.createBankAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => bankAccountsService.updateBankAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      resetForm();
    },
  });

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingAccount(null);
    setAccountTitle('');
    setBankName('');
    setAccountNumber('');
    setIbanDetails('');
    setInitialBalance(0);
  };

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setAccountTitle('');
    setBankName('');
    setAccountNumber('');
    setIbanDetails('');
    setInitialBalance(0);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (acc: BankAccount) => {
    setEditingAccount(acc);
    setAccountTitle(acc.account_title);
    setBankName(acc.bank_name);
    setAccountNumber(acc.account_number);
    setIbanDetails(acc.iban_details || '');
    setInitialBalance(Number(acc.initial_balance || 0));
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountTitle.trim() || !bankName.trim() || !accountNumber.trim()) {
      alert('Please fill out Account Title, Bank Name, and Account Number.');
      return;
    }

    const bal = initialBalance === '' ? 0 : Number(initialBalance);
    const payload = {
      account_title: accountTitle.trim(),
      bank_name: bankName.trim(),
      account_number: accountNumber.trim(),
      iban_details: ibanDetails.trim() || undefined,
      initial_balance: bal,
      opening_balance: bal,
    };

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const formatPKR = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-50/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Multi-Bank Accounts Ledger & Management</h2>
              <p className="text-xs text-slate-500">Real-time account balances, deposits & transaction routing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {selectedAccountId ? (
            <BankAccountDetailView
              accountId={selectedAccountId}
              onBack={() => setSelectedAccountId(null)}
              fallbackAccount={accounts.find((a) => a.id === selectedAccountId)}
            />
          ) : (
            <>
          {/* Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 block">
                Total Combined Bank Liquidity
              </span>
              <span className="text-3xl font-black font-mono mt-1 block">
                {formatPKR(totalCombinedBalance)}
              </span>
              <p className="text-xs text-emerald-100/90 mt-1">
                Sum of current balances across {accounts.length} registered bank account(s)
              </p>
            </div>
            {!isFormOpen && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-800/80 border border-emerald-400/30 text-white font-bold text-xs hover:bg-emerald-800 transition shadow-sm active:scale-95 shrink-0"
                  title="Move funds between Bank Accounts and Cash Drawer"
                >
                  <ArrowRightLeft className="w-4 h-4 text-emerald-200" />
                  ⇄ Transfer Funds
                </button>
                <button
                  onClick={handleOpenCreate}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-800 font-bold text-xs hover:bg-emerald-50 transition shadow-sm active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  + Add Bank Account
                </button>
              </div>
            )}
          </div>

          {/* Add / Edit Form Card */}
          {isFormOpen && (
            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-4 shadow-sm animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  {editingAccount ? 'Edit Bank Account' : 'Register New Bank Account'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sabir Plastic Main Account"
                    value={accountTitle}
                    onChange={(e) => setAccountTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Meezan Bank / HBL / MCB"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 010203040506"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    IBAN / Branch Details <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PK36MEZN0001020304"
                    value={ibanDetails}
                    onChange={(e) => setIbanDetails(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Opening Balance (Rs)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Logged as Owner's Equity Capital Injection (bypasses P&L).</p>
                </div>

                <div className="sm:col-span-2 lg:col-span-1 flex items-end justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    )}
                    {editingAccount ? 'Update Account' : 'Save Account'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Accounts Grid List */}
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 font-medium text-sm">
              Loading bank accounts...
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600 text-sm">No bank accounts registered</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "+ Add Bank Account" above to register your commercial bank accounts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500 transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100 inline-block mb-1">
                        {acc.bank_name}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors">
                        {acc.account_title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(acc);
                      }}
                      className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition"
                      title="Edit bank account details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Account No:</span>
                      <span className="font-bold text-slate-800">{acc.account_number}</span>
                    </div>
                    {acc.iban_details && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">IBAN:</span>
                        <span className="font-semibold text-slate-700 text-[11px]">{acc.iban_details}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Opening Balance</span>
                      <span className="text-xs font-mono font-semibold text-slate-600">
                        {formatPKR(acc.initial_balance)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-emerald-700 font-bold uppercase flex items-center justify-end gap-1">
                        Current Net Balance <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </span>
                      <span className="text-lg font-black font-mono text-emerald-700">
                        {formatPKR(acc.current_balance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Bank transactions & cheques automatically route balances to these accounts
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition shadow-2xs"
          >
            Close Window
          </button>
        </div>
      </div>

      <TransferFundsModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })}
      />
    </div>
  );
};
