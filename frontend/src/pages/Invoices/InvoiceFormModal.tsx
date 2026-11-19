import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2, Layers, Wallet, AlertCircle, RefreshCw, Printer, PauseCircle, Clock, Banknote, CheckCircle2, Split } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesService } from '../../services/invoices.service';
import { getCustomers } from '../../services/customers.service';
import { productsService } from '../../services/products.service';
import { bankAccountsService } from '../../services/bank-accounts.service';
import { posService, POSHeldOrder } from '../../services/pos.service';
import { SearchableCombobox, ComboboxOption } from '../../components/SearchableCombobox';
import { toast, handleApiError } from '../../utils/toast';
import { A4SalesInvoice } from '../../components/print/A4SalesInvoice';
import { HeldInvoicesModal } from './HeldInvoicesModal';
import { DateInput } from '../../components/DateInput';
import { compareProducts, formatProductTitle } from '../../utils/productSorting';

const itemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  selected_family_name: z.string().min(1, 'Product is required'),
  selected_variant_id: z.string().min(1, 'Size / Variant is compulsory'),
  bags_input: z.union([z.string(), z.number()]).optional(),
  quantity: z.coerce.number().min(0.01, 'Quantity (KG) must be greater than 0'),
  unit_price: z.coerce.number().min(0, 'Price / KG cannot be negative'),
  total: z.union([z.string(), z.number()]).optional(),
  total_price: z.union([z.string(), z.number()]).optional(),
});

const schema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  date: z.string(),
  due_date: z.string().optional().or(z.literal('')),
  discount: z.coerce.number().min(0).default(0),
  delivery_charge: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  transport: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

type FormData = z.infer<typeof schema>;

interface SplitPaymentRow {
  payment_account_id: string;
  amount: number | '';
}

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialHeldData?: any;
}

