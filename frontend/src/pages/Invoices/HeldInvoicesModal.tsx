import React, { useState } from 'react';
import { X, Play, Trash2, Clock, User, AlertCircle, Loader2 } from 'lucide-react';
import { POSHeldOrder } from '../../services/pos.service';

interface HeldInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldOrders: POSHeldOrder[];
  isLoading: boolean;
  onResume: (order: POSHeldOrder) => void;
  onDelete: (orderId: string) => void;
  isDeleting?: boolean;
}

export const HeldInvoicesModal: React.FC<HeldInvoicesModalProps> = ({
  isOpen,
  onClose,
  heldOrders,
  isLoading,
  onResume,
  onDelete,
  isDeleting,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredOrders = heldOrders.filter((order) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const note = (order.reference_note || '').toLowerCase();
    const cust = (order.customer_name || '').toLowerCase();
    const itemsStr = (order.items || [])
      .map((i) => i.productName || i.name || i.selected_family_name || '')
      .join(' ')
      .toLowerCase();
    return note.includes(term) || cust.includes(term) || itemsStr.includes(term);
  });

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  const cleanReferenceNote = (note?: string) => {
    if (!note) return 'Held Sales Invoice';
    return note.replace(/^\[ERP\]\s*/i, '');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:bg-[#121520] dark:border-[#23283B]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 px-5 py-3.5 dark:from-[#1c1208] dark:via-[#25180a] dark:to-[#1c1208] dark:border-b dark:border-amber-500/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 dark:bg-amber-950/60 dark:border dark:border-amber-500/40">
              <Clock className="w-5 h-5 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Held Wholesale Invoices</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:border-amber-500/50 dark:text-amber-300">
                  {heldOrders.length} Held
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-amber-200/70">
                Invoices put on hold — click Resume to restore the invoice in the form.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 transition dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar if multiple orders */}
        {heldOrders.length > 2 && (
          <div className="p-3 bg-slate-50 border-b border-slate-100 dark:bg-[#161925] dark:border-[#23283B]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name or product..."
              className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#121520] dark:border-[#2D3349] dark:text-white"
            />
          </div>
        )}

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-xs font-semibold">Loading held invoices...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2 dark:bg-[#161925]">
                <Clock className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Held Invoices Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {searchTerm ? 'No invoices match your search filter.' : 'When you hold an invoice during creation, it will appear here.'}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const itemsList = order.items || [];
              const itemsCount = itemsList.length;
              const totalKg = itemsList.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);

              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-amber-400/80 transition-all dark:bg-[#161925] dark:border-[#23283B] dark:hover:border-amber-500/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {order.customer_name || 'Customer'}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          {formatDate(order.created_at)} • {formatTime(order.created_at)}
                        </span>
                      </div>

                      <div className="text-xs font-medium text-amber-700 dark:text-amber-400/90">
                        {cleanReferenceNote(order.reference_note)}
                      </div>

                      {/* Items details snippet */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{itemsCount} product(s)</span> ({totalKg} KG total)
                        {itemsList.length > 0 && (
                          <span className="ml-1 text-slate-400">
                            • {itemsList.slice(0, 3).map((it: any) => it.productName || it.product_name || it.selected_family_name || 'Item').join(', ')}
                            {itemsList.length > 3 ? '...' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Total + Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#23283B]">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Payable</span>
                        <span className="text-base font-black text-blue-600 font-mono dark:text-sky-400">
                          Rs. {Number(order.total_amount || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onResume(order)}
                          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs active:scale-95 transition cursor-pointer"
                          title="Load this invoice into the form"
                        >
                          <Play className="w-3.5 h-3.5 fill-slate-950" />
                          <span>Resume</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete(order.id)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer dark:hover:bg-rose-950/40"
                          title="Delete held invoice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between text-xs text-slate-500 dark:bg-[#161925] dark:border-[#23283B] dark:text-slate-400">
          <span>Resuming a held invoice will restore its customer and line items.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 font-semibold rounded-lg text-slate-600 hover:bg-slate-200 transition dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
