import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, AlertTriangle, Check, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { productsService } from '../../services/products.service';
import { InventoryValuationItem } from '../../services/reports.service';

interface UpdateThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryValuationItem | null;
}

export function UpdateThresholdModal({ isOpen, onClose, product }: UpdateThresholdModalProps) {
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState<string>('');

  useEffect(() => {
    if (product) {
      setThreshold(String(product.low_stock_threshold ?? 0));
    }
  }, [product]);

  const mutation = useMutation({
    mutationFn: async (newVal: number) => {
      if (!product) return;
      return productsService.updateProduct(product.id, {
        low_stock_threshold: newVal,
      });
    },
    onSuccess: () => {
      toast.success(
        `Low stock threshold updated to ${Number(threshold || 0)} KG for ${product?.product_name || 'product'}`
      );
      qc.invalidateQueries({ queryKey: ['inventoryValuation'] });
      qc.invalidateQueries({ queryKey: ['lowStockAlerts'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update threshold';
      toast.error(msg);
    },
  });

  if (!isOpen || !product) return null;

  const currentStock = product.stock_on_hand !== undefined ? product.stock_on_hand : product.current_stock_kg || 0;
  const numVal = parseFloat(threshold) || 0;
  const willBeLow = numVal > 0 && currentStock <= numVal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numVal < 0) {
      toast.error('Threshold cannot be negative');
      return;
    }
    mutation.mutate(numVal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#161925] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#23283B] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#23283B]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Low Stock Threshold
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure minimum inventory alert level
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#11131c] border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Product:</span>
              <span className="font-bold text-slate-800 dark:text-white">{product.product_name}</span>
            </div>
            {product.size && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Size / Variant:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {product.size}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Current Stock on Hand:</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {currentStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Alert Threshold (KG) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g. 50"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121520] text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500">
                KG
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              When physical stock drops at or below this value, an amber/red warning will alert accountants & staff. Set to 0 to disable.
            </p>
          </div>

          {willBeLow && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Stock Deficit Notice: </span>
                Current stock ({currentStock} KG) is already at or below this new threshold ({numVal} KG). Setting this will immediately flag this item as Low Stock.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-[#23283B]">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Threshold</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

