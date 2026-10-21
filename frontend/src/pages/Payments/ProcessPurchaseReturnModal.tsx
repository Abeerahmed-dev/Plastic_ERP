import { useState, useEffect } from 'react';
import { X, RotateCcw, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesService } from '../../services/purchases.service';

interface Props {
  parentInvoiceId: string;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PURCHASE_RETURN_REASONS = [
  'Supplier Shipped Defective / Substandard Material',
  'Discrepancy in Weight / Grade from Specification',
  'Excess Inventory Returned to Supplier',
  'Incorrect Product Delivered by Vendor',
] as const;

export const ProcessPurchaseReturnModal = ({ parentInvoiceId, isOpen = true, onClose, onSuccess }: Props) => {
  const qc = useQueryClient();
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnQuantities, setReturnQuantities] = useState<{ [productId: string]: number }>({});
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { data: summaryData, isLoading, isError, error } = useQuery({
    queryKey: ['purchaseReturnSummary', parentInvoiceId],
    queryFn: () => purchasesService.getInvoiceReturnSummary(parentInvoiceId),
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

  const totalDebitNoteAmount = items.reduce((acc: number, item: any) => {
    const returnQty = returnQuantities[item.product_id] || 0;
    return acc + returnQty * Number(item.unit_price || 0);
  }, 0);

  const totalReturnQty = Object.values(returnQuantities).reduce((acc, q) => acc + q, 0);

  const hasExceededConstraint = items.some((item: any) => {
    const qty = returnQuantities[item.product_id] || 0;
    const maxAllowed = item.can_return_qty !== undefined ? item.can_return_qty : item.remaining_quantity;
    return qty > maxAllowed + 0.0001;
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

      return purchasesService.createPurchaseReturn({
        parent_invoice_id: parentInvoiceId,
        return_reason: returnReason,
        items: payloadItems,
        line_items: payloadItems,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-payments'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const serverErr = err?.response?.data?.error || err?.response?.data?.message || err.message;
      if (serverErr === 'STOCK_ALREADY_SOLD') {
        setErrorMessage('Double-Spend Protection: Goods cannot be returned because stock has already been sold from the warehouse.');
      } else {
        setErrorMessage(serverErr || 'Failed to process purchase return.');
      }
    },
  });

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
              <RotateCcw className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Purchase Return & Debit Note
              </h2>
              <p className="text-xs text-slate-500">
                Return goods to supplier and generate an official Debit Note
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-rose-600 mb-2" />
              <p className="text-sm font-medium">Loading purchase invoice details & remaining stock...</p>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-900">Error Loading Purchase Invoice</h4>
                <p className="text-xs text-red-700 mt-0.5">
                  {(error as any)?.message || 'Failed to fetch parent invoice items.'}
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-900">Return Rejected</h4>
                <p className="text-xs text-red-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {!isLoading && summaryData && (
            <>
              {/* Parent Invoice Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Purchase Invoice #</span>
                  <p className="font-bold font-mono text-slate-900 mt-0.5">
                    {parentInvoice?.invoice_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Supplier</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {parentInvoice?.supplier_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Invoice Date</span>
                  <p className="font-mono text-slate-700 mt-0.5">
                    {parentInvoice?.date ? new Date(parentInvoice.date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Original Invoice Total</span>
                  <p className="font-bold font-mono text-slate-900 mt-0.5">
                    {formatCurrency(Number(parentInvoice?.total_amount || 0))}
                  </p>
                </div>
              </div>

              {/* Items Selection Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Billed Line Items & Return Allocation
                  </h3>
                  <span className="text-xs text-slate-500">
                    Targeted Batch Deduction ensures asset capacity shrinks from inventory
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3 text-right">Billed Qty</th>
                        <th className="py-2.5 px-3 text-right">Already Returned</th>
                        <th className="py-2.5 px-3 text-right">Batch In-Stock</th>
                        <th className="py-2.5 px-3 text-right">Unit Rate</th>
                        <th className="py-2.5 px-3 text-center w-36">Return Qty</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {items.map((item: any) => {
                        const maxReturnable = item.can_return_qty !== undefined ? item.can_return_qty : item.remaining_quantity;
                        const returnQty = returnQuantities[item.product_id] || 0;
                        const lineTotal = returnQty * Number(item.unit_price || 0);
                        const isSoldOut = item.batch_remaining_qty !== undefined && item.batch_remaining_qty <= 0;

                        return (
                          <tr key={item.product_id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{item.product_name}</div>
                              {item.product_size && (
                                <div className="text-[10px] font-mono text-slate-400">Size: {item.product_size}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {Number(item.original_quantity).toLocaleString()} {item.selected_unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                              {Number(item.previously_returned || 0) > 0
                                ? `-${Number(item.previously_returned).toLocaleString()}`
                                : '0'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              <span
                                className={`font-bold ${
                                  isSoldOut ? 'text-red-600' : 'text-emerald-700'
                                }`}
                              >
                                {Number(item.batch_remaining_qty ?? item.remaining_quantity).toLocaleString()}{' '}
                                {item.selected_unit}
                              </span>
                              {isSoldOut && (
                                <div className="text-[10px] text-red-500 font-semibold">Stock Sold</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {formatCurrency(Number(item.unit_price || 0))}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 justify-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={maxReturnable}
                                  step="any"
                                  disabled={maxReturnable <= 0}
                                  value={returnQty || ''}
                                  onChange={(e) =>
                                    handleQuantityChange(
                                      item.product_id,
                                      parseFloat(e.target.value) || 0,
                                      maxReturnable
                                    )
                                  }
                                  placeholder="0"
                                  className="w-24 px-2 py-1 text-center font-mono font-bold text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                                />
                                <span className="text-[10px] font-bold text-slate-400">
                                  / {maxReturnable}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reason Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Return Reason & Audit Memo *</span>
                  <span className="text-slate-400 font-normal">Mandatory for Debit Note issuance</span>
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden bg-white text-slate-800"
                >
                  <option value="">Select an official return reason...</option>
                  {PURCHASE_RETURN_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Or enter custom return reason / details..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden text-slate-700"
                />
              </div>

              {/* Netting Summary Banner */}
              <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-rose-900 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Issuing this Debit Note will reduce your liability to <strong>{parentInvoice?.supplier_name}</strong> by{' '}
                    <strong>{formatCurrency(totalDebitNoteAmount)}</strong>.
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-rose-700 font-semibold uppercase tracking-wider">Debit Note Total</div>
                  <div className="text-lg font-black font-mono text-rose-800">
                    - {formatCurrency(totalDebitNoteAmount)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={() => mutation.mutate()}
            disabled={!isFormValid || mutation.isPending}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing Inventory Destruction...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Confirm & Issue Debit Note ({formatCurrency(totalDebitNoteAmount)})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProcessPurchaseReturnModal;
