import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ShoppingCart, Trash2, AlertCircle, DollarSign, UserCheck, Lock, UserPlus, RotateCcw, TrendingUp } from 'lucide-react';
import { productsService } from '../../services/products.service';
import { posService } from '../../services/pos.service';
import { reportsService } from '../../services/reports.service';
import { getCustomers } from '../../services/customers.service';
import { useAuthStore } from '../../store/auth.store';
import { ReceiptPrinter } from './ReceiptPrinter';
import { AddCustomerModal } from './AddCustomerModal';
import { ShiftAuditModal } from './ShiftAuditModal';
import { toast, handleApiError } from '../../utils/toast';

interface CartItem {
  product_id: string;
  productName: string;
  quantity: number | string;
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
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [discountValue, setDiscountValue] = useState<string>('0');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const paymentMethod = 'CASH'; // Hardcoded retail cash-and-carry

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isShiftAuditOpen, setIsShiftAuditOpen] = useState(false);

  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [shouldPrint, setShouldPrint] = useState(false);

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
  const posCustomers = customers.filter(
    (c: any) =>
      c.type === 'Cash Customer' ||
      c.customer_type === 'CASH' ||
      c.customer_type === 'Cash Customer' ||
      c.is_walk_in === true,
  );

  // Query Today's Cash Tally for Cashier Shift Metric
  const { data: todayCashTallyData } = useQuery({
    queryKey: ['todayCashTally'],
    queryFn: () => posService.getTodayCashTally(),
  });

  // Query Walk-in POS Metrics Summary
  const { data: metrics } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: () => reportsService.getDashboardMetrics(),
  });

  const addToCart = (product: any) => {
    const available_stock = Number(product.total_stock_kg ?? product.current_stock ?? 0);
    if (available_stock <= 0) {
      toast.warning(`Only ${available_stock} KG available.`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === product.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const unitMultiplier = (existing.selected_unit.toLowerCase() === 'bag' || existing.selected_unit.toLowerCase() === 'bora')
          ? existing.bag_weight_kg
          : 1.0;
        const currentQty = parseFloat(String(existing.quantity)) || 0;
        const requestedKg = (currentQty + 1) * unitMultiplier;

        if (requestedKg > available_stock) {
          toast.warning(`Only ${available_stock} KG available.`);
          return prev;
        }

        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: currentQty + 1 } : item,
        );
      }

      const bagWeight = Number(product.bag_weight_kg || 25.0);
      const retailNum = Number(product.fixed_retail_price_per_kg || 0);
      const saleNum = Number(product.sale_price || 0);
      const fixedRetailKg = retailNum > 0 ? retailNum : (saleNum > 0 ? saleNum : 0);
      const initialUnitPrice = fixedRetailKg;

      const productName = product.size ? `${product.name} - ${product.size}` : product.name;

      if (1 > available_stock) {
        toast.warning(`Only ${available_stock} KG available.`);
        return [
          ...prev,
          {
            product_id: product.id,
            productName,
            quantity: available_stock,
            selected_unit: 'KG',
            unit_price: initialUnitPrice,
            fixed_retail_price_per_kg: fixedRetailKg,
            current_stock: available_stock,
            bag_weight_kg: bagWeight,
            rolling_avg_cost_per_kg: Number(product.rolling_avg_cost_per_kg || product.cost_price || 0),
          },
        ];
      }

      return [
        ...prev,
        {
          product_id: product.id,
          productName,
          quantity: 1,
          selected_unit: 'KG',
          unit_price: initialUnitPrice,
          fixed_retail_price_per_kg: fixedRetailKg,
          current_stock: available_stock,
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

        // If unit changes, re-calculate fixed price
        if (updates.selected_unit) {
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

  // Safe quantity parsing for subtotal
  const subtotal = cart.reduce((acc, item) => {
    const safeQty = parseFloat(String(item.quantity)) || 0;
    return acc + safeQty * item.unit_price;
  }, 0);

  // Dual-mode discount engine (Percentage % vs Fixed Rs.)
  let calculatedDiscount = 0;
  if (discountType === 'PERCENTAGE') {
    calculatedDiscount = subtotal * ((parseFloat(discountValue) || 0) / 100);
  } else {
    calculatedDiscount = parseFloat(discountValue) || 0;
  }
  calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;

  const effectiveDiscount = isCashier ? 0 : calculatedDiscount;
  const grandTotal = Math.max(0, subtotal - effectiveDiscount);
  const netBeforeCredit = grandTotal;
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
    cart.every((item) => (parseFloat(String(item.quantity)) || 0) > 0) &&
    !hasPriceFloorViolation;

  const checkoutMutation = useMutation({
    mutationFn: () =>
      posService.checkout({
        customer_id: selectedCustomerId || undefined,
        items: cart.map((i) => ({
          product_id: i.product_id,
          quantity: parseFloat(String(i.quantity)) || 0,
          selected_unit: i.selected_unit,
          unit_price: i.unit_price,
        })),
        discount: effectiveDiscount,
        amount_paid: effectiveAmountPaid,
        payment_method: paymentMethod,
        bank_account_id: undefined,
      }),
    onSuccess: (invoice) => {
      const selectedCustomerName = customers.find(c => c.id === selectedCustomerId)?.name || 'Walk-In Customer';
      setLastInvoice({
        invoice,
        items: cart.map(i => ({ ...i, quantity: parseFloat(String(i.quantity)) || 0 })),
        cashierName: user?.name || 'Cashier',
        customerName: selectedCustomerName
      });
      setCart([]);
      setDiscountValue('0');
      setDiscountType('FIXED');
      setAmountPaid('');
      setSelectedCustomerId('');
      setShouldPrint(true);

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['posProducts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['todayCashTally'] });
      queryClient.invalidateQueries({ queryKey: ['shiftAudit'] });
      queryClient.invalidateQueries({ queryKey: ['pnlReport'] });
      queryClient.invalidateQueries({ queryKey: ['cashLedger'] });
      queryClient.invalidateQueries({ queryKey: ['liquidityLedger'] });
    },
    onError: (err: any) => {
      handleApiError(err);
    },
  });

  useEffect(() => {
    if (shouldPrint && lastInvoice) {
      setTimeout(() => {
        window.print();
        setShouldPrint(false);
      }, 500);
    }
  }, [shouldPrint, lastInvoice]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 print:hidden">
      {/* LEFT: Product Search & Customer Selection */}
      <div className="flex-1 flex flex-col p-6 border-r border-slate-200 overflow-y-auto">
        {/* Walk-in POS Summary Cards */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Walk-in POS Summary
            </h2>
            {isCashier && (
              <div
                onClick={() => setIsShiftAuditOpen(true)}
                className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl shadow-2xs cursor-pointer hover:ring-2 hover:ring-emerald-400 hover:shadow-sm transition-all select-none group"
                title="Click to open Shift Reconciliation Audit"
              >
                <div className="p-1 bg-emerald-600 group-hover:bg-emerald-700 text-white rounded-md transition-colors">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block leading-none">
                    Today's Cash Tally 🔍
                  </span>
                  <span className="text-sm font-black text-emerald-700 leading-none mt-0.5 block">
                    Rs. {todayCashTallyData?.today_cash_tally?.toLocaleString() ?? '0'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl shadow-xs border border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-0.5">Today's Sales</p>
              <p className="text-lg font-bold text-slate-900">
                Rs. {Number(metrics?.todaySales || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl shadow-xs border border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-0.5">Today's Transactions</p>
              <p className="text-lg font-bold text-slate-900">
                {Number(metrics?.todayTransactions || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl shadow-xs border border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-0.5">This Week's Sales</p>
              <p className="text-lg font-bold text-slate-900">
                Rs. {Number(metrics?.weeklySales || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl shadow-xs border border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-0.5">This Month's Sales</p>
              <p className="text-lg font-bold text-slate-900">
                Rs. {Number(metrics?.monthlySales || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Customer Selection Dropdown & Add Customer Trigger */}
        <div className="mb-5 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Select Customer (For Buying Habit Tracking)
            </label>
            <span className="text-[11px] text-slate-400 font-medium">Quick Register</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 py-2.5 px-3.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Walk-In Customer (Default)</option>
              {posCustomers.length > 0 && (
                <optgroup label="Cash Customers">
                  {posCustomers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code || c.phone || 'Cash Customer'})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <button
              type="button"
              onClick={() => setIsAddCustomerOpen(true)}
              className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition-all shrink-0 flex items-center gap-1 shadow-2xs"
            >
              <UserPlus className="w-4 h-4" />
              + New
            </button>
          </div>
        </div>

        {/* Product Search Input */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Search Products
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Type product name or category..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-white shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none text-base font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Product List Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-2.5">
            {products.map((p) => {
              const retailNum = Number(p.fixed_retail_price_per_kg || 0);
              const saleNum = Number(p.sale_price || 0);
              const displayPrice = isCashier
                ? (retailNum > 0 ? retailNum : saleNum)
                : (saleNum > 0 ? saleNum : retailNum);

              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-blue-400 hover:bg-blue-50/60 transition-all text-left group"
                >
                  <div>
                    <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                      {p.size ? `${p.name} - ${p.size}` : p.name}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      {p.code ? `${p.code} — ` : ''}{p.category || p.category_name || 'General'}{p.size ? ` • Size: ${p.size}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-blue-600 text-base">
                      Rs. {displayPrice} / KG
                    </p>
                    <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                      {p.total_stock_kg ?? p.current_stock ?? 0} KG available
                    </p>
                  </div>
                </button>
              );
            })}
            {products.length === 0 && !isSearchLoading && (
              <div className="py-12 text-center text-slate-400 font-medium bg-white rounded-xl border border-dashed border-slate-200">
                No products found matching "{searchTerm}"
              </div>
            )}
            {isSearchLoading && (
              <div className="py-12 text-center text-slate-400 font-medium">Loading inventory...</div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart & Locked Payment Panel */}
      <div className="w-[440px] flex flex-col bg-white shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
        <div className="p-4 border-b border-slate-100 bg-blue-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">Current Sale Cart</h2>
              <span className="text-xs text-slate-500 font-medium">
                {selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : 'Walk-In Customer'}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">
            {cart.length} Items
          </span>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 my-auto py-12">
              <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-600">Cart is empty</p>
              <p className="text-xs text-slate-400 mt-1">Select products from the list on the left to start billing.</p>
            </div>
          ) : (
            cart.map((item) => {
              const unitMultiplier = (item.selected_unit.toLowerCase() === 'bag' || item.selected_unit.toLowerCase() === 'bora')
                ? item.bag_weight_kg
                : 1.0;

              const safeQty = parseFloat(String(item.quantity)) || 0;
              const netKg = safeQty * unitMultiplier;

              const floorPricePerKg = item.rolling_avg_cost_per_kg * 1.05;
              const floorPricePerUnit = floorPricePerKg * unitMultiplier;
              const sellingPricePerKg = unitMultiplier > 0 ? (item.unit_price / unitMultiplier) : item.unit_price;
              const isBelowFloor = !isCashier && sellingPricePerKg < floorPricePerKg - 0.01;

              return (
                <div
                  key={item.product_id}
                  className={`flex flex-col gap-2.5 p-3.5 border rounded-xl shadow-xs transition-all ${
                    isBelowFloor ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 leading-tight block text-sm">
                        {item.productName}
                      </span>
                      <span className="text-[11px] text-blue-600 font-semibold font-mono">
                        Net: {netKg.toFixed(2)} KG ({item.quantity} {item.selected_unit})
                      </span>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {isBelowFloor && (
                    <div className="flex items-center gap-1 text-[11px] text-red-700 bg-red-100/80 p-1.5 rounded-lg border border-red-300 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                      Price below minimum floor (Rs. {floorPricePerUnit.toFixed(2)} / {item.selected_unit})
                    </div>
                  )}

                  {/* Unit, Quantity & Unit Price Control */}
                  <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={item.selected_unit}
                        onChange={(e) => {
                          const newUnit = e.target.value;
                          const newMultiplier = (newUnit.toLowerCase() === 'bag' || newUnit.toLowerCase() === 'bora')
                            ? item.bag_weight_kg
                            : 1.0;
                          const currentQty = parseFloat(String(item.quantity)) || 0;
                          const available_stock = Number(item.current_stock ?? 0);
                          if (currentQty * newMultiplier > available_stock) {
                            toast.warning(`Only ${available_stock} KG available.`);
                            const maxUnits = newMultiplier > 1 ? Math.floor((available_stock / newMultiplier) * 100) / 100 : available_stock;
                            updateCartItem(item.product_id, { selected_unit: newUnit, quantity: maxUnits });
                            return;
                          }
                          updateCartItem(item.product_id, { selected_unit: newUnit });
                        }}
                        className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="KG">KG</option>
                        <option value="Bag">Bag ({item.bag_weight_kg} KG)</option>
                      </select>

                      <input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          if (rawVal === '') {
                            updateCartItem(item.product_id, { quantity: '' });
                            return;
                          }
                          const enteredQty = parseFloat(rawVal);
                          if (isNaN(enteredQty)) {
                            updateCartItem(item.product_id, { quantity: 0 });
                            return;
                          }
                          const unitMultiplier = (item.selected_unit.toLowerCase() === 'bag' || item.selected_unit.toLowerCase() === 'bora')
                            ? item.bag_weight_kg
                            : 1.0;
                          const requestedKg = enteredQty * unitMultiplier;
                          const available_stock = Number(item.current_stock ?? 0);

                          if (requestedKg > available_stock) {
                            toast.warning(`Only ${available_stock} KG available.`);
                            const maxInUnits = unitMultiplier > 1 ? Math.floor((available_stock / unitMultiplier) * 100) / 100 : available_stock;
                            updateCartItem(item.product_id, { quantity: maxInUnits });
                            return;
                          }

                          updateCartItem(item.product_id, { quantity: rawVal });
                        }}
                        className="w-14 text-center text-xs font-bold border border-slate-300 rounded-lg py-1 px-1 bg-white focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Price/{item.selected_unit}
                        </span>
                        <input
                          type="number"
                          readOnly
                          value={item.unit_price}
                          className="w-20 text-right text-xs font-bold rounded-lg py-1 px-1.5 bg-slate-50 text-slate-500 cursor-not-allowed border-0 ring-0 focus:ring-0 focus:outline-none"
                        />
                      </div>

                      <div className="text-right min-w-[70px]">
                        <span className="text-xs font-black text-slate-900 block font-mono">
                          Rs. {(safeQty * item.unit_price).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Payment Form */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
          <div className="flex justify-between items-center text-xs text-slate-600 font-medium">
            <span>Subtotal</span>
            <span className="font-bold text-slate-800 text-sm">Rs. {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                Discount {isCashier && <Lock className="w-3 h-3 text-slate-400" />}
              </span>
              {!isCashier && (
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDiscountType('FIXED')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      discountType === 'FIXED'
                        ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Rs.
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENTAGE')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      discountType === 'PERCENTAGE'
                        ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    %
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {discountType === 'PERCENTAGE' && !isCashier && calculatedDiscount > 0 && (
                <span className="text-[11px] font-mono text-slate-500">
                  (-Rs. {calculatedDiscount.toLocaleString()})
                </span>
              )}
              <input
                type="number"
                min={0}
                max={discountType === 'PERCENTAGE' ? 100 : undefined}
                disabled={isCashier}
                readOnly={isCashier}
                value={isCashier ? 0 : discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className={`w-24 text-right text-xs font-bold rounded-lg py-1 px-2 ${
                  isCashier
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-white border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500'
                }`}
                placeholder="0"
              />
            </div>
          </div>

          {hasCreditBalance && availableCredit > 0 && (
            <div className="flex justify-between items-center text-xs font-bold bg-emerald-100/90 text-emerald-950 p-2.5 rounded-xl border border-emerald-300 shadow-2xs my-0.5">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                Available Credit Applied (Prev Returns):
              </span>
              <span className="font-mono text-emerald-800 text-sm font-black">
                - Rs. {appliedCredit.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <span className="text-sm text-slate-800 font-bold">
              {appliedCredit > 0 ? 'Net Total Payable' : 'Grand Total'}
            </span>
            <span className="text-xl text-blue-600 font-black font-mono">Rs. {total.toLocaleString()}</span>
          </div>

          {/* Amount Paid Input */}
          <div className="mt-1">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                Amount Paid (Cash Tendered)
              </label>
              <button
                type="button"
                onClick={() => setAmountPaid(total)}
                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition"
              >
                Exact Cash (Rs. {total.toLocaleString()})
              </button>
            </div>
            <input
              type="number"
              min={0}
              value={amountPaid === '' ? '' : amountPaid}
              onChange={(e) => setAmountPaid(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder={`Exact: Rs. ${total.toLocaleString()}`}
              className="w-full text-right font-black text-base rounded-xl py-2 px-3 border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 font-mono"
            />
            {isCashier && Number(amountPaid) > total + 0.01 && (
              <p className="text-[11px] text-red-600 font-semibold mt-1">
                Cashiers cannot receive excess payments beyond cart total.
              </p>
            )}
          </div>

          {/* Read-Only Payment Routing Badge */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold shadow-2xs">
            <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Payment Routing: Strict Cash in Drawer</span>
          </div>

          <button
            onClick={() => checkoutMutation.mutate()}
            disabled={!isCartValid || checkoutMutation.isPending}
            className="w-full mt-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-base transition-all shadow-sm active:scale-[0.98] flex justify-center items-center gap-2"
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

      {/* Hidden Receipt for Printing */}
      {lastInvoice && (
        <ReceiptPrinter
          invoice={lastInvoice.invoice}
          items={lastInvoice.items}
          cashierName={lastInvoice.cashierName}
        />
      )}
    </div>
  );
}
