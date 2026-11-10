import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Clock, CreditCard, Building2, User, CheckCircle2, AlertCircle, Calendar, DollarSign, FileText } from 'lucide-react';
import { incomingPdcsService } from '../../services/incoming-pdcs.service';
import { getCustomers } from '../../services/customers.service';
import { invoicesService } from '../../services/invoices.service';
import { bankAccountsService } from '../../services/bank-accounts.service';

interface AddIncomingPdcModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialCustomerId?: string;
  initialInvoiceId?: string;
  initialAmount?: number;
  initialNotes?: string;
}

export const AddIncomingPdcModal: React.FC<AddIncomingPdcModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialCustomerId = '',
  initialInvoiceId = '',
  initialAmount,
  initialNotes = '',
}) => {
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState<string>(initialCustomerId);
  const [invoiceId, setInvoiceId] = useState<string>(initialInvoiceId);
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [chequeBankName, setChequeBankName] = useState<string>('');
  const [chequeDueDate, setChequeDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>(initialAmount ?? '');
  const [destinationBankAccountId, setDestinationBankAccountId] = useState<string>('');
  const [notes, setNotes] = useState<string>(initialNotes);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync props when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      setCustomerId(initialCustomerId || '');
      setInvoiceId(initialInvoiceId || '');
      setChequeNumber('');
      setChequeBankName('');
      setChequeDueDate(new Date().toISOString().split('T')[0]);
      setAmount(initialAmount ?? '');
      setDestinationBankAccountId('');
      setNotes(initialNotes || '');
      setErrorMsg(null);
    }
  }, [isOpen, initialCustomerId, initialInvoiceId, initialAmount, initialNotes]);

  // Fetch Customers
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', { page: 1, limit: 100 }],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    enabled: isOpen,
  });

  const customersList: any[] = useMemo(() => {
    if (!customersData) return [];
    if (Array.isArray(customersData)) return customersData;
    if (Array.isArray((customersData as any)?.data)) return (customersData as any).data;
    return [];
  }, [customersData]);

  // Fetch Sales Invoices
  const { data: salesInvoices = [], isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.getInvoices(),
    enabled: isOpen,
  });

  // Fetch Business Bank Accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsService.getBankAccounts(),
    enabled: isOpen,
  });

  // Filter available unpaid/open invoices for selected customer
  const availableInvoices = useMemo(() => {
    if (!customerId) return [];
    const list = Array.isArray(salesInvoices) ? salesInvoices : [];
    return list
      .filter((inv) => inv && inv.customer_id === customerId)
      .map((inv) => {
        const total = Number(inv.total_amount || 0);
        const paid = Number(inv.paid_amount || 0);
        const balance_due = Math.max(0, Math.round((total - paid) * 100) / 100);
        return {
          ...inv,
          total_amount: total,
          paid_amount: paid,
          balance_due,
        };
      })
      .filter((inv) => inv.id === initialInvoiceId || (inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.balance_due > 0));
  }, [customerId, salesInvoices, initialInvoiceId]);

  // When an invoice is selected, automatically update amount to the invoice's remaining balance
  const handleInvoiceChange = (invId: string) => {
    setInvoiceId(invId);
    if (!invId) return;
    const inv = availableInvoices.find((i) => i.id === invId);
    if (inv && inv.balance_due > 0) {
      setAmount(inv.balance_due);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('Please select a customer.');
      if (!chequeNumber.trim()) throw new Error('Cheque Number is required.');
      if (!chequeBankName.trim()) throw new Error('Cheque Issuing Bank Name is required.');
      if (!chequeDueDate) throw new Error('Cheque Due Date is required.');
      if (!amount || Number(amount) <= 0) throw new Error('Please enter a valid amount greater than 0.');

      return await incomingPdcsService.createPdc({
        customer_id: customerId,
        invoice_id: invoiceId || null,
        cheque_number: chequeNumber.trim(),
        cheque_bank_name: chequeBankName.trim(),
        cheque_due_date: chequeDueDate,
        amount: Number(amount),
        destination_bank_account_id: destinationBankAccountId || null,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-pdcs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      queryClient.invalidateQueries({ queryKey: ['pnlReport'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to record cheque');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    createMutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
      style={{ zIndex: 9999 }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] dark:bg-[#121520] dark:border-[#23283B] relative"
        style={{ zIndex: 10000 }}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between shrink-0 dark:from-[#2a1b0b] dark:to-[#3d2307] dark:border-b dark:border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl dark:bg-amber-950/60 dark:border dark:border-amber-500/40">
              <CreditCard className="w-5 h-5 text-white dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {initialCustomerId ? 'Receive Replacement Cheque (PDC)' : 'Receive New Cheque (PDC)'}
              </h2>
              <p className="text-xs text-amber-100 font-medium dark:text-amber-300/80">
                Record incoming post-dated customer cheque against an existing invoice
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 dark:text-slate-300">
              Customer <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setInvoiceId('');
                }}
                disabled={isLoadingCustomers || !!initialCustomerId}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-white"
                required
              >
                <option value="">-- Select Customer --</option>
                {customersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.city ? `(${c.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Link to Existing / Old Invoice */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 dark:text-slate-300">
              Link to Existing Invoice (Optional)
            </label>
            <select
              value={invoiceId}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              disabled={!customerId || isLoadingInvoices}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-white"
            >
              <option value="">-- No Specific Invoice (On-Account / Auto-Allocation) --</option>
              {availableInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — Date: {inv.date ? inv.date.substring(0, 10) : 'N/A'} (Unpaid: Rs. {Number(inv.balance_due).toLocaleString()} / Total: Rs. {Number(inv.total_amount).toLocaleString()})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">
              Selecting an invoice will settle it directly using this cheque without needing a new invoice.
            </p>
          </div>

          {/* Cheque Number & Cheque Bank Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 dark:text-slate-300">
                Cheque Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. CHQ-981240"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 dark:text-slate-300">
                Customer Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Meezan Bank, HBL"
                value={chequeBankName}
                onChange={(e) => setChequeBankName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-white"
                required
              />
            </div>
          </div>

          {/* Cheque Due Date & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 dark:text-slate-300">
                Cheque Due Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={chequeDueDate}
                  onChange={(e) => setChequeDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-white"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 dark:text-slate-300">
                Cheque Amount (PKR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-white text-emerald-700 dark:text-emerald-400"
                required
              />
            </div>
          </div>

          {/* Destination Bank Account (Where to deposit upon clearance) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 dark:text-slate-300">
              Target Deposit Bank Account (Optional)
            </label>
            <select
              value={destinationBankAccountId}
              onChange={(e) => setDestinationBankAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-white"
            >
              <option value="">-- Primary Business Account (Default) --</option>
              {bankAccounts.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} — {b.account_title} ({b.account_number}) [Bal: Rs. {Number(b.current_balance || 0).toLocaleString()}]
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 dark:text-slate-300">
              Notes / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Replacement for bounced cheque or settlement note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none dark:bg-[#161925] dark:border-[#23283B] dark:text-white"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-200 flex justify-end items-center gap-3 dark:border-[#23283B]">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer dark:bg-[#161925] dark:text-slate-300 dark:hover:bg-[#1e2337]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save & Receive PDC
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

