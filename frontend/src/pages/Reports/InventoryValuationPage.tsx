import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  Search,
  RefreshCw,
  Loader2,
  Filter,
  DollarSign,
  AlertTriangle,
  Package,
  Layers,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  History,
  CheckCircle2,
  CircleDot,
} from 'lucide-react';
import { reportsService, InventoryValuationData, FifoBucketItem } from '../../services/reports.service';

export default function InventoryValuationPage() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [highCapitalOnly, setHighCapitalOnly] = useState<boolean>(false);
  const [sortField, setSortField] = useState<'asset_value' | 'current_stock_kg' | 'product_name'>('asset_value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Accordion row expansion state
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<InventoryValuationData>({
    queryKey: ['inventoryValuation'],
    queryFn: () => reportsService.getInventoryValuation(),
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    if (!data?.products) return;
    const next: Record<string, boolean> = {};
    data.products.forEach((p) => {
      next[p.id] = true;
    });
    setExpandedRows(next);
  };

  const collapseAll = () => {
    setExpandedRows({});
  };

  const categoriesList = useMemo(() => {
    if (!data?.products) return [];
    const set = new Set<string>();
    data.products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [data?.products]);

  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    return data.products
      .filter((p) => {
        const matchesSearch =
          p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
        const assetVal = p.total_asset_value || p.asset_value || 0;
        const stockKg = p.stock_on_hand || p.current_stock_kg || 0;
        const isHighCapital = assetVal > 500000 || stockKg > 1000;
        const matchesCapitalFilter = !highCapitalOnly || isHighCapital;

        return matchesSearch && matchesCategory && matchesCapitalFilter;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') {
          valA = (valA as string).toLowerCase();
          valB = (valB as string).toLowerCase();
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [data?.products, searchQuery, selectedCategory, highCapitalOnly, sortField, sortOrder]);

  const stats = useMemo(() => {
    if (!data?.products) return { totalProducts: 0, totalWeightKg: 0, heavyTieUpCount: 0, heavyTieUpValue: 0 };
    let totalWeight = 0;
    let heavyCount = 0;
    let heavyVal = 0;

    data.products.forEach((p) => {
      const stockKg = p.stock_on_hand || p.current_stock_kg || 0;
      const assetVal = p.total_asset_value || p.asset_value || 0;
      totalWeight += stockKg;
      if (assetVal > 500000 || stockKg > 1000) {
        heavyCount++;
        heavyVal += assetVal;
      }
    });

    return {
      totalProducts: data.products.length,
      totalWeightKg: totalWeight,
      heavyTieUpCount: heavyCount,
      heavyTieUpValue: heavyVal,
    };
  }, [data?.products]);

  const toggleSort = (field: 'asset_value' | 'current_stock_kg' | 'product_name') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── PAGE HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Inventory Valuation & Asset Ledger
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Real-time capital allocation across physical warehouse stock with expandable FIFO purchase bucket depletion
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Expand All Rows
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Collapse All
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── ERROR STATE ────────────────────────────────────────── */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-center justify-between">
          <span>Failed to load inventory valuation data. Please try again.</span>
          <button onClick={() => refetch()} className="font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* ─── MACRO KPI CARD (TOTAL WAREHOUSE CAPITAL) ───────────── */}
      <div className="relative overflow-hidden bg-slate-900 text-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-800">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Boxes className="w-80 h-80 text-white" />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                <DollarSign className="w-3.5 h-3.5" /> Total Warehouse Capital (WAC)
              </span>
              <h2 className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-white mt-3 tabular-nums">
                Rs. {(data?.total_warehouse_capital || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Sum of (Real-Time Physical Stock KG × Rolling WAC per KG) for all active products
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-800/80 backdrop-blur-md p-3.5 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-400" /> Active Products
                </div>
                <div className="text-lg font-bold font-mono text-white mt-1 tabular-nums">
                  {stats.totalProducts}
                </div>
              </div>

              <div className="bg-slate-800/80 backdrop-blur-md p-3.5 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" /> Total Stock Weight
                </div>
                <div className="text-lg font-bold font-mono text-white mt-1 tabular-nums">
                  {stats.totalWeightKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} KG
                </div>
              </div>

              <div className="bg-amber-950/40 backdrop-blur-md p-3.5 rounded-xl border border-amber-800/50 col-span-2 sm:col-span-1">
                <div className="text-amber-400 text-xs font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Heavy Capital Tie-Up
                </div>
                <div className="text-lg font-bold font-mono text-amber-300 mt-1 tabular-nums">
                  {stats.heavyTieUpCount} items
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DATA TABLE BLOCK ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by product name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
              />
            </div>

            {/* Category Dropdown */}
            <div className="relative min-w-[180px]">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Heavy Tie-Up Checkbox Filter */}
          <label className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl cursor-pointer select-none shrink-0 w-full sm:w-auto justify-center hover:bg-amber-100/80 transition-colors">
            <input
              type="checkbox"
              checked={highCapitalOnly}
              onChange={(e) => setHighCapitalOnly(e.target.checked)}
              className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>⚠️ Heavy Tie-Up Only (&gt; Rs. 500k or &gt; 1,000 KG)</span>
          </label>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
            <p className="text-xs font-medium">Calculating warehouse asset valuations & FIFO bucket data...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Package className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No products found matching your filter</p>
            <p className="text-xs text-slate-400">Try adjusting your search query or category selection</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200">
                  <th className="py-3.5 pl-4 pr-2 w-10 text-center">#</th>
                  <th className="py-3.5 px-4 sm:px-6">
                    <button
                      onClick={() => toggleSort('product_name')}
                      className="flex items-center gap-1.5 hover:text-slate-900 cursor-pointer font-bold uppercase tracking-wider text-[11px]"
                    >
                      <span>Product</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>

                  <th className="py-3.5 px-4 uppercase tracking-wider text-[11px] font-bold">Category</th>

                  <th className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => toggleSort('current_stock_kg')}
                      className="flex items-center gap-1.5 ml-auto hover:text-slate-900 cursor-pointer font-bold uppercase tracking-wider text-[11px]"
                    >
                      <span>Stock on Hand (KG)</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>

                  <th className="py-3.5 px-4 text-right uppercase tracking-wider text-[11px] font-bold">
                    Rolling Cost (WAC/KG)
                  </th>

                  <th className="py-3.5 px-4 sm:px-6 text-right">
                    <button
                      onClick={() => toggleSort('asset_value')}
                      className="flex items-center gap-1.5 ml-auto hover:text-slate-900 cursor-pointer font-bold uppercase tracking-wider text-[11px]"
                    >
                      <span>Total Asset Value</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredProducts.map((product) => {
                  const stockKg = product.stock_on_hand !== undefined ? product.stock_on_hand : product.current_stock_kg;
                  const assetVal = product.total_asset_value !== undefined ? product.total_asset_value : product.asset_value;
                  const isHeavyCapital = assetVal > 500000 || stockKg > 1000;
                  const isExpanded = !!expandedRows[product.id];
                  const buckets: FifoBucketItem[] = product.buckets || [];

                  // Lifetime turnover calculations
                  const kgAcquired = product.lifetime_kg_acquired > 0 ? product.lifetime_kg_acquired : (stockKg + product.lifetime_kg_sold);
                  const kgSold = product.lifetime_kg_sold || 0;
                  const turnoverPct = kgAcquired > 0 ? Math.min(100, Math.max(0, Math.round((kgSold / kgAcquired) * 100))) : 0;

                  return (
                    <Fragment key={product.id}>
                      {/* MASTER ROW */}
                      <tr
                        onClick={() => toggleRow(product.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded
                            ? 'bg-slate-100/90 font-medium'
                            : isHeavyCapital
                            ? 'bg-amber-50/40 hover:bg-amber-100/50'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Accordion Chevron */}
                        <td className="py-3.5 pl-4 pr-2 text-center text-slate-400">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(product.id);
                            }}
                            className="p-1 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-700" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                          </button>
                        </td>

                        {/* Product Name & Warning Badge */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{product.product_name}</span>
                            {isHeavyCapital && (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0">
                                <AlertTriangle className="h-3 w-3 text-amber-600" /> Heavy Tie-Up
                              </span>
                            )}
                          </div>
                          {product.code && (
                            <span className="inline-block mt-0.5 text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {product.code}
                            </span>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {product.category}
                          </span>
                        </td>

                        {/* Stock on Hand (KG) */}
                        <td className="py-3.5 px-4 text-right font-mono text-xs sm:text-sm tabular-nums font-semibold text-slate-800">
                          {stockKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                        </td>

                        {/* Rolling WAC per KG */}
                        <td className="py-3.5 px-4 text-right font-mono text-xs sm:text-sm tabular-nums text-slate-600">
                          Rs. {product.current_wac.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Total Asset Value */}
                        <td className="py-3.5 px-4 sm:px-6 text-right font-mono text-xs sm:text-sm tabular-nums">
                          {isHeavyCapital ? (
                            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg font-black shadow-2xs">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <span>
                                Rs. {assetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-slate-900">
                              Rs. {assetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* EXPANDABLE SUB-ROW (FIFO BUCKETS & TURNOVER) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200 shadow-inner">
                          <td colSpan={6} className="p-4 sm:p-6 space-y-6">
                            {/* Sub-Row Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                              <div className="flex items-center gap-2">
                                <History className="h-4 w-4 text-slate-600" />
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                                  Active & Historical Price Buckets (FIFO Depletion)
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                  {buckets.length} Lots
                                </span>
                              </div>
                              <span className="text-xs text-slate-500">
                                Real-time FIFO bucket depletion progress tracked per purchase lot
                              </span>
                            </div>

                            {/* BUCKETS TABLE */}
                            {buckets.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                                No historical purchase buckets recorded for this product.
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                                      <th className="py-2.5 px-4">Bucket #</th>
                                      <th className="py-2.5 px-4">Created Date</th>
                                      <th className="py-2.5 px-4 text-right">Buy Price / KG</th>
                                      <th className="py-2.5 px-4 text-right">Stock (Remaining / Original)</th>
                                      <th className="py-2.5 px-4 w-48 text-center">Depletion Progress</th>
                                      <th className="py-2.5 px-4 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-sans">
                                    {buckets.map((bucket, idx) => {
                                      const orig = bucket.original_stock > 0 ? bucket.original_stock : 1;
                                      const rem = bucket.remaining_stock || 0;
                                      const depPct = Math.min(
                                        100,
                                        Math.max(0, Math.round(((orig - rem) / orig) * 100))
                                      );
                                      const isActive = rem > 0;

                                      return (
                                        <tr key={bucket.bucket_id || idx} className="hover:bg-slate-50/80">
                                          {/* Bucket # */}
                                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                                            {bucket.batch_number || `LOT-${idx + 1}`}
                                          </td>

                                          {/* Created Date */}
                                          <td className="py-2.5 px-4 text-slate-600 font-mono">
                                            {bucket.created_date}
                                          </td>

                                          {/* Buy Price / KG */}
                                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                                            Rs. {bucket.buy_price_per_kg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>

                                          {/* Stock Remaining / Original */}
                                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                                            <span className="font-bold text-slate-900">{rem.toLocaleString()}</span>
                                            <span className="text-slate-400"> / {bucket.original_stock.toLocaleString()} KG</span>
                                          </td>

                                          {/* Depletion Progress Bar */}
                                          <td className="py-2.5 px-4">
                                            <div className="flex items-center gap-2">
                                              <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                  className={`h-2.5 rounded-full transition-all ${
                                                    isActive ? 'bg-emerald-500' : 'bg-slate-400'
                                                  }`}
                                                  style={{ width: `${depPct}%` }}
                                                />
                                              </div>
                                              <span className="text-[11px] font-mono font-bold text-slate-700 w-10 text-right">
                                                {depPct}%
                                              </span>
                                            </div>
                                          </td>

                                          {/* Status Badge */}
                                          <td className="py-2.5 px-4 text-center">
                                            {isActive ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                <CircleDot className="w-2.5 h-2.5 text-emerald-600" /> ACTIVE
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600 border border-slate-300">
                                                <CheckCircle2 className="w-2.5 h-2.5 text-slate-500" /> DEPLETED
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

                            {/* LIFETIME TURNOVER METRIC BLOCK */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-blue-600" />
                                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                    Lifetime Inventory Turnover & Margin
                                  </h4>
                                </div>

                                <div className="text-xs font-semibold font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                                  All-Time Gross Margin: {(product.all_time_gross_margin || 0).toFixed(1)}%
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                  <span>
                                    Depletion Velocity: <strong className="text-slate-900 font-mono">{kgSold.toLocaleString()} KG Sold</strong> out of <strong className="text-slate-900 font-mono">{kgAcquired.toLocaleString()} KG Acquired</strong>
                                  </span>
                                  <span className="font-mono font-bold text-blue-700">{turnoverPct}% Cleared</span>
                                </div>

                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 p-0.5">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all shadow-xs"
                                    style={{ width: `${turnoverPct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
