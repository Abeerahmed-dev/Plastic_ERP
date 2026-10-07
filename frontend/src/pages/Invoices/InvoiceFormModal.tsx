import { useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Layers } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesService } from '../../services/invoices.service';
import { getCustomers } from '../../services/customers.service';
import { productsService } from '../../services/products.service';

const itemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().min(0.01, 'Quantity (KG) must be greater than 0'),
  unit_price: z.coerce.number().min(0, 'Price / KG cannot be negative'),
});

const schema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  date: z.string(),
  due_date: z.string(),
  discount: z.coerce.number().min(0).default(0),
  delivery_charge: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const InvoiceFormModal = ({ isOpen = true, onClose, onSuccess }: Props) => {
  const qc = useQueryClient();

  const { data: customersResponse } = useQuery({ queryKey: ['customers'], queryFn: () => getCustomers({ limit: 100 }) });
  const { data: productsResponse } = useQuery({ queryKey: ['products'], queryFn: () => productsService.getProducts() });

  const products = productsResponse || [];

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: '',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      discount: 0,
      delivery_charge: 0,
      notes: '',
      items: [{ product_id: '', quantity: 1, unit_price: 0 }],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const items = watch('items');
  const discount = watch('discount');
  const delivery_charge = watch('delivery_charge');

  const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  const deliveryChargeNum = Number(delivery_charge || 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0)) + deliveryChargeNum;

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setValue(`items.${index}.unit_price`, Number(product.sale_price || 0));
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => invoicesService.createInvoice(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['pnlReport'] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error.message || 'Failed to save invoice');
    }
  });

  useEffect(() => {
    reset({
      customer_id: '',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      discount: 0,
      delivery_charge: 0,
      notes: '',
      items: [{ product_id: '', quantity: 1, unit_price: 0 }],
    });
  }, [isOpen]);

  const onSubmit = (data: FormData) => {
    const cleanData = {
      ...data,
      discount: Number(data.discount || 0),
      delivery_charge: Number(data.delivery_charge || 0),
      items: data.items.map((i) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
        selected_unit: 'KG',
        unit_price: Number(i.unit_price),
      })),
    };
    mutation.mutate(cleanData as any);
  };

  if (!isOpen) return null;

  const inputCls = (hasError: boolean) =>
    `block w-full rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
    }`;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto pt-10 pb-10">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl flex flex-col my-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Create New Wholesale Sales Invoice</h2>
              <p className="text-xs text-slate-500 font-medium">Strict KG Wholesale Billing Model</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto flex-1">
          <form id="invoice-form" onSubmit={handleSubmit(onSubmit, (errs) => console.log('Validation failed:', errs))} className="space-y-6">
            {mutation.isError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 font-medium border border-red-200">
                {(mutation.error as any)?.response?.data?.error || (mutation.error as any)?.response?.data?.message || mutation.error?.message || 'Failed to create invoice.'}
                {(mutation.error as any)?.response?.data?.detail && (
                  <p className="text-xs text-red-600 mt-1 font-mono">Detail: {(mutation.error as any).response.data.detail}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer</label>
                <select {...register('customer_id')} className={inputCls(!!errors.customer_id)}>
                  <option value="">Select a customer...</option>
                  {customersResponse?.data.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
                {errors.customer_id && <p className="mt-1 text-xs text-red-600">{errors.customer_id.message}</p>}
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

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-1/2">Product</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-36">QTY (KG)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-36">PRICE / KG</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-40">Total</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {fields.map((field, index) => {
                    const itemError = errors.items?.[index];
                    const selectedProdId = items[index]?.product_id;

                    const qty = Number(items[index]?.quantity || 0);
                    const price = Number(items[index]?.unit_price || 0);
                    const lineTotal = qty * price;

                    return (
                      <tr key={field.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 align-top">
                          <select
                            {...register(`items.${index}.product_id`, {
                              onChange: (e) => handleProductChange(index, e.target.value)
                            })}
                            className={inputCls(!!itemError?.product_id)}
                          >
                            <option value="">Select product...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.size ? `${p.name} - ${p.size}` : p.name} ({p.code})</option>
                            ))}
                          </select>
                          {itemError?.product_id && <p className="text-xs text-red-600 mt-1">{itemError.product_id.message}</p>}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <input
                            type="number"
                            step="0.01"
                            disabled={!selectedProdId}
                            placeholder="0.00"
                            {...register(`items.${index}.quantity`)}
                            className={inputCls(!!itemError?.quantity)}
                          />
                          {itemError?.quantity && <p className="text-xs text-red-600 mt-1">{itemError.quantity.message}</p>}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <input
                            type="number"
                            step="0.01"
                            disabled={!selectedProdId}
                            placeholder="0.00"
                            {...register(`items.${index}.unit_price`)}
                            className={inputCls(!!itemError?.unit_price)}
                          />
                          {itemError?.unit_price && <p className="text-xs text-red-600 mt-1">{itemError.unit_price.message}</p>}
                        </td>

                        <td className="px-4 py-3 text-sm font-bold text-slate-900 align-top pt-3 font-mono">
                          {formatCurrency(lineTotal)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => append({ product_id: '', quantity: 1, unit_price: 0 })}
                  className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-700"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Line Item
                </button>
              </div>
            </div>
            {errors.items?.root && <p className="text-sm text-red-600">{errors.items.root.message}</p>}

            <div className="flex justify-end">
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Discount</span>
                  <div className="w-24">
                    <input
                      type="number"
                      step="0.01"
                      {...register('discount')}
                      className={inputCls(!!errors.discount)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Delivery / Freight (Rs)</span>
                  <div className="w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('delivery_charge')}
                      className={inputCls(!!errors.delivery_charge)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200">
                  <span>Total Payable</span>
                  <span className="text-xl font-black text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Remarks</label>
              <textarea {...register('notes')} rows={2} className={inputCls(false)} placeholder="Optional invoice notes..."></textarea>
            </div>
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
            form="invoice-form"
            disabled={mutation.isPending}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition shadow-md"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Invoice...
              </>
            ) : (
              'Save Invoice'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


