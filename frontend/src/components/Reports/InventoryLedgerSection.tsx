import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  RefreshCw,
  Boxes,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useReportStore } from '../../store/useReportStore';

const formatPKR = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'Rs. 0';
  const num = Math.round(Number(val));
  return `Rs. ${num.toLocaleString('en-PK')}`;
};

const formatNumber = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 1 }).format(val);
};

export const InventoryLedgerSection: React.FC = () => {
  const {
    inventoryLedger = [],
    isLoadingInventory,
    fetchInventoryLedger,
  } = useReportStore();

  useEffect(() => {
    if (!inventoryLedger || inventoryLedger.length === 0) {
      fetchInventoryLedger();
    }
  }, []);

  const safeInventory = Array.isArray(inventoryLedger) ? inventoryLedger : [];

  // Calculate Overall Aggregate Lifetime Inventory Turnover & Metrics
  const overallMetrics = useMemo(() => {
    let totalKgSold = 0;
    let totalKgPurchased = 0;
    let totalStockKg = 0;
    let totalGrossMargin = 0;
    let totalAssetValue = 0;

    safeInventory.forEach((item) => {
      const sold = Number(item.all_time_kg_sold || 0);
      const purchased = Number(item.all_time_kg_purchased || 0);
      const stock = Number(item.total_kg || 0);
      totalKgSold += sold;
      totalKgPurchased += purchased;
      totalStockKg += stock;
      totalGrossMargin += Number(item.all_time_profit || 0);
      totalAssetValue += Number(item.total_asset_value || 0);
    });

    const totalAcquired = Math.max(totalKgPurchased, totalKgSold + totalStockKg);
    const turnoverPct = totalAcquired > 0 ? Math.min(100, Math.max(0, (totalKgSold / totalAcquired) * 100)) : 0;

    return {
      totalKgSold,
      totalKgAcquired: totalAcquired,
      turnoverPct,
      totalGrossMargin,
      totalAssetValue,
      totalStockKg,
    };
  }, [safeInventory]);

  return (
    <div className="rounded-2xl border border-slate-300/80 bg-white p-4 sm:p-5 shadow-[0_20px_50px_rgba(15,23,42,0.30),0_8px_20px_rgba(15,23,42,0.18)] transition-all space-y-3.5 w-full min-w-0 overflow-hidden flex flex-col justify-between dark:bg-[#121520] dark:border-[#23283B] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 min-w-0 pb-2 border-b border-slate-100 dark:border-[#23283B]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0 dark:bg-purple-950/40 dark:border-purple-500/80 dark:text-purple-400 dark:shadow-[0_0_12px_rgba(168,85,247,0.35)]">
            <Package className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              1. Inventory Ledger &amp; WAC Valuation
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 font-medium truncate">
              Overall stock levels and average cost valuation
            </p>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            onClick={() => fetchInventoryLedger()}
            disabled={isLoadingInventory}
            title="Refresh Inventory Data"
            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:dark:bg-slate-700"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingInventory ? 'animate-spin text-indigo-600 dark:text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Single Aggregate Overall Lifetime Inventory Turnover Banner ── */}
      <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs dark:bg-[#161925] dark:border-[#23283B]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Overall Inventory Lifetime Turnover
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Turnover Rate:</span>
            <span className="font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200 text-xs dark:bg-blue-950/40 dark:border-blue-500/60 dark:text-blue-400">
              {overallMetrics.turnoverPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
            style={{ width: `${overallMetrics.turnoverPct}%` }}
          />
        </div>

        {/* Bottom Details Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-0.5">
          <div className="text-slate-600 dark:text-slate-400">
            Total Sold: <strong className="text-slate-900 dark:text-white font-mono">{formatNumber(overallMetrics.totalKgSold)} KG</strong>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">|</span>
            Acquired: <strong className="text-slate-900 dark:text-white font-mono">{formatNumber(overallMetrics.totalKgAcquired)} KG</strong>
          </div>
          <div className="text-slate-600 dark:text-slate-400">
            All-Time Margin: <strong className={`font-mono ${overallMetrics.totalGrossMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatPKR(overallMetrics.totalGrossMargin)}</strong>
          </div>
        </div>
      </div>

      {/* Aggregate KPI Metric Tiles */}
      <div className="grid grid-cols-2 gap-2.5 w-full">
        {/* Total Stock on Hand */}
        <div className="bg-blue-50/50 rounded-xl border border-blue-100/80 p-2.5 sm:p-3 flex items-center gap-2.5 shadow-2xs hover:shadow-xs transition-all dark:bg-[#0c1b2b] dark:border-sky-400/80 dark:shadow-[0_0_12px_rgba(56,189,248,0.35)]">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600 shrink-0 dark:bg-sky-950/60 dark:text-sky-400">
            <Boxes className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-medium text-slate-500 dark:text-sky-300/80">Current Stock</span>
            <span className="block text-sm sm:text-base font-bold text-slate-900 dark:text-sky-300 font-mono tabular-nums truncate">
              {formatNumber(overallMetrics.totalStockKg)} <span className="text-xs font-normal text-slate-500 dark:text-sky-400/70">KG</span>
            </span>
          </div>
        </div>

        {/* Total Asset Valuation */}
        <div className="bg-emerald-50/50 rounded-xl border border-emerald-100/80 p-2.5 sm:p-3 flex items-center gap-2.5 shadow-2xs hover:shadow-xs transition-all dark:bg-[#092218] dark:border-emerald-400/80 dark:shadow-[0_0_12px_rgba(52,211,153,0.35)]">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 shrink-0 dark:bg-emerald-950/60 dark:text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-medium text-slate-500 dark:text-emerald-300/80">Total Asset Value</span>
            <span className="block text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums truncate">
              {formatPKR(overallMetrics.totalAssetValue)}
            </span>
          </div>
        </div>

        {/* Products Tracked */}
        <div className="bg-indigo-50/50 rounded-xl border border-indigo-100/80 p-2.5 sm:p-3 flex items-center gap-2.5 shadow-2xs hover:shadow-xs transition-all dark:bg-[#1a0f2b] dark:border-purple-500/80 dark:shadow-[0_0_12px_rgba(168,85,247,0.35)]">
          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 shrink-0 dark:bg-purple-950/60 dark:text-purple-400">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-medium text-slate-500 dark:text-purple-300/80">Active Products</span>
            <span className="block text-sm sm:text-base font-bold text-slate-900 dark:text-purple-300 font-mono tabular-nums">
              {safeInventory.length} <span className="text-xs font-normal text-slate-500 dark:text-purple-400/70">Items</span>
            </span>
          </div>
        </div>

        {/* Inventory Security & Valuation Mode */}
        <div className="bg-amber-50/50 rounded-xl border border-amber-100/80 p-2.5 sm:p-3 flex items-center gap-2.5 shadow-2xs hover:shadow-xs transition-all dark:bg-[#201c08] dark:border-amber-400/80 dark:shadow-[0_0_12px_rgba(250,204,21,0.35)]">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-600 shrink-0 dark:bg-amber-950/60 dark:text-yellow-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-medium text-slate-500 dark:text-yellow-300/80">Costing Method</span>
            <span className="block text-xs font-bold text-amber-900 dark:text-yellow-300 truncate">
              Weighted Avg (WAC)
            </span>
          </div>
        </div>
      </div>

      {/* Link to Full Stocks & Valuation Page */}
      <Link
        to="/stocks"
        className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 transition-all text-xs font-semibold text-slate-700 hover:text-indigo-600 group dark:bg-[#161925] dark:border-[#23283B] dark:text-slate-300 hover:dark:text-blue-400 hover:dark:border-blue-500/50"
      >
        <span>View Full Stocks &amp; FIFO Buckets</span>
        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform dark:text-slate-500 dark:group-hover:text-blue-400" />
      </Link>
    </div>
  );
};
