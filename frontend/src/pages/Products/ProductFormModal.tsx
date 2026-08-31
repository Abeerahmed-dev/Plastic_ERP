import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { Product, UnitOfMeasure } from '../../types/product.types';

const productSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2, 'Name is required').max(150),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required').max(50),
  uom_id: z.string().uuid('Please select a unit of measure'),
  cost_price: z.coerce.number().min(0, 'Must be at least 0'),
  sale_price: z.coerce.number().min(0, 'Must be at least 0'),
  opening_stock: z.coerce.number().min(0, 'Must be at least 0'),
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
  uoms: UnitOfMeasure[];
}

export const ProductFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialData,
  uoms,
}: ProductFormModalProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      category: 'Plastic Bag',
      uom_id: '',
      cost_price: 0,
      sale_price: 0,
      opening_stock: 0,
      is_active: true,
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          code: initialData.code,
          name: initialData.name,
          description: initialData.description || '',
          category: initialData.category,
          uom_id: initialData.uom_id,
          cost_price: Number(initialData.cost_price),
          sale_price: Number(initialData.sale_price),
          opening_stock: Number(initialData.opening_stock),
          is_active: initialData.is_active,
          notes: initialData.notes || '',
        });
      } else {
        reset({
          code: '',
          name: '',
          description: '',
          category: 'Finished Goods',
          uom_id: '',
          cost_price: 0,
          sale_price: 0,
          opening_stock: 0,
          is_active: true,
          notes: '',
        });
      }
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const inputCls = (hasError: boolean) =>
    `block w-full rounded-xl border px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
    }`;

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
          <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                <input {...register('name')} placeholder="Plastic Chair" className={inputCls(!!errors.name)} />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select {...register('category')} className={inputCls(!!errors.category)}>
                  <option value="Plastic Bag">Plastic Bag</option>
                  <option value="Roll">Roll</option>
                  <option value="Sheet">Sheet</option>
                  <option value="Granules">Granules</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Other">Other</option>
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Unit of Measure <span className="text-red-500">*</span>
                </label>
                <select {...register('uom_id')} className={inputCls(!!errors.uom_id)}>
                  <option value="">Select UOM...</option>
                  {uoms.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.abbreviation})
                    </option>
                  ))}
                </select>
                {errors.uom_id && <p className="mt-1 text-xs text-red-600">{errors.uom_id.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Cost Price</label>
                <input
                  {...register('cost_price')}
                  type="number"
                  step="0.01"
                  className={inputCls(!!errors.cost_price)}
                />
                {errors.cost_price && <p className="mt-1 text-xs text-red-600">{errors.cost_price.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Sale Price</label>
                <input
                  {...register('sale_price')}
                  type="number"
                  step="0.01"
                  className={inputCls(!!errors.sale_price)}
                />
                {errors.sale_price && <p className="mt-1 text-xs text-red-600">{errors.sale_price.message}</p>}
              </div>
            </div>

            {!initialData && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Opening Stock <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('opening_stock')}
                  type="number"
                  step="0.01"
                  className={inputCls(!!errors.opening_stock)}
                />
                <p className="mt-1 text-xs text-slate-500">Stock level at the time of system go-live.</p>
                {errors.opening_stock && (
                  <p className="mt-1 text-xs text-red-600">{errors.opening_stock.message}</p>
                )}
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
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
