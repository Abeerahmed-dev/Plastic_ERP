import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Box, Package } from 'lucide-react';
import { productsService } from '../../services/products.service';

export default function CashierStockPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['cashierStock', searchTerm],
    queryFn: () => productsService.getPOSAvailableProducts(searchTerm),
  });

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.size || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category || p.category_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(Number(val));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            Current Physical Stock
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time physical warehouse inventory levels available for cashier billing.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-xl border-0 py-2.5 pl-10 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all"
              placeholder="Search product name, code, size, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-500 font-medium text-sm">
              Loading physical stock...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Box className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900">No stock records found</h3>
              <p className="mt-1 text-sm text-slate-500">No available products match the search query.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Product Code</th>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">Size</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">Available Stock (KG)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProducts.map((p) => {
                  const stock = Number(p.total_stock_kg || p.current_stock || 0);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-blue-600">
                        {p.code}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {p.size ? `${p.name} (${p.size})` : p.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {p.size ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100 text-xs font-semibold">
                            {p.size}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium">
                          {p.category || p.category_name || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-slate-900 text-base">
                        {formatNumber(stock)} KG
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
