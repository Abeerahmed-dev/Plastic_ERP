import { useState, useEffect } from 'react';
import { X, RotateCcw, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesService } from '../../services/invoices.service';

interface Props {
  parentInvoiceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RETURN_REASONS = [
  'Dispatch Error - Wrong Item/Size Physically Shipped',
  'Customer - Excess Quantity Ordered',
  'Customer - Defective/Damaged Product',
] as const;

export const ProcessReturnModal = ({ parentInvoiceId, isOpen, onClose, onSuccess }: Props) => {
  const qc = useQueryClient();
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnQuantities, setReturnQuantities] = useState<{ [productId: string]: number }>({});
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { data: summaryData, isLoading, isError, error } = useQuery({
    queryKey: ['invoiceReturnSummary', parentInvoiceId],
    queryFn: () => invoicesService.getInvoiceReturnSummary(parentInvoiceId),
    enabled: isOpen && !!parentInvoiceId,
  });

  useEffect(() => {
    if (summaryData?.items) {
      const initialQtys: { [productId: string]: number } = {};
      summaryData.items.forEach((item: any) => {
        initialQtys[item.product_id] = 0;
      });
      setReturnQuantities(initialQtys);
      setReturnReason('');
      setErrorMessage('');
    }
  }, [summaryData, isOpen]);

  const items = summaryData?.items || [];
  const parentInvoice = summaryData?.parentInvoice;

  const handleQuantityChange = (productId: string, val: number, maxAllowed: number) => {
    const clamped = Math.max(0, Math.min(val, maxAllowed));
    setReturnQuantities((prev) => ({ ...prev, [productId]: clamped }));
  };

  const totalCreditNoteAmount = items.reduce((acc: number, item: any) => {
    const returnQty = returnQuantities[item.product_id] || 0;
    return acc + returnQty * Number(item.unit_price || 0);
  }, 0);

  const totalReturnQty = Object.values(returnQuantities).reduce((acc, q) => acc + q, 0);

  const hasExceededConstraint = items.some((item: any) => {
    const qty = returnQuantities[item.product_id] || 0;
    return qty > item.remaining_quantity + 0.0001;
  });

  const isFormValid =
    !isLoading &&
    returnReason.trim() !== '' &&
    totalReturnQty > 0 &&
    !hasExceededConstraint;

  const mutation = useMutation({
    mutationFn: () => {
      const payloadItems = Object.entries(returnQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([product_id, return_quantity]) => ({
          product_id,
          return_quantity,
        }));

      return invoicesService.createSalesReturn(parentInvoiceId, {
        return_reason: returnReason,
        items: payloadItems,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['pnlReport'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.error || err.message || 'Failed to process sales return.');
    },
  });

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 text-red-700 font-bold border border-red-200">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Invoice-Anchored Sales Return (Credit Note)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Parent Invoice: <span className="font-bold text-slate-800">{parentInvoice?.invoice_number || parentInvoiceId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-6 overflow-y-auto flex-1 space-y-6">
          {isLoading && (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              <p className="font-semibold text-sm">Loading historical invoice items...</p>
            </div>
          )}

          {isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error instanceof Error ? error.message : 'Failed to load return summary.'}
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-red-800 text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" />
              {errorMessage}
            </div>
          )}

          {!isLoading && summaryData && (
            <>
              {/* Mandatory Reason Dropdown */}
              <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl shadow-2xs">
                <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">
                  Return Reason (Mandatory Audit Trail) <span className="text-red-600">*</span>
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-xl py-2.5 px-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  <option value="">-- Select Mandatory Return Reason --</option>
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-amber-700 mt-1 font-medium">
                  Select whether this return was due to staff dispatch error or customer preference for owner auditing.
                </p>
              </div>

              {/* Billed Items Return Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Product Name & Size</th>
                      <th className="py-3 px-3 text-center">Billed Qty</th>
                      <th className="py-3 px-3 text-center">Prev. Returned</th>
                      <th className="py-3 px-3 text-center">Max Returnable</th>
                      <th className="py-3 px-3 text-right">Price / Unit</th>
                      <th className="py-3 px-4 text-center w-36">Return Qty</th>
                      <th className="py-3 px-4 text-right">Credit Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {items.map((item: any) => {
                      const returnQty = returnQuantities[item.product_id] || 0;
                      const lineCredit = returnQty * Number(item.unit_price || 0);
                      const isFullyReturned = item.remaining_quantity <= 0;

                      return (
                        <tr
                          key={item.product_id}
                          className={returnQty > 0 ? 'bg-red-50/60' : 'hover:bg-slate-50/60'}
                        >
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800 block">
                              {item.product_size ? `${item.product_name} - ${item.product_size}` : item.product_name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Code: {item.product_code || item.product_id.slice(0, 8)}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center font-semibold text-slate-700">
                            {item.original_quantity} {item.selected_unit || 'KG'}
                          </td>

                          <td className="py-3 px-3 text-center font-medium text-slate-500">
                            {item.previously_returned_quantity} {item.selected_unit || 'KG'}
                          </td>

                          <td className="py-3 px-3 text-center font-bold text-emerald-700 bg-emerald-50/50 rounded-lg">
                            {item.remaining_quantity} {item.selected_unit || 'KG'}
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-slate-800 font-semibold">
                            Rs. {Number(item.unit_price).toLocaleString()}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isFullyReturned ? (
                              <span className="text-[11px] font-extrabold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                FULLY RETURNED
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                max={item.remaining_quantity}
                                value={returnQty || ''}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    item.product_id,
                                    parseFloat(e.target.value) || 0,
                                    item.remaining_quantity
                                  )
                                }
                                placeholder="0"
                                className="w-24 text-center font-bold text-sm py-1.5 px-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                              />
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-red-700">
                            {returnQty > 0 ? `- ${formatCurrency(lineCredit)}` : 'PKR 0.00'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Credit Note Summary */}
              <div className="flex justify-end pt-2">
                <div className="w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Items to Return</span>
                    <span className="font-bold text-slate-800">
                      {Object.values(returnQuantities).filter((q) => q > 0).length} Item(s)
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>Credit Note Total</span>
                    <span className="text-xl font-black text-red-600 font-mono">
                      - {formatCurrency(totalCreditNoteAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!isFormValid || mutation.isPending}
            className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Return...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Confirm Sales Return & Issue Credit Note
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
