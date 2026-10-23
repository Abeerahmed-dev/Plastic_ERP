import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ShoppingCart, Trash2, AlertCircle, UserCheck, Lock, UserPlus, RotateCcw, Printer, FileText, Copy } from 'lucide-react';
import { productsService } from '../../services/products.service';
import { posService } from '../../services/pos.service';
import { reportsService } from '../../services/reports.service';
import { getCustomers } from '../../services/customers.service';
import { useAuthStore } from '../../store/auth.store';
import { useReportStore } from '../../store/useReportStore';
import { printThermalReceipt } from '../../utils/printThermal';
import { AddCustomerModal } from './AddCustomerModal';
import { ShiftAuditModal } from './ShiftAuditModal';

interface CartItem {
  product_id: string;
  productName: string;
  name_urdu?: string | null;
  category?: string;
  quantity: number;
  selected_unit: string;
  unit_price: number;
  fixed_retail_price_per_kg: number;
  current_stock: number;
  bag_weight_kg: number;
  rolling_avg_cost_per_kg: number;
}

export default function POSPage() {
  const { user } = useAuthStore();
  const isCashier = (user?.role || '').toUpperCase() === 'CASHIER';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isShiftAuditOpen, setIsShiftAuditOpen] = useState(false);
  const [slipMode, setSlipMode] = useState<'SINGLE' | 'DUPLICATE'>('SINGLE');

  const [lastInvoice, setLastInvoice] = useState<any>(null);

  const queryClient = useQueryClient();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query Available Products
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ['posProducts', debouncedSearch],
    queryFn: () => productsService.getPOSAvailableProducts(debouncedSearch),
  });
  const products = searchResults || [];

  // Query Customers for Searchable Dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customersSelect'],
    queryFn: () => getCustomers({ limit: 100 }),
  });
  const customers = customersData?.data || [];

  // Query Active Bank Accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => import('../../services/bank-accounts.service').then(m => m.bankAccountsService.getBankAccounts()),
  });

  // Query Walk-in POS Metrics Summary
  const { data: metrics } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: () => reportsService.getDashboardMetrics(),
  });

  const addToCart = (product: any) => {
    const stockKg = Number(product.total_stock_kg ?? product.current_stock ?? 0);
    if (stockKg <= 0) return;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === product.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        if (existing.quantity >= stockKg) return prev;
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      const bagWeight = Number(product.bag_weight_kg || 25.0);
      const fixedRetailKg = Number(product.fixed_retail_price_per_kg || product.sale_price || 0);
      const initialUnitPrice = isCashier ? fixedRetailKg : Number(product.sale_price || 0);

      const productName = product.size ? `${product.name} - ${product.size}` : product.name;

      return [
        ...prev,
        {
          product_id: product.id,
          productName,
          name_urdu: product.name_urdu || null,
          category: product.category || product.category_name || '',
          quantity: 1,
          selected_unit: 'KG',
          unit_price: initialUnitPrice,
          fixed_retail_price_per_kg: fixedRetailKg,
          current_stock: Number(product.current_stock || 0),
          bag_weight_kg: bagWeight,
          rolling_avg_cost_per_kg: Number(product.rolling_avg_cost_per_kg || product.cost_price || 0),
        },
      ];
    });
  };

  const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const updated = { ...item, ...updates };

        // If unit changes, re-calculate fixed price for Cashier
        if (updates.selected_unit && isCashier) {
          const unitMultiplier =
            updates.selected_unit.toLowerCase() === 'bag' || updates.selected_unit.toLowerCase() === 'bora'
              ? item.bag_weight_kg
              : 1.0;
          updated.unit_price = item.fixed_retail_price_per_kg * unitMultiplier;
        }

        return updated;
      }),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== id));
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerBalance = Number(selectedCustomer?.outstanding_balance || 0);
  const hasCreditBalance = customerBalance < 0;
  const availableCredit = hasCreditBalance ? Math.abs(customerBalance) : 0;

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const effectiveDiscount = isCashier ? 0 : discount;
  const netBeforeCredit = Math.max(0, subtotal - effectiveDiscount);
  const appliedCredit = hasCreditBalance ? Math.min(netBeforeCredit, availableCredit) : 0;
  const total = Math.max(0, netBeforeCredit - appliedCredit);
  const effectiveAmountPaid = amountPaid === '' ? total : Number(amountPaid);

  const hasPriceFloorViolation = !isCashier && cart.some((item) => {
    const unitMultiplier = (item.selected_unit.toLowerCase() === 'bag' || item.selected_unit.toLowerCase() === 'bora')
      ? item.bag_weight_kg
      : 1.0;
    const floorPricePerKg = item.rolling_avg_cost_per_kg * 1.05;
    const sellingPricePerKg = unitMultiplier > 0 ? (item.unit_price / unitMultiplier) : item.unit_price;
    return sellingPricePerKg < floorPricePerKg - 0.01;
  });

  const isCartValid =
    cart.length > 0 &&
    cart.every((item) => item.quantity > 0) &&
    !hasPriceFloorViolation;

  const checkoutMutation = useMutation({
    mutationFn: () =>
      posService.checkout({
        customer_id: selectedCustomerId || undefined,
        items: cart.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          selected_unit: i.selected_unit,
          unit_price: i.unit_price,
        })),
        discount: effectiveDiscount,
        amount_paid: effectiveAmountPaid,
        payment_method: paymentMethod,
        bank_account_id: paymentMethod === 'BANK' ? (selectedBankAccountId || undefined) : undefined,
      }),
    onSuccess: (invoice: any) => {
      const selectedCustomerName = customers.find(c => c.id === selectedCustomerId)?.name || 'Walk-In Customer';
      const selectedBank = bankAccounts.find((b: any) => b.id === selectedBankAccountId);
      const activeMethod = paymentMethod;
      const tendered = activeMethod === 'CASH' ? (invoice.cash_tendered ?? effectiveAmountPaid) : 0;
      const returned = activeMethod === 'CASH' ? (invoice.change_returned ?? Math.max(0, effectiveAmountPaid - total)) : 0;
      const balanceDue = Math.max(0, total - effectiveAmountPaid);

      const isDuplicateMode = slipMode === 'DUPLICATE';
      const receiptData = {
        invoice: {
          ...invoice,
          payment_method: activeMethod,
          bank_name: selectedBank ? selectedBank.bank_name : undefined,
          paid_amount: effectiveAmountPaid,
          cash_tendered: tendered,
          change_returned: returned,
          balance_due: balanceDue,
        },
        items: [...cart],
        cashierName: user?.name || 'Cashier',
        customerName: selectedCustomerName,
        isDuplicate: false,
        printBoth: isDuplicateMode, // When DUPLICATE is selected: prints 2 slips (Original + Duplicate). When SINGLE: prints only Original.
      };
      setLastInvoice(receiptData);
      setCart([]);
      setDiscount(0);
      setAmountPaid('');
      setSelectedCustomerId('');
      setSelectedBankAccountId('');
      printThermalReceipt(receiptData);

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['posProducts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['todayCashTally'] });
      queryClient.invalidateQueries({ queryKey: ['shiftAudit'] });
      queryClient.invalidateQueries({ queryKey: ['pnlReport'] });
      queryClient.invalidateQueries({ queryKey: ['cashLedger'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-drawer-balance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      useReportStore.getState().fetchLiquidityLedger();
      useReportStore.getState().fetchAllReports();
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || err.message || 'Checkout failed');
    },
  });

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 print:hidden">
        {/* LEFT: Product Search & Customer Selection */}
        <div className="flex-1 flex flex-col p-3.5 sm:p-4 border-r border-slate-200 overflow-hidden">
          {/* Reprint Slip Bar (if last invoice exists) */}
          {lastInvoice && (
            <div className="flex items-center justify-end gap-1.5 mb-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (lastInvoice) printThermalReceipt({ ...lastInvoice, isDuplicate: false, printBoth: false });
                }}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1 rounded-lg text-[11px] font-bold transition-all shadow-2xs"
                title="Reprint Single Original Slip"
              >
                <Printer className="w-3 h-3 text-blue-600" />
                <span>Reprint Original (1 Slip)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (lastInvoice) printThermalReceipt({ ...lastInvoice, isDuplicate: false, printBoth: true });
                }}
                className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-lg text-[11px] font-bold transition-all shadow-2xs"
                title="Reprint Both Slips: Original + Duplicate"
              >
                <Copy className="w-3 h-3 text-amber-600" />
                <span>Reprint Both (2 Slips)</span>
              </button>
            </div>
          )}

          {/* TOP: Direct Side-by-Side Customer Selection (Left) & Product Search (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-2.5 shrink-0">
            {/* Customer Selection Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-none truncate"
                  title="Select Customer for Habit Tracking"
                >
                  <option value="">Walk-In Customer (Default)</option>
                  <optgroup label="Cash Customers">
                    {customers.filter((c) => c.customer_type === 'CASH').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code || c.phone || 'Cash Customer'})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Credit Accounts (Udhaar)">
                    {customers.filter((c) => c.customer_type === 'CREDIT').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code || c.phone || 'Credit Account'})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(true)}
                className="px-2.5 py-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg transition-all shrink-0 flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                title="Register New Customer"
              >
                <UserPlus className="w-3.5 h-3.5 text-slate-950" />
                <span>+ New</span>
              </button>
            </div>

            {/* Product Search Input */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search products by name or category..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* MIDDLE: Product List Grid (5 Columns Across in Compact Square Boxes) */}
          <div className="flex-1 overflow-y-auto pr-1 mb-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5 p-1">
              {products.map((p) => {
                const displayPrice = isCashier
                  ? (p.fixed_retail_price_per_kg || p.sale_price)
                  : p.sale_price;
                const stockKg = Number(p.total_stock_kg ?? p.current_stock ?? 0);
                const isOutOfStock = stockKg <= 0;

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={isOutOfStock}
                    className={`border rounded-xl p-2.5 flex flex-col justify-between text-left transition-all duration-150 group relative min-h-[105px] max-h-[120px] overflow-hidden ${
                      isOutOfStock
                        ? 'border-red-300 bg-red-50/80 shadow-[0_4px_14px_rgba(239,68,68,0.18)] cursor-not-allowed opacity-90'
                        : 'bg-white border-slate-300/80 shadow-[0_6px_16px_rgba(15,23,42,0.22),0_2px_6px_rgba(15,23,42,0.12)] hover:border-blue-500 hover:shadow-[0_10px_24px_rgba(15,23,42,0.30),0_4px_10px_rgba(37,99,235,0.20)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]'
                    }`}
                    title={
                      isOutOfStock
                        ? `${p.name} - Out of Stock (0 KG Available)`
                        : `${p.name} - Rs. ${displayPrice} / KG (${stockKg} KG Available)`
                    }
                  >
                    {/* Top: Category & Stock Badge */}
                    <div className="flex items-center justify-between gap-1 w-full mb-0.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate max-w-[50%] ${
                          isOutOfStock ? 'text-red-700 bg-red-100/80' : 'text-slate-500 bg-slate-100'
                        }`}
                      >
                        {p.category || p.category_name || 'Item'}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 bg-red-600 text-white shadow-2xs uppercase tracking-tight">
                          Out of Stock
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            stockKg > 10
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-amber-700 bg-amber-50'
                          }`}
                        >
                          {stockKg} KG
                        </span>
                      )}
                    </div>

                    {/* Middle: Product Title */}
                    <div className="my-auto py-0.5">
                      <p
                        className={`font-bold text-xs line-clamp-2 leading-snug transition-colors ${
                          isOutOfStock ? 'text-red-950/80' : 'text-slate-800 group-hover:text-blue-600'
                        }`}
                      >
                        {p.size ? `${p.name} - ${p.size}` : p.name}
                      </p>
                      {p.name_urdu && (
                        <p
                          className={`text-[10px] font-medium truncate mt-0.5 ${
                            isOutOfStock ? 'text-red-400' : 'text-slate-400'
                          }`}
                          dir="rtl"
                        >
                          {p.name_urdu}
                        </p>
                      )}
                    </div>

                    {/* Bottom: Price & Quick Add / Out of Stock Indicator */}
                    <div
                      className={`flex items-end justify-between pt-1 border-t mt-0.5 w-full ${
                        isOutOfStock ? 'border-red-200' : 'border-slate-100'
                      }`}
                    >
                      <div>
                        <span
                          className={`text-[8px] font-semibold uppercase block leading-none ${
                            isOutOfStock ? 'text-red-400' : 'text-slate-400'
                          }`}
                        >
                          Rate
                        </span>
                        <span
                          className={`font-black text-xs leading-tight ${
                            isOutOfStock ? 'text-red-700' : 'text-blue-600'
                          }`}
                        >
                          Rs. {displayPrice}
                          <span
                            className={`text-[9px] font-medium ml-0.5 ${
                              isOutOfStock ? 'text-red-400' : 'text-slate-500'
                            }`}
                          >
                            /KG
                          </span>
                        </span>
                      </div>
                      {isOutOfStock ? (
                        <div className="px-1.5 py-0.5 rounded bg-red-100 border border-red-200 text-red-700 text-[9px] font-extrabold uppercase shadow-2xs">
                          0 KG
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-[11px] font-black transition-colors shadow-2xs">
                          +
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {products.length === 0 && !isSearchLoading && (
              <div className="py-8 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-dashed border-slate-200 mt-2">
                No products found matching "{searchTerm}"
              </div>
            )}
            {isSearchLoading && (
              <div className="py-8 text-center text-slate-400 text-xs font-medium mt-2">Loading inventory...</div>
            )}
          </div>

          {/* BOTTOM: Summary Metric Cards (Compact) */}
          <div className="pt-2 border-t border-slate-200 shrink-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-white p-2 rounded-lg shadow-2xs border border-slate-200">
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">Today's Sales</p>
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  Rs. {Number(metrics?.todaySales || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-2xs border border-slate-200">
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">Today's Transactions</p>
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {Number(metrics?.todayTransactions || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-2xs border border-slate-200">
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">This Week's Sales</p>
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  Rs. {Number(metrics?.weeklySales || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-2xs border border-slate-200">
                <p className="text-[10px] font-medium text-slate-500 mb-0.5">This Month's Sales</p>
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  Rs. {Number(metrics?.monthlySales || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* RIGHT: Cart & Locked Payment Panel (Compact Width w-[350px]) */}
      <div className="w-[340px] xl:w-[350px] flex flex-col bg-white shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 shrink-0">
        <div className="p-3 border-b border-slate-100 bg-blue-50/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 leading-tight">Current Sale Cart</h2>
              <span className="text-[11px] text-slate-500 font-medium">
                {selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : 'Walk-In Customer'}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
            {cart.length} Items
          </span>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 flex flex-col divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 my-auto py-8">
              <ShoppingCart className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600 text-xs">Cart is empty</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Select products from the left to start billing.</p>
            </div>
          ) : (
            cart.map((item) => {
              const unitMultiplier = (item.selected_unit.toLowerCase() === 'bag' || item.selected_unit.toLowerCase() === 'bora')
                ? item.bag_weight_kg
                : 1.0;

              const floorPricePerKg = item.rolling_avg_cost_per_kg * 1.05;
              const floorPricePerUnit = floorPricePerKg * unitMultiplier;
              const sellingPricePerKg = unitMultiplier > 0 ? (item.unit_price / unitMultiplier) : item.unit_price;
              const isBelowFloor = !isCashier && sellingPricePerKg < floorPricePerKg - 0.01;

              return (
                <div
                  key={item.product_id}
                  className={`py-2 px-0.5 transition-all ${
                    isBelowFloor ? 'bg-red-50/70 -mx-1 px-1.5 rounded' : ''
                  }`}
                >
                  {/* Top: Product Name & Delete Button */}
                  <div className="flex justify-between items-center gap-1">
                    <span className="font-bold text-slate-800 text-xs truncate" title={item.productName}>
                      {item.productName}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-slate-400 hover:text-red-600 p-0.5 transition-colors shrink-0"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isBelowFloor && (
                    <div className="flex items-center gap-1 text-[10px] text-red-700 bg-red-100/80 p-1 rounded border border-red-300 font-medium my-1">
                      <AlertCircle className="w-3 h-3 shrink-0 text-red-600" />
                      Below floor (Rs. {floorPricePerUnit.toFixed(1)} / {item.selected_unit})
                    </div>
                  )}

                  {/* Bottom: Unit, Quantity & Line Total Price (No editable price input) */}
                  <div className="flex justify-between items-center gap-2 mt-1">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={item.selected_unit}
                        onChange={(e) => updateCartItem(item.product_id, { selected_unit: e.target.value })}
                        className="text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 font-semibold text-slate-700 focus:outline-none shadow-2xs"
                      >
                        <option value="KG">KG</option>
                        <option value="Bag">Bag ({item.bag_weight_kg}k)</option>
                      </select>

                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateCartItem(item.product_id, {
                            quantity: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-12 text-center text-xs font-bold border border-slate-300 rounded py-0.5 px-1 bg-white focus:outline-none shadow-2xs"
                      />

                      <span className="text-[11px] text-slate-500 font-semibold font-mono">
                        @ Rs. {item.unit_price}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-900 block font-mono">
                        Rs. {(item.quantity * item.unit_price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Payment Form */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs text-slate-600 font-medium">
            <span>Subtotal</span>
            <span className="font-bold text-slate-800">Rs. {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1">
              Discount {isCashier && <Lock className="w-3 h-3 text-slate-400" />}
            </span>
            <input
              type="number"
              min={0}
              disabled={isCashier}
              readOnly={isCashier}
              value={isCashier ? 0 : (discount || '')}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className={`w-20 text-right text-xs font-bold rounded py-0.5 px-2 ${
                isCashier ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' : 'bg-white border border-slate-300'
              }`}
              placeholder="0"
            />
          </div>

          {hasCreditBalance && availableCredit > 0 && (
            <div className="flex justify-between items-center text-xs font-bold bg-emerald-100/90 text-emerald-950 p-2 rounded-lg border border-emerald-300 shadow-2xs">
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-emerald-700" />
                Credit Applied:
              </span>
              <span className="font-mono text-emerald-800 text-xs font-black">
                - Rs. {appliedCredit.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
            <span className="text-xs text-slate-800 font-bold">
              {appliedCredit > 0 ? 'Net Payable' : 'Grand Total'}
            </span>
            <span className="text-base text-blue-600 font-black font-mono">Rs. {total.toLocaleString()}</span>
          </div>

          {/* Amount Paid Input */}
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <span>Amount Paid</span>
                {amountPaid === '' && total > 0 && (
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1 rounded border border-emerald-200">
                    Auto: Full Cash (Rs. {total.toLocaleString()})
                  </span>
                )}
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmountPaid(0)}
                  className="text-[9px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 transition"
                >
                  Rs. 0 (Credit)
                </button>
                <button
                  type="button"
                  onClick={() => setAmountPaid(total)}
                  className="text-[9px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition"
                >
                  Full (Rs. {total.toLocaleString()})
                </button>
              </div>
            </div>
            <input
              type="number"
              min={0}
              value={amountPaid === '' ? '' : amountPaid}
              onChange={(e) => setAmountPaid(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder={total > 0 ? `Full: Rs. ${total.toLocaleString()}` : '0 (Enter Amount)'}
              className="w-full text-right font-black text-sm rounded-lg py-1 px-2.5 border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 font-mono"
            />
            {amountPaid !== '' && Number(amountPaid) > total && (
              <div className="mt-1 flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded text-[11px] font-bold">
                <span>Change Return:</span>
                <span className="font-mono text-xs text-emerald-700">
                  Rs. {(Number(amountPaid) - total).toLocaleString()}
                </span>
              </div>
            )}
            {amountPaid !== '' && Number(amountPaid) < total && (
              <div className="mt-1 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded text-[11px] font-bold">
                <span>Remaining Due:</span>
                <span className="font-mono text-xs text-amber-700">
                  Rs. {(total - Number(amountPaid)).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method Dropdown (Cash in Drawer or Bank Transfer) */}
          <div>
            <select
              value={paymentMethod}
              onChange={(e) => {
                const val = e.target.value;
                setPaymentMethod(val);
                if (val === 'BANK' && !selectedBankAccountId && bankAccounts.length > 0) {
                  setSelectedBankAccountId(bankAccounts[0].id);
                }
              }}
              className="w-full text-xs font-bold rounded-lg py-1.5 px-2 border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="CASH">💵 Cash in Drawer (CASH)</option>
              <option value="BANK">🏦 Bank Transfer</option>
            </select>
          </div>

          {paymentMethod === 'BANK' && (
            <div>
              <select
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="w-full text-xs font-bold rounded-lg py-1.5 px-2 border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 cursor-pointer"
                required
              >
                <option value="">-- Select Bank Account --</option>
                {bankAccounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} — {acc.account_title || acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Slip Type Options */}
          <div className="p-1.5 bg-slate-100/80 border border-slate-200 rounded-lg">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setSlipMode('SINGLE')}
                className={`py-1 px-2 rounded text-[11px] font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                  slipMode === 'SINGLE'
                    ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold border-amber-500 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Single (1 Slip)</span>
              </button>
              <button
                type="button"
                onClick={() => setSlipMode('DUPLICATE')}
                className={`py-1 px-2 rounded text-[11px] font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                  slipMode === 'DUPLICATE'
                    ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold border-amber-500 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Copy className="w-3 h-3" />
                <span>Duplicate (2 Slips)</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              if (paymentMethod === 'BANK' && !selectedBankAccountId) {
                alert('Please select a Bank Account for Bank Transfer payment');
                return;
              }
              checkoutMutation.mutate();
            }}
            disabled={!isCartValid || checkoutMutation.isPending}
            className="w-full mt-1 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg text-sm transition-all shadow-md shadow-amber-500/20 active:scale-[0.98] flex justify-center items-center gap-2 cursor-pointer"
          >
            {checkoutMutation.isPending ? 'Processing POS Sale...' : 'Complete POS Sale'}
          </button>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerCreated={(newCustomer) => {
          queryClient.invalidateQueries({ queryKey: ['customersSelect'] });
          setSelectedCustomerId(newCustomer.id);
        }}
      />

      {/* Shift Audit Reconciliation Modal */}
      <ShiftAuditModal
        isOpen={isShiftAuditOpen}
        onClose={() => setIsShiftAuditOpen(false)}
      />

      </div>
    </>
  );
}
