import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2, Wallet } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { purchasesService } from '../../services/purchases.service';
import { getSuppliers } from '../../services/suppliers.service';
import { productsService } from '../../services/products.service';
import { SearchableCombobox, ComboboxOption } from '../../components/SearchableCombobox';

const itemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  selected_family_name: z.string().min(1, 'Product is required'),
  selected_variant_id: z.string().min(1, 'Size / Variant is compulsory'),
  bags_input: z.union([z.string(), z.number()]).optional(),
  quantity: z.coerce.number().min(0.0001, 'Min quantity 0.0001'),
  unit_price: z.coerce.number().min(0, 'Min price 0'),
  total: z.union([z.string(), z.number()]).optional(),
  total_price: z.union([z.string(), z.number()]).optional(),
  actual_weight_per_unit: z.coerce.number().min(0).optional().nullable(),
  actual_kanta_wt: z.coerce.number().min(0).optional().nullable(),
  actual_weight_kg: z.coerce.number().min(0).optional().nullable(),
});

const schema = z.object({
  supplier_id: z.string().min(1, 'Party is required'),
  date: z.string(),
  due_date: z.string().optional().or(z.literal('')),
  discount: z.coerce.number().min(0).default(0),
  delivery_charges: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  initialProductId?: string;
}

export default function PurchaseFormModal({ onClose, onSuccess, initialProductId }: Props) {
  const qc = useQueryClient();
  const [applyAdvance, setApplyAdvance] = useState(false);
  const [advanceAppliedAmount, setAdvanceAppliedAmount] = useState('0');

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
      due_date: '',
      discount: 0,
      delivery_charges: 0,
      notes: '',
      items: [{ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0, total: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');
  const watchDiscount = watch('discount');
  const watchDeliveryCharges = watch('delivery_charges');
  const selectedSupplierId = watch('supplier_id');

  const selectedSupplier = suppliers.find((s: any) => s.id === selectedSupplierId);
  const walletBalance = Number((selectedSupplier as any)?.advance_payable || (selectedSupplier as any)?.advance_wallet || 0);

  // Check if any row has missing product or empty size/variant
  const hasAnyEmptySize = !watchItems || watchItems.length === 0 || watchItems.some((item) => {
    const prodId = item.product_id || item.selected_variant_id;
    if (!prodId) return true;
    const prod = products.find(p => p.id === prodId);
    return !prod || !prod.size || prod.size.trim() === '';
  });

  // Prefill when initialProductId is passed (e.g. from Low Stock alert "Order Stock" action)
  useEffect(() => {
    if (initialProductId && products.length > 0) {
      const p = products.find(prod => prod.id === initialProductId);
      if (p) {
        const stdWeight = Number(p.bag_weight_kg || 25);
        const costPrice = Number(p.cost_price || 0);
        setValue('items', [{
          product_id: p.id,
          selected_family_name: p.name,
          selected_variant_id: p.id,
          bags_input: 1,
          quantity: stdWeight,
          unit_price: costPrice,
          total: Math.round(stdWeight * costPrice * 100) / 100,
          total_price: Math.round(stdWeight * costPrice * 100) / 100,
        }]);
      }
    }
  }, [initialProductId, products, setValue]);

  // Phase 2: Explicitly rounded line-item totals summation
  const subtotal = Math.round(
    (watchItems || []).reduce((sum, item) => {
      const itemTotal = item.total !== undefined && item.total !== null && item.total !== ''
        ? Number(item.total)
        : Math.round((Number(item.quantity || 0) * Number(item.unit_price || 0)) * 100) / 100;
      return sum + (Number(itemTotal) || 0);
    }, 0) * 100
  ) / 100;

  const discountNum = Math.round((Number(watchDiscount) || 0) * 100) / 100;
  const deliveryChargesNum = Math.round((Number(watchDeliveryCharges) || 0) * 100) / 100;
  const total = Math.max(0, Math.round((subtotal - discountNum) * 100) / 100);

  const totalKg = Math.round(
    (watchItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) * 100
  ) / 100;
  const dcPerKg = totalKg > 0 ? Math.round((deliveryChargesNum / totalKg) * 100) / 100 : 0;
  const grandTotalWithDc = Math.round((total + deliveryChargesNum) * 100) / 100;

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
    const variants = groupedProducts[familyName] || [];
    if (variants.length === 1) {
      const singleVariant = variants[0];
      setValue(`items.${index}.selected_variant_id`, singleVariant.id);
      setValue(`items.${index}.product_id`, singleVariant.id);
      handleProductChange(index, singleVariant.id);
    } else {
      setValue(`items.${index}.selected_variant_id`, '');
      setValue(`items.${index}.product_id`, '');
      setValue(`items.${index}.unit_price`, 0);
      setValue(`items.${index}.total`, 0);
      setValue(`items.${index}.total_price`, 0);
    }
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
      const unitPrice = Number(product.cost_price || 0);
      setValue(`items.${index}.unit_price`, unitPrice);
      
      const currentBags = watchItems[index]?.bags_input;
      let qty = stdWeight;
      if (currentBags !== undefined && currentBags !== '' && Number(currentBags) > 0) {
        qty = Number((Number(currentBags) * stdWeight).toFixed(2));
      } else {
        setValue(`items.${index}.bags_input`, 1);
      }
      setValue(`items.${index}.quantity`, qty);
      const lineTotal = Math.round(qty * unitPrice * 100) / 100;
      setValue(`items.${index}.total`, lineTotal);
      setValue(`items.${index}.total_price`, lineTotal);
    }
  };

  const handleBagsChange = (index: number, val: string) => {
    setValue(`items.${index}.bags_input`, val);
    const numBags = Number(val) || 0;
    const selectedProdId = watchItems[index]?.product_id;
    const selectedProd = products.find(p => p.id === selectedProdId);
    const stdWeight = selectedProd && selectedProd.bag_weight_kg ? Number(selectedProd.bag_weight_kg) : 25;
    
    if (numBags > 0) {
      const newQty = Number((numBags * stdWeight).toFixed(2));
      setValue(`items.${index}.quantity`, newQty);
      const unitPrice = Number(watchItems[index]?.unit_price || 0);
      const newTotal = Math.round(newQty * unitPrice * 100) / 100;
      setValue(`items.${index}.total`, newTotal);
      setValue(`items.${index}.total_price`, newTotal);
    }
  };

  // Phase 1: Bidirectional handlers
  const handleQuantityChange = (index: number, val: string) => {
    setValue(`items.${index}.quantity`, val as any);
    const newQty = parseFloat(val);
    if (!isNaN(newQty)) {
      const unitPrice = Number(watchItems[index]?.unit_price || 0);
      const newTotal = Math.round(newQty * unitPrice * 100) / 100;
      setValue(`items.${index}.total`, newTotal);
      setValue(`items.${index}.total_price`, newTotal);

      // Helper sync for bags count if valid standard bag weight exists
      const selectedProdId = watchItems[index]?.product_id || watchItems[index]?.selected_variant_id || '';
      const selectedProd = products.find(p => p.id === selectedProdId);
      const stdWeight = selectedProd && selectedProd.bag_weight_kg ? Number(selectedProd.bag_weight_kg) : 25;
      if (stdWeight > 0) {
        setValue(`items.${index}.bags_input`, Number((newQty / stdWeight).toFixed(2)));
      }
    }
  };

  const handleUnitPriceChange = (index: number, val: string) => {
    setValue(`items.${index}.unit_price`, val as any);
    const newUnitPrice = parseFloat(val);
    if (!isNaN(newUnitPrice)) {
      const qty = Number(watchItems[index]?.quantity || 0);
      const newTotal = Math.round(qty * newUnitPrice * 100) / 100;
      setValue(`items.${index}.total`, newTotal);
      setValue(`items.${index}.total_price`, newTotal);
    }
  };

  const handleTotalChange = (index: number, val: string) => {
    setValue(`items.${index}.total`, val as any);
    setValue(`items.${index}.total_price`, val as any);
    const newTotal = parseFloat(val);
    if (!isNaN(newTotal)) {
      const qty = Number(watchItems[index]?.quantity || 0);
      const newUnitPrice = qty > 0 ? Math.round((newTotal / qty) * 100) / 100 : 0;
      setValue(`items.${index}.unit_price`, newUnitPrice);
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => purchasesService.createInvoice(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['liquidityLedger'] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error.message || 'Failed to save purchase invoice');
    }
  });

  const onSubmit = (data: FormData) => {
    const cleanItems = data.items.map(({ bags_input, selected_family_name, selected_variant_id, ...rest }) => {
      const qty = Number(rest.quantity || 0);
      const unitPrice = Math.round(Number(rest.unit_price || 0) * 100) / 100;
      const itemTotal = rest.total !== undefined && rest.total !== null && rest.total !== ''
        ? Math.round(Number(rest.total) * 100) / 100
        : Math.round(qty * unitPrice * 100) / 100;

      const prod = products.find(p => p.id === rest.product_id);
      const resolvedSize = (prod?.size || 'Standard').trim();

      return {
        ...rest,
        size: resolvedSize,
        quantity: qty,
        unit_price: unitPrice,
        total: itemTotal,
        total_price: itemTotal,
      };
    });

    mutation.mutate({
      ...data,
      due_date: data.due_date ? data.due_date : undefined,
      discount: Math.round(Number(data.discount || 0) * 100) / 100,
      delivery_charges: deliveryChargesNum,
      advance_applied_amount: applyAdvance ? Math.round(Number(advanceAppliedAmount || 0) * 100) / 100 : 0,
      items: cleanItems,
    } as any);
  };

  const inputCls = (err?: boolean) =>
    `w-full rounded-lg border ${
      err
        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
        : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
    } py-2 px-3 text-sm outline-none transition bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Purchasing</h2>
            <p className="text-sm text-slate-500 mt-0.5">Record incoming inventory (Strict KG Wholesale Model)</p>
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

            <div className="border border-slate-200 rounded-xl overflow-visible shadow-sm">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center rounded-t-xl">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-800 text-sm">Line Items (Strict KG Wholesale Model)</h3>
                  {hasAnyEmptySize && (
                    <span className="text-xs text-amber-600 font-medium">
                      * Select product & size/variant for all rows to add more or save
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={hasAnyEmptySize}
                  onClick={() => append({ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0 })}
                  className={`text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-colors ${
                    hasAnyEmptySize
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                      : 'text-emerald-600 hover:text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                  }`}
                  title={hasAnyEmptySize ? "Please select a size/variant for all items before adding another row" : "Add Row"}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Row
                </button>
              </div>
              
              {errors.items?.root && <p className="text-sm text-red-600 p-3">{errors.items.root.message}</p>}
              
              <div className="overflow-visible">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-[26%]">Product</th>
                      <th className="px-4 py-3 w-[24%]">Size / Variant</th>
                      <th className="px-4 py-3 w-24 min-w-[75px] text-center">Bags (Opt.)</th>
                      <th className="px-4 py-3 w-28">QTY (KG)</th>
                      <th className="px-4 py-3 w-32">PRICE / KG</th>
                      <th className="px-4 py-3 w-36">TOTAL (PKR)</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {fields.map((field, index) => {
                      const itemError = errors.items?.[index];
                      const selectedProdId = watchItems[index]?.product_id || watchItems[index]?.selected_variant_id || '';
                      const selectedProd = products.find(p => p.id === selectedProdId);

                      const rowFamily = watchItems[index]?.selected_family_name || (
                        selectedProd ? selectedProd.name : ''
                      ) || '';

                      const variantList = rowFamily ? (groupedProducts[rowFamily] || []) : [];
                      const variantOptions: ComboboxOption[] = variantList.map((p) => ({
                        value: p.id,
                        label: p.size ? `${p.size} (${p.code})` : `${p.name} (${p.code})`,
                        badge: p.code,
                        subLabel: `Std: ${Number(p.bag_weight_kg || 25).toFixed(2)} KG/bag`,
                      }));

                      const qty = Number(watchItems[index]?.quantity) || 0;
                      const price = Number(watchItems[index]?.unit_price) || 0;
                      const currentLineTotal = watchItems[index]?.total !== undefined && watchItems[index]?.total !== null && watchItems[index]?.total !== ''
                        ? watchItems[index]?.total
                        : (qty && price ? Math.round(qty * price * 100) / 100 : '');
                      
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

                          <td className="px-4 py-3 align-top w-24 min-w-[75px]">
                            <input
                              type="number"
                              step="0.1"
                              disabled={!selectedProdId}
                              placeholder="0"
                              value={watchItems[index]?.bags_input ?? ''}
                              onChange={(e) => handleBagsChange(index, e.target.value)}
                              className="w-full py-2 px-3 text-sm border border-slate-300 rounded-lg text-slate-900 text-center font-medium bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition"
                            />
                            <span className="text-[10px] text-slate-400 block mt-1 text-center">Bags helper</span>
                          </td>

                          <td className="px-4 py-3 align-top min-w-[120px]">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!selectedProdId}
                              placeholder="0.00"
                              value={watchItems[index]?.quantity ?? ''}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                              className={inputCls(!!itemError?.quantity)}
                            />
                            {itemError?.quantity && <p className="text-xs text-red-600 mt-1">{itemError.quantity.message}</p>}
                          </td>

                          <td className="px-4 py-3 align-top min-w-[120px]">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!selectedProdId}
                              placeholder="0.00"
                              value={watchItems[index]?.unit_price ?? ''}
                              onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                              className={inputCls(!!itemError?.unit_price)}
                            />
                            {itemError?.unit_price && <p className="text-xs text-red-600 mt-1">{itemError.unit_price.message}</p>}
                          </td>

                          <td className="px-4 py-3 align-top min-w-[130px]">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!selectedProdId}
                              placeholder="0.00"
                              value={currentLineTotal}
                              onChange={(e) => handleTotalChange(index, e.target.value)}
                              className={`${inputCls(false)} font-mono font-bold text-slate-900 bg-emerald-50/20 focus:bg-white`}
                            />
                            <span className="text-[10px] text-slate-400 block mt-1">Lump sum total</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
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

            {walletBalance > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3 shadow-2xs mt-4">
                <div className="flex items-center justify-between text-emerald-900">
                  <span className="text-sm font-bold flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                    Supplier Advance Wallet Available
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-700">
                    Rs. {walletBalance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-emerald-700">
                  Supplier has <strong>Rs. {walletBalance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</strong> available in prepaid Advance Wallet.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-emerald-200/60">
                  <label className="flex items-center gap-2.5 text-xs font-bold text-emerald-900 cursor-pointer">
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
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    Apply Advance to this Purchase
                  </label>

                  {applyAdvance && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-800 font-semibold">Applied Amount:</span>
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
                        className="w-32 rounded-lg border border-emerald-300 px-2.5 py-1 text-sm font-mono font-bold text-emerald-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

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

                <div className="flex justify-between items-center text-sm">
                  <div>
                    <span className="text-slate-700 font-medium block">Delivery Charges (DC)</span>
                    <span className="text-[11px] text-amber-600 font-medium block">Expense only • Excluded from party ledger</span>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register('delivery_charges')}
                      className={inputCls(!!errors.delivery_charges)}
                    />
                  </div>
                </div>

                {deliveryChargesNum > 0 && totalKg > 0 && (
                  <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-amber-700">Total Purchase Weight:</span>
                      <span className="font-mono font-bold">{totalKg.toLocaleString()} KG</span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-800">
                      <span>DC Added per KG:</span>
                      <span className="font-mono text-emerald-700">+ Rs. {dcPerKg.toFixed(2)} / KG</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">Party Payable (Ledger)</span>
                    <span className="text-[11px] text-slate-400">Recorded to {selectedSupplier?.name || 'Party'}</span>
                  </div>
                  <span className="text-base font-bold font-mono text-slate-900">Rs. {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                </div>

                {deliveryChargesNum > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-sm font-bold text-emerald-900 block">Grand Total (Goods + DC)</span>
                      <span className="text-[11px] text-emerald-600">Total cost of this shipment</span>
                    </div>
                    <span className="text-xl font-black font-mono text-emerald-600">Rs. {grandTotalWithDc.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
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
            disabled={mutation.isPending || hasAnyEmptySize}
            className="px-5 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center cursor-pointer"
            title={hasAnyEmptySize ? "All line items must have a size/variant selected" : undefined}
          >
            {mutation.isPending ? 'Saving...' : 'Save Purchase'}
          </button>
        </div>

      </div>
    </div>
  );
}
