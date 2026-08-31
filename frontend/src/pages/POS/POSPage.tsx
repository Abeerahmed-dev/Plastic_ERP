import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ShoppingCart, Trash2 } from 'lucide-react';
import { productsService } from '../../services/products.service';
import { posService } from '../../services/pos.service';
import { useAuthStore } from '../../store/auth.store';
import { ReceiptPrinter } from './ReceiptPrinter';

interface CartItem {
  product_id: string;
  productName: string;
  quantity: number;
  unit_price: number;
  current_stock: number;
}

export default function POSPage() {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  
  // Need to print receipt?
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

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) return prev; // Cannot exceed stock
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      if (product.current_stock <= 0) return prev;
      return [...prev, {
        product_id: product.id,
        productName: product.name,
        quantity: 1,
        unit_price: product.sale_price,
        current_stock: product.current_stock
      }];
    });
  };

  const updateQuantity = (id: string, qty: number, maxStock: number) => {
    if (qty <= 0) return;
    if (qty > maxStock) qty = maxStock;
    setCart(prev => prev.map(i => i.product_id === id ? { ...i, quantity: qty } : i));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.product_id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const total = Math.max(0, subtotal - discount);

  const checkoutMutation = useMutation({
    mutationFn: () => posService.checkout({
      items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
      discount
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
    }
  });

  useEffect(() => {
    if (shouldPrint && lastInvoice) {
      setTimeout(() => {
        window.print();
        setShouldPrint(false);
      }, 500); // Wait for React to render the print container
    }
  }, [shouldPrint, lastInvoice]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 print:hidden">
      {/* LEFT: Product Search & Results */}
      <div className="flex-1 flex flex-col p-6 border-r border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Walk-in POS</h1>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Select or search product... ▼</label>
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
             {products.map(p => (
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
                     <p className="text-xs text-emerald-600 font-medium">{p.current_stock} in stock</p>
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
      <div className="w-[400px] flex flex-col bg-white shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
        <div className="p-4 border-b border-slate-100 bg-blue-50/50 flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Current Sale</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 mt-10">
              Cart is empty. Add products to begin.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="flex flex-col gap-2 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-slate-700 leading-tight">{item.productName}</span>
                  <button onClick={() => removeFromCart(item.product_id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-600">Rs. {item.unit_price}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={item.current_stock}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1, item.current_stock)}
                      className="w-16 text-center text-sm border-slate-200 rounded-lg py-1 px-2"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-600 font-medium">Subtotal</span>
            <span className="text-slate-800 font-semibold">Rs. {subtotal}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-600 font-medium">Discount</span>
            <input
              type="number"
              min={0}
              value={discount || ''}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="w-24 text-right text-sm border-slate-200 rounded-lg py-1 px-2"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between items-end mb-6 pt-4 border-t border-slate-200">
            <span className="text-lg text-slate-800 font-bold">Total</span>
            <span className="text-3xl text-blue-600 font-bold">Rs. {total}</span>
          </div>

          <button
            onClick={() => checkoutMutation.mutate()}
            disabled={cart.length === 0 || checkoutMutation.isPending}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-lg transition-all shadow-md active:scale-[0.98] flex justify-center items-center gap-2"
          >
            {checkoutMutation.isPending ? 'Processing...' : 'Complete Sale'}
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
