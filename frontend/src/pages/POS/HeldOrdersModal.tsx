import React, { useState } from 'react';
import { X, Play, Trash2, Clock, ShoppingCart, User, AlertCircle, Loader2 } from 'lucide-react';
import { POSHeldOrder } from '../../services/pos.service';

interface HeldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldOrders: POSHeldOrder[];
  isLoading: boolean;
  onResume: (order: POSHeldOrder) => void;
  onDelete: (orderId: string) => void;
  isDeleting?: boolean;
}

export const HeldOrdersModal: React.FC<HeldOrdersModalProps> = ({
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
    const itemsStr = (order.items || []).map((i) => (i.productName || i.name || '')).join(' ').toLowerCase();
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
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Held POS Transactions</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:border-amber-500/50 dark:text-amber-300">
                  {heldOrders.length} Held
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-amber-200/70">
                Saved bills from previous customers — click at any time to resume the bill and complete checkout.
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
        {heldOrders.length > 3 && (
          <div className="p-3 bg-slate-50 border-b border-slate-100 dark:bg-[#161925] dark:border-[#23283B]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name, reference note or product..."
              className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#121520] dark:border-[#2D3349] dark:text-white"
            />
          </div>
        )}

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-xs font-semibold">Loading held orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:bg-[#161925] dark:border dark:border-[#23283B] dark:text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-700 text-sm dark:text-white">No transactions currently on hold</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto dark:text-slate-400">
                To put a customer's bill on hold, click the "Hold Bill" button in the sale cart.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const itemsList = Array.isArray(order.items) ? order.items : [];
              const itemsCount = itemsList.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 1), 0);

              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-md transition-all p-3.5 flex flex-col gap-2.5 relative dark:bg-[#161925] dark:border-[#23283B] dark:hover:border-amber-500/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-slate-900 text-sm truncate dark:text-white">
                          {order.reference_note || 'Held Transaction'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                          <Clock className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                          {formatTime(order.created_at)} ({formatDate(order.created_at)})
                        </span>
                        {order.creator_name && (
                          <span className="text-[10px] text-slate-500 font-medium dark:text-slate-400">
                            by {order.creator_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 mb-1 dark:text-slate-400">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium truncate">
                          {order.customer_name ? (
                            <strong className="text-blue-700 font-semibold dark:text-sky-400">{order.customer_name}</strong>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">Walk-In Customer</span>
                          )}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          {itemsList.length} unique items ({itemsCount} total units)
                        </span>
                      </div>

                      {/* Items Preview Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {itemsList.slice(0, 4).map((item: any, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium dark:bg-[#121520] dark:border-[#2D3349] dark:text-slate-300"
                          >
                            <span className="truncate max-w-[140px]">{item.productName || item.name}</span>
                            <span className="font-bold text-slate-900 dark:text-white">x{item.quantity} {item.selected_unit || 'KG'}</span>
                          </span>
                        ))}
                        {itemsList.length > 4 && (
                          <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded dark:bg-slate-800 dark:text-slate-400">
                            +{itemsList.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Total Amount & Action Buttons */}
                    <div className="text-right flex flex-col items-end shrink-0 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider dark:text-slate-400">
                          Grand Total
                        </span>
                        <span className="font-black text-base text-blue-700 font-mono dark:text-sky-400">
                          Rs. {Number(order.total_amount).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to discard this held order for "${order.reference_note}"?`)) {
                              onDelete(order.id);
                            }
                          }}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition cursor-pointer dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                          title="Discard / Delete Held Bill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onResume(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
                          title="Resume this bill in POS Cart"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Resume Bill</span>
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
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between text-xs text-slate-500 dark:bg-[#0c101c] dark:border-[#1e2235] dark:text-slate-400">
          <span>
            {heldOrders.length > 0
              ? 'Tip: After resuming a bill, you can add more items, edit quantities, or proceed to checkout.'
              : 'Hold transaction feature empowers continuous checkout without losing paused customer items.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer dark:bg-[#161925] dark:border-[#2D3349] dark:text-slate-200 dark:hover:bg-[#1e2337]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
