import React from 'react';
import { X, Printer, CheckCircle2, Wallet, ArrowDownLeft, ArrowUpRight, Receipt, Calendar, User, FileText } from 'lucide-react';
import sabirLogo from '../../assets/sabirlogo.png';

export interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: {
    id: string;
    reference_no?: string;
    reference: string;
    date: string;
    type: string;
    debit?: number;
    credit?: number;
    amount?: number;
    payment_method?: string | null;
    notes?: string | null;
  } | null;
  entityType?: 'customer' | 'supplier';
  entityName?: string;
  entityCode?: string;
}

function formatRs(n: number | string | undefined | null) {
  if (n === undefined || n === null) return 'Rs. 0';
  return `Rs. ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  entityType = 'customer',
  entityName,
  entityCode,
}) => {
  if (!isOpen || !payment) return null;

  const paymentAmount = payment.amount ?? (payment.credit && payment.credit > 0 ? payment.credit : payment.debit) ?? 0;
  const isAdvance = payment.type === 'ADVANCE_DEPOSIT';
  const isRefund = payment.type === 'CASH_REFUND';
  const receiptTitle = isAdvance
    ? 'Advance Payment Receipt'
    : isRefund
    ? 'Cash Refund Voucher'
    : 'Payment Receipt';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden print:shadow-none print:border-none print:max-w-full">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-slate-50/50 print:hidden">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <span>Transaction Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-8 space-y-6">
          {/* Brand & Document Type */}
          <div className="flex items-start justify-between border-b border-gray-200 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <img src={sabirLogo} alt="Logo" className="h-8 w-auto object-contain" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">SABIR PLASTIC</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Enterprise Resource Planning</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ${
                isAdvance
                  ? 'bg-amber-100 text-amber-800'
                  : isRefund
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {receiptTitle}
              </span>
              <p className="mt-1 font-mono text-xs font-bold text-gray-700">
                {payment.reference_no || payment.reference}
              </p>
            </div>
          </div>

          {/* Key Metric: Amount */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-5 text-center">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              {isRefund ? 'Refunded Amount' : 'Received Amount'}
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1 font-mono">
              {formatRs(paymentAmount)}
            </p>
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Settled & Recorded in General Ledger
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm border-b border-gray-100 pb-5">
            <div>
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                {entityType === 'supplier' ? 'Supplier / Vendor' : 'Customer Account'}
              </span>
              <p className="mt-1 font-semibold text-gray-900">
                {entityName || 'Account Entity'}
                {entityCode && <span className="ml-1 text-xs text-gray-500 font-mono font-normal">({entityCode})</span>}
              </p>
            </div>

            <div>
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Transaction Date
              </span>
              <p className="mt-1 font-semibold text-gray-900 font-mono">
                {payment.date ? new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>

            <div>
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-gray-400" />
                Payment Method
              </span>
              <p className="mt-1 font-semibold text-gray-900">
                <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold text-gray-700">
                  {payment.payment_method?.replace(/_/g, ' ') || 'CASH DRAWER'}
                </span>
              </p>
            </div>

            <div>
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                Transaction Type
              </span>
              <p className="mt-1 font-semibold text-gray-900">
                {payment.type.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          {/* Notes */}
          {payment.notes && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <span className="font-semibold text-gray-700">Remarks / Notes: </span>
              {payment.notes}
            </div>
          )}

          {/* Signature / Stamp line (print only) */}
          <div className="hidden print:flex justify-between pt-12 text-xs text-gray-500">
            <div className="border-t border-gray-400 pt-1 w-36 text-center">
              Prepared By
            </div>
            <div className="border-t border-gray-400 pt-1 w-36 text-center">
              Authorized Signature
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 flex justify-end print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
