import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Product } from '../../types/product.types';
import { categoriesService, Category } from '../../services/categories.service';

const productSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2, 'Name is required').max(150),
  name_urdu: z.string().optional(),
  size: z.string({ required_error: 'Size/Variant is compulsory' })
    .trim()
    .min(1, 'Size/Variant is compulsory'),
  low_stock_threshold: z.coerce.number().min(0, 'Must be at least 0').default(0),
  description: z.string().optional(),
  category_id: z.string().min(1, 'Category is required'),
  cost_price: z.coerce.number().min(0, 'Must be at least 0').optional().default(0),
  historical_wac: z.coerce.number().min(0, 'Must be at least 0').optional().default(0),
  sale_price: z.coerce.number().min(0, 'Must be at least 0').optional().default(0),
  opening_stock: z.coerce.number().min(0, 'Must be at least 0').optional().default(0),
  is_active: z.boolean().optional(),
  notes: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
  initialData?: Product | null;
  categories?: Category[];
}

export const ProductFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialData,
  categories: propCategories,
}: ProductFormModalProps) => {
  const { data: fetchedCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesService.getCategories(),
    enabled: isOpen,
  });

  const categories = propCategories || fetchedCategories;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: '',
      name: '',
      name_urdu: '',
      size: '',
      low_stock_threshold: 0,
      description: '',
      category_id: '',
      cost_price: 0,
      historical_wac: 0,
      sale_price: 0,
      opening_stock: 0,
      is_active: true,
      notes: '',
    },
  });

  const selectedCategoryId = watch('category_id');
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const openingStockValue = watch('opening_stock');
  const isZeroStock = Number(openingStockValue || 0) <= 0;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          code: initialData.code,
          name: initialData.name,
          name_urdu: initialData.name_urdu || '',
          size: initialData.size || '',
          low_stock_threshold: Number((initialData as any).low_stock_threshold || 0),
          description: initialData.description || '',
          category_id: initialData.category_id,
          cost_price: Number(initialData.cost_price),
          historical_wac: Number(initialData.cost_price),
          sale_price: Number(initialData.sale_price),
          opening_stock: Number(initialData.opening_stock),
          is_active: initialData.is_active,
          notes: initialData.notes || '',
        });
      } else {
        reset({
          code: '',
          name: '',
          name_urdu: '',
          size: '',
          low_stock_threshold: 0,
          description: '',
          category_id: categories.length > 0 ? categories[0].id : '',
          cost_price: 0,
          historical_wac: 0,
          sale_price: 0,
          opening_stock: 0,
          is_active: true,
          notes: '',
        });
      }
    }
  }, [isOpen, initialData, reset, categories]);


  if (!isOpen) return null;

  const inputCls = (hasError: boolean) =>
    `block w-full rounded-xl border px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
    }`;

  const handleFormSubmit = (data: ProductFormData) => {
    const openingStock = Number(data.opening_stock || 0);
    const histWac = openingStock > 0 ? Number(data.historical_wac || 0) : 0;
    onSubmit({
      ...data,
      cost_price: initialData?.cost_price ? Number(initialData.cost_price) : (histWac > 0 ? histWac : 0),
      sale_price: initialData?.sale_price ? Number(initialData.sale_price) : 0,
      opening_stock: openingStock,
      opening_stock_kg: openingStock,
      historical_wac: histWac,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto pt-10 pb-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {initialData ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
          <form id="product-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Product Code
                </label>
                <input
                  {...register('code')}
                  placeholder="Leave blank to auto-generate"
                  className={inputCls(!!errors.code)}
                />
                {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input {...register('name')} placeholder="e.g. Shopping Bag / 30/s Poly" className={inputCls(!!errors.name)} />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Size / Variant <span className="text-red-500">*</span>
                  <span className="text-slate-400 font-normal text-xs ml-1">(e.g., 10x15, Standard)</span>
                </label>
                <input
                  {...register('size', { required: 'Size/Variant is compulsory' })}
                  required
                  placeholder="e.g. 10x15 or Standard"
                  className={inputCls(!!errors.size)}
                />
                {errors.size && <p className="mt-1 text-xs text-red-600 font-medium">{errors.size.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Low Stock Alert Threshold (KG)
                  <span className="text-slate-400 font-normal text-xs ml-1">(Warning limit)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  {...register('low_stock_threshold')}
                  placeholder="e.g. 50"
                  className={inputCls(!!errors.low_stock_threshold)}
                />
                {errors.low_stock_threshold && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{errors.low_stock_threshold.message}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">Triggers dashboard warning when current stock &le; threshold.</p>
              </div>


              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select {...register('category_id')} className={inputCls(!!errors.category_id)}>
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({Number(c.bag_weight_kg).toFixed(2)} KG / Bag)
                    </option>
                  ))}
                </select>
                {errors.category_id && <p className="mt-1 text-xs text-red-600">{errors.category_id.message}</p>}
                {selectedCategory && (
                  <p className="mt-2 text-xs font-semibold text-blue-700 bg-blue-50 p-2.5 rounded-xl border border-blue-100 flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 text-blue-500" />
                    Conversion weight inherited from category ({Number(selectedCategory.bag_weight_kg).toFixed(2)} KG/Bag)
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Base Unit of Measure
                </label>
                <input
                  type="text"
                  value="Kilograms (KG)"
                  disabled
                  readOnly
                  className="block w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-slate-400">Standard system-wide unit for all inventory & WAC calculations.</p>
              </div>
            </div>

            {!initialData && (
              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Day Zero Stock (Optional)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Initialize existing on-hand stock and historical cost. Generates an active Day-Zero FIFO bucket (Owner Equity) without creating a purchase payable.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Opening Stock (KG)
                    </label>
                    <input
                      {...register('opening_stock')}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      className={inputCls(!!errors.opening_stock)}
                    />
                    {errors.opening_stock && (
                      <p className="mt-1 text-xs text-red-600">{errors.opening_stock.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Historical WAC / Price per KG (Rs)
                    </label>
                    <input
                      {...register('historical_wac')}
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={isZeroStock}
                      placeholder="0"
                      className={`block w-full rounded-xl border px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 ${
                        isZeroStock
                          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-blue-500/20'
                      }`}
                    />
                    {isZeroStock ? (
                      <p className="mt-1 text-[11px] text-slate-400">Disabled when Opening Stock is 0.</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-blue-600 font-medium">Used as initial FIFO buy price per KG.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                {...register('description')}
                rows={3}
                className={inputCls(!!errors.description)}
              ></textarea>
            </div>

            {initialData && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  {...register('is_active')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700">
                  Product is Active
                </label>
              </div>
            )}
          </form>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-950" />
                Saving...
              </>
            ) : (
              'Save Product'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
