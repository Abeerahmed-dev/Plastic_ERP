import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { purchasesService } from '../../services/purchases.service';
import { getSuppliers } from '../../services/suppliers.service';
import { productsService } from '../../services/products.service';

const itemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().min(0.0001, 'Min quantity 0.0001'),
  unit_price: z.coerce.number().min(0, 'Min price 0'),
  actual_weight_per_unit: z.coerce.number().min(0).optional().nullable(),
  actual_kanta_wt: z.coerce.number().min(0).optional().nullable(),
  actual_weight_kg: z.coerce.number().min(0).optional().nullable(),
});

const schema = z.object({
  supplier_id: z.string().min(1, 'Party is required'),
  date: z.string(),
  due_date: z.string().optional(),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PurchaseFormModal({ onClose, onSuccess }: Props) {
  const qc = useQueryClient();

  // Fetch dependencies
  const { data: suppliersResponse } = useQuery({ 
    queryKey: ['suppliers'], 
    queryFn: () => getSuppliers({ limit: 100 })
  });
  const suppliers = suppliersResponse?.data || [];

  const { data: productsResponse } = useQuery({ 
    queryKey: ['products'], 
    queryFn: () => productsService.getProducts() 
  });
  const products = productsResponse || [];

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplier_id: '',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      discount: 0,
      notes: '',
      items: [{ product_id: '', quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');
  const watchDiscount = watch('discount');

  // Calculations
  const subtotal = watchItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - (Number(watchDiscount) || 0));

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setValue(`items.${index}.unit_price`, Number(product.cost_price || 0));
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => purchasesService.createInvoice(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error.message || 'Failed to save purchase invoice');
    }
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const inputCls = (err?: boolean) => `w-full rounded-lg border ${err ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500'} py-2 px-3 text-sm outline-none transition`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Purchasing</h2>
            <p className="text-sm text-slate-500 mt-0.5">Record incoming bags from supplier (Implicit Bag unit)</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto flex-1">
          <form id="purchase-form" onSubmit={handleSubmit(onSubmit, (errs) => console.log('Validation failed:', errs))} className="space-y-6">
            
            {mutation.isError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {mutation.error instanceof Error ? mutation.error.message : 'Failed to create invoice.'}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Party</label>
                <select {...register('supplier_id')} className={inputCls(!!errors.supplier_id)}>
                  <option value="">Select party...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.city ? ` (${s.city})` : ''}
                    </option>
                  ))}
                </select>
                {errors.supplier_id && <p className="mt-1 text-xs text-red-600">{errors.supplier_id.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice Date</label>
                <input type="date" {...register('date')} className={inputCls(!!errors.date)} />
                {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Due Date</label>
                <input type="date" {...register('due_date')} className={inputCls(!!errors.due_date)} />
                {errors.due_date && <p className="mt-1 text-xs text-red-600">{errors.due_date.message}</p>}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 text-sm">Line Items (All purchases in Bags)</h3>
                <button
                  type="button"
                  onClick={() => append({ product_id: '', quantity: 1, unit_price: 0 })}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Row
                </button>
              </div>
              
              {errors.items?.root && <p className="text-sm text-red-600 p-3">{errors.items.root.message}</p>}
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 font-medium w-1/3">Product</th>
                      <th className="px-4 py-2 font-medium w-28">Qty (Bags)</th>
                      <th className="px-4 py-2 font-medium w-48">Actual Kanta Wt / Unit (KG)</th>
                      <th className="px-4 py-2 font-medium w-28">Unit Price</th>
                      <th className="px-4 py-2 font-medium w-28">Total</th>
                      <th className="px-4 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fields.map((field, index) => {
                      const itemError = errors.items?.[index];
                      const selectedProdId = watchItems[index]?.product_id;
                      const selectedProd = products.find(p => p.id === selectedProdId);

                      const bagWeightKg = selectedProd && selectedProd.bag_weight_kg ? Number(selectedProd.bag_weight_kg) : 25.0;

                      const qty = Number(watchItems[index]?.quantity) || 0;
                      const price = Number(watchItems[index]?.unit_price) || 0;
                      const lineTotal = qty * price;
                      const calculatedStdWeight = qty * bagWeightKg;
                      
                      return (
                        <tr key={field.id}>
                          <td className="px-4 py-3 align-top">
                            <select
                              {...register(`items.${index}.product_id`, {
                                onChange: (e) => handleProductChange(index, e.target.value)
                              })}
                              className={inputCls(!!itemError?.product_id)}
                            >
                              <option value="">Select product...</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.size ? `${p.name} - ${p.size}` : p.name} ({p.category || p.category_name} — {Number(p.bag_weight_kg || 25).toFixed(2)} KG/Bag)
                                </option>
                              ))}
                            </select>
                            {itemError?.product_id && <p className="text-xs text-red-600 mt-1">{itemError.product_id.message}</p>}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              type="number"
                              step="0.0001"
                              {...register(`items.${index}.quantity`)}
                              className={inputCls(!!itemError?.quantity)}
                            />
                            {selectedProdId && (
                              <p className="mt-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 p-1 rounded border border-emerald-100">
                                Total: {calculatedStdWeight.toFixed(2)} KG
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              type="number"
                              step="0.01"
                              placeholder={`Std: ${bagWeightKg} KG`}
                              {...register(`items.${index}.actual_weight_per_unit`)}
                              className={inputCls(!!itemError?.actual_weight_per_unit)}
                            />
                            <p className="mt-1 text-[11px] text-slate-400">Optional batch weight override</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              type="number"
                              step="0.01"
                              {...register(`items.${index}.unit_price`)}
                              className={inputCls(!!itemError?.unit_price)}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700 align-top pt-5">
                            Rs. {lineTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="font-semibold text-slate-700">Rs. {subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Discount (Rs)</span>
                  <div className="w-32">
                    <input
                      type="number"
                      step="0.01"
                      {...register('discount')}
                      className={inputCls(!!errors.discount)}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <span className="text-base font-bold text-slate-900">Total Amount</span>
                  <span className="text-xl font-black text-emerald-600">Rs. {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Terms</label>
              <textarea
                {...register('notes')}
                rows={2}
                className={inputCls(!!errors.notes)}
                placeholder="Optional notes for this purchase..."
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="purchase-form"
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-70 flex items-center"
          >
            {mutation.isPending ? 'Saving...' : 'Save Purchase'}
          </button>
        </div>

      </div>
    </div>
  );
}
