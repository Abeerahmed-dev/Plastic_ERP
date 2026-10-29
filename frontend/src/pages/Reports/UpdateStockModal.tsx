import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Loader2,
  TrendingUp,
  Truck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Percent,
} from 'lucide-react';
import { toast } from 'sonner';
import { purchasesService, StockUpdatePurchase } from '../../services/purchases.service';

interface UpdateStockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ItemRowState {
  product_id: string;
  product_name: string;
  product_code: string;
  size: string;
  quantity_kg: number;
  base_unit_price: number;
  current_sale_price: number;
  selling_price: number | string;
}

export const UpdateStockModal = ({ isOpen, onClose }: UpdateStockModalProps) => {
  const qc = useQueryClient();
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [deliveryCharges, setDeliveryCharges] = useState<number | string>('');
  const [itemRows, setItemRows] = useState<ItemRowState[]>([]);

  // Fetch recent purchases for stock update
  const {
    data: purchases = [],
    isLoading,
    isError,
  } = useQuery<StockUpdatePurchase[]>({
    queryKey: ['recentPurchasesForStockUpdate'],
    queryFn: () => purchasesService.getRecentForStockUpdate(25),
    enabled: isOpen,
  });

  // Default to latest purchase when purchases load
  useEffect(() => {
    if (purchases.length > 0 && !selectedPurchaseId) {
      setSelectedPurchaseId(purchases[0].id);
    }
  }, [purchases, selectedPurchaseId]);

  // When selected purchase changes, load its items and existing delivery charges
  const selectedPurchase = useMemo(() => {
    return purchases.find((p) => p.id === selectedPurchaseId);
  }, [purchases, selectedPurchaseId]);

  useEffect(() => {
    if (selectedPurchase) {
      setDeliveryCharges(selectedPurchase.delivery_charges || 0);

      const rows: ItemRowState[] = (selectedPurchase.items || []).map((item) => {
        const baseCost = Number(item.base_unit_price || item.unit_price || 0);
        const existingSalePrice = Number(item.current_sale_price || 0);
        // If current_sale_price is set, use it; otherwise default to baseCost * 1.15
        const defaultSalePrice = existingSalePrice > 0
          ? existingSalePrice
          : (baseCost > 0 ? Math.round(baseCost * 1.15 * 100) / 100 : 0);

        return {
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          size: item.size || 'Standard',
          quantity_kg: Number(item.quantity_kg || item.quantity || 0),
          base_unit_price: baseCost,
          current_sale_price: existingSalePrice,
          selling_price: defaultSalePrice,
        };
      });

      setItemRows(rows);
    }
  }, [selectedPurchase]);

  // Calculate total purchase weight (KG)
  const totalPurchaseKg = useMemo(() => {
    return itemRows.reduce((sum, item) => sum + (Number(item.quantity_kg) || 0), 0);
  }, [itemRows]);

  // Calculate DC per KG
  const numDc = Number(deliveryCharges) || 0;
  const dcPerKg = totalPurchaseKg > 0 ? Math.round((numDc / totalPurchaseKg) * 100) / 100 : 0;

  // Handle single item selling price change
  const handleSellingPriceChange = (productId: string, val: string) => {
    setItemRows((prev) =>
      prev.map((r) => (r.product_id === productId ? { ...r, selling_price: val } : r))
    );
  };

  // Quick preset: Apply margin percentage to all items
  const applyPresetMargin = (marginPct: number) => {
    setItemRows((prev) =>
      prev.map((r) => {
        const landedCost = r.base_unit_price + dcPerKg;
        const newPrice = Math.round(landedCost * (1 + marginPct / 100) * 100) / 100;
        return {
          ...r,
          selling_price: newPrice,
        };
      })
    );
    toast.info(`Applied +${marginPct}% margin to all items.`);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedPurchaseId) throw new Error('Please select a purchase');

      const itemsPayload = itemRows.map((r) => ({
        product_id: r.product_id,
        selling_price: Number(r.selling_price) || 0,
      }));

      return await purchasesService.updateStockDcAndPrices(selectedPurchaseId, {
        delivery_charges: numDc,
        items: itemsPayload,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventoryValuation'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['recentPurchasesForStockUpdate'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Stock delivery charges and selling prices updated successfully!');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err.message || 'Failed to update stock');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Update Stock & Final Selling Price
              </h2>
              <p className="text-xs text-slate-500">
                Allocate Delivery Charges (DC) per KG & set active selling price for sales/POS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Loading recent purchases & inventory items...</p>
            </div>
          ) : isError || purchases.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3 bg-slate-50 rounded-xl border border-slate-200 p-6">
              <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No recent purchases found</p>
              <p className="text-xs text-slate-400">
                Record a purchase invoice first to update its stock delivery charges and selling prices.
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Select Purchase Invoice */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    1. Select Purchase (Last Purchase Selected by Default)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {purchases.length} Recent purchases available
                  </span>
                </div>

                <select
                  value={selectedPurchaseId}
                  onChange={(e) => setSelectedPurchaseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  {purchases.map((p, idx) => (
                    <option key={p.id} value={p.id}>
                      {idx === 0 ? '★ [LATEST] ' : ''}
                      {p.invoice_number} — {p.supplier_name} ({new Date(p.date).toLocaleDateString()}) — {p.items?.length || 0} items ({Number(p.total_kg || 0).toLocaleString()} KG)
                    </option>
                  ))}
                </select>

                {selectedPurchase && (
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                    <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                      Party: <strong className="text-slate-900">{selectedPurchase.supplier_name}</strong>
                    </span>
                    <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                      Party Bill: <strong className="font-mono text-slate-900">Rs. {Number(selectedPurchase.total_amount).toLocaleString()}</strong>
                    </span>
                    <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                      Total Weight: <strong className="font-mono text-slate-900">{totalPurchaseKg.toLocaleString()} KG</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Step 2: Delivery Charges (DC) Input */}
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Truck className="h-4 w-4 text-amber-600" />
                    <span>2. Delivery Charges / DC (Rs)</span>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                    Auto-divided per KG into stock cost
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deliveryCharges}
                      onChange={(e) => setDeliveryCharges(e.target.value)}
                      placeholder="e.g. 15000"
                      className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-base font-bold font-mono text-amber-950 placeholder:text-slate-300 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <p className="mt-1 text-[11px] text-amber-700">
                      Logged as OPEX Expense (Logistics) • Not added to party ledger
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Shipment Total Weight:</span>
                      <span className="font-bold font-mono text-slate-800">{totalPurchaseKg.toLocaleString()} KG</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-amber-900 pt-1 border-t border-slate-100">
                      <span>Calculated DC / KG:</span>
                      <span className="font-mono text-emerald-700 text-base">
                        + Rs. {dcPerKg.toFixed(2)} <span className="text-xs font-normal text-slate-500">/ KG</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Margin Helper & Items Table */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      3. Purchased Items & Final Selling Price
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {itemRows.length} Items
                    </span>
                  </div>

                  {/* Preset Margin Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Percent className="h-3 w-3" /> Quick Margin:
                    </span>
                    {[10, 15, 20, 25].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => applyPresetMargin(pct)}
                        className="px-2 py-0.5 text-xs font-bold rounded-lg border border-slate-200 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition cursor-pointer"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <th className="py-2.5 px-3">Product / Variant</th>
                        <th className="py-2.5 px-3 text-right">Qty (KG)</th>
                        <th className="py-2.5 px-3 text-right">Buy / KG</th>
                        <th className="py-2.5 px-3 text-right text-amber-700">+ DC / KG</th>
                        <th className="py-2.5 px-3 text-right text-blue-900 bg-blue-50/60">Landed Cost</th>
                        <th className="py-2.5 px-3 w-40 text-center">New Sale Price / KG</th>
                        <th className="py-2.5 px-3 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-sans">
                      {itemRows.map((item) => {
                        const landedCost = Math.round((item.base_unit_price + dcPerKg) * 100) / 100;
                        const sPrice = Number(item.selling_price) || 0;
                        const profitPerKg = sPrice - landedCost;
                        const marginPct = sPrice > 0 ? Math.round((profitPerKg / sPrice) * 100) : 0;
                        const isBelowCost = sPrice > 0 && sPrice < landedCost;

                        return (
                          <tr key={item.product_id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Product & Variant */}
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                {item.product_name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-block text-[10px] font-mono font-bold bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded">
                                  {item.product_code}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Size: <strong className="text-slate-700">{item.size}</strong>
                                </span>
                              </div>
                            </td>

                            {/* Qty (KG) */}
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                              {item.quantity_kg.toLocaleString()} KG
                            </td>

                            {/* Buy Price / KG */}
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              Rs. {item.base_unit_price.toFixed(2)}
                            </td>

                            {/* DC / KG */}
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-700">
                              + Rs. {dcPerKg.toFixed(2)}
                            </td>

                            {/* Landed Cost / KG */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900 bg-blue-50/50">
                              Rs. {landedCost.toFixed(2)}
                            </td>

                            {/* Selling Price / KG (Editable) */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="relative inline-block w-32">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.selling_price}
                                  onChange={(e) => handleSellingPriceChange(item.product_id, e.target.value)}
                                  className={`w-full text-center py-1.5 px-2.5 rounded-lg border text-sm font-bold font-mono outline-none transition ${
                                    isBelowCost
                                      ? 'border-red-400 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-400/20'
                                      : 'border-emerald-400 bg-emerald-50/40 text-emerald-950 focus:bg-white focus:ring-2 focus:ring-emerald-500/20'
                                  }`}
                                />
                              </div>
                            </td>

                            {/* Margin % */}
                            <td className="py-2.5 px-3 text-right font-mono">
                              {isBelowCost ? (
                                <span className="text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                  Loss ({marginPct}%)
                                </span>
                              ) : marginPct > 0 ? (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                  +{marginPct}%
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">0%</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {itemRows.length > 0 && (
              <span>
                Saving will set final selling price for <strong className="text-slate-800">{itemRows.length}</strong> items across POS & Invoices.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || isLoading || itemRows.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Updating Prices...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Save & Apply Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

