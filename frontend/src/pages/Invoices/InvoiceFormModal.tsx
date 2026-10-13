import { useEffect, useState, useMemo } from 'react';
import { X, Plus, Trash2, Loader2, Layers, Wallet } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesService } from '../../services/invoices.service';
import { getCustomers } from '../../services/customers.service';
import { productsService } from '../../services/products.service';
import { SearchableCombobox, ComboboxOption } from '../../components/SearchableCombobox';
import { toast, handleApiError } from '../../utils/toast';

const itemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  selected_family_name: z.string().optional(),
  selected_variant_id: z.string().optional(),
  bags_input: z.union([z.string(), z.number()]).optional(),
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
  const [applyAdvance, setApplyAdvance] = useState(false);
  const [advanceAppliedAmount, setAdvanceAppliedAmount] = useState('0');

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
      items: [{ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0 }],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const items = watch('items');
  const discount = watch('discount');
  const delivery_charge = watch('delivery_charge');
  const selectedCustomerId = watch('customer_id');

  const selectedCustomer = customersResponse?.data.find((c: any) => c.id === selectedCustomerId);
  const walletBalance = Number(selectedCustomer?.advance_credit || (selectedCustomer as any)?.advance_wallet || 0);

  const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  const deliveryChargeNum = Number(delivery_charge || 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0)) + deliveryChargeNum;

  // Step 1: Group products by product_name
  const groupedProducts = useMemo(() => {
    const groups: Record<string, typeof products> = {};
    (products || []).forEach((p) => {
      const family = (p.name || '').trim();
      if (!family) return;
      if (!groups[family]) {
        groups[family] = [];
      }
      groups[family].push(p);
    });
    return groups;
  }, [products]);

  const productFamilies = useMemo(() => {
    return Object.keys(groupedProducts).sort((a, b) => a.localeCompare(b));
  }, [groupedProducts]);

  const familyOptions: ComboboxOption[] = useMemo(() => {
    return productFamilies.map((fam) => ({
      value: fam,
      label: fam,
      subLabel: `${groupedProducts[fam]?.length || 0} variant${(groupedProducts[fam]?.length || 0) > 1 ? 's' : ''}`,
    }));
  }, [productFamilies, groupedProducts]);

  const handleFamilyChange = (index: number, familyName: string) => {
    setValue(`items.${index}.selected_family_name`, familyName);
    setValue(`items.${index}.selected_variant_id`, '');
    setValue(`items.${index}.product_id`, '');
    setValue(`items.${index}.unit_price`, 0);
  };

  const handleVariantChange = (index: number, variantId: string) => {
    setValue(`items.${index}.selected_variant_id`, variantId);
    setValue(`items.${index}.product_id`, variantId);
    handleProductChange(index, variantId);
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const stdWeight = Number(product.bag_weight_kg || 25);
      const available_stock = Number(product.total_stock_kg ?? product.current_stock ?? 0);
      setValue(`items.${index}.unit_price`, Number(product.sale_price || 0));
      
      const currentBags = items[index]?.bags_input;
      let requestedKg = stdWeight;
      if (currentBags !== undefined && currentBags !== '' && Number(currentBags) > 0) {
        requestedKg = Number((Number(currentBags) * stdWeight).toFixed(2));
      }

      if (requestedKg > available_stock) {
        toast.warning(`Only ${available_stock} KG available.`);
        setValue(`items.${index}.quantity`, available_stock);
        setValue(`items.${index}.bags_input`, stdWeight > 0 ? Number((available_stock / stdWeight).toFixed(2)) : 0);
      } else {
        setValue(`items.${index}.bags_input`, currentBags !== undefined && currentBags !== '' ? currentBags : 1);
        setValue(`items.${index}.quantity`, requestedKg);
      }
    }
  };

  const handleBagsChange = (index: number, val: string) => {
    setValue(`items.${index}.bags_input`, val);
    const numBags = Number(val) || 0;
    const selectedProdId = items[index]?.product_id || items[index]?.selected_variant_id || '';
    const selectedProd = products.find(p => p.id === selectedProdId);
    const stdWeight = selectedProd && selectedProd.bag_weight_kg ? Number(selectedProd.bag_weight_kg) : 25;
    const available_stock = Number(selectedProd?.total_stock_kg ?? selectedProd?.current_stock ?? 0);
    
    if (numBags > 0) {
      const requestedKg = Number((numBags * stdWeight).toFixed(2));
      if (requestedKg > available_stock) {
        toast.warning(`Only ${available_stock} KG available.`);
        setValue(`items.${index}.quantity`, available_stock);
        if (stdWeight > 0) {
          setValue(`items.${index}.bags_input`, Number((available_stock / stdWeight).toFixed(2)));
        }
        return;
      }
      setValue(`items.${index}.quantity`, requestedKg);
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => invoicesService.createInvoice(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['pnlReport'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['liquidityLedger'] });
      toast.success('Sales invoice created successfully!');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      handleApiError(error);
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
      items: [{ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0 }],
    });
    setApplyAdvance(false);
    setAdvanceAppliedAmount('0');
  }, [isOpen]);

  const onSubmit = async (data: FormData) => {
    try {
      const cleanData = {
        ...data,
        discount: Number(data.discount || 0),
        delivery_charge: Number(data.delivery_charge || 0),
        advance_applied_amount: applyAdvance ? Number(advanceAppliedAmount || 0) : 0,
        items: data.items.map(({ bags_input, ...i }) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity),
          selected_unit: 'KG',
          unit_price: Number(i.unit_price),
        })),
      };
      await mutation.mutateAsync(cleanData as any);
    } catch (err: any) {
      handleApiError(err);
    }
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

            <div className="border border-slate-200 rounded-xl overflow-visible shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[26%]">Product</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[24%]">Size / Variant</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-24">Bags (Opt.)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">QTY (KG)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-32">PRICE / KG</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-36">Total</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {fields.map((field, index) => {
                    const itemError = errors.items?.[index];
                    const selectedProdId = items[index]?.product_id || items[index]?.selected_variant_id || '';
                    const selectedProd = products.find(p => p.id === selectedProdId);

                    const rowFamily = items[index]?.selected_family_name || (
                      selectedProd ? selectedProd.name : ''
                    ) || '';

                    const variantList = rowFamily ? (groupedProducts[rowFamily] || []) : [];
                    const variantOptions: ComboboxOption[] = variantList.map((p) => ({
                      value: p.id,
                      label: p.size ? `${p.size} (${p.code})` : `${p.name} (${p.code})`,
                      badge: p.code,
                      subLabel: `Std: ${Number(p.bag_weight_kg || 25).toFixed(2)} KG/bag`,
                    }));

                    const qty = Number(items[index]?.quantity || 0);
                    const price = Number(items[index]?.unit_price || 0);
                    const lineTotal = qty * price;

                    return (
                      <tr key={field.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 align-top min-w-[190px]">
                          <SearchableCombobox
                            value={rowFamily}
                            onChange={(val) => handleFamilyChange(index, val)}
                            options={familyOptions}
                            placeholder="Select product..."
                            hasError={!!itemError?.product_id && !rowFamily}
                          />
                          {itemError?.product_id && !rowFamily && (
                            <p className="text-xs text-red-600 mt-1">{itemError.product_id.message}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 align-top min-w-[180px]">
                          <SearchableCombobox
                            value={selectedProdId}
                            onChange={(val) => handleVariantChange(index, val)}
                            options={variantOptions}
                            placeholder={rowFamily ? "Select size / variant..." : "Select product first..."}
                            disabled={!rowFamily}
                            hasError={!!itemError?.product_id && !!rowFamily && !selectedProdId}
                          />
                          {selectedProd && (
                            <span className="text-[11px] text-slate-400 font-medium block mt-1">
                              Std: {Number(selectedProd.bag_weight_kg || 25).toFixed(2)} KG / Bag
                            </span>
                          )}
                          {itemError?.product_id && !!rowFamily && !selectedProdId && (
                            <p className="text-xs text-red-600 mt-1">{itemError.product_id.message}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <input
                            type="number"
                            step="0.1"
                            disabled={!selectedProdId}
                            placeholder="0"
                            value={items[index]?.bags_input ?? ''}
                            onChange={(e) => handleBagsChange(index, e.target.value)}
                            className={inputCls(false)}
                          />
                          <span className="text-[10px] text-slate-400 block mt-1">Bags helper</span>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <input
                            type="number"
                            step="0.01"
                            disabled={!selectedProdId}
                            placeholder="0.00"
                            {...register(`items.${index}.quantity`, {
                              onChange: (e) => {
                                const rawVal = e.target.value;
                                if (rawVal === '') return;
                                const enteredQty = parseFloat(rawVal);
                                if (isNaN(enteredQty)) return;

                                const selectedProdId = items[index]?.product_id || items[index]?.selected_variant_id || '';
                                const selectedProd = products.find(p => p.id === selectedProdId);
                                const available_stock = Number(selectedProd?.total_stock_kg ?? selectedProd?.current_stock ?? 0);

                                if (enteredQty > available_stock) {
                                  toast.warning(`Only ${available_stock} KG available.`);
                                  setValue(`items.${index}.quantity`, available_stock);
                                  const stdWeight = Number(selectedProd?.bag_weight_kg || 25);
                                  if (stdWeight > 0) {
                                    setValue(`items.${index}.bags_input`, Number((available_stock / stdWeight).toFixed(2)));
                                  }
                                  return;
                                }

                                const stdWeight = Number(selectedProd?.bag_weight_kg || 25);
                                if (stdWeight > 0) {
                                  setValue(`items.${index}.bags_input`, Number((enteredQty / stdWeight).toFixed(2)));
                                }
                              },
                            })}
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
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition cursor-pointer"
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
                  onClick={() => append({ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0 })}
                  className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-700"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Line Item
                </button>
              </div>
            </div>
            {errors.items?.root && <p className="text-sm text-red-600">{errors.items.root.message}</p>}

            {walletBalance > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between text-amber-900">
                  <span className="text-sm font-bold flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-amber-600" />
                    Customer Advance Wallet Available
                  </span>
                  <span className="text-sm font-black font-mono text-amber-700">
                    {formatCurrency(walletBalance)}
                  </span>
                </div>
                <p className="text-xs text-amber-700">
                  Customer has <strong>{formatCurrency(walletBalance)}</strong> available in their unallocated Advance Wallet.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-amber-200/60">
                  <label className="flex items-center gap-2.5 text-xs font-bold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyAdvance}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setApplyAdvance(checked);
                        if (checked) {
                          const maxApplicable = Math.min(total, walletBalance);
                          setAdvanceAppliedAmount(maxApplicable.toString());
                        } else {
                          setAdvanceAppliedAmount('0');
                        }
                      }}
                      className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    Apply Advance to this Invoice
                  </label>

                  {applyAdvance && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-800 font-semibold">Applied Amount:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={Math.min(total, walletBalance)}
                        value={advanceAppliedAmount}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          const capped = Math.min(val, walletBalance);
                          setAdvanceAppliedAmount(capped.toString());
                        }}
                        className="w-32 rounded-lg border border-amber-300 px-2.5 py-1 text-sm font-mono font-bold text-amber-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

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


