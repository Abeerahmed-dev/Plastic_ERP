import { useState, useEffect, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Boxes,
  RefreshCw,
  Loader2,
  Filter,
  DollarSign,
  Package,
  Layers,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  History,
  CheckCircle2,
  CircleDot,
  RotateCcw,
  AlertTriangle,
  Edit3,
  ShieldAlert,
  Plus,
  X,
} from 'lucide-react';
import { reportsService, InventoryValuationData, InventoryValuationItem, FifoBucketItem } from '../../services/reports.service';
import { productsService } from '../../services/products.service';
import { useAuthStore } from '../../store/auth.store';
import { UpdateStockModal } from './UpdateStockModal';
import { UpdateThresholdModal } from './UpdateThresholdModal';
import { ProductFormModal } from '../Products/ProductFormModal';
import { LowStockWidget } from '../../components/Dashboard/LowStockWidget';
import { ProductSizeFilter } from '../../components/Common/ProductSizeFilter';
import { invalidateProductQueries } from '../../utils/querySync';
import { erpSyncBus, useErpSync } from '../../utils/erpSyncBus';
import { pickCanonicalGroupName } from '../../utils/productSorting';

interface ProductGroup {
  groupKey: string;
  groupName: string;
  variants: InventoryValuationItem[];
  totalGroupStock: number;
  totalGroupAssetValue: number;
  hasLowStock: boolean;
  lowStockCount: number;
  totalThreshold: number;
}

interface SellingPriceEditorCardProps {
  product: InventoryValuationItem;
  canEdit?: boolean;
  onPriceUpdated: (newPrice: number) => void;
}

