import React, { useState, useEffect } from 'react';
import { X, PauseCircle, User, ShoppingBag, Loader2 } from 'lucide-react';

interface HoldConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (referenceNote: string) => void;
  customerName: string;
  itemsCount: number;
  totalAmount: number;
  isPending?: boolean;
}

export const HoldConfirmModal: React.FC<HoldConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  customerName,
  itemsCount,
  totalAmount,
  isPending,
}) => {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNote('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(note.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 dark:bg-[#121520] dark:border-[#23283B]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-amber-50/70 px-5 py-3.5 dark:bg-[#1a140d] dark:border-[#23283B]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500 text-white dark:bg-amber-950/60 dark:border dark:border-amber-500/40">
              <PauseCircle className="w-5 h-5 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hold Current Sale</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Put this bill on hold to immediately serve the next customer.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-700 transition dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Order Summary Snapshot */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between dark:bg-[#161925] dark:border-[#23283B]">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block dark:text-slate-400">Customer</span>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 dark:text-white">
                <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                {customerName || 'Walk-In Customer'}
              </span>
              <span className="text-[11px] text-slate-500 font-medium dark:text-slate-400">
                {itemsCount} items in cart
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block dark:text-slate-400">Total Amount</span>
              <span className="text-base font-black text-amber-700 font-mono dark:text-amber-400">
                Rs. {totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Reference / Note Input */}
          <div>
            <label htmlFor="hold_note" className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-300">
              Token / Reference Note (Optional)
            </label>
            <input
              id="hold_note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Token #4, Customer name, blue shirt, vehicle parking..."
              className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs dark:bg-[#161925] dark:border-[#2D3349] dark:text-white"
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1">
              If left blank, customer name and current time will be auto-assigned.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#23283B]">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-300 transition cursor-pointer dark:bg-[#161925] dark:border-[#2D3349] dark:text-slate-300 dark:hover:bg-[#1e2337]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition cursor-pointer dark:from-amber-500 dark:to-amber-600 dark:text-slate-950"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Holding...</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Hold & Clear Cart</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