export const InvoiceFormModal = ({ isOpen = true, onClose, onSuccess, initialHeldData }: Props) => {
  const qc = useQueryClient();
  const [applyAdvance, setApplyAdvance] = useState(false);
  const [advanceAppliedAmount, setAdvanceAppliedAmount] = useState('0');
  const [paymentAccountId, setPaymentAccountId] = useState<string>('CASH_DRAWER');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitPaymentRow[]>([
    { payment_account_id: 'CASH_DRAWER', amount: '' },
    { payment_account_id: '', amount: '' },
  ]);

  const { data: customersResponse } = useQuery({ queryKey: ['customers'], queryFn: () => getCustomers({ limit: 100 }) });
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsService.getBankAccounts(),
  });
  const {
    data: productsResponse,
    isLoading: isLoadingProducts,
    isError: isProductsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsService.getProducts(),
    staleTime: 5000,
  });

  const products = productsResponse || [];

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: '',
      date: new Date().toISOString().split('T')[0],
      due_date: '',
      discount: 0,
      delivery_charge: 0,
      notes: '',
      transport: '',
      items: [{ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0, total: 0 }],
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
  const isCashCustomer = selectedCustomer?.customer_type === 'CASH';
  const isCreditCustomer = Boolean(selectedCustomer && !isCashCustomer);
  const walletBalance = Number(selectedCustomer?.advance_credit || (selectedCustomer as any)?.advance_wallet || 0);

  useEffect(() => {
    if (isCashCustomer) {
      setValue('transport', '');
    }
  }, [isCashCustomer, setValue]);

  // Check if any row has missing product or empty size/variant
  const hasAnyEmptySize = !items || items.length === 0 || items.some((item) => {
    const prodId = item.product_id || item.selected_variant_id;
    if (!prodId) return true;
    const prod = products.find(p => p.id === prodId);
    return !prod || !prod.size || prod.size.trim() === '';
  });

  // Phase 2: Explicitly rounded line-item totals summation
  const subtotal = Math.round(
    (items || []).reduce((acc, item) => {
      const itemTotal = item.total !== undefined && item.total !== null && item.total !== ''
        ? Number(item.total)
        : Math.round((Number(item.quantity || 0) * Number(item.unit_price || 0)) * 100) / 100;
      return acc + (Number(itemTotal) || 0);
    }, 0) * 100
  ) / 100;

  const deliveryChargeNum = Math.round(Number(delivery_charge || 0) * 100) / 100;
  const discountNum = Math.round(Number(discount || 0) * 100) / 100;
  const total = Math.max(0, Math.round((subtotal - discountNum) * 100) / 100) + deliveryChargeNum;

  const splitTotalAllocated = Math.round(
    splitRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) * 100
  ) / 100;
  const splitDiff = Math.round((total - splitTotalAllocated) * 100) / 100;
  const hasInvalidSplitRow = splitRows.some(
    (r) => !r.payment_account_id || r.amount === '' || Number(r.amount) <= 0
  );
  const isSplitBalanced = isCashCustomer && isSplitPayment
    ? Math.abs(splitDiff) <= 0.01 && !hasInvalidSplitRow
    : true;

  const toggleSplitMode = () => {
    setIsSplitPayment((prev) => {
      const next = !prev;
      if (next) {
        const half = Math.round((total / 2) * 100) / 100;
        const remainder = Math.round((total - half) * 100) / 100;
        const secondBank = bankAccounts.find((b: any) => b.is_active && b.id !== paymentAccountId)?.id || bankAccounts[0]?.id || '';
        setSplitRows([
          { payment_account_id: paymentAccountId || 'CASH_DRAWER', amount: half > 0 ? half : '' },
          { payment_account_id: secondBank, amount: remainder > 0 ? remainder : '' },
        ]);
      }
      return next;
    });
  };

  const handleSplitRowChange = (index: number, field: 'payment_account_id' | 'amount', value: any) => {
    setSplitRows((prev) => {
      const updated = prev.map((row, i) => {
        if (i !== index) return row;
        return { ...row, [field]: value };
      });

      // Auto-fill second row remaining amount when editing row 0 in a 2-row setup
      if (field === 'amount' && index === 0 && updated.length === 2) {
        const row0Amt = value === '' ? 0 : Number(value);
        if (!isNaN(row0Amt)) {
          const remaining = Math.max(0, Math.round((total - row0Amt) * 100) / 100);
          updated[1] = {
            ...updated[1],
            amount: value === '' ? '' : (remaining > 0 ? remaining : 0),
          };
        }
      }

      return updated;
    });
  };

  const addSplitRow = () => {
    const existingIds = new Set(splitRows.map((r) => r.payment_account_id));
    const nextUnusedBank = bankAccounts.find((b: any) => b.is_active && !existingIds.has(b.id))?.id || bankAccounts[0]?.id || 'CASH_DRAWER';
    const currentSum = Math.round(splitRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) * 100) / 100;
    const remaining = Math.max(0, Math.round((total - currentSum) * 100) / 100);

    setSplitRows((prev) => [
      ...prev,
      { payment_account_id: nextUnusedBank, amount: remaining > 0 ? remaining : '' },
    ]);
  };

  const removeSplitRow = (index: number) => {
    if (splitRows.length <= 2) return;
    setSplitRows((prev) => prev.filter((_, i) => i !== index));
  };

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
    Object.keys(groups).forEach((key) => {
      groups[key].sort(compareProducts);
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
      const unitPrice = Number(product.sale_price || 0);
      setValue(`items.${index}.unit_price`, unitPrice);
      
      const currentBags = items[index]?.bags_input;
      let requestedKg = stdWeight;
      if (currentBags !== undefined && currentBags !== '' && Number(currentBags) > 0) {
        requestedKg = Number((Number(currentBags) * stdWeight).toFixed(2));
      }

      setValue(`items.${index}.bags_input`, currentBags !== undefined && currentBags !== '' ? currentBags : 1);
      setValue(`items.${index}.quantity`, requestedKg);
      const lineTotal = Math.round(requestedKg * unitPrice * 100) / 100;
      setValue(`items.${index}.total`, lineTotal);
      setValue(`items.${index}.total_price`, lineTotal);
    }
  };

  const handleBagsChange = (index: number, val: string) => {
    setValue(`items.${index}.bags_input`, val);
    const numBags = Number(val) || 0;
    const selectedProdId = items[index]?.product_id || items[index]?.selected_variant_id || '';
    const selectedProd = products.find(p => p.id === selectedProdId);
    const stdWeight = selectedProd && selectedProd.bag_weight_kg ? Number(selectedProd.bag_weight_kg) : 25;
    const unitPrice = Number(items[index]?.unit_price || 0);
    
    if (numBags > 0) {
      const requestedKg = Number((numBags * stdWeight).toFixed(2));
      setValue(`items.${index}.quantity`, requestedKg);
      const lineTotal = Math.round(requestedKg * unitPrice * 100) / 100;
      setValue(`items.${index}.total`, lineTotal);
      setValue(`items.${index}.total_price`, lineTotal);
    }
  };

  // Phase 1: Bidirectional handlers
  const handleQuantityChange = (index: number, val: string) => {
    setValue(`items.${index}.quantity`, val as any);
    const enteredQty = parseFloat(val);
    if (!isNaN(enteredQty)) {
      const selectedProdId = items[index]?.product_id || items[index]?.selected_variant_id || '';
      const selectedProd = products.find(p => p.id === selectedProdId);
      const unitPrice = Number(items[index]?.unit_price || 0);
      const stdWeight = Number(selectedProd?.bag_weight_kg || 25);

      if (stdWeight > 0) {
        setValue(`items.${index}.bags_input`, Number((enteredQty / stdWeight).toFixed(2)));
      }

      // Keep unit_price locked, recalculate total
      const newTotal = Math.round(enteredQty * unitPrice * 100) / 100;
      setValue(`items.${index}.total`, newTotal);
      setValue(`items.${index}.total_price`, newTotal);
    }
  };

  const handleUnitPriceChange = (index: number, val: string) => {
    setValue(`items.${index}.unit_price`, val as any);
    const newUnitPrice = parseFloat(val);
    if (!isNaN(newUnitPrice)) {
      const qty = Number(items[index]?.quantity || 0);
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
      const qty = Number(items[index]?.quantity || 0);
      const newUnitPrice = qty > 0 ? Math.round((newTotal / qty) * 100) / 100 : 0;
      setValue(`items.${index}.unit_price`, newUnitPrice);
    }
  };

  const customerOptions: ComboboxOption[] = useMemo(() => {
    return (customersResponse?.data || []).map((c) => ({
      value: c.id,
      label: `${c.name}${c.city ? ` (${c.city})` : ''}`,
      badge: c.customer_type === 'CASH' ? 'CASH' : (c.code || undefined),
      subLabel: [
        c.customer_type === 'CASH' ? '💵 Cash Customer' : '📋 Credit Customer',
        c.phone,
        c.address
      ].filter(Boolean).join(' • ') || undefined,
    }));
  }, [customersResponse?.data]);

  const focusField = (id: string) => {
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLElement;
      if (el) {
        el.focus();
        if ('select' in el && typeof (el as any).select === 'function') {
          (el as any).select();
        }
      }
    }, 40);
  };

  const handleRowKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    fieldName: 'bags' | 'quantity' | 'unit-price' | 'total'
  ) => {
    // Row deletion shortcut: Alt+Delete or Ctrl+Backspace
    if ((e.altKey && e.key === 'Delete') || (e.ctrlKey && e.key === 'Backspace')) {
      e.preventDefault();
      if (fields.length > 1) {
        remove(index);
        const prevIdx = Math.max(0, index - 1);
        focusField(`item-${prevIdx}-family`);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      if (fieldName === 'bags') {
        focusField(`item-${index}-quantity`);
      } else if (fieldName === 'quantity') {
        focusField(`item-${index}-unit-price`);
      } else if (fieldName === 'unit-price' || fieldName === 'total') {
        if (e.shiftKey) {
          focusField('invoice-discount');
          return;
        }
        const currentItem = items[index];
        const isCurrentRowFilled = !!(currentItem?.product_id || currentItem?.selected_variant_id) && Number(currentItem?.quantity || 0) > 0;

        if (index === fields.length - 1) {
          if (isCurrentRowFilled) {
            append({
              product_id: '',
              selected_family_name: '',
              selected_variant_id: '',
              bags_input: 1,
              quantity: 25,
              unit_price: 0,
            });
            focusField(`item-${index + 1}-family`);
          } else {
            focusField('invoice-discount');
          }
        } else {
          focusField(`item-${index + 1}-family`);
        }
      }
    }
  };

  const [printCopyMode, setPrintCopyMode] = useState<'ORIGINAL' | 'DUPLICATE' | 'BOTH'>('ORIGINAL');
  const [printInvoiceData, setPrintInvoiceData] = useState<any>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);

  // Query Held Orders
  const { data: allHeldOrders = [], isLoading: isLoadingHeldOrders } = useQuery({
    queryKey: ['posHeldOrders'],
    queryFn: () => posService.getHeldOrders(),
  });

  const erpHeldOrders = useMemo(() => {
    return allHeldOrders.filter((o) =>
      o.reference_note?.startsWith('[ERP]') ||
      (o.items && o.items.some((i: any) => i.selected_family_name || i.selected_variant_id))
    );
  }, [allHeldOrders]);

  const deleteHeldOrderMutation = useMutation({
    mutationFn: (id: string) => posService.deleteHeldOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posHeldOrders'] });
      toast.success('Held invoice removed.');
    },
  });

  const resumeHeldInvoice = (order: POSHeldOrder) => {
    const parsedItems = (order.items || []).map((it: any) => ({
      product_id: it.product_id || '',
      selected_family_name: it.selected_family_name || it.productName || it.name || '',
      selected_variant_id: it.selected_variant_id || it.product_id || '',
      bags_input: it.bags_input ?? 1,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      total: Number(it.total) || 0,
      total_price: Number(it.total_price || it.total) || 0,
    }));

    reset({
      customer_id: order.customer_id || '',
      date: (order as any).date || new Date().toISOString().split('T')[0],
      due_date: (order as any).due_date || '',
      discount: Number(order.discount) || 0,
      delivery_charge: Number((order as any).delivery_charge) || 0,
      notes: (order as any).notes || '',
      transport: (order as any).transport || '',
      items: parsedItems.length > 0 ? parsedItems : [{ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0, total: 0 }],
    });

    if ((order as any).payment_splits && Array.isArray((order as any).payment_splits) && (order as any).payment_splits.length > 0) {
      setIsSplitPayment(true);
      setSplitRows((order as any).payment_splits);
    } else {
      setIsSplitPayment(false);
      if ((order as any).payment_account_id) {
        setPaymentAccountId((order as any).payment_account_id);
      } else {
        setPaymentAccountId('CASH_DRAWER');
      }
    }

    deleteHeldOrderMutation.mutate(order.id);
    setIsHeldModalOpen(false);
    toast.info(`Held invoice for ${order.customer_name || 'Customer'} resumed!`);
  };

  const handleHoldInvoice = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer before holding the invoice.');
      return;
    }
    const validItems = (items || []).filter(i => i.product_id);
    if (validItems.length === 0) {
      toast.error('Please add at least one product before holding the invoice.');
      return;
    }

    try {
      setIsHolding(true);
      const cust = customersResponse?.data.find((c: any) => c.id === selectedCustomerId);
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const refNote = `[ERP] Sale - ${cust?.name || 'Customer'} (${timeStr})`;

      const heldPayload = {
        reference_note: refNote,
        customer_id: selectedCustomerId,
        customer_name: cust?.name || 'Customer',
        items: (items || []).map(i => {
          const prod = products.find(p => p.id === i.product_id);
          return {
            product_id: i.product_id,
            selected_family_name: i.selected_family_name,
            selected_variant_id: i.selected_variant_id,
            bags_input: i.bags_input,
            quantity: Number(i.quantity) || 0,
            unit_price: Number(i.unit_price) || 0,
            total: Number(i.total) || (Number(i.quantity || 0) * Number(i.unit_price || 0)),
            total_price: Number(i.total) || (Number(i.quantity || 0) * Number(i.unit_price || 0)),
            productName: prod ? (prod.size ? `${prod.name} - ${prod.size}` : prod.name) : 'Product',
            size: prod?.size || '',
          };
        }),
        subtotal: subtotal,
        discount: Number(discount) || 0,
        delivery_charge: Number(delivery_charge) || 0,
        total_amount: total,
        payment_method: isCashCustomer ? (isSplitPayment ? 'SPLIT' : (paymentAccountId === 'CASH_DRAWER' ? 'CASH' : 'BANK_TRANSFER')) : 'CREDIT',
        payment_account_id: isCashCustomer ? (isSplitPayment ? splitRows[0]?.payment_account_id : paymentAccountId) : undefined,
        payment_splits: isCashCustomer && isSplitPayment ? splitRows.map((r) => ({ payment_account_id: r.payment_account_id, amount: Number(r.amount) || 0 })) : undefined,
        notes: watch('notes') || '',
        due_date: watch('due_date') || '',
        date: watch('date') || new Date().toISOString().split('T')[0],
      };

      await posService.createHeldOrder(heldPayload);
      qc.invalidateQueries({ queryKey: ['posHeldOrders'] });
      toast.success('Invoice put on hold successfully!');
      onClose();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setIsHolding(false);
    }
  };

  const triggerA4Print = (createdInvoice: any) => {
    const selectedCust = customersResponse?.data.find((c: any) => c.id === selectedCustomerId);
    const enrichedItems = (createdInvoice.items || []).map((item: any) => {
      const prod = products.find(p => p.id === item.product_id);
      return {
        ...item,
        product_name: item.product_name || prod?.name || item.name || 'Product',
        product_name_urdu: item.product_name_urdu || prod?.name_urdu,
        product_code: item.product_code || prod?.code,
        size: item.size || prod?.size || '',
        category: item.category || prod?.category_name || prod?.category,
      };
    });

    const invoiceToPrint = {
      ...createdInvoice,
      customer_name: createdInvoice.customer_name || selectedCust?.name || 'Customer',
      customer_code: createdInvoice.customer_code || selectedCust?.code,
      customer_phone: createdInvoice.customer_phone || selectedCust?.phone,
      customer_city: createdInvoice.customer_city || selectedCust?.city,
      transport: createdInvoice.transport ?? (isCashCustomer ? null : (watch('transport')?.trim() || null)),
      items: enrichedItems.length > 0 ? enrichedItems : createdInvoice.items,
      type: 'sales',
    };

    const wasDark = document.documentElement.classList.contains('dark');
    if (wasDark) {
      document.documentElement.classList.remove('dark');
    }

    setPrintInvoiceData(invoiceToPrint);
    document.body.classList.add('printing-a4');

    const handleAfterPrint = () => {
      document.body.classList.remove('printing-a4');
      if (wasDark) {
        document.documentElement.classList.add('dark');
      }
      setPrintInvoiceData(null);
      window.removeEventListener('afterprint', handleAfterPrint);
      onSuccess();
      onClose();
    };

    window.addEventListener('afterprint', handleAfterPrint);

    setTimeout(() => {
      window.print();
    }, 250);
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => invoicesService.createInvoice(data as any),
    onSuccess: (createdInvoice: any) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['pnlReport'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['liquidityLedger'] });
      toast.success('Sales invoice created and saved successfully!');
      triggerA4Print(createdInvoice);
    },
    onError: (error: any) => {
      handleApiError(error);
    }
  });

  useEffect(() => {
    if (isOpen) {
      refetchProducts();
      if (initialHeldData) {
        resumeHeldInvoice(initialHeldData);
      } else {
        reset({
          customer_id: '',
          date: new Date().toISOString().split('T')[0],
          due_date: '',
          discount: 0,
          delivery_charge: 0,
          notes: '',
          transport: '',
          items: [{ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0, total: 0 }],
        });
        setApplyAdvance(false);
        setAdvanceAppliedAmount('0');
        setPaymentAccountId('CASH_DRAWER');
        setIsSplitPayment(false);
        setSplitRows([
          { payment_account_id: 'CASH_DRAWER', amount: '' },
          { payment_account_id: '', amount: '' },
        ]);
      }
      focusField('customer-combobox');
    }
  }, [isOpen, initialHeldData]);

  // Global Keyboard Shortcuts for Invoice Creation
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or F9 -> Save and Print Invoice
      if ((e.ctrlKey && e.key === 'Enter' && !e.shiftKey) || e.key === 'F9') {
        e.preventDefault();
        const canSubmit = !mutation.isPending && !isHolding && !hasAnyEmptySize && !(isCashCustomer && isSplitPayment && !isSplitBalanced);
        if (canSubmit) {
          handleSubmit(onSubmit)();
        }
      }
      // Alt+H or Ctrl+Shift+Enter -> Hold Invoice
      else if ((e.altKey && (e.key === 'h' || e.key === 'H')) || (e.ctrlKey && e.shiftKey && e.key === 'Enter')) {
        e.preventDefault();
        if (!mutation.isPending && !isHolding) {
          handleHoldInvoice();
        }
      }
      // Alt+P -> Toggle Print mode: ORIGINAL -> DUPLICATE -> BOTH
      else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setPrintCopyMode((prev) => (prev === 'ORIGINAL' ? 'DUPLICATE' : prev === 'DUPLICATE' ? 'BOTH' : 'ORIGINAL'));
      }
      // Alt+A or F4 -> Add new line item
      else if ((e.altKey && (e.key === 'a' || e.key === 'A')) || e.key === 'F4') {
        e.preventDefault();
        if (!hasAnyEmptySize) {
          append({ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0 });
          focusField(`item-${fields.length}-family`);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, mutation.isPending, isHolding, hasAnyEmptySize, fields.length, isCashCustomer, isSplitPayment, isSplitBalanced]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isCashCustomer) {
        if (isSplitPayment) {
          if (!isSplitBalanced) {
            toast.error('Split payment total must equal the invoice Grand Total.');
            return;
          }
          if (splitRows.some((r) => !r.payment_account_id || r.amount === '' || Number(r.amount) <= 0)) {
            toast.error('Every split payment row must have an account and amount > 0.');
            return;
          }
        } else {
          if (!paymentAccountId) {
            toast.error('Please select a payment account to settle the cash invoice.');
            return;
          }
        }
      }

      const cleanSplits = isCashCustomer && isSplitPayment
        ? splitRows.map((r) => ({
            payment_account_id: r.payment_account_id,
            amount: Math.round(Number(r.amount) * 100) / 100,
          }))
        : undefined;

      const cleanData = {
        ...data,
        transport: isCashCustomer ? undefined : (data.transport && data.transport.trim() ? data.transport.trim() : undefined),
        due_date: isCashCustomer ? undefined : (data.due_date ? data.due_date : undefined),
        discount: Math.round(Number(data.discount || 0) * 100) / 100,
        delivery_charge: Math.round(Number(data.delivery_charge || 0) * 100) / 100,
        advance_applied_amount: (!isCashCustomer && applyAdvance) ? Math.round(Number(advanceAppliedAmount || 0) * 100) / 100 : 0,
        payment_splits: cleanSplits,
        payment_account_id: isCashCustomer ? (isSplitPayment ? cleanSplits?.[0]?.payment_account_id : paymentAccountId) : undefined,
        payment_method: isCashCustomer ? (isSplitPayment ? 'SPLIT' : (paymentAccountId === 'CASH_DRAWER' ? 'CASH' : 'BANK_TRANSFER')) : undefined,
        items: data.items.map(({ bags_input, selected_family_name, selected_variant_id, ...i }) => {
          const qty = Number(i.quantity || 0);
          const unitPrice = Math.round(Number(i.unit_price || 0) * 100) / 100;
          const totalPrice = i.total !== undefined && i.total !== null && i.total !== ''
            ? Math.round(Number(i.total) * 100) / 100
            : Math.round(qty * unitPrice * 100) / 100;

          const prod = products.find(p => p.id === i.product_id);
          const resolvedSize = (prod?.size || 'Standard').trim();

          return {
            product_id: i.product_id,
            size: resolvedSize,
            quantity: qty,
            selected_unit: 'KG',
            unit_price: unitPrice,
            total: totalPrice,
            total_price: totalPrice,
          };
        }),
      };
      await mutation.mutateAsync(cleanData as any);
    } catch (err: any) {
      handleApiError(err);
    }
  };

  if (!isOpen) return null;

  const inputCls = (hasError: boolean) =>
    `block w-full rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
        : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/20'
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
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-800">Create New Wholesale Sales Invoice</h2>
                {erpHeldOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsHeldModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition cursor-pointer shadow-2xs border border-amber-300"
                    title="View and resume previously held wholesale invoices"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Held Invoices ({erpHeldOrders.length})</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 font-medium">Strict KG Wholesale Billing Model</p>
                {isLoadingProducts && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" /> Syncing live stock...
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
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

            {isProductsError && (
              <div className="rounded-xl bg-rose-50 p-3.5 text-sm text-rose-700 font-medium border border-rose-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Unable to load live inventory stock. Please check network or click retry.</span>
                </div>
                <button
                  type="button"
                  onClick={() => refetchProducts()}
                  className="px-2.5 py-1 text-xs font-bold bg-white text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            )}

            <div className={`grid grid-cols-1 ${isCreditCustomer ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-5`}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Customer <span className="text-xs font-normal text-slate-400">(Type or Arrow keys)</span>
                </label>
                <SearchableCombobox
                  id="customer-combobox"
                  value={selectedCustomerId || ''}
                  onChange={(val) => {
                    setValue('customer_id', val, { shouldValidate: true });
                    const cust = customersResponse?.data.find((c: any) => c.id === val);
                    if (cust?.customer_type === 'CASH') {
                      setValue('transport', '');
                    }
                  }}
                  options={customerOptions}
                  placeholder="Type to search customer..."
                  autoFocus={true}
                  hasError={!!errors.customer_id}
                  onSelectNext={() => focusField('item-0-family')}
                  onTabNext={() => focusField('item-0-family')}
                />
                {errors.customer_id && <p className="mt-1 text-xs text-red-600">{errors.customer_id.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice Date</label>
                <DateInput
                  id="invoice-date"
                  value={watch('date')}
                  onChange={(val) => setValue('date', val, { shouldValidate: true })}
                  placeholder="dd/mm/yyyy"
                  className={inputCls(!!errors.date)}
                  hasError={!!errors.date}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      focusField('invoice-due-date');
                    }
                  }}
                />
                {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Due Date</label>
                  {isCashCustomer && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      N/A (Cash Spot Sale)
                    </span>
                  )}
                </div>
                <DateInput
                  id="invoice-due-date"
                  value={isCashCustomer ? '' : watch('due_date')}
                  disabled={isCashCustomer}
                  onChange={(val) => setValue('due_date', val, { shouldValidate: true })}
                  placeholder={isCashCustomer ? 'Immediate Payment' : 'dd/mm/yyyy'}
                  className={inputCls(!!errors.due_date && !isCashCustomer)}
                  hasError={!!errors.due_date && !isCashCustomer}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      focusField(isCreditCustomer ? 'invoice-transport' : 'item-0-family');
                    }
                  }}
                />
                {errors.due_date && !isCashCustomer && <p className="mt-1 text-xs text-red-600">{errors.due_date.message}</p>}
              </div>

              {isCreditCustomer && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Transport (optional)
                  </label>
                  <input
                    id="invoice-transport"
                    type="text"
                    autoComplete="off"
                    {...register('transport')}
                    className={inputCls(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        focusField('item-0-family');
                      }
                    }}
                  />
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-visible shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[26%]">Product</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[24%]">Size / Variant</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-24 min-w-[75px] text-center">Bags (Opt.)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">QTY (KG)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-32">PRICE / KG</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-36">TOTAL (PKR)</th>
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

                    const variantList = rowFamily ? [...(groupedProducts[rowFamily] || [])].sort(compareProducts) : [];
                    const variantOptions: ComboboxOption[] = variantList.map((p) => {
                      const vStock = Number(p.total_stock_kg ?? p.current_stock ?? 0);
                      const vBagWeight = Number(p.bag_weight_kg || 25);
                      const vBags = vBagWeight > 0 ? (vStock / vBagWeight).toFixed(1) : '0';
                      const isZero = vStock <= 0;
                      return {
                        value: p.id,
                        label: p.size ? `${formatProductTitle(p.name, p.size)} (${p.code})` : `${p.name} (${p.code})`,
                        badge: isZero ? 'Out of Stock' : `${vStock.toLocaleString()} KG`,
                        subLabel: `Stock: ${vStock.toLocaleString()} KG (${vBags} Bags) • Std: ${vBagWeight.toFixed(0)} KG/bag`,
                      };
                    });

                    const qty = Number(items[index]?.quantity || 0);
                    const price = Number(items[index]?.unit_price || 0);
                    const currentLineTotal = items[index]?.total !== undefined && items[index]?.total !== null && items[index]?.total !== ''
                      ? items[index]?.total
                      : (qty && price ? Math.round(qty * price * 100) / 100 : '');

                    const available_stock = Number(selectedProd?.total_stock_kg ?? selectedProd?.current_stock ?? 0);
                    const bagWeight = Number(selectedProd?.bag_weight_kg || 25);
                    const availableBags = bagWeight > 0 ? (available_stock / bagWeight).toFixed(1) : '0';
                    const isOutOfStock = available_stock <= 0;
                    const isLowStock = !isOutOfStock && available_stock <= (Number(selectedProd?.low_stock_threshold) || 50);
                    const shortfall = selectedProdId ? Math.max(0, Math.round((qty - available_stock) * 100) / 100) : 0;

                    return (
                      <tr key={field.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 align-top min-w-[190px]">
                          <SearchableCombobox
                            id={`item-${index}-family`}
                            value={rowFamily}
                            onChange={(val) => handleFamilyChange(index, val)}
                            options={familyOptions}
                            placeholder="Select product..."
                            hasError={!!itemError?.product_id && !rowFamily}
                            onSelectNext={() => focusField(`item-${index}-variant`)}
                            onKeyDown={(e) => {
                              if ((e.altKey && e.key === 'Delete') || (e.ctrlKey && e.key === 'Backspace')) {
                                e.preventDefault();
                                if (fields.length > 1) {
                                  remove(index);
                                  const prevIdx = Math.max(0, index - 1);
                                  focusField(`item-${prevIdx}-family`);
                                }
                              }
                            }}
                          />
                          {itemError?.product_id && !rowFamily && (
                            <p className="text-xs text-red-600 mt-1">{itemError.product_id.message}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 align-top min-w-[200px]">
                          <SearchableCombobox
                            id={`item-${index}-variant`}
                            value={selectedProdId}
                            onChange={(val) => handleVariantChange(index, val)}
                            options={variantOptions}
                            placeholder={rowFamily ? "Select size / variant..." : "Select product first..."}
                            disabled={!rowFamily}
                            hasError={!!itemError?.product_id && !!rowFamily && !selectedProdId}
                            onSelectNext={() => focusField(`item-${index}-bags`)}
                            onKeyDown={(e) => {
                              if ((e.altKey && e.key === 'Delete') || (e.ctrlKey && e.key === 'Backspace')) {
                                e.preventDefault();
                                if (fields.length > 1) {
                                  remove(index);
                                  const prevIdx = Math.max(0, index - 1);
                                  focusField(`item-${prevIdx}-family`);
                                }
                              }
                            }}
                          />

                          {/* Loading Indicator */}
                          {isLoadingProducts && (
                            <span className="text-[11px] text-blue-500 font-medium flex items-center gap-1 mt-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" /> Fetching live stock...
                            </span>
                          )}

                          {/* Live Size-Wise Available Stock Display */}
                          {selectedProd && !isLoadingProducts && (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                                    isOutOfStock
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : isLowStock
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                  />
                                  <span>
                                    Available Stock: <strong>{available_stock.toLocaleString()} KG</strong>
                                    {bagWeight > 0 && (
                                      <span className="font-semibold text-slate-500 ml-1">
                                        ({availableBags} Bags)
                                      </span>
                                    )}
                                  </span>
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 block font-medium">
                                Std Weight: {bagWeight.toFixed(2)} KG / Bag
                              </span>
                            </div>
                          )}

                          {itemError?.product_id && !!rowFamily && !selectedProdId && (
                            <p className="text-xs text-red-600 mt-1">{itemError.product_id.message}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 align-top w-24 min-w-[75px]">
                          <input
                            id={`item-${index}-bags`}
                            type="number"
                            step="0.1"
                            disabled={!selectedProdId}
                            placeholder="0"
                            value={items[index]?.bags_input ?? ''}
                            onChange={(e) => handleBagsChange(index, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleRowKeyDown(e, index, 'bags')}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl text-slate-900 text-center font-medium bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                          />
                          <span className="text-[10px] text-slate-400 block mt-1 text-center">Bags helper</span>
                        </td>

                        <td className="px-4 py-3 align-top min-w-[130px]">
                          <div className="flex flex-col">
                            <input
                              id={`item-${index}-quantity`}
                              type="number"
                              step="0.01"
                              disabled={!selectedProdId}
                              placeholder="0.00"
                              value={items[index]?.quantity ?? ''}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => handleRowKeyDown(e, index, 'quantity')}
                              className={`block w-full rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
                                itemError?.quantity
                                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20 text-red-900'
                                  : shortfall > 0
                                  ? 'border-amber-400 text-amber-900 focus:border-amber-500 focus:ring-amber-500/20'
                                  : 'border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-500/20'
                              }`}
                            />
                            {shortfall > 0 && (
                              <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md mt-1 font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0 text-amber-600" />
                                Exceeds stock ({available_stock.toLocaleString()} KG). {shortfall.toLocaleString()} KG backordered
                              </span>
                            )}
                            {itemError?.quantity && <p className="text-xs text-red-600 mt-1">{itemError.quantity.message}</p>}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top min-w-[120px]">
                          <input
                            id={`item-${index}-unit-price`}
                            type="number"
                            step="0.01"
                            disabled={!selectedProdId}
                            placeholder="0.00"
                            value={items[index]?.unit_price ?? ''}
                            onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleRowKeyDown(e, index, 'unit-price')}
                            className={inputCls(!!itemError?.unit_price)}
                          />
                          {itemError?.unit_price && <p className="text-xs text-red-600 mt-1">{itemError.unit_price.message}</p>}
                        </td>

                        <td className="px-4 py-3 align-top min-w-[130px]">
                          <input
                            id={`item-${index}-total`}
                            type="number"
                            step="0.01"
                            disabled={!selectedProdId}
                            placeholder="0.00"
                            value={currentLineTotal}
                            onChange={(e) => handleTotalChange(index, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleRowKeyDown(e, index, 'total')}
                            className={`${inputCls(false)} font-mono font-bold text-slate-900 bg-blue-50/20 focus:bg-white`}
                          />
                          <span className="text-[10px] text-slate-400 block mt-1">Lump sum total</span>
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

              <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  disabled={hasAnyEmptySize}
                  onClick={() => append({ product_id: '', selected_family_name: '', selected_variant_id: '', bags_input: 1, quantity: 25, unit_price: 0 })}
                  className={`inline-flex items-center text-sm font-bold transition-colors ${
                    hasAnyEmptySize
                      ? 'text-slate-400 cursor-not-allowed opacity-60'
                      : 'text-blue-600 hover:text-blue-700 cursor-pointer'
                  }`}
                  title={hasAnyEmptySize ? "Please select a size/variant for all items before adding another row" : "Add line item"}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Line Item
                </button>
                {hasAnyEmptySize && (
                  <span className="text-xs text-amber-600 font-medium">
                    * Select product & size/variant for all rows to add more or save
                  </span>
                )}
              </div>
            </div>
            {errors.items?.root && <p className="text-sm text-red-600">{errors.items.root.message}</p>}

            {/* Advance Balance / Credit Application Option (Only for CREDIT customers) */}
            {!isCashCustomer && walletBalance > 0 && selectedCustomerId && (
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

            {/* POS-Style Instant Payment Settlement Section (Only for CASH customers) */}
            {isCashCustomer && (
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/90 via-emerald-50/50 to-teal-50/30 p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                          Cash Customer Settlement
                        </span>
                        <span className="text-xs font-bold text-emerald-700">Immediate Full Payment</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 font-medium">
                        Immediate settlement upon saving. No separate &quot;Record Payment&quot; step required.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={toggleSplitMode}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer border bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-300 active:scale-95"
                    >
                      <Split className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isSplitPayment ? 'Single Payment' : '+ Split Payment'}</span>
                    </button>

                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-2xs">
                      <span className="text-xs font-bold text-slate-600">Total:</span>
                      <span className="text-sm font-black font-mono text-emerald-700">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>
                </div>

                {isSplitPayment ? (
                  /* Split Mode */
                  <div className="pt-3 border-t border-emerald-200/80 space-y-3">
                    {/* Live Status Pill */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white/90 p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                      <div className="flex items-center gap-2">
                        {isSplitBalanced ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Balanced — Full Rs. {total.toLocaleString()} allocated
                          </span>
                        ) : splitDiff > 0.01 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            Remaining to allocate: Rs. {splitDiff.toLocaleString()}
                          </span>
                        ) : splitDiff < -0.01 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-900 bg-rose-100 border border-rose-300 px-3 py-1 rounded-full">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            Over-allocated by: Rs. {Math.abs(splitDiff).toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-900 bg-rose-100 border border-rose-300 px-3 py-1 rounded-full">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            All rows must have an account and amount &gt; 0
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                        <span>Allocated: <strong className="font-mono text-emerald-700">Rs. {splitTotalAllocated.toLocaleString()}</strong></span>
                        <span className="text-slate-300">|</span>
                        <span>Target: <strong className="font-mono text-slate-900">Rs. {total.toLocaleString()}</strong></span>
                      </div>
                    </div>

                    {/* Split Rows */}
                    <div className="space-y-2">
                      {splitRows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-emerald-200/90 shadow-2xs">
                          <span className="text-xs font-black text-emerald-700 w-6 text-center shrink-0">
                            #{idx + 1}
                          </span>

                          <div className="flex-1">
                            <select
                              value={row.payment_account_id}
                              onChange={(e) => handleSplitRowChange(idx, 'payment_account_id', e.target.value)}
                              className="w-full text-xs font-semibold rounded-lg py-1.5 px-2.5 border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer text-slate-900"
                            >
                              <option value="">-- Select Account --</option>
                              <option value="CASH_DRAWER">💵 Cash in Drawer (Cash Register)</option>
                              {bankAccounts
                                .filter((b: any) => b.is_active)
                                .map((b: any) => (
                                  <option key={b.id} value={b.id}>
                                    🏦 {b.bank_name} — {b.account_title} ({b.account_number})
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="w-44 shrink-0">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.amount === '' ? '' : row.amount}
                                placeholder="0.00"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleSplitRowChange(idx, 'amount', e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full text-right font-mono font-bold text-xs rounded-lg py-1.5 pl-8 pr-2.5 border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900"
                              />
                            </div>
                          </div>

                          {splitRows.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeSplitRow(idx)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer shrink-0"
                              title="Remove split account"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add Another Account Button */}
                    <div className="flex justify-between items-center pt-1">
                      <button
                        type="button"
                        onClick={addSplitRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100/60 transition shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-700" />
                        <span>+ Add Another Account</span>
                      </button>

                      <p className="text-[11px] text-slate-500 font-medium">
                        Auto-calculates second row balance as you type in row 1.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Single Mode */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-emerald-200/80">
                    <div>
                      <label htmlFor="invoice-payment-account" className="block text-xs font-bold text-slate-800 mb-1">
                        Payment Account / Method <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="invoice-payment-account"
                        value={paymentAccountId}
                        onChange={(e) => setPaymentAccountId(e.target.value)}
                        className="w-full text-sm font-semibold rounded-xl py-2 px-3 border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer text-slate-900 shadow-2xs"
                      >
                        <option value="CASH_DRAWER">💵 Cash in Drawer (Cash Register)</option>
                        {bankAccounts
                          .filter((b: any) => b.is_active)
                          .map((b: any) => (
                            <option key={b.id} value={b.id}>
                              🏦 {b.bank_name} — {b.account_title} ({b.account_number})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex items-center bg-emerald-100/70 rounded-xl px-3.5 py-2 border border-emerald-200">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-2.5 shrink-0" />
                      <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                        Full Grand Total of <strong className="font-bold text-emerald-950 font-mono">{formatCurrency(total)}</strong> will be settled into <strong className="font-bold text-emerald-950">{paymentAccountId === 'CASH_DRAWER' ? 'Cash in Drawer' : (bankAccounts.find((b: any) => b.id === paymentAccountId)?.bank_name || 'Selected Bank')}</strong> immediately upon saving this invoice.
                      </p>
                    </div>
                  </div>
                )}
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
                      id="invoice-discount"
                      type="number"
                      step="0.01"
                      {...register('discount')}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          focusField('invoice-delivery-charge');
                        }
                      }}
                      className={inputCls(!!errors.discount)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Delivery / Freight (Rs)</span>
                  <div className="w-24">
                    <input
                      id="invoice-delivery-charge"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('delivery_charge')}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          focusField('invoice-notes');
                        }
                      }}
                      className={inputCls(!!errors.delivery_charge)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200">
                  <span>Total Payable</span>
                  <span className="text-xl font-black text-blue-600">{formatCurrency(total)}</span>
                </div>
                {isCashCustomer && (
                  <div className="flex justify-between items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    <span>Payment Status:</span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Fully Settled (Cash)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Remarks</label>
              <textarea
                id="invoice-notes"
                {...register('notes')}
                rows={2}
                className={inputCls(false)}
                placeholder="Optional invoice notes... (Press Ctrl+Enter or F9 to Save & Print)"
              ></textarea>
            </div>
          </form>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl">
          {/* Left: 3 Checkboxes (Original, Duplicate, Both) */}
          <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-bold text-slate-700">Print:</span>
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={printCopyMode === 'ORIGINAL'}
                onChange={() => setPrintCopyMode('ORIGINAL')}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
              />
              <span>Original</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={printCopyMode === 'DUPLICATE'}
                onChange={() => setPrintCopyMode('DUPLICATE')}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
              />
              <span>Duplicate</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={printCopyMode === 'BOTH'}
                onChange={() => setPrintCopyMode('BOTH')}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
              />
              <span>Both</span>
            </label>
          </div>

          {/* Right: Cancel, Hold Invoice, Save and Print Invoice */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending || isHolding}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleHoldInvoice}
              disabled={mutation.isPending || isHolding || !selectedCustomerId || (items || []).filter(i => i.product_id).length === 0}
              className="inline-flex items-center justify-center rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 px-4 py-2.5 text-sm font-bold shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              title="Hold this invoice"
            >
              {isHolding ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-slate-700" />
                  Holding...
                </>
              ) : (
                <>
                  <PauseCircle className="mr-1.5 h-4 w-4 text-amber-600" />
                  Hold Invoice
                </>
              )}
            </button>
            <button
              type="submit"
              form="invoice-form"
              disabled={mutation.isPending || isHolding || hasAnyEmptySize || (isCashCustomer && isSplitPayment && !isSplitBalanced)}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              title={
                hasAnyEmptySize
                  ? "All line items must have a size/variant selected"
                  : isCashCustomer && isSplitPayment && !isSplitBalanced
                  ? "Split payment must be balanced and all rows have valid amounts"
                  : "Save and Print Invoice"
              }
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-950" />
                  Saving & Printing...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4 text-slate-950" />
                  Save and Print Invoice
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Held Invoices Modal */}
      <HeldInvoicesModal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        heldOrders={erpHeldOrders}
        isLoading={isLoadingHeldOrders}
        onResume={resumeHeldInvoice}
        onDelete={(id) => deleteHeldOrderMutation.mutate(id)}
        isDeleting={deleteHeldOrderMutation.isPending}
      />

      {/* A4 Print Portal */}
      {printInvoiceData && createPortal(
        <div className="invoice-print-portal hidden print:block" style={{ backgroundColor: '#ffffff', color: '#000000', colorScheme: 'light' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @page {
              size: A4 portrait !important;
              margin: 8mm !important;
            }
            html, html.dark, body, html.dark body {
              background-color: #ffffff !important;
              background: #ffffff !important;
              color: #000000 !important;
              color-scheme: light !important;
            }
            .invoice-print-portal,
            .invoice-print-portal * {
              color-scheme: light !important;
            }
            @media print {
              html, html.dark, body, html.dark body {
                background-color: #ffffff !important;
                background: #ffffff !important;
                color: #000000 !important;
                color-scheme: light !important;
              }
              .page-break-after-always {
                page-break-after: always !important;
                break-after: page !important;
              }
            }
          ` }} />
          {printCopyMode === 'BOTH' ? (
            <>
              <div className="page-break-after-always">
                <A4SalesInvoice data={{ ...printInvoiceData, isDuplicate: false, type: 'sales' }} />
              </div>
              <div>
                <A4SalesInvoice data={{ ...printInvoiceData, isDuplicate: true, type: 'sales' }} />
              </div>
            </>
          ) : (
            <A4SalesInvoice
              data={{
                ...printInvoiceData,
                isDuplicate: printCopyMode === 'DUPLICATE',
                type: 'sales'
              }}
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
};