function SellingPriceEditorCard({ product, canEdit = true, onPriceUpdated }: SellingPriceEditorCardProps) {
  const qc = useQueryClient();
  const initialPrice = product.selling_price !== undefined
    ? Number(product.selling_price)
    : Number(product.sale_price || 0);

  const [priceInput, setPriceInput] = useState<string>(initialPrice > 0 ? initialPrice.toString() : '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const cur = product.selling_price !== undefined
      ? Number(product.selling_price)
      : Number(product.sale_price || 0);
    setPriceInput(cur > 0 ? cur.toString() : '');
  }, [product.id, product.selling_price, product.sale_price]);

  const avgCost = Number(product.current_wac || 0);
  const parsedPrice = parseFloat(priceInput);
  const isValidNumber = !isNaN(parsedPrice) && parsedPrice >= 0;
  const currentSavedPrice = product.selling_price !== undefined
    ? Number(product.selling_price)
    : Number(product.sale_price || 0);

  const isChanged = isValidNumber && Math.abs(parsedPrice - currentSavedPrice) > 0.001;

  // Margin calculation against Avg Cost / KG
  const profitPerKg = isValidNumber && avgCost > 0 ? parsedPrice - avgCost : null;
  const marginPct =
    isValidNumber && parsedPrice > 0 && profitPerKg !== null
      ? Math.round((profitPerKg / parsedPrice) * 100)
      : null;
  const isBelowCost = isValidNumber && avgCost > 0 && parsedPrice < avgCost;

  const applyMarginPct = (pct: number) => {
    if (avgCost <= 0) return;
    const calculated = Math.round(avgCost * (1 + pct / 100) * 100) / 100;
    setPriceInput(calculated.toString());
  };

  const handleSave = async () => {
    if (!isValidNumber || !isChanged || isSaving || !canEdit) return;
    try {
      setIsSaving(true);
      await productsService.updateSellingPrice(product.id, parsedPrice);

      onPriceUpdated(parsedPrice);

      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['posProducts'] });
      qc.invalidateQueries({ queryKey: ['inventoryValuation'] });
      qc.invalidateQueries({ queryKey: ['inventory-valuation'] });
      erpSyncBus.emit('products');

      toast.success(`Selling price updated to Rs. ${parsedPrice.toFixed(2)} / KG`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to update selling price');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/70 via-indigo-50/50 to-white dark:from-[#181d2e] dark:via-[#151928] dark:to-[#121520] border border-blue-200/80 dark:border-blue-900/50 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Title & Input with Live Margin */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Selling Price / KG (Daily Market Rate)
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              • Active across POS & Sales Invoices
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative inline-flex items-center">
              <span className="absolute left-3 text-xs font-bold text-slate-400 dark:text-slate-500 select-none">
                Rs.
              </span>
              <input
                type="number"
                min="0"
                step="any"
                disabled={!canEdit || isSaving}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="0.00"
                className={`w-36 pl-9 pr-8 py-2 rounded-xl border text-sm font-bold font-mono outline-none transition bg-white dark:bg-[#0f111a] text-slate-900 dark:text-white shadow-2xs ${
                  isBelowCost
                    ? 'border-red-400 ring-2 ring-red-400/20 dark:border-red-600'
                    : 'border-slate-300 dark:border-[#23283B] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
              <span className="absolute right-2.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 select-none">
                /KG
              </span>
            </div>

            {/* Live Margin % badge */}
            {avgCost > 0 && isValidNumber && profitPerKg !== null && (
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors shadow-2xs ${
                  isBelowCost
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                }`}
              >
                {isBelowCost ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span>
                      Below Cost ({marginPct}%) • Loss: -Rs. {Math.abs(profitPerKg).toFixed(2)}/KG
                    </span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      +{marginPct}% Margin • Profit: +Rs. {profitPerKg.toFixed(2)}/KG
                    </span>
                  </>
                )}
              </div>
            )}

            {avgCost === 0 && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                (No Avg Cost recorded yet)
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Margin Pills & Save Button */}
        {canEdit && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-2 sm:pt-0">
            {/* Quick Margin Pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 select-none hidden sm:inline">
                Margin:
              </span>
              {[10, 15, 20, 25].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  disabled={avgCost <= 0 || isSaving}
                  onClick={() => applyMarginPct(pct)}
                  className="px-2 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-[#121520] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-[#23283B] hover:border-blue-300 dark:hover:border-blue-800 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                  title={avgCost > 0 ? `Set price to Avg Cost + ${pct}%` : 'Requires Avg Cost > 0'}
                >
                  +{pct}%
                </button>
              ))}
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValidNumber || !isChanged || isSaving}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Price</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InventoryValuationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const role = (user?.roleName || user?.role || '').toUpperCase();
  const isCashier = role === 'CASHIER';
  const isAccountant = role === 'ACCOUNTANT';

  const [productQuery, setProductQuery] = useState<string>('');
  const [sizeQuery, setSizeQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'asset_value' | 'current_stock_kg' | 'product_name'>('asset_value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isUpdateStockOpen, setIsUpdateStockOpen] = useState<boolean>(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState<boolean>(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState<boolean>(false);
  const [showInStockOnly, setShowInStockOnly] = useState<boolean>(false);
  const [editingThresholdProduct, setEditingThresholdProduct] = useState<InventoryValuationItem | null>(null);
  const [selectedFifoProduct, setSelectedFifoProduct] = useState<InventoryValuationItem | null>(null);

  const createProductMutation = useMutation({
    mutationFn: (data: any) => productsService.createProduct(data),
    onSuccess: () => {
      invalidateProductQueries(queryClient);
      erpSyncBus.emit('product');
      setIsAddProductOpen(false);
    },
  });

  // Group expansion state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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

  // Automatically refresh inventory valuation on any mutation across the system
  useErpSync(() => {
    refetch();
  });

  const filterProductItems = useMemo(() => {
    if (!data?.products) return [];
    return data.products.map((p) => ({
      ...p,
      name: p.product_name,
      size: p.size || 'Standard',
    }));
  }, [data?.products]);

  const isSearchActive = Boolean(productQuery.trim() || sizeQuery.trim());

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const isCurrentlyExpanded = isSearchActive
        ? prev[groupKey] !== false
        : !!prev[groupKey];
      return {
        ...prev,
        [groupKey]: !isCurrentlyExpanded,
      };
    });
  };

  const categoriesList = useMemo(() => {
    if (!data?.products) return [];
    const set = new Set<string>();
    data.products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [data?.products]);

  // Step 1: Group the Data (React useMemo)
  const groupedProducts = useMemo(() => {
    if (!data?.products) return [];

    const pQ = productQuery.trim().toLowerCase();
    const sQ = sizeQuery.trim().toLowerCase();

    // Filter products
    const filtered = data.products.filter((p) => {
      const stockKg = p.stock_on_hand !== undefined ? p.stock_on_hand : p.current_stock_kg || 0;
      const threshold = Number(p.low_stock_threshold || 0);
      const isLow = Boolean(p.is_low_stock || (threshold > 0 && stockKg <= threshold) || stockKg <= 0);

      const matchesProduct = !pQ || p.product_name.trim().toLowerCase().includes(pQ);
      const matchesSize = !sQ || (p.size ? p.size.trim().toLowerCase().includes(sQ) : false);
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchesLowStock = !showLowStockOnly || isLow;
      const matchesInStock = !showInStockOnly || stockKg > 0;

      return matchesProduct && matchesSize && matchesCategory && matchesLowStock && matchesInStock;
    });

    // Reduce into groups by normalized product_name
    const groupMap = new Map<string, ProductGroup>();

    filtered.forEach((p) => {
      const normalizedName = p.product_name.trim().toLowerCase();
      const stockKg = p.stock_on_hand !== undefined ? p.stock_on_hand : p.current_stock_kg || 0;
      const assetVal = p.total_asset_value !== undefined ? p.total_asset_value : p.asset_value || 0;
      const threshold = Number(p.low_stock_threshold || 0);
      const isLow = Boolean(p.is_low_stock || (threshold > 0 && stockKg <= threshold) || stockKg <= 0);

      if (!groupMap.has(normalizedName)) {
        groupMap.set(normalizedName, {
          groupKey: normalizedName,
          groupName: p.product_name.trim(),
          variants: [],
          totalGroupStock: 0,
          totalGroupAssetValue: 0,
          hasLowStock: false,
          lowStockCount: 0,
          totalThreshold: 0,
        });
      }

      const group = groupMap.get(normalizedName)!;
      group.groupName = pickCanonicalGroupName([group.groupName, p.product_name.trim()]);
      group.variants.push(p);
      group.totalGroupStock += stockKg;
      group.totalGroupAssetValue += assetVal;
      group.totalThreshold += threshold;
      if (isLow) {
        group.hasLowStock = true;
        group.lowStockCount += 1;
      }
    });

    // Sort groups based on sortField & sortOrder
    const groupsArray = Array.from(groupMap.values());

    groupsArray.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'product_name') {
        valA = a.groupName.toLowerCase();
        valB = b.groupName.toLowerCase();
      } else if (sortField === 'current_stock_kg') {
        valA = a.totalGroupStock;
        valB = b.totalGroupStock;
      } else {
        valA = a.totalGroupAssetValue;
        valB = b.totalGroupAssetValue;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return groupsArray;
  }, [data?.products, productQuery, sizeQuery, selectedCategory, sortField, sortOrder, showLowStockOnly, showInStockOnly]);

  const expandAll = () => {
    if (!groupedProducts) return;
    const nextGroups: Record<string, boolean> = {};
    groupedProducts.forEach((g) => {
      nextGroups[g.groupKey] = true;
    });
    setExpandedGroups(nextGroups);
  };

  const collapseAll = () => {
    if (isSearchActive) {
      const nextGroups: Record<string, boolean> = {};
      groupedProducts.forEach((g) => {
        nextGroups[g.groupKey] = false;
      });
      setExpandedGroups(nextGroups);
    } else {
      setExpandedGroups({});
    }
  };

  const stats = useMemo(() => {
    if (!data?.products) return { totalProducts: 0, totalWeightKg: 0, lowStockCount: 0 };
    let totalWeight = 0;
    let lowStockCount = 0;

    data.products.forEach((p) => {
      const stockKg = p.stock_on_hand !== undefined ? p.stock_on_hand : p.current_stock_kg || 0;
      totalWeight += stockKg;
      const threshold = Number(p.low_stock_threshold || 0);
      const isLow = Boolean(p.is_low_stock || (threshold > 0 && stockKg <= threshold) || stockKg <= 0);
      if (isLow) {
        lowStockCount += 1;
      }
    });

    return {
      totalProducts: data.products.length,
      totalWeightKg: totalWeight,
      lowStockCount,
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0B10] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── PAGE HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-[#161925] p-6 rounded-2xl border border-slate-200 dark:border-[#23283B] shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 dark:bg-[#0e111a] dark:border dark:border-slate-800 text-white shadow-md">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Stocks
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Real-time physical warehouse stock, sizes, variants & asset valuation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCashier && (
            <button
              onClick={() => setIsAddProductOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              title="Add New Product / Variant"
            >
              <Plus className="h-4 w-4 text-slate-950" />
              <span>Add Product</span>
            </button>
          )}
          {!isCashier && (
            <button
              onClick={() => setIsUpdateStockOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 via-black-700 to-indigo-800 hover:from-blue-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              title="Allocate Delivery Charges and calculate Landed Cost & Pricing for purchase shipments"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Allocate Delivery Charges & Pricing</span>
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 hover:dark:bg-slate-700 dark:border dark:border-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── LOW STOCK EARLY WARNINGS WIDGET (ACCOUNTANT ONLY) ─────── */}
      {isAccountant && <LowStockWidget />}

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
      <div className="relative overflow-hidden bg-slate-900 dark:bg-[#121520] text-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-800 dark:border-[#23283B]">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Boxes className="w-80 h-80 text-white" />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 dark:border-[#23283B] pb-6">
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

            {isAccountant ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-800/80 dark:bg-[#161925]/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-700 dark:border-[#23283B]">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-blue-400" /> Active Products
                  </div>
                  <div className="text-lg font-bold font-mono text-white mt-1 tabular-nums">
                    {stats.totalProducts}
                  </div>
                </div>

                <div className="bg-slate-800/80 dark:bg-[#161925]/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-700 dark:border-[#23283B]">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" /> Total Stock Weight
                  </div>
                  <div className="text-lg font-bold font-mono text-white mt-1 tabular-nums">
                    {stats.totalWeightKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} KG
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowLowStockOnly((prev) => !prev);
                    setShowInStockOnly(false);
                  }}
                  className={`text-left p-3.5 rounded-xl border backdrop-blur-md transition-all cursor-pointer ${
                    showLowStockOnly
                      ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30'
                      : stats.lowStockCount > 0
                      ? 'bg-amber-950/40 border-amber-600/60 hover:border-amber-500'
                      : 'bg-slate-800/80 dark:bg-[#161925]/90 border-slate-700 dark:border-[#23283B]'
                  }`}
                  title="Click to toggle low stock filter"
                >
                  <div className="flex items-center justify-between">
                    <div className={`text-xs font-medium flex items-center gap-1.5 ${stats.lowStockCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      <AlertTriangle className={`w-3.5 h-3.5 ${stats.lowStockCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} /> Low Stock Alerts
                    </div>
                    {stats.lowStockCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200">
                        {showLowStockOnly ? 'Filtered' : 'Action'}
                      </span>
                    )}
                  </div>
                  <div className={`text-lg font-bold font-mono mt-1 tabular-nums ${stats.lowStockCount > 0 ? 'text-amber-300' : 'text-white'}`}>
                    {stats.lowStockCount} {stats.lowStockCount === 1 ? 'Variant' : 'Variants'}
                  </div>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/80 dark:bg-[#161925]/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-700 dark:border-[#23283B]">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-blue-400" /> Active Products
                  </div>
                  <div className="text-lg font-bold font-mono text-white mt-1 tabular-nums">
                    {stats.totalProducts}
                  </div>
                </div>

                <div className="bg-slate-800/80 dark:bg-[#161925]/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-700 dark:border-[#23283B]">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" /> Total Stock Weight
                  </div>
                  <div className="text-lg font-bold font-mono text-white mt-1 tabular-nums">
                    {stats.totalWeightKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} KG
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── DATA TABLE BLOCK ───────────────────────────────────── */}
      <div className="bg-white dark:bg-[#161925] rounded-2xl border border-slate-200 dark:border-[#23283B] shadow-2xs overflow-hidden">
        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-[#23283B] bg-slate-50/50 dark:bg-[#121520] flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full items-stretch sm:items-center">
            {/* Reusable Product & Size Filter */}
            <div className="flex-1 w-full min-w-0">
              <ProductSizeFilter
                products={filterProductItems}
                productQuery={productQuery}
                sizeQuery={sizeQuery}
                onProductChange={setProductQuery}
                onSizeChange={setSizeQuery}
                onClear={() => {
                  setProductQuery('');
                  setSizeQuery('');
                }}
                className="w-full"
              />
            </div>

            {/* Category Dropdown */}
            <div className="relative min-w-[170px] shrink-0">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#161925] border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer"
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

          {/* Quick Filter Buttons & Accordion Toggles */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowLowStockOnly(false);
                setShowInStockOnly(false);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                !showLowStockOnly && !showInStockOnly
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-[#161925] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInStockOnly((prev) => !prev);
                setShowLowStockOnly(false);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                showInStockOnly
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-white dark:bg-[#161925] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>In Stock Only</span>
            </button>
            {(!isCashier || isAccountant) && (
              <button
                type="button"
                onClick={() => {
                  setShowLowStockOnly((prev) => !prev);
                  setShowInStockOnly(false);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  showLowStockOnly
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : stats.lowStockCount > 0
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/60 hover:bg-amber-100'
                    : 'bg-white dark:bg-[#161925] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Low Stock Alerts ({stats.lowStockCount})</span>
              </button>
            )}
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
            <p className="text-xs font-medium">Calculating warehouse asset valuations & FIFO bucket data...</p>
          </div>
        ) : groupedProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Package className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No products found matching your filter</p>
            <p className="text-xs text-slate-400">Try adjusting your search query or category selection</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0F111A] text-slate-600 dark:text-slate-400 font-semibold text-xs border-b border-slate-200 dark:border-[#23283B]">
                  <th className="py-3.5 pl-4 pr-2 w-10 text-center">#</th>
                  <th className="py-3.5 px-4 sm:px-6">
                    <button
                      onClick={() => toggleSort('product_name')}
                      className="flex items-center gap-1.5 hover:text-slate-900 hover:dark:text-white cursor-pointer font-bold uppercase tracking-wider text-[11px]"
                    >
                      <span>Product Group / Variant</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>

                  <th className="py-3.5 px-4 uppercase tracking-wider text-[11px] font-bold">Category</th>

                  <th className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => toggleSort('current_stock_kg')}
                      className="flex items-center gap-1.5 ml-auto hover:text-slate-900 hover:dark:text-white cursor-pointer font-bold uppercase tracking-wider text-[11px]"
                    >
                      <span>Stock on Hand (KG)</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>

                  {isAccountant && (
                    <th className="py-3.5 px-4 text-right uppercase tracking-wider text-[11px] font-bold">
                      Min. Stock Alert
                    </th>
                  )}

                  <th className="py-3.5 px-4 text-right uppercase tracking-wider text-[11px] font-bold">
                    Avg. Cost / KG
                  </th>

                  <th className="py-3.5 px-4 sm:px-6 text-right">
                    <button
                      onClick={() => toggleSort('asset_value')}
                      className="flex items-center gap-1.5 ml-auto hover:text-slate-900 hover:dark:text-white cursor-pointer font-bold uppercase tracking-wider text-[11px]"
                    >
                      <span>Total Asset Value</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
                {groupedProducts.map((group) => {
                  const isGroupExpanded = isSearchActive
                    ? expandedGroups[group.groupKey] !== false
                    : !!expandedGroups[group.groupKey];
                  const variantCount = group.variants.length;

                  const groupCategories = Array.from(new Set(group.variants.map((v) => v.category))).filter(Boolean);
                  const categoryDisplay =
                    groupCategories.length === 1
                      ? groupCategories[0]
                      : groupCategories.length > 1
                      ? `${groupCategories[0]} (+${groupCategories.length - 1})`
                      : '-';

                  return (
                    <Fragment key={group.groupKey}>
                      {/* ─── LEVEL 1: MASTER GROUP ROW ─── */}
                      <tr
                        onClick={() => toggleGroup(group.groupKey)}
                        className={`cursor-pointer transition-colors border-t-2 border-slate-200/80 dark:border-[#23283B] ${
                          isGroupExpanded
                            ? 'bg-slate-900 dark:bg-[#0e111a] text-white hover:bg-slate-800 hover:dark:bg-[#141824]'
                            : 'bg-slate-100/90 dark:bg-[#161925] hover:bg-slate-200/80 hover:dark:bg-[#1e2335] text-slate-900 dark:text-white'
                        }`}
                      >
                        {/* Accordion Chevron */}
                        <td className="py-3.5 pl-4 pr-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroup(group.groupKey);
                            }}
                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                              isGroupExpanded
                                ? 'hover:bg-slate-700 text-slate-200'
                                : 'hover:bg-slate-300 hover:dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isGroupExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>

                        {/* Product Group Name & Variant Badge */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-bold text-sm sm:text-base tracking-tight">
                              {group.groupName}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                                isGroupExpanded
                                  ? 'bg-slate-800 text-slate-200 border border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700'
                                  : 'bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {variantCount} {variantCount === 1 ? 'Variant' : 'Variants'}
                            </span>
                            {isAccountant && group.hasLowStock && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                {group.lowStockCount} Low Stock
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Group Category */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isGroupExpanded
                                  ? 'bg-slate-800 text-slate-200 border border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700'
                                  : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:border dark:border-slate-700/60'
                            }`}
                          >
                            {categoryDisplay}
                          </span>
                        </td>

                        {/* Group Aggregated Stock on Hand (KG) */}
                        <td className="py-3.5 px-4 text-right font-mono text-xs sm:text-sm tabular-nums font-bold">
                          {group.totalGroupStock.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          KG
                        </td>

                        {/* Group Threshold (Accountant Only) */}
                        {isAccountant && (
                          <td className="py-3.5 px-4 text-right font-mono text-xs sm:text-sm tabular-nums">
                            {variantCount > 1 ? (
                              <span className="text-slate-400 dark:text-slate-500 text-xs">
                                {group.totalThreshold > 0 ? `${group.totalThreshold.toLocaleString(undefined, { minimumFractionDigits: 1 })} KG (Total)` : 'Not set'}
                              </span>
                            ) : (
                              <span className={group.variants[0]?.low_stock_threshold ? 'font-semibold' : 'text-slate-400 italic'}>
                                {group.variants[0]?.low_stock_threshold ? `${Number(group.variants[0].low_stock_threshold).toLocaleString(undefined, { minimumFractionDigits: 1 })} KG` : 'Not set'}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Master WAC Column: Display "Multiple" or single WAC */}
                        <td
                          className={`py-3.5 px-4 text-right font-mono text-xs sm:text-sm tabular-nums ${
                            isGroupExpanded ? 'text-slate-300 dark:text-slate-400' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {variantCount > 1 ? (
                            <span className="italic opacity-80">Multiple</span>
                          ) : (
                            `Rs. ${group.variants[0]?.current_wac?.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          )}
                        </td>

                        {/* Group Aggregated Total Asset Value */}
                        <td className="py-3.5 px-4 sm:px-6 text-right font-mono text-xs sm:text-sm tabular-nums">
                          <span className="font-extrabold">
                            Rs.{' '}
                            {group.totalGroupAssetValue.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                      </tr>

                      {/* ─── LEVEL 2: GROUP VARIANTS (SIZE ROWS) ─── */}
                      {isGroupExpanded &&
                        group.variants.map((product) => {
                          const stockKg =
                            product.stock_on_hand !== undefined
                              ? product.stock_on_hand
                              : product.current_stock_kg;
                          const assetVal =
                            product.total_asset_value !== undefined
                              ? product.total_asset_value
                              : product.asset_value;

                          const variantThreshold = Number(product.low_stock_threshold || 0);
                          const isVariantLow = Boolean(
                            product.is_low_stock ||
                              (variantThreshold > 0 && stockKg <= variantThreshold) ||
                              stockKg <= 0
                          );

                          return (
                            <tr
                              key={product.id}
                              className="border-b border-slate-200/60 dark:border-[#23283B] bg-slate-50/70 dark:bg-[#121520] hover:bg-slate-100/90 hover:dark:bg-[#181d2e] transition-colors"
                            >
                              {/* Indent / Bullet Indicator */}
                              <td className="py-3 pl-6 pr-2 text-center text-slate-300 dark:text-slate-600">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto" />
                              </td>

                              {/* Size / Variant Label & Health Status (Code badge removed) */}
                              <td className="py-3 px-4 sm:px-6">
                                <div className="flex items-center gap-2 pl-2 border-l-2 border-slate-300 dark:border-slate-700 flex-wrap">
                                  <span className="font-semibold text-slate-800 dark:text-white text-xs sm:text-sm">
                                    {product.size ? `Size: ${product.size}` : product.product_name}
                                  </span>
                                  {isAccountant && (
                                    stockKg <= 0 ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-300 dark:border-red-800">
                                        <AlertTriangle className="w-2.5 h-2.5" /> Out of Stock
                                      </span>
                                    ) : isVariantLow ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                                        <AlertTriangle className="w-2.5 h-2.5" /> Low Stock
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                        Healthy
                                      </span>
                                    )
                                  )}
                                </div>
                              </td>

                              {/* Category: Repeated badge removed */}
                              <td className="py-3 px-4 text-slate-400 dark:text-slate-600 text-xs">
                                —
                              </td>

                              {/* Variant Stock on Hand */}
                              <td className="py-3 px-4 text-right font-mono text-xs sm:text-sm tabular-nums font-semibold text-slate-800 dark:text-white">
                                <div>
                                  {stockKg.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  KG
                                </div>
                                {isAccountant && variantThreshold > 0 && stockKg <= variantThreshold && (
                                  <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 font-sans">
                                    Deficit: {Math.max(0, Math.round((variantThreshold - stockKg) * 10) / 10)} KG
                                  </div>
                                )}
                              </td>

                              {/* Variant Min. Stock Alert (Accountant Only) */}
                              {isAccountant && (
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span
                                      className={`font-mono text-xs sm:text-sm tabular-nums font-semibold ${
                                        variantThreshold > 0
                                          ? 'text-slate-800 dark:text-slate-200'
                                          : 'text-slate-400 dark:text-slate-500 italic'
                                      }`}
                                    >
                                      {variantThreshold > 0
                                        ? `${variantThreshold.toLocaleString(undefined, {
                                            minimumFractionDigits: 1,
                                          })} KG`
                                        : 'Not set'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingThresholdProduct(product);
                                      }}
                                      className="p-1 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                                      title="Edit Min. Stock Alert"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              )}

                              {/* Variant Avg. Cost / KG */}
                              <td className="py-3 px-4 text-right font-mono text-xs sm:text-sm tabular-nums text-slate-700 dark:text-slate-300">
                                Rs.{' '}
                                {product.current_wac.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                              {/* Variant Asset Value & Details Button */}
                              <td className="py-3 px-4 sm:px-6 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <span className="font-bold text-slate-900 dark:text-white font-mono text-xs sm:text-sm tabular-nums">
                                    Rs.{' '}
                                    {assetVal.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedFifoProduct(product)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800/60 transition-colors shadow-2xs cursor-pointer"
                                  >
                                    Details
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isCashier && (
        <UpdateStockModal
          isOpen={isUpdateStockOpen}
          onClose={() => setIsUpdateStockOpen(false)}
        />
      )}

      {!isCashier && (
        <ProductFormModal
          isOpen={isAddProductOpen}
          onClose={() => setIsAddProductOpen(false)}
          onSubmit={(data) => createProductMutation.mutate(data)}
          isSubmitting={createProductMutation.isPending}
        />
      )}

      {isAccountant && (
        <UpdateThresholdModal
          isOpen={!!editingThresholdProduct}
          onClose={() => setEditingThresholdProduct(null)}
          product={editingThresholdProduct}
        />
      )}
      {/* ─── FIFO & SALES SUMMARY DETAILS MODAL ─── */}
      {selectedFifoProduct && (() => {
        const product = selectedFifoProduct;
        const stockKg =
          product.stock_on_hand !== undefined
            ? product.stock_on_hand
            : product.current_stock_kg;
        const assetVal =
          product.total_asset_value !== undefined
            ? product.total_asset_value
            : product.asset_value;
        const buckets: FifoBucketItem[] = product.buckets || [];
        const kgAcquired =
          product.lifetime_kg_acquired > 0
            ? product.lifetime_kg_acquired
            : stockKg + (product.lifetime_kg_sold || 0);
        const kgSold = product.lifetime_kg_sold || 0;
        const turnoverPct =
          kgAcquired > 0
            ? Math.min(100, Math.max(0, Math.round((kgSold / kgAcquired) * 100)))
            : 0;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setSelectedFifoProduct(null)}
          >
            <div
              className="bg-white dark:bg-[#161925] border border-slate-200 dark:border-[#23283B] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-[#23283B] bg-slate-50/50 dark:bg-[#121520]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {product.product_name}
                    </h2>
                    {product.size && (
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                        Size: {product.size}
                      </span>
                    )}
                    {product.code && (
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700/60 font-semibold">
                        {product.code}
                      </span>
                    )}
                    {product.category && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {product.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Detailed batch tracking, FIFO lot depletion, and lifetime profitability metrics
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFifoProduct(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Quick KPI Cards & Selling Price Editor */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#121520] border border-slate-200/80 dark:border-[#23283B]">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Current Stock on Hand</div>
                      <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                        {stockKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#121520] border border-slate-200/80 dark:border-[#23283B]">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg. Cost / KG</div>
                      <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                        Rs. {product.current_wac.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#121520] border border-slate-200/80 dark:border-[#23283B]">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Asset Value</div>
                      <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                        Rs. {assetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Fast Selling Price / KG Editor Card */}
                  <SellingPriceEditorCard
                    product={product}
                    canEdit={!isCashier}
                    onPriceUpdated={(newPrice) => {
                      setSelectedFifoProduct((prev) =>
                        prev ? { ...prev, sale_price: newPrice, selling_price: newPrice } : null
                      );
                    }}
                  />
                </div>

                {/* Purchase Lots (FIFO) */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-[#23283B] pb-3">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Purchase Lots (FIFO)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                        {buckets.length} {buckets.length === 1 ? 'Lot' : 'Lots'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Real-time FIFO bucket depletion progress tracked per purchase lot
                    </span>
                  </div>

                  {buckets.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-[#121520] rounded-xl border border-slate-200 dark:border-[#23283B]">
                      No historical purchase buckets recorded for this product.
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#121520] rounded-xl border border-slate-200 dark:border-[#23283B] shadow-2xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100/80 dark:bg-[#0F111A] text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-[#23283B] text-[11px] uppercase tracking-wider">
                              <th className="py-2.5 px-4">Lot #</th>
                              <th className="py-2.5 px-4">Created Date</th>
                              <th className="py-2.5 px-4 text-right">Buy Price / KG</th>
                              <th className="py-2.5 px-4 text-right">Stock (Remaining / Original)</th>
                              <th className="py-2.5 px-4 w-48 text-center">Depletion Progress</th>
                              <th className="py-2.5 px-4 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                            {buckets.map((bucket, idx) => {
                              const originalQty = Number(bucket.original_stock ?? (bucket as any).original_qty ?? 0);
                              const remainingQty = Number(bucket.remaining_stock ?? (bucket as any).remaining_qty ?? 0);
                              const progress = originalQty > 0 ? ((originalQty - remainingQty) / originalQty) * 100 : 0;
                              const depPct = Math.min(100, Math.max(0, Math.round(progress)));
                              const isReturned = bucket.status === 'RETURNED' || originalQty === 0;
                              const isActive = remainingQty > 0 && !isReturned;

                              return (
                                <tr key={bucket.bucket_id || idx} className="hover:bg-slate-50/80 hover:dark:bg-[#1a1f33]">
                                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                    {bucket.batch_number || `LOT-${idx + 1}`}
                                  </td>
                                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-mono">
                                    {bucket.created_date}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                                    Rs. {bucket.buy_price_per_kg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {remainingQty.toLocaleString()}
                                    </span>
                                    <span className="text-slate-400 dark:text-slate-500">
                                      {' '}/ {originalQty.toLocaleString()} KG
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-slate-200 dark:bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
                                        <div
                                          className={`h-2.5 rounded-full transition-all ${
                                            isReturned ? 'bg-amber-400' : (isActive ? 'bg-emerald-500' : 'bg-slate-400')
                                          }`}
                                          style={{ width: `${depPct}%` }}
                                        />
                                      </div>
                                      <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 w-10 text-right">
                                        {depPct}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    {isReturned ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60">
                                        <RotateCcw className="w-2.5 h-2.5 text-amber-600" /> RETURNED
                                      </span>
                                    ) : isActive ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
                                        <CircleDot className="w-2.5 h-2.5 text-emerald-600" /> ACTIVE
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/60">
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
                    </div>
                  )}
                </div>

                {/* Sales & Profit Summary */}
                <div className="bg-slate-50 dark:bg-[#121520] p-4 rounded-xl border border-slate-200 dark:border-[#23283B] shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-[#23283B] pb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Sales & Profit Summary
                      </h4>
                    </div>

                    <div className="text-xs font-semibold font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-md self-start sm:self-auto">
                      All-Time Gross Margin: {(product.all_time_gross_margin || 0).toFixed(1)}%
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>
                        Total Sold:{' '}
                        <strong className="text-slate-900 dark:text-white font-mono">
                          {kgSold.toLocaleString()} KG
                        </strong>{' '}
                        /{' '}
                        <strong className="text-slate-900 dark:text-white font-mono">
                          {kgAcquired.toLocaleString()} KG
                        </strong>{' '}
                        Bought
                      </span>
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                        {turnoverPct}% Cleared
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-300/60 dark:border-slate-700/60 p-0.5">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all shadow-xs"
                        style={{ width: `${turnoverPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-[#23283B] bg-slate-50 dark:bg-[#121520] flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedFifoProduct(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
