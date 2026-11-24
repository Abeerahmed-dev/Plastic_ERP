import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Box } from 'lucide-react';
import { toast } from 'sonner';
import { productsService } from '../../services/products.service';
import { categoriesService } from '../../services/categories.service';
import { ProductFormModal } from './ProductFormModal';
import { Product, CreateProductData, UpdateProductData } from '../../types/product.types';
import { useAuthStore } from '../../store/auth.store';
import { invalidateProductQueries } from '../../utils/querySync';
import { erpSyncBus, useErpSync } from '../../utils/erpSyncBus';
import { ProductSizeFilter } from '../../components/Common/ProductSizeFilter';

export default function ProductsListPage() {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuthStore();
  const userRole = (user?.roleName || user?.role || '').toUpperCase();
  const isCashier = userRole === 'CASHIER';
  const isOwner = userRole === 'OWNER' || userRole === 'ADMIN';
  const isAccountant = userRole === 'ACCOUNTANT';

  const [productQuery, setProductQuery] = useState('');
  const [sizeQuery, setSizeQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const canWrite = isOwner || isAccountant || hasPermission('products:write');

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: productsService.getProducts,
  });

  const { data: categories = [], refetch: refetchCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesService.getCategories,
  });

  useErpSync(() => {
    refetch();
    refetchCategories();
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProductData) => productsService.createProduct(data),
    onSuccess: () => {
      invalidateProductQueries(queryClient);
      erpSyncBus.emit('product');
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || err.message || 'Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductData }) =>
      productsService.updateProduct(id, data),
    onSuccess: () => {
      invalidateProductQueries(queryClient);
      erpSyncBus.emit('product');
      setIsModalOpen(false);
      setEditingProduct(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || err.message || 'Failed to update product');
    },
  });

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (productQuery.trim()) {
        const pName = (p.name || '').trim().toLowerCase();
        if (!pName.includes(productQuery.trim().toLowerCase())) {
          return false;
        }
      }
      if (sizeQuery.trim()) {
        const pSize = (p.size || '').trim().toLowerCase();
        if (!pSize.includes(sizeQuery.trim().toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [products, productQuery, sizeQuery]);

  const handleClearFilters = () => {
    setProductQuery('');
    setSizeQuery('');
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSubmit = (data: any) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
    }).format(Number(val));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage raw materials, finished goods, and product category conversions.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5 text-slate-950" />
            Add Product
          </button>
        )}
      </div>

      {/* Product & Size Filter Combobox */}
      <ProductSizeFilter
        products={products}
        productQuery={productQuery}
        sizeQuery={sizeQuery}
        onProductChange={setProductQuery}
        onSizeChange={setSizeQuery}
        onClear={handleClearFilters}
        showLabels={true}
        productLabel="Select Product"
        sizeLabel="Select Size"
        className="mb-6"
      />

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Category (Bag Weight)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Pricing
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Current Stock (KG)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <span className="mt-2">Loading catalog...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <Box className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-slate-900">
                            {product.size ? `${product.name} (${product.size})` : product.name}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{product.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.size ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100 text-xs font-semibold">
                          {product.size}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-100">
                        {product.category || product.category_name} ({Number(product.bag_weight_kg || 25).toFixed(2)} KG/Bag)
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 font-medium">
                        {formatCurrency(product.sale_price)} / KG
                      </div>
                      {!isCashier && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Cost: {formatCurrency(product.cost_price)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 font-bold">
                        {Number(product.current_stock ?? product.opening_stock).toLocaleString()} KG
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${product.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                          }`}
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canWrite && (
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="inline-flex items-center text-slate-400 hover:text-blue-600 transition-colors bg-white p-1.5 rounded-lg hover:bg-blue-50"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        initialData={editingProduct}
        categories={categories}
      />
    </div>
  );
}
