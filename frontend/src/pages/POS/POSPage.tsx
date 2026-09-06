import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ShoppingCart, Trash2, Layers, AlertCircle } from 'lucide-react';
import { productsService, ProductBatch } from '../../services/products.service';
import { posService } from '../../services/pos.service';
import { useAuthStore } from '../../store/auth.store';
import { ReceiptPrinter } from './ReceiptPrinter';

interface CartItem {
  product_id: string;
  batch_id: string;
  productName: string;
  quantity: number;
  selected_unit: string;
  unit_price: number;
  current_stock: number;
  availableBatches: ProductBatch[];
  selectedBatch?: ProductBatch;
}

export default function POSPage() {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
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

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ['posProducts', debouncedSearch],
    queryFn: () => productsService.getPOSAvailableProducts(debouncedSearch),
  });

  const products = searchResults || [];

  const addToCart = async (product: any) => {
    try {
      const batches = await productsService.getProductBatches(product.id);

      setCart((prev) => {
        const existingIndex = prev.findIndex((item) => item.product_id === product.id);
        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          if (existing.quantity >= product.current_stock) return prev;
          return prev.map((item, idx) =>
            idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
          );
        }

        const firstBatch = batches.length > 0 ? batches[0] : undefined;

        return [
          ...prev,
          {
            product_id: product.id,
            batch_id: firstBatch ? firstBatch.id : '',
            productName: product.name,
            quantity: 1,
            selected_unit: firstBatch?.selected_unit || product.sale_unit || 'Dasti',
            unit_price: product.sale_price,
            current_stock: product.current_stock,
            availableBatches: batches,
            selectedBatch: firstBatch,
          },
        ];
      });
    } catch (err) {
      console.error('Failed to fetch product batches:', err);
    }
  };

  const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;

        const updated = { ...item, ...updates };

        if (updates.batch_id !== undefined) {
          const foundBatch = item.availableBatches.find((b) => b.id === updates.batch_id);
          updated.selectedBatch = foundBatch;

          if (foundBatch) {
            const bConversions = typeof foundBatch.batch_unit_conversions === 'string'
              ? JSON.parse(foundBatch.batch_unit_conversions)
              : foundBatch.batch_unit_conversions;

            // Automatically set default unit to batch's selected_unit or first available unit in conversion matrix
            const availUnits = Object.keys(bConversions || {});
            if (availUnits.length > 0 && !availUnits.includes(updated.selected_unit)) {
              updated.selected_unit = foundBatch.selected_unit || availUnits[0];
            }
          }
        }

        return updated;
      }),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const total = Math.max(0, subtotal - discount);

  const hasPriceFloorViolation = cart.some((item) => {
    if (!item.selectedBatch) return false;
    const bConversions: Record<string, number> = typeof item.selectedBatch.batch_unit_conversions === 'string'
      ? JSON.parse(item.selectedBatch.batch_unit_conversions)
      : (item.selectedBatch.batch_unit_conversions || {});
    const customUnitWeight = bConversions && item.selected_unit && bConversions[item.selected_unit] !== undefined
      ? Number(bConversions[item.selected_unit])
      : Number(item.selectedBatch.actual_weight_per_unit || 1.0);
    const floorPricePerKg = Number(item.selectedBatch.buy_price_per_kg || 0) * 1.05;
    const sellingPricePerKg = customUnitWeight > 0 ? (item.unit_price / customUnitWeight) : item.unit_price;
    return sellingPricePerKg < floorPricePerKg - 0.01;
  });

  const isCartValid =
    cart.length > 0 &&
    cart.every((item) => !!item.batch_id && item.quantity > 0) &&
    !hasPriceFloorViolation;

  const checkoutMutation = useMutation({
    mutationFn: () =>
      posService.checkout({
        items: cart.map((i) => ({
          product_id: i.product_id,
          batch_id: i.batch_id,
          quantity: i.quantity,
          selected_unit: i.selected_unit,
          unit_price: i.unit_price,
        })),
        discount,
      }),
    onSuccess: (invoice) => {
      setLastInvoice({ invoice, items: [...cart], cashierName: user?.name || 'Cashier' });
      setCart([]);
      setDiscount(0);
      setShouldPrint(true);

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['posProducts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || err.message || 'Checkout failed');
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
      {/* LEFT: Product Search & Results */}
      <div className="flex-1 flex flex-col p-6 border-r border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Walk-in POS</h1>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Select or search product... ▼
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Start typing product name, initials, or code..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex flex-col gap-2">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
              >
                <div>
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  <p className="text-sm text-slate-500">{p.code}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">Rs. {p.sale_price}</p>
                  <p className="text-xs text-emerald-600 font-medium">{p.current_stock} KG available</p>
                </div>
              </button>
            ))}
            {products.length === 0 && !isSearchLoading && (
              <div className="py-8 text-center text-slate-500">
                No available products found matching "{searchTerm}"
              </div>
            )}
            {isSearchLoading && (
              <div className="py-8 text-center text-slate-500">Searching...</div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div className="w-[450px] flex flex-col bg-white shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
        <div className="p-4 border-b border-slate-100 bg-blue-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Current Sale</h2>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">
            {cart.length} Items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 mt-10">
              Cart is empty. Select products from left list.
            </div>
          ) : (
            cart.map((item) => {
              const selectedBatch = item.selectedBatch;
              const batchConversions: Record<string, number> = selectedBatch
                ? typeof selectedBatch.batch_unit_conversions === 'string'
                  ? JSON.parse(selectedBatch.batch_unit_conversions)
                  : (selectedBatch.batch_unit_conversions || {})
                : {};

              const availableUnits = Object.keys(batchConversions).length > 0
                ? Object.keys(batchConversions)
                : ['Bora', 'Peti', 'Dasti', 'Pura', 'KG'];

              const customUnitWeight = batchConversions && item.selected_unit && batchConversions[item.selected_unit] !== undefined
                ? Number(batchConversions[item.selected_unit])
                : Number(selectedBatch?.actual_weight_per_unit || 1.0);

              const netKg = item.quantity * customUnitWeight;

              // Price Floor Calculation
              const buyPricePerKg = Number(selectedBatch?.buy_price_per_kg || 0);
              const minMarkupPercent = 5.00;
              const floorPricePerKg = buyPricePerKg * (1 + (minMarkupPercent / 100));
              const floorPricePerUnit = floorPricePerKg * customUnitWeight;
              const sellingPricePerKg = customUnitWeight > 0 ? (item.unit_price / customUnitWeight) : item.unit_price;
              const isBelowFloor = selectedBatch ? (sellingPricePerKg < floorPricePerKg - 0.01) : false;

              return (
                <div
                  key={item.product_id}
                  className={`flex flex-col gap-2.5 p-3.5 border rounded-2xl shadow-sm transition-colors ${
                    isBelowFloor ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 leading-tight block">
                        {item.productName}
                      </span>
                      <span className="text-[11px] text-blue-600 font-medium font-mono">
                        Net: {netKg.toFixed(2)} KG ({item.quantity} {item.selected_unit})
                      </span>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mandatory Step 2: Select Batch */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      1. Select Stock Batch (Required):
                    </label>
                    <select
                      value={item.batch_id}
                      onChange={(e) => updateCartItem(item.product_id, { batch_id: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Batch (Required) --</option>
                      {item.availableBatches.map((b) => {
                        const bConversions = typeof b.batch_unit_conversions === 'string'
                          ? JSON.parse(b.batch_unit_conversions)
                          : (b.batch_unit_conversions || {});
                        const unitWt = bConversions[b.selected_unit || 'Bora'] || b.actual_weight_per_unit || 30;

                        return (
                          <option key={b.id} value={b.id}>
                            Batch #{b.batch_number} - {b.remaining_qty} KG Rem - (1 {b.selected_unit || 'Bora'} = {unitWt} KG)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {!item.batch_id && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Select a stock batch to unlock unit selection & prices.
                    </div>
                  )}

                  {isBelowFloor && (
                    <div className="flex items-center gap-1 text-[11px] text-red-700 bg-red-100/80 p-1.5 rounded-lg border border-red-300 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                      Price below minimum authorized margin (Floor: Rs. {floorPricePerUnit.toFixed(2)} / {item.selected_unit})
                    </div>
                  )}

                  {/* Step 3 & 4: Select Unit, Quantity & Editable Unit Price */}
                  <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={item.selected_unit}
                        disabled={!item.batch_id}
                        onChange={(e) => updateCartItem(item.product_id, { selected_unit: e.target.value })}
                        className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        title={!item.batch_id ? 'Select a batch first' : 'Select Unit'}
                      >
                        {availableUnits.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min={1}
                        disabled={!item.batch_id}
                        value={item.quantity}
                        onChange={(e) =>
                          updateCartItem(item.product_id, {
                            quantity: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-14 text-center text-sm font-bold border-slate-300 rounded-lg py-1 px-1 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-mono block">Unit Price</span>
                        <input
                          type="number"
                          step="0.5"
                          disabled={!item.batch_id}
                          value={item.unit_price}
                          onChange={(e) =>
                            updateCartItem(item.product_id, {
                              unit_price: Math.max(0, parseFloat(e.target.value) || 0),
                            })
                          }
                          className={`w-20 text-right text-xs font-bold rounded-lg py-1 px-1.5 transition-all outline-none ${
                            isBelowFloor
                              ? 'border-2 border-red-500 bg-red-100 text-red-900 focus:ring-2 focus:ring-red-500'
                              : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                      </div>

                      <div className="text-right min-w-[70px]">
                        <span className="text-sm font-black text-slate-900 block">
                          Rs. {(item.quantity * item.unit_price).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-600 font-medium text-sm">Subtotal</span>
            <span className="text-slate-800 font-bold text-sm">Rs. {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-600 font-medium text-sm">Discount</span>
            <input
              type="number"
              min={0}
              value={discount || ''}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="w-24 text-right text-sm font-bold border-slate-300 rounded-lg py-1 px-2 bg-white"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between items-end mb-5 pt-3 border-t border-slate-200">
            <span className="text-base text-slate-800 font-bold">Total Payable</span>
            <span className="text-2xl text-blue-600 font-black">Rs. {total.toLocaleString()}</span>
          </div>

          <button
            onClick={() => checkoutMutation.mutate()}
            disabled={!isCartValid || checkoutMutation.isPending}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-base transition-all shadow-md active:scale-[0.98] flex justify-center items-center gap-2"
          >
            {checkoutMutation.isPending ? 'Processing...' : 'Complete POS Sale'}
          </button>
        </div>
      </div>

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
