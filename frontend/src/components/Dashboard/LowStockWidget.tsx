import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShoppingCart, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { inventoryService, LowStockVariant } from '../../services/inventory.service';

export const LowStockWidget: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<LowStockVariant[]>({
    queryKey: ['lowStockAlerts'],
    queryFn: () => inventoryService.getLowStock(),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const lowStockItems = data || [];

  const handleOrderStock = (item: LowStockVariant) => {
    navigate(`/purchases?orderProduct=${encodeURIComponent(item.id)}`, {
      state: { prefillVariantId: item.id },
    });
  };

  return (
    <div className="rounded-2xl border border-red-200/80 bg-linear-to-b from-red-50/90 via-red-50/40 to-white p-5 shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-red-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-red-100 text-red-600 shadow-2xs">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Low Stock Early Warnings
              </h3>
              {lowStockItems.length > 0 ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-red-600 text-white shadow-2xs animate-pulse">
                  {lowStockItems.length} {lowStockItems.length === 1 ? 'Variant' : 'Variants'} Below Threshold
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Healthy Stock
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live inventory monitoring flagged at customizable variant-level thresholds
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-100/70 transition-all disabled:opacity-50 cursor-pointer"
          title="Refresh alerts"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-red-600' : ''}`} />
        </button>
      </div>

      {/* Body Content */}
      <div className="pt-3">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-slate-400">
            Scanning variant inventory levels...
          </div>
        ) : isError ? (
          <div className="py-4 px-3 rounded-xl bg-red-100/60 text-xs text-red-700 font-medium">
            Failed to retrieve real-time low stock alerts. Click refresh to retry.
          </div>
        ) : lowStockItems.length === 0 ? (
          <div className="py-5 px-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-900">
                All Variant Stocks are Healthy
              </p>
              <p className="text-[11px] text-emerald-700">
                No active sizes or variants have breached their minimum low-inventory thresholds.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {lowStockItems.map((item) => {
              const currentKg = Number(item.total_stock_kg || 0).toLocaleString('en-PK', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
              });
              const minKg = Number(item.low_stock_threshold || 0).toLocaleString('en-PK', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
              });
              const isDepleted = Number(item.total_stock_kg || 0) <= 0;

              return (
                <div
                  key={item.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-red-200/70 bg-white/90 hover:bg-red-50/60 hover:border-red-300 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        isDepleted ? 'bg-red-600 animate-ping' : 'bg-amber-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {item.name}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          Size: {item.size || 'Standard'}
                        </span>
                        {item.code && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {item.code}
                          </span>
                        )}
                        {item.category_name && (
                          <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                            {item.category_name}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 mt-1 flex items-center gap-2 font-medium">
                        <span className={isDepleted ? 'text-red-700 font-bold' : 'text-slate-700'}>
                          Current: <strong className="font-mono text-red-600">{currentKg} KG</strong>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>
                          Minimum: <strong className="font-mono text-slate-800">{minKg} KG</strong>
                        </span>
                        {item.deficit_kg > 0 && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="text-red-700 font-semibold text-[11px]">
                              Deficit: {Number(item.deficit_kg).toFixed(1)} KG
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleOrderStock(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-98 rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
                      title={`Open Purchase Invoice for ${item.name} (${item.size})`}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      <span>Order Stock</span>
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LowStockWidget;
