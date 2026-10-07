import React, { useState, useEffect } from 'react';
import {
  Package,
  Filter,
  ChevronDown,
  ChevronRight,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useReportStore } from '../../store/useReportStore';

const formatPKR = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
  }).format(val);
};

const formatNumber = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(val);
};

export const InventoryLedgerSection: React.FC = () => {
  const {
    inventoryLedger = [],
    selectedProductId,
    isLoadingInventory,
    setSelectedProductId,
    fetchInventoryLedger,
  } = useReportStore();

  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!inventoryLedger || inventoryLedger.length === 0) {
      fetchInventoryLedger();
    }
  }, []);

  const toggleProductAccordion = (productId: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const safeInventory = Array.isArray(inventoryLedger) ? inventoryLedger : [];
  const filteredInventory = selectedProductId
    ? safeInventory.filter((i) => i.product_id === selectedProductId)
    : safeInventory;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">1. Inventory Ledger & WAC Asset Valuation</h2>
            <p className="text-xs text-slate-500">Flattened stock levels and rolling average cost valuation per product</p>
          </div>
        </div>

        {/* Global Product Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <label className="text-xs font-semibold text-slate-600 shrink-0">Filter by Product:</label>
          <select
            value={selectedProductId || ''}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Products ({safeInventory.length})</option>
            {safeInventory.map((item) => (
              <option key={item.product_id} value={item.product_id}>
                {item.product_name} ({item.product_code})
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchInventoryLedger()}
            disabled={isLoadingInventory}
            title="Refresh Inventory Ledger"
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInventory ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          {isLoadingInventory && <span className="text-xs text-blue-600 animate-pulse font-medium ml-1">Loading...</span>}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Product Name</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-right">Total Stock (KG)</th>
              <th className="py-3 px-4 text-right">Rolling Avg Cost/KG</th>
              <th className="py-3 px-4 text-right">Total Asset Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                  {isLoadingInventory ? 'Loading inventory data...' : 'No active inventory products found matching the filter.'}
                </td>
              </tr>
            ) : (
              filteredInventory.flatMap((item) => {
                const isAccordionOpen = !!expandedProducts[item.product_id];
                const kgSold = item.all_time_kg_sold || 0;
                const kgPurchased = item.all_time_kg_purchased || 0;
                const totalAcquired = Math.max(kgPurchased, kgSold + (item.total_kg || 0));
                const turnoverPct = totalAcquired > 0 ? Math.min(100, Math.max(0, (kgSold / totalAcquired) * 100)) : 0;
                const profit = item.all_time_profit || 0;
                const isProfit = profit >= 0;
                const batches = item.batches || [];

                return [
                  /* ─── Top Level Row (Product Summary) ─── */
                  <tr
                    key={item.product_id}
                    onClick={() => toggleProductAccordion(item.product_id)}
                    className="hover:bg-slate-50/70 transition-colors border-t border-slate-200/60 cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProductAccordion(item.product_id);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {isAccordionOpen ? (
                            <ChevronDown className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <span>{item.product_name}</span>
                        <span className="text-xs font-mono font-normal text-slate-400">({item.product_code})</span>
                        {batches.length > 0 && (
                          <span className="ml-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                            {batches.length} Buckets
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                      {formatNumber(item.total_kg)} KG
                      {item.secondary_units_summary && (
                        <span className="block text-[11px] font-normal text-slate-400">
                          {item.secondary_units_summary}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-700">
                      {formatPKR(item.avg_cost)} / KG
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 font-mono">
                      {formatPKR(item.total_asset_value)}
                    </td>
                  </tr>,

                  /* ─── Middle Accordion Row (Consolidated Price Buckets) ─── */
                  isAccordionOpen && (
                    <tr key={`buckets-${item.product_id}`} className="bg-indigo-50/30 border-b border-indigo-100">
                      <td colSpan={5} className="py-3 px-6">
                        <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-indigo-600" />
                              Active & Historical Price Buckets for {item.product_name} ({batches.length} Buckets)
                            </span>
                            <span className="text-slate-500 font-normal text-[11px]">
                              Auto-FIFO Stock Deduction Order (Oldest First)
                            </span>
                          </div>

                          {batches.length === 0 ? (
                            <div className="py-4 text-center text-xs text-slate-400 italic">
                              No granular price buckets found for this product.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2.5 px-3">Bucket #</th>
                                    <th className="py-2.5 px-3">Created Date</th>
                                    <th className="py-2.5 px-3 text-right">Buy Price / KG</th>
                                    <th className="py-2.5 px-3 text-right">Stock (Remaining / Original)</th>
                                    <th className="py-2.5 px-3 min-w-[180px]">Depletion Progress</th>
                                    <th className="py-2.5 px-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {batches.map((b: any) => {
                                    const orig = Number(b.original_qty || 0);
                                    const rem = Number(b.remaining_qty || 0);
                                    const sold = Number(b.total_kg_sold || Math.max(0, orig - rem));
                                    const depletionPct = orig > 0 ? Math.min(100, Math.max(0, (sold / orig) * 100)) : 0;
                                    const isDepleted = b.status === 'DEPLETED' || rem <= 0;

                                    return (
                                      <tr key={b.batch_id} className="hover:bg-slate-50/60">
                                        <td className="py-2 px-3 font-mono font-bold text-indigo-600">
                                          {b.batch_number}
                                        </td>
                                        <td className="py-2 px-3 font-mono text-slate-600">
                                          {b.date}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                                          {formatPKR(b.buy_price_per_kg)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                          {formatNumber(rem)} / {formatNumber(orig)} KG
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="space-y-1">
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                                              <div
                                                className={`h-2 rounded-full transition-all duration-300 ${
                                                  isDepleted ? 'bg-slate-400' : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${depletionPct}%` }}
                                              />
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                                              <span>{formatNumber(sold)} KG Depleted</span>
                                              <span>{depletionPct.toFixed(1)}%</span>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          {isDepleted ? (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                              DEPLETED
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                              ACTIVE
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),

                  /* ─── Bottom Master Bar (All-Time Turnover & Margin) ─── */
                  <tr key={`turnover-${item.product_id}`} className="bg-slate-50/50 border-b border-slate-200">
                    <td colSpan={5} className="pb-3 pt-1 px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        {/* Progress Bar & Lifetime Turnover */}
                        <div className="flex-1 space-y-1.5 min-w-[220px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                              Lifetime Inventory Turnover
                            </span>
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                              {turnoverPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${turnoverPct}%` }}
                            />
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 flex justify-between">
                            <span>
                              Lifetime Turnover: <strong className="text-slate-800 font-mono">{formatNumber(kgSold)} KG</strong> Sold
                            </span>
                            <span>
                              <strong className="text-slate-800 font-mono">{formatNumber(kgPurchased > 0 ? kgPurchased : totalAcquired)} KG</strong> Total Acquired
                            </span>
                          </div>
                        </div>

                        {/* Vertical divider on sm screens */}
                        <div className="hidden sm:block w-px h-10 bg-slate-200" />

                        {/* Yield Metric: All-Time Gross Margin */}
                        <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center shrink-0">
                          <span className="text-xs font-semibold text-slate-500">All-Time Gross Margin</span>
                          <span className={`text-base font-black font-mono ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatPKR(profit)}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>,
                ];
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
