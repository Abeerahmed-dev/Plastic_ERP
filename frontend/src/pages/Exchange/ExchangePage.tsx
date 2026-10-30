import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  RotateCcw,
  Boxes,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  X,
  Clock,
  UserCheck,
} from 'lucide-react';
import { productsService } from '../../services/products.service';
import { exchangesService } from '../../services/exchanges.service';
import { SearchableCombobox, ComboboxOption } from '../../components/SearchableCombobox';
import { Product } from '../../types/product.types';
import { toast, extractApiErrorMessage } from '../../utils/toast';

const formatNumber = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(val),
  );
};

const formatDateTime = (dateStr?: string | Date | null) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
};

const formatDate = (dateStr?: string | Date | null) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
};

export default function ExchangePage() {
  const queryClient = useQueryClient();

  // ─── Form State ───
  const [givenProductId, setGivenProductId] = useState('');
  const [givenQuantity, setGivenQuantity] = useState<string>('');
  const [receivedProductId, setReceivedProductId] = useState('');
  const [receivedQuantity, setReceivedQuantity] = useState<string>('');
  const [exchangeDate, setExchangeDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [notes, setNotes] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // ─── History Filter State ───
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // ─── Fetch Products ───
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: productsService.getProducts,
  });

  // ─── Fetch Exchanges ───
  const {
    data: exchangesData = { rows: [], total: 0 },
    isLoading: isLoadingExchanges,
  } = useQuery({
    queryKey: ['exchanges', searchTerm, filterStartDate, filterEndDate],
    queryFn: () =>
      exchangesService.getExchanges({
        search: searchTerm || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      }),
  });

  const exchanges = exchangesData.rows;

  // ─── Selected Products Map ───
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  const givenProduct = givenProductId ? productsMap.get(givenProductId) : undefined;
  const receivedProduct = receivedProductId ? productsMap.get(receivedProductId) : undefined;

  const givenStock = givenProduct ? Number(givenProduct.total_stock_kg ?? givenProduct.current_stock ?? 0) : 0;
  const receivedStock = receivedProduct
    ? Number(receivedProduct.total_stock_kg ?? receivedProduct.current_stock ?? 0)
    : 0;

  const numGivenQty = parseFloat(givenQuantity) || 0;
  const numReceivedQty = parseFloat(receivedQuantity) || 0;

  const projectedGivenStock = Math.max(0, givenStock - numGivenQty);
  const projectedReceivedStock = receivedStock + numReceivedQty;

  const isSameProduct = Boolean(givenProductId && receivedProductId && givenProductId === receivedProductId);
  const isInsufficientStock = Boolean(givenProduct && numGivenQty > givenStock);
  const isFormValid =
    Boolean(givenProductId) &&
    Boolean(receivedProductId) &&
    !isSameProduct &&
    numGivenQty > 0 &&
    numReceivedQty > 0 &&
    !isInsufficientStock;

  // ─── Combobox Options ───
  const productOptions: ComboboxOption[] = useMemo(() => {
    return products.map((p) => {
      const stock = Number(p.total_stock_kg ?? p.current_stock ?? 0);
      return {
        value: p.id,
        label: `${p.name} (${p.size || 'Standard'})`,
        subLabel: `Code: ${p.code} | Category: ${p.category_name || p.category || 'General'}`,
        badge: `Stock: ${formatNumber(stock)} KG`,
      };
    });
  }, [products]);

  // ─── Create Exchange Mutation ───
  const exchangeMutation = useMutation({
    mutationFn: exchangesService.createExchange,
    onSuccess: (result) => {
      toast.success(`Exchange ${result.exchange_number} completed successfully! Inventory updated.`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cashierStock'] });
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });

      // Reset form
      setGivenProductId('');
      setGivenQuantity('');
      setReceivedProductId('');
      setReceivedQuantity('');
      setNotes('');
      setIsConfirmModalOpen(false);
    },
    onError: (err: any) => {
      const msg = extractApiErrorMessage(err);
      toast.error(msg || 'Failed to complete product exchange. Please try again.');
    },
  });

  const handleResetForm = () => {
    setGivenProductId('');
    setGivenQuantity('');
    setReceivedProductId('');
    setReceivedQuantity('');
    setNotes('');
  };

  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      if (isSameProduct) {
        toast.error('The outgoing product and incoming product cannot be the same.');
        return;
      }
      if (isInsufficientStock) {
        toast.error(`Insufficient stock for ${givenProduct?.name}. Available: ${formatNumber(givenStock)} KG.`);
        return;
      }
      if (numGivenQty <= 0 || numReceivedQty <= 0) {
        toast.error('Please enter valid quantities greater than zero.');
        return;
      }
      toast.error('Please complete all required fields.');
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const handleExecuteExchange = () => {
    if (!isFormValid) return;
    exchangeMutation.mutate({
      given_product_id: givenProductId,
      given_quantity: numGivenQty,
      received_product_id: receivedProductId,
      received_quantity: numReceivedQty,
      exchange_date: exchangeDate,
      notes: notes.trim() || undefined,
    });
  };

  // Quick summary counts
  const totalExchangesCount = exchanges.length;
  const totalGivenKg = useMemo(
    () => exchanges.reduce((acc, e) => acc + Number(e.given_quantity || 0), 0),
    [exchanges],
  );
  const totalReceivedKg = useMemo(
    () => exchanges.reduce((acc, e) => acc + Number(e.received_quantity || 0), 0),
    [exchanges],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
              <ArrowLeftRight className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Product-to-Product Exchange
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Exchange physical stock between products with automatic inventory balance reconciliation.
              </p>
            </div>
          </div>
        </div>

        {/* Live Metrics Header Badges */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="bg-white dark:bg-[#161925] rounded-xl px-3.5 py-2 border border-slate-200/80 dark:border-[#23283B] shadow-xs flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Exchanges</p>
              <p className="text-sm font-extrabold text-slate-800 dark:text-white leading-none mt-0.5">{totalExchangesCount}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#161925] rounded-xl px-3.5 py-2 border border-slate-200/80 dark:border-[#23283B] shadow-xs flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Given Out</p>
              <p className="text-sm font-extrabold text-rose-700 dark:text-rose-400 leading-none mt-0.5">
                {formatNumber(totalGivenKg)} <span className="text-[11px] font-medium text-slate-400">KG</span>
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#161925] rounded-xl px-3.5 py-2 border border-slate-200/80 dark:border-[#23283B] shadow-xs flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Received In</p>
              <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 leading-none mt-0.5">
                {formatNumber(totalReceivedKg)} <span className="text-[11px] font-medium text-slate-400">KG</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Exchange Form Section ─── */}
      <div className="bg-white dark:bg-[#161925] rounded-2xl shadow-sm border border-slate-200 dark:border-[#23283B] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-[#23283B] bg-gradient-to-r from-slate-900 to-slate-800 dark:from-[#0e111a] dark:to-[#141824] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide uppercase">New Exchange Transaction</h2>
          </div>
          <span className="text-xs text-amber-300/90 font-medium">Atomic Real-Time Inventory Sync</span>
        </div>

        <form onSubmit={handleOpenConfirmModal} className="p-6 space-y-6">
          {/* Main 2-Panel Exchange Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
            {/* ─── Outgoing Panel (Product Given) ─── */}
            <div className="bg-rose-50/40 dark:bg-rose-950/20 rounded-2xl p-5 border border-rose-200/70 dark:border-rose-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Product Given (Outgoing)
                </span>
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Deducts Stock (-)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Outgoing Product <span className="text-rose-500">*</span>
                </label>
                <SearchableCombobox
                  value={givenProductId}
                  onChange={(val) => setGivenProductId(val)}
                  options={productOptions}
                  placeholder={isLoadingProducts ? 'Loading products...' : 'Search product by name, code or size...'}
                  hasError={isSameProduct || isInsufficientStock}
                />
                {isSameProduct && (
                  <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" /> Outgoing and incoming products cannot be the same.
                  </p>
                )}
              </div>

              {/* Live Stock Display for Outgoing Product */}
              {givenProduct ? (
                <div className="bg-white dark:bg-[#161925] rounded-xl p-3.5 border border-rose-200/80 dark:border-rose-900/40 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Current Available Stock
                    </span>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                      {formatNumber(givenStock)} <span className="text-xs font-medium text-slate-500">KG</span>
                    </p>
                  </div>
                  {numGivenQty > 0 && (
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Projected After
                      </span>
                      <p
                        className={`text-lg font-black leading-tight ${
                          isInsufficientStock ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {formatNumber(projectedGivenStock)}{' '}
                        <span className="text-xs font-medium text-slate-500">KG</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10 p-3 text-center text-xs text-rose-500 dark:text-rose-400">
                  Select a product to view real-time available stock
                </div>
              )}

              {/* Quantity Given Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Quantity Given (KG) <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="0.00"
                    value={givenQuantity}
                    onChange={(e) => setGivenQuantity(e.target.value)}
                    className={`block w-full rounded-xl border-0 py-2.5 pl-3.5 pr-14 text-slate-900 dark:text-white font-bold bg-white dark:bg-[#121520] ring-1 ring-inset ${
                      isInsufficientStock
                        ? 'ring-rose-500 focus:ring-2 focus:ring-rose-600'
                        : 'ring-slate-300 dark:ring-slate-700 focus:ring-2 focus:ring-amber-500'
                    } placeholder:text-slate-400 dark:placeholder:text-slate-500 sm:text-base transition-all`}
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      KG
                    </span>
                  </div>
                </div>

                {isInsufficientStock && (
                  <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Exceeds available stock of {formatNumber(givenStock)} KG (deficit of{' '}
                    {formatNumber(numGivenQty - givenStock)} KG).
                  </p>
                )}
              </div>
            </div>

            {/* ─── Incoming Panel (Product Received) ─── */}
            <div className="bg-emerald-50/40 dark:bg-emerald-950/20 rounded-2xl p-5 border border-emerald-200/70 dark:border-emerald-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Product Received (Incoming)
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Adds Stock (+)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Incoming Product <span className="text-emerald-500">*</span>
                </label>
                <SearchableCombobox
                  value={receivedProductId}
                  onChange={(val) => setReceivedProductId(val)}
                  options={productOptions}
                  placeholder={isLoadingProducts ? 'Loading products...' : 'Search product by name, code or size...'}
                  hasError={isSameProduct}
                />
                {isSameProduct && (
                  <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" /> Cannot exchange the same product.
                  </p>
                )}
              </div>

              {/* Live Stock Display for Incoming Product */}
              {receivedProduct ? (
                <div className="bg-white dark:bg-[#161925] rounded-xl p-3.5 border border-emerald-200/80 dark:border-emerald-900/40 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Current Available Stock
                    </span>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                      {formatNumber(receivedStock)} <span className="text-xs font-medium text-slate-500">KG</span>
                    </p>
                  </div>
                  {numReceivedQty > 0 && (
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Projected After
                      </span>
                      <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 leading-tight">
                        {formatNumber(projectedReceivedStock)}{' '}
                        <span className="text-xs font-medium text-slate-500">KG</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10 p-3 text-center text-xs text-emerald-600 dark:text-emerald-400">
                  Select a product to view real-time current stock
                </div>
              )}

              {/* Quantity Received Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Quantity Received (KG) <span className="text-emerald-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="0.00"
                    value={receivedQuantity}
                    onChange={(e) => setReceivedQuantity(e.target.value)}
                    className="block w-full rounded-xl border-0 py-2.5 pl-3.5 pr-14 text-slate-900 dark:text-white font-bold bg-white dark:bg-[#121520] ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 sm:text-base transition-all"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      KG
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Details: Date & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Exchange Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={exchangeDate}
                  onChange={(e) => setExchangeDate(e.target.value)}
                  className="block w-full rounded-xl border-0 py-2.5 px-3 text-slate-900 dark:text-white bg-white dark:bg-[#121520] font-medium ring-1 ring-inset ring-slate-300 dark:ring-slate-700 focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Notes / Reference Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Size swap for party, defective stock trade, customer walk-in conversion"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                className="block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 dark:text-white bg-white dark:bg-[#121520] font-medium ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-[#23283B]">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-800 hover:dark:text-white hover:bg-slate-100 hover:dark:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Form
            </button>

            <button
              type="submit"
              disabled={!isFormValid || exchangeMutation.isPending}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all ${
                !isFormValid || exchangeMutation.isPending
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 hover:from-amber-500 hover:to-amber-700 active:scale-98 shadow-amber-500/20'
              }`}
            >
              {exchangeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Complete Exchange</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ─── Confirmation Modal ─── */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Confirm Product Exchange</h3>
                  <p className="text-xs text-amber-400 leading-tight">Please review the transaction summary</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Product Outgoing Summary */}
              <div className="rounded-2xl bg-rose-50/70 border border-rose-200/80 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-rose-800 tracking-wider flex items-center gap-1.5">
                    <TrendingDown className="h-4 w-4" /> Product Given Out
                  </span>
                  <span className="text-xs font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                    - {formatNumber(numGivenQty)} KG
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{givenProduct?.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  <span>Code: {givenProduct?.code}</span>
                  <span>Size: {givenProduct?.size || 'Standard'}</span>
                </div>
                <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Stock Before: {formatNumber(givenStock)} KG</span>
                  <ArrowRight className="h-3.5 w-3.5 text-rose-400" />
                  <span className="font-bold text-slate-900">
                    Stock After: {formatNumber(projectedGivenStock)} KG
                  </span>
                </div>
              </div>

              {/* Product Incoming Summary */}
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" /> Product Received In
                  </span>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    + {formatNumber(numReceivedQty)} KG
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{receivedProduct?.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  <span>Code: {receivedProduct?.code}</span>
                  <span>Size: {receivedProduct?.size || 'Standard'}</span>
                </div>
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Stock Before: {formatNumber(receivedStock)} KG</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-bold text-slate-900">
                    Stock After: {formatNumber(projectedReceivedStock)} KG
                  </span>
                </div>
              </div>

              {/* Meta details */}
              <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 text-slate-600 border border-slate-200/70">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Exchange Date:</span>
                  <span className="font-bold text-slate-900">{formatDate(exchangeDate)}</span>
                </div>
                {notes && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Remarks:</span>
                    <span className="font-medium text-slate-800 italic">{notes}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-200/60 text-amber-700 font-semibold">
                  <span>Inventory Updates:</span>
                  <span>Atomic Commit (Rolled back on failure)</span>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  disabled={exchangeMutation.isPending}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel / Edit
                </button>
                <button
                  type="button"
                  onClick={handleExecuteExchange}
                  disabled={exchangeMutation.isPending}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 hover:from-amber-500 hover:to-amber-700 shadow-md shadow-amber-500/20 active:scale-98 flex items-center gap-2"
                >
                  {exchangeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Transaction...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Confirm & Complete Exchange</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Exchange History Section ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-4">
        {/* Header + Filter Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-200/80 dark:border-[#23283B] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-amber-500" />
                Exchange Transaction History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Shared historical audit trail of all completed inventory product swaps.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-2 relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reference #, product name, code or notes..."
                className="block w-full rounded-xl border-0 py-2 pl-9 pr-3 text-slate-900 dark:text-white bg-white dark:bg-[#121520] font-medium ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm"
              />
            </div>

            {/* Start Date */}
            <div>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                title="Filter by Start Date"
                className="block w-full rounded-xl border-0 py-2 px-3 text-slate-900 dark:text-white bg-white dark:bg-[#121520] font-medium ring-1 ring-inset ring-slate-300 dark:ring-slate-700 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm"
              />
            </div>

            {/* End Date */}
            <div>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                title="Filter by End Date"
                className="block w-full rounded-xl border-0 py-2 px-3 text-slate-900 dark:text-white bg-white dark:bg-[#121520] font-medium ring-1 ring-inset ring-slate-300 dark:ring-slate-700 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          {isLoadingExchanges ? (
            <div className="flex h-36 items-center justify-center text-slate-500 gap-2 text-sm font-semibold">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              Loading exchange history...
            </div>
          ) : exchanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <ArrowLeftRight className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No exchange records found</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {searchTerm || filterStartDate || filterEndDate
                  ? 'No records match the applied search filters.'
                  : 'Completed product-to-product exchanges will appear here.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 dark:bg-[#0F111A] text-slate-700 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-[#23283B]">
                <tr>
                  <th className="px-5 py-3.5">Reference #</th>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Product Given (Out)</th>
                  <th className="px-5 py-3.5">Product Received (In)</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5">Processed By</th>
                  <th className="px-5 py-3.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#161925]">
                {exchanges.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/80 hover:dark:bg-[#1a1f33] transition-colors">
                    {/* Reference */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-extrabold text-slate-900 dark:text-white font-mono tracking-tight bg-slate-100 dark:bg-slate-800 dark:border dark:border-slate-700/60 px-2 py-0.5 rounded text-xs">
                        {ex.exchange_number}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatDateTime(ex.exchange_date || ex.created_at)}</span>
                      </div>
                    </td>

                    {/* Given Product */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">
                          {ex.given_product_name || 'Product'}
                        </span>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{ex.given_product_code}</span>
                          <span>•</span>
                          <span>{ex.given_product_size || 'Standard'}</span>
                        </div>
                        <span className="inline-block mt-0.5 font-black text-rose-600 text-xs">
                          - {formatNumber(ex.given_quantity)} KG
                        </span>
                      </div>
                    </td>

                    {/* Received Product */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">
                          {ex.received_product_name || 'Product'}
                        </span>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{ex.received_product_code}</span>
                          <span>•</span>
                          <span>{ex.received_product_size || 'Standard'}</span>
                        </div>
                        <span className="inline-block mt-0.5 font-black text-emerald-600 text-xs">
                          + {formatNumber(ex.received_quantity)} KG
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        {ex.status || 'COMPLETED'}
                      </span>
                    </td>

                    {/* Processed By */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-700 font-medium text-xs">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                        <span>{ex.created_by_name || 'System User'}</span>
                      </div>
                    </td>

                    {/* Notes */}
                    <td className="px-5 py-3.5 text-slate-500 text-xs max-w-xs truncate">
                      {ex.notes || <span className="text-slate-300 italic">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
