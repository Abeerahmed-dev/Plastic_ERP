import React from 'react';
import { X, Loader2, ArrowDownRight, RefreshCw, FileText } from 'lucide-react';
import { SalesReturnDetailItem } from '../../services/reports.service';

interface SalesReturnsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate?: string;
  endDate?: string;
  items: SalesReturnDetailItem[];
  isLoading: boolean;
  onRefresh?: () => void;
}

export const SalesReturnsDetailModal: React.FC<SalesReturnsDetailModalProps> = ({
  isOpen,
  onClose,
  startDate,
  endDate,
  items,
  isLoading,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const totalKg = items.reduce((acc, curr) => acc + (curr.returned_kg || 0), 0);
  const totalRefund = items.reduce((acc, curr) => acc + (curr.refund_amount || 0), 0);

  const formatMoney = (val: number) => {
    const formatted = Math.abs(val).toLocaleString('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `(Rs. ${formatted})`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <ArrowDownRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Sales Returns Detail
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  Credit Notes
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Period: <span className="text-slate-200 font-semibold">{startDate || 'N/A'}</span> to{' '}
                <span className="text-slate-200 font-semibold">{endDate || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer disabled:opacity-50"
                title="Refresh Returns Detail"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Close Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Fetching itemized sales returns & credit notes...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <FileText className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No returns found for this period</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No credit notes or customer return invoices were processed between {startDate} and {endDate}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Ref # (Credit Note)</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4 text-right">Qty Returned (KG)</th>
                    <th className="py-3 px-4 text-right">Refund Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-medium">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs shrink-0 whitespace-nowrap">
                        {item.date}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4 text-slate-900 font-semibold">
                        {item.customer_name}
                      </td>

                      {/* Ref # */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          {item.credit_note_id}
                        </span>
                        {item.original_invoice_id && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            Original: {item.original_invoice_id}
                          </span>
                        )}
                      </td>

                      {/* Product */}
                      <td className="py-3 px-4 text-slate-800">
                        {item.product_name}
                      </td>

                      {/* Qty Returned (KG) */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {item.returned_kg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                      </td>

                      {/* Refund Amount (PKR) */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-red-600">
                        {formatMoney(item.refund_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer / Summary */}
        {!isLoading && items.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <div className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-mono">{items.length}</strong> itemized return record(s)
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm font-mono">
              <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-slate-500 text-xs mr-2">Total Returned Weight:</span>
                <strong className="text-slate-900">{totalKg.toLocaleString(undefined, { minimumFractionDigits: 2 })} KG</strong>
              </div>

              <div className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                <span className="text-red-700 text-xs mr-2 font-sans font-semibold">Total Credit Refund:</span>
                <strong className="text-red-600 font-bold">{formatMoney(totalRefund)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
