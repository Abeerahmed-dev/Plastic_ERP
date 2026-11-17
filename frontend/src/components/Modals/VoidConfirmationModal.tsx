import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, X, Ban, Loader2 } from 'lucide-react';
import { invoicesService } from '../../services/invoices.service';
import { purchasesService } from '../../services/purchases.service';
import { invalidatePurchaseQueries, invalidateSalesInvoiceQueries } from '../../utils/querySync';

export interface VoidConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'sale' | 'purchase';
  invoice: {
    id: string;
    invoice_number: string;
    customer_name?: string;
    supplier_name?: string;
    total_amount?: number | string;
  } | null;
  onSuccess?: () => void;
}

export function VoidConfirmationModal({
  isOpen,
  onClose,
  type = 'sale',
  invoice,
  onSuccess,
}: VoidConfirmationModalProps) {
  const [voidReason, setVoidReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  if (!isOpen || !invoice) return null;

  const isPurchase = type === 'purchase';

  const handleClose = () => {
    if (isSubmitting) return;
    setVoidReason('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const payloadReason = voidReason.trim() ? voidReason.trim() : null;

      if (isPurchase) {
        await purchasesService.voidInvoice(invoice.id, payloadReason);
        toast.success('Purchase invoice successfully voided.');
        await invalidatePurchaseQueries(queryClient);
      } else {
        await invoicesService.voidInvoice(invoice.id, payloadReason);
        toast.success('Invoice successfully voided and inventory restored.');
        await invalidateSalesInvoiceQueries(queryClient);
      }

      setVoidReason('');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to void invoice:', error);
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to void invoice';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const partyName = isPurchase
    ? invoice.supplier_name || invoice.customer_name
    : invoice.customer_name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-red-200 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="void-modal-title"
      >
        {/* Header Banner */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs ring-1 ring-white/20">
              <Ban className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="void-modal-title" className="text-lg font-bold tracking-tight">
                {isPurchase ? 'Void Purchase Invoice' : 'Void Sales Invoice'}
              </h2>
              <p className="text-xs text-red-100 font-mono">
                {invoice.invoice_number} {partyName ? `• ${partyName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Severe Warning Callout */}
          <div className="rounded-xl border-2 border-red-300 bg-red-50/90 p-4 shadow-inner">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs text-red-950">
                <p className="font-extrabold uppercase tracking-wide text-red-800 text-[11px]">
                  CRITICAL WARNING: Irreversible State Unwinding
                </p>
                <p className="leading-relaxed text-slate-800">
                  {isPurchase
                    ? 'Voiding this purchase invoice will strictly unwind stock and supplier payments without deleting the audit trail:'
                    : 'Voiding this invoice will strictly unwind its physical and financial impact without deleting the audit trail:'}
                </p>
                {isPurchase ? (
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    <li>
                      <strong className="text-slate-900">Safety Guard:</strong> Cannot void if stock from this bill has already been sold.
                    </li>
                    <li>
                      <strong className="text-slate-900">Decrements Warehouse Stock:</strong> Unsold stock is automatically deducted from inventory.
                    </li>
                    <li>
                      <strong className="text-slate-900">Marks Batches VOID:</strong> Associated inventory batches are deactivated and closed.
                    </li>
                    <li>
                      <strong className="text-slate-900">Transfers Cash to Supplier Advance:</strong> Any payments made toward this bill are converted to supplier advance credit.
                    </li>
                    <li>
                      <strong className="text-slate-900">Audit Trail Preserved:</strong> Row status changes to <em>VOID</em> with timestamp and administrator ID.
                    </li>
                  </ul>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    <li>
                      <strong className="text-slate-900">Restores Physical Stock:</strong> Dispatched quantities are automatically credited back to warehouse inventory.
                    </li>
                    <li>
                      <strong className="text-slate-900">Revives FIFO Batches:</strong> Batches depleted by this sale are incremented and set back to <em>ACTIVE</em>.
                    </li>
                    <li>
                      <strong className="text-slate-900">Cancels Overdrafts:</strong> Unfulfilled pending deliveries are marked <em>CANCELLED</em>.
                    </li>
                    <li>
                      <strong className="text-slate-900">Transfers Cash to Surplus:</strong> Any payments made toward this invoice are unlinked and routed into the customer's <strong>WALLET_ADVANCE</strong>.
                    </li>
                    <li>
                      <strong className="text-slate-900">Audit Trail Preserved:</strong> Row status changes to <em>VOID</em> with timestamp and administrator ID.
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Void Reason Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="void-reason" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Reason for Voiding <span className="text-slate-400 font-normal normal-case">(Optional)</span>
              </label>
            </div>
            <textarea
              id="void-reason"
              rows={3}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Provide an optional reason for the audit log (e.g., Customer cancelled order, entered wrong details)... (Optional)"
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition shadow-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-600/20 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Voiding Invoice...</span>
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  <span>Confirm & Void</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VoidConfirmationModal;

