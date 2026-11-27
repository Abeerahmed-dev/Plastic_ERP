import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShoppingCart, Trash2, AlertCircle, UserCheck, Lock, UserPlus, RotateCcw, Printer, FileText, Copy, Clock, PauseCircle, Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { productsService } from '../../services/products.service';
import { posService, POSHeldOrder } from '../../services/pos.service';
import { offlineVaultService, OFFLINE_VAULT_CHANGED_EVENT } from '../../services/offline-vault.service';
import { offlineMasterCache } from '../../services/offline-master-cache.service';
import { reportsService } from '../../services/reports.service';
import { getCustomers } from '../../services/customers.service';
import { useAuthStore } from '../../store/auth.store';
import { useReportStore } from '../../store/useReportStore';
import { printThermalReceipt } from '../../utils/printThermal';
import {
  generateUuidV4,
  getNextOfflineReference,
  isEffectivelyOffline,
  isOfflineOrNetworkError,
} from '../../utils/networkError';
import { SearchableCombobox, ComboboxOption } from '../../components/SearchableCombobox';
import { ProductSizeFilter } from '../../components/Common/ProductSizeFilter';
import { AddCustomerModal } from './AddCustomerModal';
import { ShiftAuditModal } from './ShiftAuditModal';
import { HeldOrdersModal } from './HeldOrdersModal';
import { HoldConfirmModal } from './HoldConfirmModal';
import { compareProducts, formatProductTitle, formatSizeOnly } from '../../utils/productSorting';
import { invalidateSalesInvoiceQueries, invalidateAllDomains } from '../../utils/querySync';
import { erpSyncBus, useErpSync } from '../../utils/erpSyncBus';

interface CartItem {
  product_id: string;
  productName: string;
  name_urdu?: string | null;
  category?: string;
  quantity: number | string;
  selected_unit: string;
  unit_price: number | string;
  price?: number | string;
  fixed_retail_price_per_kg: number;
  current_stock: number;
  bag_weight_kg: number;
  rolling_avg_cost_per_kg: number;
}

export default function POSPage() {
  const { user } = useAuthStore();
  const isCashier = (user?.role || '').toUpperCase() === 'CASHIER';

  const [productQuery, setProductQuery] = useState('');
  const [sizeQuery, setSizeQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [deliveryCharges, setDeliveryCharges] = useState<number>(0);
  const [slipCharges, setSlipCharges] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [splitCashAmount, setSplitCashAmount] = useState<number | ''>('');
  const [splitBankAmount, setSplitBankAmount] = useState<number | ''>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isShiftAuditOpen, setIsShiftAuditOpen] = useState(false);
  const [isHeldOrdersOpen, setIsHeldOrdersOpen] = useState(false);
  const [isHoldConfirmOpen, setIsHoldConfirmOpen] = useState(false);
  const [slipMode, setSlipMode] = useState<'SINGLE' | 'DUPLICATE'>('SINGLE');

  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [offlinePendingCount, setOfflinePendingCount] = useState<number>(0);
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);
  const pendingClientOfflineIdRef = useRef<string | null>(null);

  const queryClient = useQueryClient();

  const handleManualSync = async () => {
    if (isSyncingNow) return;
    try {
      setIsSyncingNow(true);
      const count = await offlineVaultService.getPendingCount();
      if (count === 0) {
        setOfflinePendingCount(0);
        return;
      }
      toast.info('Syncing offline invoices...');
      await offlineVaultService.syncOfflineInvoices();
      const newCount = await offlineVaultService.getPendingCount();
      setOfflinePendingCount(newCount);
      toast.success('Offline invoices synchronized successfully!');
      await invalidateAllDomains(queryClient);
      erpSyncBus.emit('offline-sync');
    } catch (err: any) {
      console.error('Offline sync error:', err);
      toast.error(err?.response?.data?.error || err?.message || 'Offline sync failed — will retry when connection improves.');
    } finally {
      setIsSyncingNow(false);
    }
  };

  // Track pending offline vault records & register auto-sync listener
  useEffect(() => {
    const refreshPendingCount = () => {
      offlineVaultService.getPendingCount().then(setOfflinePendingCount);
    };

    refreshPendingCount();

    const handleOnline = async () => {
      try {
        const count = await offlineVaultService.getPendingCount();
        if (count > 0) {
          toast.info('Connection restored. Syncing offline invoices...');
          await offlineVaultService.syncOfflineInvoices();
          const newCount = await offlineVaultService.getPendingCount();
          setOfflinePendingCount(newCount);
          toast.success('Offline invoices synchronized successfully!');
          await invalidateAllDomains(queryClient);
          erpSyncBus.emit('offline-sync');
        }
      } catch (err) {
        console.error('Offline auto-sync error:', err);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener(OFFLINE_VAULT_CHANGED_EVENT, refreshPendingCount);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(OFFLINE_VAULT_CHANGED_EVENT, refreshPendingCount);
    };
  }, [queryClient]);

  // Subscribe to cross-page mutations to keep POS products, cash tally, and metrics synchronized
  useErpSync(() => {
    queryClient.invalidateQueries({ queryKey: ['posProducts'] });
    queryClient.invalidateQueries({ queryKey: ['todayCashTally'] });
    queryClient.invalidateQueries({ queryKey: ['shiftAudit'] });
  });

  // Query Available Products
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ['posProducts'],
    queryFn: () => productsService.getPOSAvailableProducts(),
  });

  const sortedProducts = useMemo(() => {
    return [...(searchResults || [])].sort(compareProducts);
  }, [searchResults]);

  const products = useMemo(() => {
    return sortedProducts.filter((p) => {
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
  }, [sortedProducts, productQuery, sizeQuery]);

  // Query Customers for Searchable Dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customersSelect'],
    queryFn: () => getCustomers({ limit: 5000 }),
  });
  const customers = customersData?.data || [];

  const [highlightedProductIndex, setHighlightedProductIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const focusField = (id: string, select = false) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (el) {
        el.focus();
        if (select && el instanceof HTMLInputElement) {
          el.select();
        }
      }
    });
  };

  // Initial focus on product search when POS loads
  useEffect(() => {
    focusField('pos-product-search', true);
  }, []);

  const customerOptions: ComboboxOption[] = useMemo(() => {
    return [
      { value: '', label: 'Walk-In Customer (Default)' },
      ...customers.map((c) => ({
        value: c.id,
        label: `${c.name}${c.city ? ` (${c.city})` : ''}`,
        badge: c.customer_type === 'CREDIT' ? 'Credit' : 'Cash',
        subLabel: `Balance: Rs. ${Number(c.outstanding_balance || 0).toLocaleString()} • ${c.phone || 'No phone'}`,
      })),
    ];
  }, [customers]);

  // Query Active Bank Accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => import('../../services/bank-accounts.service').then(m => m.bankAccountsService.getBankAccounts()),
  });

  // Query Walk-in POS Metrics Summary
  const { data: metrics } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: () => reportsService.getDashboardMetrics(),
  });

  // Query Held Orders (excluding wholesale ERP held orders)
  const { data: allHeldOrders = [], isLoading: isLoadingHeldOrders } = useQuery({
    queryKey: ['posHeldOrders'],
    queryFn: () => posService.getHeldOrders(),
  });
  const heldOrders = useMemo(() => {
    return allHeldOrders.filter((o) => !o.reference_note?.startsWith('[ERP]'));
  }, [allHeldOrders]);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === product.id);
      let newCart: CartItem[];
      if (existingIndex >= 0) {
        newCart = prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: (Number(item.quantity) || 0) + 1 } : item,
        );
      } else {
        const bagWeight = Number(product.bag_weight_kg || 25.0);
        const fixedRetailKg = Number(product.fixed_retail_price_per_kg || product.sale_price || 0);
        const initialUnitPrice = fixedRetailKg > 0 ? fixedRetailKg : Number(product.sale_price || 0);

        const productName = formatProductTitle(product.name, product.size);

        newCart = [
          ...prev,
          {
            product_id: product.id,
            productName,
            name_urdu: product.name_urdu || null,
            category: product.category || product.category_name || '',
            quantity: 1,
            selected_unit: 'KG',
            unit_price: initialUnitPrice,
            price: initialUnitPrice,
            fixed_retail_price_per_kg: fixedRetailKg,
            current_stock: Number(product.total_stock_kg ?? product.current_stock ?? 0),
            bag_weight_kg: bagWeight,
            rolling_avg_cost_per_kg: Number(product.rolling_avg_cost_per_kg || product.cost_price || 0),
          },
        ];
      }

      setTimeout(() => {
        focusField(`pos-cart-qty-${product.id}`, true);
      }, 50);

      return newCart;
    });
  };

  const handleEnterSingleMatch = () => {
    if (products.length === 1) {
      addToCart(products[0]);
      setProductQuery('');
      setSizeQuery('');
      focusField('pos-product-search', true);
    }
  };

  const handleSelectAndAddToCart = (productName: string, size?: string) => {
    const cleanName = (productName || '').trim().toLowerCase();
    const cleanSize = (size || '').trim().toLowerCase();

    // 1. Exact match by name & size
    let matchedProduct = sortedProducts.find((p) => {
      const pName = (p.name || '').trim().toLowerCase();
      const pSize = (p.size || '').trim().toLowerCase();
      const pSizeOnly = formatSizeOnly(p, p.name).toLowerCase();
      return pName === cleanName && (pSize === cleanSize || pSizeOnly === cleanSize);
    });

    // 2. Substring match by size
    if (!matchedProduct && cleanSize) {
      matchedProduct = sortedProducts.find((p) => {
        const pName = (p.name || '').trim().toLowerCase();
        const pSize = (p.size || '').trim().toLowerCase();
        return pName === cleanName && pSize.includes(cleanSize);
      });
    }

    // 3. Fallback to product name match
    if (!matchedProduct) {
      matchedProduct = sortedProducts.find((p) => {
        const pName = (p.name || '').trim().toLowerCase();
        return pName === cleanName;
      });
    }

    if (matchedProduct) {
      addToCart(matchedProduct);
      setProductQuery('');
      setSizeQuery('');
    }
  };

  const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const updated = { ...item, ...updates };

        // Keep unit_price and price property synchronized
        if (updates.price !== undefined && updates.unit_price === undefined) {
          updated.unit_price = updates.price;
        } else if (updates.unit_price !== undefined && updates.price === undefined) {
          updated.price = updates.unit_price;
        }

        // If unit changes, scale price proportionally based on bag weight
        if (updates.selected_unit && updates.selected_unit !== item.selected_unit) {
          const oldMultiplier =
            item.selected_unit.toLowerCase() === 'bag' || item.selected_unit.toLowerCase() === 'bora'
              ? item.bag_weight_kg
              : 1.0;
          const newMultiplier =
            updates.selected_unit.toLowerCase() === 'bag' || updates.selected_unit.toLowerCase() === 'bora'
              ? item.bag_weight_kg
              : 1.0;
          const currentPrice = Number(updated.price !== undefined ? updated.price : (updated.unit_price ?? item.unit_price ?? 0));
          const ratePerKg = oldMultiplier > 0 ? (currentPrice / oldMultiplier) : currentPrice;
          const scaledPrice = Math.round(ratePerKg * newMultiplier * 100) / 100;
          updated.unit_price = scaledPrice;
          updated.price = scaledPrice;
        }

        return updated;
      }),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== id));
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerBalance = Number(selectedCustomer?.outstanding_balance || 0);
  const hasCreditBalance = customerBalance < 0;
  const availableCredit = hasCreditBalance ? Math.abs(customerBalance) : 0;

  const subtotal = cart.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.price !== undefined ? item.price : item.unit_price) || 0),
    0
  );

  const totalWeightKg = cart.reduce((acc, item) => {
    const isItemReturn = Number(item.quantity) < 0;
    const absQty = Math.abs(Number(item.quantity) || 0);
    const unitMultiplier = (item.selected_unit?.toLowerCase() === 'bag' || item.selected_unit?.toLowerCase() === 'bora')
      ? Number(item.bag_weight_kg || 25.0)
      : 1.0;
    const kg = absQty * unitMultiplier;
    return isItemReturn ? acc - kg : acc + kg;
  }, 0);
  const formattedTotalWeight = Number(totalWeightKg.toFixed(2)).toString();

  const effectiveDiscount = isCashier ? 0 : discount;
  const effectiveDeliveryCharges = Math.max(0, Number(deliveryCharges) || 0);
  const effectiveSlipCharges = Math.max(0, Number(slipCharges) || 0);
  const netBeforeCredit = Math.max(0, subtotal - effectiveDiscount + effectiveDeliveryCharges + effectiveSlipCharges);
  const appliedCredit = hasCreditBalance ? Math.min(netBeforeCredit, availableCredit) : 0;
  const total = Math.max(0, netBeforeCredit - appliedCredit);

  const isSplit = paymentMethod === 'SPLIT';
  const effectiveSplitCash = splitCashAmount === '' ? 0 : Number(splitCashAmount);
  const effectiveSplitBank = splitBankAmount === '' ? 0 : Number(splitBankAmount);
  const effectiveAmountPaid = isSplit
    ? (effectiveSplitCash + effectiveSplitBank)
    : (amountPaid === '' ? total : Number(amountPaid));

  const isCartValid =
    cart.length > 0 &&
    cart.every((item) => Number(item.quantity) > 0 && Number(item.price !== undefined ? item.price : item.unit_price) >= 0);

  const checkoutMutation = useMutation({
    mutationFn: (offlineIdOverride?: string) =>
      posService.checkout({
        customer_id: selectedCustomerId || undefined,
        items: cart.map((i) => {
          const itemPrice = Number(i.price !== undefined ? i.price : i.unit_price) || 0;
          return {
            product_id: i.product_id,
            quantity: Number(i.quantity) || 0,
            selected_unit: i.selected_unit,
            unit_price: itemPrice,
            price: itemPrice,
          };
        }),
        discount: effectiveDiscount,
        delivery_charges: effectiveDeliveryCharges,
        slip_charges: effectiveSlipCharges,
        amount_paid: effectiveAmountPaid,
        payment_method: paymentMethod,
        bank_account_id: (paymentMethod === 'BANK' || paymentMethod === 'SPLIT') ? (selectedBankAccountId || undefined) : undefined,
        split_cash_amount: isSplit ? effectiveSplitCash : undefined,
        split_bank_amount: isSplit ? effectiveSplitBank : undefined,
        offline_id: offlineIdOverride || pendingClientOfflineIdRef.current || undefined,
        offline_timestamp: Date.now(),
      }),
    onSuccess: async (invoice: any) => {
      const selectedCustomerName = customers.find(c => c.id === selectedCustomerId)?.name || 'Walk-In Customer';
      const selectedBank = bankAccounts.find((b: any) => b.id === selectedBankAccountId);
      const activeMethod = paymentMethod;
      const tendered = activeMethod === 'CASH'
        ? (invoice.cash_tendered ?? effectiveAmountPaid)
        : (activeMethod === 'SPLIT' ? effectiveSplitCash : 0);
      const returned = activeMethod === 'BANK'
        ? 0
        : (invoice.change_returned ?? Math.max(0, (activeMethod === 'SPLIT' ? (effectiveSplitCash + effectiveSplitBank) : effectiveAmountPaid) - total));
      const balanceDue = Math.max(0, total - effectiveAmountPaid);

      const isDuplicateMode = slipMode === 'DUPLICATE';
      const receiptData = {
        invoice: {
          ...invoice,
          delivery_charges: effectiveDeliveryCharges,
          delivery_charge: effectiveDeliveryCharges,
          slip_charges: effectiveSlipCharges,
          payment_method: activeMethod,
          bank_name: selectedBank ? selectedBank.bank_name : (invoice.bank_name || undefined),
          paid_amount: effectiveAmountPaid,
          cash_tendered: tendered,
          change_returned: returned,
          balance_due: balanceDue,
          split_cash_amount: activeMethod === 'SPLIT' ? effectiveSplitCash : undefined,
          split_bank_amount: activeMethod === 'SPLIT' ? effectiveSplitBank : undefined,
        },
        items: [...cart],
        cashierName: user?.name || 'Cashier',
        customerName: selectedCustomerName,
        isDuplicate: false,
        printBoth: isDuplicateMode, // When DUPLICATE is selected: prints 2 slips (Original + Duplicate). When SINGLE: prints only Original.
      };

      setLastInvoice(receiptData);

      // Print immediately to thermal printer / browser dialog
      printThermalReceipt(receiptData);

      // Clear cart and reset state immediately
      setCart([]);
      setDiscount(0);
      setDeliveryCharges(0);
      setSlipCharges(0);
      setAmountPaid('');
      setSplitCashAmount('');
      setSplitBankAmount('');
      setSelectedCustomerId('');
      setSelectedBankAccountId('');

      // Refresh stock, invoices, customers, bank accounts, and metrics immediately across all pages
      await invalidateSalesInvoiceQueries(queryClient);
      erpSyncBus.emit('pos', { invoice });

      toast.success(`Sale ${invoice.invoice_number || 'POS'} completed successfully!`);
    },
    onError: async (err: any) => {
      if (isOfflineOrNetworkError(err)) {
        await handleOfflineCheckout(pendingClientOfflineIdRef.current || undefined);
        pendingClientOfflineIdRef.current = null;
        return;
      }
      pendingClientOfflineIdRef.current = null;
      alert(err?.response?.data?.error || err.message || 'Checkout failed');
    },
  });

  const handleOfflineCheckout = async (clientOfflineId?: string) => {
    try {
      const selectedCustomerName = customers.find(c => c.id === selectedCustomerId)?.name || 'Walk-In Customer';
      const selectedBank = bankAccounts.find((b: any) => b.id === selectedBankAccountId);
      const activeMethod = paymentMethod;
      const tendered = activeMethod === 'CASH'
        ? effectiveAmountPaid
        : (activeMethod === 'SPLIT' ? effectiveSplitCash : 0);
      const returned = activeMethod === 'BANK'
        ? 0
        : Math.max(0, (activeMethod === 'SPLIT' ? (effectiveSplitCash + effectiveSplitBank) : effectiveAmountPaid) - total);
      const balanceDue = Math.max(0, total - effectiveAmountPaid);
      const localBillNo = getNextOfflineReference('POS');
      const nowIso = new Date().toISOString();

      const orderData = {
        record_type: 'POS' as const,
        local_bill_number: localBillNo,
        customer_id: selectedCustomerId || undefined,
        customer_name: selectedCustomerName,
        items: cart.map((i) => {
          const itemPrice = Number(i.price !== undefined ? i.price : i.unit_price) || 0;
          return {
            product_id: i.product_id,
            productName: i.productName,
            name_urdu: i.name_urdu,
            category: i.category,
            quantity: Number(i.quantity) || 0,
            selected_unit: i.selected_unit,
            unit_price: itemPrice,
            price: itemPrice,
            bag_weight_kg: i.bag_weight_kg,
          };
        }),
        subtotal,
        discount: effectiveDiscount,
        delivery_charges: effectiveDeliveryCharges,
        delivery_charge: effectiveDeliveryCharges,
        slip_charges: effectiveSlipCharges,
        total_amount: total,
        amount_paid: effectiveAmountPaid,
        payment_method: activeMethod,
        bank_account_id: (activeMethod === 'BANK' || activeMethod === 'SPLIT') ? (selectedBankAccountId || undefined) : undefined,
        split_cash_amount: isSplit ? effectiveSplitCash : undefined,
        split_bank_amount: isSplit ? effectiveSplitBank : undefined,
        created_by_name: user?.name || 'Cashier',
        date: nowIso,
        offline_timestamp: Date.now(),
      };

      const savedRecord = await offlineVaultService.saveOfflineInvoice(orderData, clientOfflineId);

      // Persist decremented stock in master cache so page reloads stay accurate offline
      void offlineMasterCache.adjustCachedProductStock(orderData.items);

      const isDuplicateMode = slipMode === 'DUPLICATE';
      const receiptData = {
        invoice: {
          id: savedRecord.id,
          invoice_number: localBillNo,
          bill_number: localBillNo,
          created_at: nowIso,
          date: nowIso,
          subtotal,
          discount: effectiveDiscount,
          delivery_charges: effectiveDeliveryCharges,
          delivery_charge: effectiveDeliveryCharges,
          slip_charges: effectiveSlipCharges,
          total_amount: total,
          payment_method: activeMethod,
          bank_name: selectedBank ? selectedBank.bank_name : undefined,
          paid_amount: effectiveAmountPaid,
          cash_tendered: tendered,
          change_returned: returned,
          balance_due: balanceDue,
          split_cash_amount: activeMethod === 'SPLIT' ? effectiveSplitCash : undefined,
          split_bank_amount: activeMethod === 'SPLIT' ? effectiveSplitBank : undefined,
          is_offline_pending: true,
        },
        items: [...cart],
        cashierName: user?.name || 'Cashier',
        customerName: selectedCustomerName,
        isDuplicate: false,
        printBoth: isDuplicateMode,
      };

      setLastInvoice(receiptData);

      // Trigger print cleanly & surface any async error
      printThermalReceipt(receiptData).catch((printErr) => {
        console.error('Offline thermal print error:', printErr);
        toast.error('Print popup blocked — click "Reprint Original (1 Slip)" above.');
      });

      // State Assertion: Cashier local UI stock quantity decrements immediately to prevent blind overselling
      queryClient.setQueriesData({ queryKey: ['posProducts'] }, (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((prod: any) => {
          const cartItem = cart.find((c) => c.product_id === prod.id);
          if (!cartItem) return prod;
          const soldQty = Number(cartItem.quantity) || 0;
          const curStock = Number(prod.total_stock_kg ?? prod.current_stock ?? 0);
          const nextStock = Math.max(0, curStock - soldQty);
          return {
            ...prod,
            total_stock_kg: nextStock,
            current_stock: nextStock,
          };
        });
      });

      const newCount = await offlineVaultService.getPendingCount();
      setOfflinePendingCount(newCount);

      setCart([]);
      setDiscount(0);
      setDeliveryCharges(0);
      setSlipCharges(0);
      setAmountPaid('');
      setSplitCashAmount('');
      setSplitBankAmount('');
      setSelectedCustomerId('');
      setSelectedBankAccountId('');

      toast.warning('Offline Sale: Slip printing & bill saved locally for auto-sync!');
    } catch (err: any) {
      console.error('Failed to store offline checkout:', err);
      toast.error('Failed to save offline sale');
    }
  };

  // Hold Order Mutation
  const createHeldOrderMutation = useMutation({
    mutationFn: (refNote: string) => {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      return posService.createHeldOrder({
        reference_note: refNote,
        customer_id: selectedCustomerId || null,
        customer_name: customer ? customer.name : 'Walk-In Customer',
        items: cart,
        subtotal,
        discount,
        delivery_charges: effectiveDeliveryCharges,
        delivery_charge: effectiveDeliveryCharges,
        slip_charges: effectiveSlipCharges,
        total_amount: total,
        payment_method: paymentMethod,
        split_cash_amount: splitCashAmount !== '' ? Number(splitCashAmount) : null,
        split_bank_amount: splitBankAmount !== '' ? Number(splitBankAmount) : null,
        bank_account_id: selectedBankAccountId || null,
        slip_mode: slipMode,
      });
    },
    onSuccess: () => {
      setIsHoldConfirmOpen(false);
      setCart([]);
      setDiscount(0);
      setDeliveryCharges(0);
      setSlipCharges(0);
      setAmountPaid('');
      setSplitCashAmount('');
      setSplitBankAmount('');
      setSelectedCustomerId('');
      setSelectedBankAccountId('');
      queryClient.invalidateQueries({ queryKey: ['posHeldOrders'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || err?.message || 'Failed to hold order');
    },
  });

  // Delete Held Order Mutation
  const deleteHeldOrderMutation = useMutation({
    mutationFn: (orderId: string) => posService.deleteHeldOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posHeldOrders'] });
    },
  });

  // Resume Held Order Handler
  const handleResumeHeldOrder = (order: POSHeldOrder) => {
    if (cart.length > 0) {
      const confirmOverwrite = window.confirm(
        'Your current cart already contains items. Do you want to replace the current cart with this held bill?'
      );
      if (!confirmOverwrite) return;
    }

    setCart(order.items || []);
    setSelectedCustomerId(order.customer_id || '');
    setDiscount(Number(order.discount || 0));
    setDeliveryCharges(Number((order as any).delivery_charges || (order as any).delivery_charge || 0));
    setSlipCharges((order as any).slip_charges !== undefined ? Number((order as any).slip_charges) : 0);
    setPaymentMethod(order.payment_method || 'CASH');
    setSplitCashAmount(order.split_cash_amount !== null && order.split_cash_amount !== undefined ? Number(order.split_cash_amount) : '');
    setSplitBankAmount(order.split_bank_amount !== null && order.split_bank_amount !== undefined ? Number(order.split_bank_amount) : '');
    setSelectedBankAccountId(order.bank_account_id || '');
    if (order.slip_mode === 'DUPLICATE' || order.slip_mode === 'SINGLE') {
      setSlipMode(order.slip_mode as any);
    }

    deleteHeldOrderMutation.mutate(order.id);
    setIsHeldOrdersOpen(false);
  };

  const handleCompleteSale = () => {
    if (!isCartValid) {
      if (cart.length === 0) {
        toast.error('Cart is empty. Add products before completing sale.');
      } else {
        toast.error('Please enter valid quantities for all cart items.');
      }
      return;
    }

    if (paymentMethod === 'BANK' && !selectedBankAccountId) {
      alert('Please select a Bank Account for Bank Transfer payment');
      focusField('pos-bank-select');
      return;
    }
    if (paymentMethod === 'SPLIT') {
      if (effectiveSplitBank > 0 && !selectedBankAccountId) {
        alert('Please select a Bank Account for the Bank Transfer portion');
        focusField('pos-split-bank-select');
        return;
      }
      if (effectiveSplitCash <= 0 && effectiveSplitBank <= 0) {
        alert('Please enter at least Cash or Bank amount for Split Payment');
        focusField('pos-split-cash-amount', true);
        return;
      }
    }

    if (isEffectivelyOffline()) {
      handleOfflineCheckout();
      return;
    }

    const offlineId = generateUuidV4();
    pendingClientOfflineIdRef.current = offlineId;
    checkoutMutation.mutate(offlineId);
  };

  const handleHoldBill = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty. Add items first to hold.');
      return;
    }
    setIsHoldConfirmOpen(true);
  };

  // ── Global POS Keyboard Hotkey Listeners ──
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. If any modal is active, let modal handle Escape
      if (isAddCustomerOpen || isShiftAuditOpen || isHeldOrdersOpen || isHoldConfirmOpen) {
        if (e.key === 'Escape') {
          setIsAddCustomerOpen(false);
          setIsShiftAuditOpen(false);
          setIsHeldOrdersOpen(false);
          setIsHoldConfirmOpen(false);
        }
        return;
      }

      // Complete Sale: Ctrl + Enter or F9
      if ((e.ctrlKey && e.key === 'Enter') || e.key === 'F9') {
        e.preventDefault();
        handleCompleteSale();
        return;
      }

      // Hold Bill: Alt + H or F8
      if ((e.altKey && (e.key === 'h' || e.key === 'H')) || e.key === 'F8') {
        e.preventDefault();
        handleHoldBill();
        return;
      }

      // Held Bills List: Alt + B or F7
      if ((e.altKey && (e.key === 'b' || e.key === 'B')) || e.key === 'F7') {
        e.preventDefault();
        setIsHeldOrdersOpen(true);
        return;
      }

      // Toggle Slip Mode: Alt + P or F6
      if ((e.altKey && (e.key === 'p' || e.key === 'P')) || e.key === 'F6') {
        e.preventDefault();
        setSlipMode((prev) => (prev === 'SINGLE' ? 'DUPLICATE' : 'SINGLE'));
        toast.info(`Slip Mode: ${slipMode === 'SINGLE' ? 'Duplicate (2 Slips)' : 'Single (1 Slip)'}`);
        return;
      }

      // Focus Customer Selection: Alt + U or F3
      if ((e.altKey && (e.key === 'u' || e.key === 'U')) || e.key === 'F3') {
        e.preventDefault();
        focusField('pos-customer-select', true);
        return;
      }

      // Focus Product Search: Alt + S or F2, or Enter key when idle
      if ((e.altKey && (e.key === 's' || e.key === 'S')) || e.key === 'F2') {
        e.preventDefault();
        focusField('pos-product-search', true);
        return;
      }

      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement;
        const isEditingInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
        if (!isEditingInput) {
          e.preventDefault();
          focusField('pos-product-search', true);
          return;
        }
      }

      // Focus Amount Paid: Alt + A or F10
      if ((e.altKey && (e.key === 'a' || e.key === 'A')) || e.key === 'F10') {
        e.preventDefault();
        focusField('pos-amount-paid', true);
        return;
      }

      // Cycle Payment Method: Alt + M
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setPaymentMethod((prev) => {
          const next = prev === 'CASH' ? 'BANK' : prev === 'BANK' ? 'SPLIT' : 'CASH';
          if ((next === 'BANK' || next === 'SPLIT') && !selectedBankAccountId && bankAccounts.length > 0) {
            setSelectedBankAccountId(bankAccounts[0].id);
          }
          if (next === 'SPLIT') {
            const half = Math.round((total / 2) * 100) / 100;
            setSplitCashAmount(half);
            setSplitBankAmount(Math.round((total - half) * 100) / 100);
          }
          toast.info(`Payment Method: ${next}`);
          return next;
        });
        return;
      }

      // New Customer Modal: Alt + N
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setIsAddCustomerOpen(true);
        return;
      }

      // Reprint Last Invoice: Alt + R
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        if (lastInvoice) {
          e.preventDefault();
          printThermalReceipt(lastInvoice);
          toast.info('Reprinting last POS receipt...');
        }
        return;
      }

      // Clear Cart: Alt + C
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        if (cart.length > 0) {
          e.preventDefault();
          if (window.confirm('Clear all items from current cart?')) {
            setCart([]);
            setDiscount(0);
            setDeliveryCharges(0);
            setSlipCharges(0);
            setAmountPaid('');
            setSplitCashAmount('');
            setSplitBankAmount('');
            focusField('pos-product-search', true);
            toast.info('Cart cleared');
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isAddCustomerOpen,
    isShiftAuditOpen,
    isHeldOrdersOpen,
    isHoldConfirmOpen,
    isCartValid,
    paymentMethod,
    selectedBankAccountId,
    bankAccounts,
    effectiveSplitBank,
    effectiveSplitCash,
    cart,
    total,
    slipMode,
    lastInvoice,
    checkoutMutation,
  ]);

return (
    <>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 print:hidden dark:bg-[#0b0d14]">
        {/* LEFT: Product Search & Customer Selection */}
        <div className="flex-1 flex flex-col p-3.5 sm:p-4 border-r border-slate-200 overflow-hidden dark:border-[#1e2235]">
          {/* Top Actions Bar: Held Orders & Reprint Slips */}
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsHeldOrdersOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs border cursor-pointer ${
                  heldOrders.length > 0
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-[#161925] dark:hover:bg-[#1c2030] dark:text-slate-200 dark:border-[#23283B]'
                }`}
                title="View and resume held transactions"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Held Bills</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  heldOrders.length > 0 ? 'bg-white text-amber-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {heldOrders.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {lastInvoice && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (lastInvoice) printThermalReceipt({ ...lastInvoice, isDuplicate: false, printBoth: false });
                    }}
                    className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1 rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer dark:bg-[#161925] dark:hover:bg-[#1c2030] dark:text-slate-200 dark:border-[#23283B]"
                    title="Reprint Single Original Slip"
                  >
                    <Printer className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span>Reprint Original (1 Slip)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (lastInvoice) printThermalReceipt({ ...lastInvoice, isDuplicate: false, printBoth: true });
                    }}
                    className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60"
                    title="Reprint Both Slips: Original + Duplicate"
                  >
                    <Copy className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Reprint Both (2 Slips)</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Offline Sync Pending Warning Banner */}
          {offlinePendingCount > 0 && (
            <div
              data-testid="offline-sync-banner"
              className="mb-2 px-3.5 py-2.5 bg-amber-500/15 border border-amber-500/80 rounded-xl text-amber-500 flex items-center justify-between shadow-2xs shrink-0"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-bold text-xs uppercase tracking-wide">Offline Sync Pending</span>
                <span className="text-[11px] text-amber-400 font-medium">
                  ({offlinePendingCount} invoice{offlinePendingCount > 1 ? 's' : ''} stored locally in vault)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {typeof navigator === 'undefined' || navigator.onLine ? (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncingNow}
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 uppercase cursor-pointer disabled:opacity-60"
                  >
                    {isSyncingNow ? 'Syncing…' : 'Sync Now'}
                  </button>
                ) : (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 uppercase">
                    Vault Active
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TOP: Direct Side-by-Side Customer Selection (Left) & Product Search (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-2.5 shrink-0 items-center">
            {/* Customer Selection Input */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <SearchableCombobox
                  id="pos-customer-select"
                  options={customerOptions}
                  value={selectedCustomerId}
                  onChange={(val) => {
                    setSelectedCustomerId(val);
                    focusField('pos-product-search', true);
                  }}
                  onSelectNext={() => focusField('pos-product-search', true)}
                  placeholder="Walk-In Customer (Default)"
                  className="w-full text-xs font-semibold"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(true)}
                className="px-2.5 py-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer dark:from-amber-500 dark:to-amber-600 dark:text-slate-950"
                title="Register New Customer (Alt + N)"
              >
                <UserPlus className="w-3.5 h-3.5 text-slate-950" />
                <span>+ New</span>
              </button>
            </div>

            {/* Product & Size Cascading Search */}
            <ProductSizeFilter
              products={sortedProducts}
              productQuery={productQuery}
              sizeQuery={sizeQuery}
              onProductChange={setProductQuery}
              onSizeChange={setSizeQuery}
              onClear={() => {
                setProductQuery('');
                setSizeQuery('');
                focusField('pos-product-search', true);
              }}
              onEnterSingleMatch={handleEnterSingleMatch}
              onSelectAndAddToCart={handleSelectAndAddToCart}
              productInputId="pos-product-search"
              sizeInputId="pos-size-search"
              productInputRef={searchInputRef}
              showLabels={false}
              className="w-full"
            />
          </div>

          {/* MIDDLE: Product List Grid (5 Columns Across in Compact Square Boxes) */}
          <div className="flex-1 overflow-y-auto pr-1 mb-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5 p-1">
              {products.map((p, idx) => {
                const displayPrice = isCashier
                  ? (p.fixed_retail_price_per_kg || p.sale_price)
                  : p.sale_price;
                const stockKg = Number(p.total_stock_kg ?? p.current_stock ?? 0);
                const isOutOfStock = stockKg <= 0;
                const isHighlighted = idx === highlightedProductIndex;

                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      addToCart(p);
                      setProductQuery('');
                      setSizeQuery('');
                      setHighlightedProductIndex(0);
                    }}
                    className={`border rounded-xl p-2.5 flex flex-col justify-between text-left transition-all duration-150 group relative min-h-[105px] max-h-[120px] overflow-hidden cursor-pointer ${
                      isHighlighted ? 'ring-2 ring-amber-500 scale-[1.02] shadow-lg ' : ''
                    }${
                      isOutOfStock
                        ? 'border-amber-300/80 bg-amber-50/40 hover:border-amber-500 shadow-2xs hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] dark:bg-amber-950/20 dark:border-amber-900/40'
                        : 'bg-white border-slate-300/80 shadow-[0_6px_16px_rgba(15,23,42,0.22),0_2px_6px_rgba(15,23,42,0.12)] hover:border-blue-500 hover:shadow-[0_10px_24px_rgba(15,23,42,0.30),0_4px_10px_rgba(37,99,235,0.20)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] dark:bg-[#121520] dark:border-[#23283B] hover:dark:border-blue-500/80 dark:shadow-[0_4px_14px_rgba(0,0,0,0.4)]'
                    }`}
                    title={
                      isOutOfStock
                        ? `${p.name} - Rs. ${displayPrice} / KG (${stockKg} KG Available - Overdraft Sale)`
                        : `${p.name} - Rs. ${displayPrice} / KG (${stockKg} KG Available)`
                    }
                  >
                    {/* Top: Category & Stock Badge */}
                    <div className="flex items-center justify-between gap-1 w-full mb-0.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate max-w-[50%] ${
                          isOutOfStock ? 'text-amber-800 bg-amber-100/80 dark:bg-amber-900/40 dark:text-amber-300' : 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {p.category || p.category_name || 'Item'}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 bg-amber-500 text-white shadow-2xs uppercase tracking-tight" title="0 KG on shelf - Overdraft enabled">
                          {stockKg} KG
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            stockKg > 10
                              ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border dark:border-emerald-800/40'
                              : 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border dark:border-amber-800/40'
                          }`}
                        >
                          {stockKg} KG
                        </span>
                      )}
                    </div>

                    {/* Middle: Product Title */}
                    <div className="my-auto py-0.5">
                      <p
                        className={`font-bold text-xs line-clamp-2 leading-snug transition-colors ${
                          isOutOfStock ? 'text-amber-950/90 dark:text-amber-200' : 'text-slate-800 group-hover:text-blue-600 dark:text-slate-100 group-hover:dark:text-blue-400'
                        }`}
                      >
                        {formatProductTitle(p.name, p.size)}
                      </p>
                      {p.name_urdu && (
                        <p
                          className="text-[10px] font-medium truncate mt-0.5 text-slate-400"
                          dir="rtl"
                        >
                          {p.name_urdu}
                        </p>
                      )}
                    </div>

                    {/* Bottom: Price & Quick Add */}
                    <div
                      className={`flex items-end justify-between pt-1 border-t mt-0.5 w-full ${
                        isOutOfStock ? 'border-amber-200 dark:border-amber-900/40' : 'border-slate-100 dark:border-[#1e2235]'
                      }`}
                    >
                      <div>
                        <span
                          className={`text-[8px] font-semibold uppercase block leading-none ${
                            isOutOfStock ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          Rate
                        </span>
                        <span
                          className={`font-black text-xs leading-tight ${
                            isOutOfStock ? 'text-amber-700 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          Rs. {displayPrice}
                          <span
                            className={`text-[9px] font-medium ml-0.5 ${
                              isOutOfStock ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            /KG
                          </span>
                        </span>
                      </div>
                      {isOutOfStock ? (
                        <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center text-[11px] font-black transition-colors shadow-2xs dark:bg-amber-950/50 dark:text-amber-400 dark:border dark:border-amber-800/50 group-hover:dark:bg-amber-600 group-hover:dark:text-white" title="Add to cart (Overdraft)">
                          +
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-[11px] font-black transition-colors shadow-2xs dark:bg-blue-950/50 dark:text-blue-400 dark:border dark:border-blue-800/50 group-hover:dark:bg-blue-600 group-hover:dark:text-white">
                          +
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {products.length === 0 && !isSearchLoading && (
              <div className="py-8 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-dashed border-slate-200 mt-2 dark:bg-[#121520] dark:border-[#23283B] dark:text-slate-400">
                {productQuery || sizeQuery ? (
                  <span>
                    No products found matching "{productQuery}{sizeQuery ? ` (${sizeQuery})` : ''}"
                  </span>
                ) : (
                  <span>No products available.</span>
                )}
              </div>
            )}
            {isSearchLoading && (
              <div className="py-8 text-center text-slate-400 text-xs font-medium mt-2 dark:text-slate-400">Loading inventory...</div>
            )}
          </div>

          {/* BOTTOM: Summary Metric Cards (Compact) */}
          <div className="pt-2 border-t border-slate-200 shrink-0 dark:border-[#1e2235]">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-white p-2 rounded-lg shadow-2xs border border-slate-200 dark:bg-[#121520] dark:border-[#23283B]">
                <p className="text-[10px] font-medium text-slate-500 mb-0.5 dark:text-slate-400">Today's Sales</p>
                <p className="text-sm font-bold text-slate-900 leading-tight dark:text-white">
                  Rs. {Number(metrics?.todaySales || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-2xs border border-slate-200 dark:bg-[#121520] dark:border-[#23283B]">
                <p className="text-[10px] font-medium text-slate-500 mb-0.5 dark:text-slate-400">Today's Transactions</p>
                <p className="text-sm font-bold text-slate-900 leading-tight dark:text-white">
                  {Number(metrics?.todayTransactions || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-2xs border border-slate-200 dark:bg-[#121520] dark:border-[#23283B]">
                <p className="text-[10px] font-medium text-slate-500 mb-0.5 dark:text-slate-400">This Week's Sales</p>
                <p className="text-sm font-bold text-slate-900 leading-tight dark:text-white">
                  Rs. {Number(metrics?.weeklySales || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-2xs border border-slate-200 dark:bg-[#121520] dark:border-[#23283B]">
                <p className="text-[10px] font-medium text-slate-500 mb-0.5 dark:text-slate-400">This Month's Sales</p>
                <p className="text-sm font-bold text-slate-900 leading-tight dark:text-white">
                  Rs. {Number(metrics?.monthlySales || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* RIGHT: Cart & Locked Payment Panel (Compact Width w-[350px]) */}
      <div className="w-[340px] xl:w-[350px] flex flex-col bg-white shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 shrink-0 dark:bg-[#0c101c] dark:border-l dark:border-[#1e2235]">
        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 flex flex-col divide-y divide-slate-100 dark:divide-[#1e2235]">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 my-auto py-8 dark:text-slate-500">
              <ShoppingCart className="w-10 h-10 mx-auto text-slate-300 mb-2 dark:text-slate-600" />
              <p className="font-semibold text-slate-600 text-xs dark:text-slate-400">Cart is empty</p>
              <p className="text-[11px] text-slate-400 mt-0.5 dark:text-slate-500">Select products from the left to start billing.</p>
            </div>
          ) : (
            cart.map((item, cartIdx) => {
              const unitMultiplier = (item.selected_unit.toLowerCase() === 'bag' || item.selected_unit.toLowerCase() === 'bora')
                ? item.bag_weight_kg
                : 1.0;

              const itemQtyKg = (Number(item.quantity) || 0) * unitMultiplier;
              const liveStockKg = Number(item.current_stock || 0);
              const isOverdraft = itemQtyKg > liveStockKg;
              const deferredQtyKg = Math.max(0, itemQtyKg - Math.max(0, liveStockKg));

              return (
                <div
                  key={item.product_id}
                  className={`py-2 px-0.5 transition-all ${
                    isOverdraft ? 'bg-amber-50/50 -mx-1 px-1.5 rounded dark:bg-amber-950/30' : ''
                  }`}
                >
                  {/* Top: Product Name & Delete Button */}
                  <div className="flex justify-between items-center gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-slate-800 text-xs truncate dark:text-white" title={item.productName}>
                        {item.productName}
                      </span>
                      {isOverdraft && (
                        <span
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-700 dark:text-amber-300 uppercase tracking-tight shrink-0"
                          title={`Available Stock: ${liveStockKg} KG | Backorder: ${deferredQtyKg.toFixed(1)} KG deferred`}
                        >
                          Overdraft
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-slate-400 hover:text-red-600 p-0.5 transition-colors shrink-0 dark:hover:text-red-400 cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isOverdraft && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50/90 p-1 rounded border border-amber-300/80 font-medium my-1 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300">
                      <AlertCircle className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                      Backorder: {deferredQtyKg.toFixed(1)} KG deferred to pending delivery
                    </div>
                  )}

                  {/* Bottom: Unit, Quantity & Line Total Price (Editable custom price) */}
                  <div className="flex justify-between items-center gap-2 mt-1">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={item.selected_unit}
                        onChange={(e) => updateCartItem(item.product_id, { selected_unit: e.target.value })}
                        className="text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 font-semibold text-slate-700 focus:outline-none shadow-2xs dark:bg-[#161925] dark:border-[#2D3349] dark:text-slate-200"
                      >
                        <option value="KG">KG</option>
                        <option value="Bag">Bag ({item.bag_weight_kg}k)</option>
                      </select>

                      <input
                        id={`pos-cart-qty-${item.product_id}`}
                        type="number"
                        step="any"
                        min={0.001}
                        value={item.quantity === '' ? '' : item.quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCartItem(item.product_id, {
                            quantity: val === '' ? '' : (parseFloat(val) || 0),
                          });
                        }}
                        onBlur={() => {
                          if (item.quantity === '' || Number(item.quantity) <= 0) {
                            updateCartItem(item.product_id, { quantity: 1 });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (e.shiftKey) {
                              focusField('pos-product-search', true);
                            } else {
                              focusField(`pos-cart-price-${item.product_id}`, true);
                            }
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (cartIdx < cart.length - 1) {
                              focusField(`pos-cart-qty-${cart[cartIdx + 1].product_id}`, true);
                            } else {
                              focusField('pos-amount-paid', true);
                            }
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (cartIdx > 0) {
                              focusField(`pos-cart-qty-${cart[cartIdx - 1].product_id}`, true);
                            } else {
                              focusField('pos-product-search', true);
                            }
                          } else if ((e.altKey && e.key === 'Delete') || (e.ctrlKey && e.key === 'Backspace')) {
                            e.preventDefault();
                            removeFromCart(item.product_id);
                            if (cart.length > 1) {
                              const nextId = cartIdx > 0 ? cart[cartIdx - 1].product_id : cart[cartIdx + 1].product_id;
                              focusField(`pos-cart-qty-${nextId}`, true);
                            } else {
                              focusField('pos-product-search', true);
                            }
                          }
                        }}
                        className="w-14 text-center text-xs font-bold border border-slate-300 rounded py-0.5 px-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs dark:bg-[#161925] dark:border-[#2D3349] dark:text-white"
                      />

                      <div className="flex items-center gap-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold font-mono dark:text-slate-400">
                          @
                        </span>
                        <input
                          id={`pos-cart-price-${item.product_id}`}
                          type="number"
                          step="any"
                          min={0}
                          value={(item.price !== undefined ? item.price : item.unit_price) === '' ? '' : (item.price !== undefined ? item.price : item.unit_price)}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value;
                            const parsedVal = val === '' ? '' : (parseFloat(val) || 0);
                            updateCartItem(item.product_id, {
                              price: parsedVal,
                              unit_price: parsedVal,
                            });
                          }}
                          onBlur={() => {
                            const cur = item.price !== undefined ? item.price : item.unit_price;
                            if (cur === '' || Number(cur) < 0) {
                              updateCartItem(item.product_id, { price: 0, unit_price: 0 });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              focusField('pos-product-search', true);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              focusField(`pos-cart-qty-${item.product_id}`, true);
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              if (cartIdx < cart.length - 1) {
                                focusField(`pos-cart-price-${cart[cartIdx + 1].product_id}`, true);
                              } else {
                                focusField('pos-amount-paid', true);
                              }
                            } else if ((e.altKey && e.key === 'Delete') || (e.ctrlKey && e.key === 'Backspace')) {
                              e.preventDefault();
                              removeFromCart(item.product_id);
                              focusField('pos-product-search', true);
                            }
                          }}
                          className="w-16 text-center text-xs font-bold border border-slate-300 rounded py-0.5 px-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs dark:bg-[#161925] dark:border-[#2D3349] dark:text-white font-mono"
                          title="Override selling price"
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-900 block font-mono dark:text-white">
                        Rs. {((Number(item.quantity) || 0) * (Number(item.price !== undefined ? item.price : item.unit_price) || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Payment Form */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 dark:bg-[#0c101c] dark:border-[#1e2235]">
          <div className="flex justify-between items-center text-xs text-slate-600 font-medium dark:text-slate-400">
            <span>Total Weight</span>
            <span className="font-bold text-slate-800 dark:text-white">{formattedTotalWeight} KG</span>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-600 font-medium dark:text-slate-400">
            <span>Subtotal</span>
            <span className="font-bold text-slate-800 dark:text-white">Rs. {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-600 font-medium dark:text-slate-400">
            <span className="flex items-center gap-1">
              Discount
            </span>
            <input
              type="number"
              min={0}
              value={discount || ''}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
className={`w-20 text-right text-xs font-bold rounded py-0.5 px-2 ${
                isCashier ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700' : 'bg-white border border-slate-300 dark:bg-[#161925] dark:border-[#2D3349] dark:text-white'
              }`}
              disabled={isCashier}
              placeholder="0"
            />
          </div>

          <div className="flex justify-between items-center text-xs text-slate-600 font-medium dark:text-slate-400">
            <span className="flex items-center gap-1">
              Delivery / Freight (Rs)
            </span>
            <input
              type="number"
              min="0"
              value={deliveryCharges || ''}
              onChange={(e) => setDeliveryCharges(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 text-right text-xs font-bold rounded py-0.5 px-2 bg-white border border-slate-300 dark:bg-[#161925] dark:border-[#2D3349] dark:text-white"
              placeholder="0"
            />
          </div>

          <div className="flex justify-between items-center text-xs text-slate-600 font-medium dark:text-slate-400">
            <span className="flex items-center gap-1">
              Slip Charges (Rs)
            </span>
            <input
              type="number"
              min="0"
              value={slipCharges === 0 ? '0' : (slipCharges || '')}
              onChange={(e) => setSlipCharges(e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 text-right text-xs font-bold rounded py-0.5 px-2 bg-white border border-slate-300 dark:bg-[#161925] dark:border-[#2D3349] dark:text-white"
              placeholder="0"
            />
          </div>

          {hasCreditBalance && availableCredit > 0 && (
            <div className="flex justify-between items-center text-xs font-bold bg-emerald-100/90 text-emerald-950 p-2 rounded-lg border border-emerald-300 shadow-2xs dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300">
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                Credit Applied:
              </span>
              <span className="font-mono text-emerald-800 text-xs font-black dark:text-emerald-300">
                - Rs. {appliedCredit.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-[#1e2235]">
            <span className="text-xs text-slate-800 font-bold dark:text-white">
              {appliedCredit > 0 ? 'Net Payable' : 'Grand Total'}
            </span>
            <span className="text-base text-blue-600 font-black font-mono dark:text-sky-400">Rs. {total.toLocaleString()}</span>
          </div>

          {/* Payment Method Dropdown (Cash in Drawer, Bank Transfer, or Split Payment) */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-0.5 dark:text-slate-300">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                const val = e.target.value;
                setPaymentMethod(val);
                if ((val === 'BANK' || val === 'SPLIT') && !selectedBankAccountId && bankAccounts.length > 0) {
                  setSelectedBankAccountId(bankAccounts[0].id);
                }
                if (val === 'SPLIT') {
                  const half = Math.round((total / 2) * 100) / 100;
                  setSplitCashAmount(half);
                  setSplitBankAmount(Math.round((total - half) * 100) / 100);
                }
              }}
              className="w-full text-xs font-bold rounded-lg py-1.5 px-2 border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 cursor-pointer dark:bg-[#161925] dark:border-[#2D3349] dark:text-white"
            >
              <option value="CASH">💵 Cash in Drawer (CASH)</option>
              <option value="BANK">🏦 Bank Transfer</option>
              <option value="SPLIT">🔀 Split Payment (Cash + Bank)</option>
            </select>
          </div>

          {/* Standard Single Amount Paid Input (when CASH or BANK) */}
          {paymentMethod !== 'SPLIT' && (
            <div>
              <div className="flex justify-between items-center mb-0.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 dark:text-slate-300">
                  <span>Amount Paid</span>
                  {amountPaid === '' && total > 0 && (
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1 rounded border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                      Auto: Full (Rs. {total.toLocaleString()})
                    </span>
                  )}
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmountPaid(0)}
                    className="text-[9px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 transition cursor-pointer dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  >
                    Rs. 0 (Credit)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountPaid(total)}
                    className="text-[9px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition cursor-pointer dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                  >
                    Full (Rs. {total.toLocaleString()})
                  </button>
                </div>
              </div>
              <input
                id="pos-amount-paid"
                type="number"
                min={0}
                value={amountPaid === '' ? '' : amountPaid}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setAmountPaid(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCompleteSale();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (cart.length > 0) {
                      focusField(`pos-cart-qty-${cart[cart.length - 1].product_id}`, true);
                    } else {
                      focusField('pos-product-search', true);
                    }
                  }
                }}
                placeholder={total > 0 ? `Full: Rs. ${total.toLocaleString()}` : '0 (Enter Amount)'}
                className="w-full text-right font-black text-sm rounded-lg py-1 px-2.5 border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 font-mono dark:bg-[#161925] dark:border-[#2D3349] dark:text-white"
              />
              {amountPaid !== '' && Number(amountPaid) > total && (
                <div className="mt-1 flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded text-[11px] font-bold dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                  <span>Change Return:</span>
                  <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                    Rs. {(Number(amountPaid) - total).toLocaleString()}
                  </span>
                </div>
              )}
              {amountPaid !== '' && Number(amountPaid) < total && (
                <div className="mt-1 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded text-[11px] font-bold dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                  <span>Remaining Due:</span>
                  <span className="font-mono text-xs text-amber-700 dark:text-amber-400">
                    Rs. {(total - Number(amountPaid)).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bank Account Dropdown for BANK method */}
          {paymentMethod === 'BANK' && (
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-0.5 dark:text-slate-300">
                Select Bank Account <span className="text-red-500">*</span>
              </label>
              <select
                id="pos-bank-select"
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="w-full text-xs font-bold rounded-lg py-1.5 px-2 border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 cursor-pointer dark:bg-[#161925] dark:border-[#2D3349] dark:text-white"
                required
              >
                <option value="">-- Select Bank Account --</option>
                {bankAccounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} — {acc.account_title || acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Split Payment Dedicated Section */}
          {paymentMethod === 'SPLIT' && (
            <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg flex flex-col gap-2 dark:bg-[#0c1824] dark:border-sky-500/40 dark:shadow-[0_0_14px_rgba(56,189,248,0.15)]">
              <div className="flex justify-between items-center text-[11px] font-bold text-blue-900 border-b border-blue-200/60 pb-1 dark:text-sky-300 dark:border-sky-500/20">
                <span>🔀 Split Payment Allocation</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const half = Math.round((total / 2) * 100) / 100;
                      setSplitCashAmount(half);
                      setSplitBankAmount(Math.round((total - half) * 100) / 100);
                    }}
                    className="text-[9px] bg-white border border-blue-300 text-blue-700 px-1.5 py-0.5 rounded font-semibold hover:bg-blue-100 transition cursor-pointer dark:bg-[#161925] dark:border-sky-500/50 dark:text-sky-300 dark:hover:bg-[#1e2337]"
                  >
                    50 / 50
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitCashAmount(total);
                      setSplitBankAmount(0);
                    }}
                    className="text-[9px] bg-white border border-blue-300 text-blue-700 px-1.5 py-0.5 rounded font-semibold hover:bg-blue-100 transition cursor-pointer dark:bg-[#161925] dark:border-sky-500/50 dark:text-sky-300 dark:hover:bg-[#1e2337]"
                  >
                    All Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitCashAmount(0);
                      setSplitBankAmount(total);
                    }}
                    className="text-[9px] bg-white border border-blue-300 text-blue-700 px-1.5 py-0.5 rounded font-semibold hover:bg-blue-100 transition cursor-pointer dark:bg-[#161925] dark:border-sky-500/50 dark:text-sky-300 dark:hover:bg-[#1e2337]"
                  >
                    All Bank
                  </button>
                </div>
              </div>

              {/* Cash & Bank Portions in a Single Row */}
              <div className="grid grid-cols-2 gap-2">
                {/* Cash Portion */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="text-[10px] font-bold text-slate-700 truncate dark:text-slate-300" title="Cash Portion (Rs.)">
                      💵 Cash Portion (Rs.)
                    </label>
                    {splitBankAmount !== '' && Number(splitBankAmount) < total && (
                      <button
                        type="button"
                        onClick={() => setSplitCashAmount(Math.max(0, total - Number(splitBankAmount)))}
                        className="text-[9px] text-blue-600 hover:underline font-semibold dark:text-sky-400"
                        title={`Fill Remaining (Rs. ${Math.max(0, total - Number(splitBankAmount)).toLocaleString()})`}
                      >
                        Fill Rem.
                      </button>
                    )}
                  </div>
                  <input
                    id="pos-split-cash-amount"
                    type="number"
                    min={0}
                    value={splitCashAmount === '' ? '' : splitCashAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setSplitCashAmount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        focusField('pos-split-bank-amount', true);
                      }
                    }}
                    placeholder="0"
                    className="w-full text-right font-black text-xs rounded-lg py-1 px-2 border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 font-mono dark:bg-[#121520] dark:border-[#2D3349] dark:text-white dark:focus:border-sky-400"
                  />
                </div>

                {/* Bank Portion */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="text-[10px] font-bold text-slate-700 truncate dark:text-slate-300" title="Bank Transfer Portion (Rs.)">
                      🏦 Bank Portion (Rs.)
                    </label>
                    {splitCashAmount !== '' && Number(splitCashAmount) < total && (
                      <button
                        type="button"
                        onClick={() => setSplitBankAmount(Math.max(0, total - Number(splitCashAmount)))}
                        className="text-[9px] text-blue-600 hover:underline font-semibold dark:text-sky-400"
                        title={`Fill Remaining (Rs. ${Math.max(0, total - Number(splitCashAmount)).toLocaleString()})`}
                      >
                        Fill Rem.
                      </button>
                    )}
                  </div>
                  <input
                    id="pos-split-bank-amount"
                    type="number"
                    min={0}
                    value={splitBankAmount === '' ? '' : splitBankAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setSplitBankAmount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!selectedBankAccountId) {
                          focusField('pos-split-bank-select');
                        } else {
                          handleCompleteSale();
                        }
                      }
                    }}
                    placeholder="0"
                    className="w-full text-right font-black text-xs rounded-lg py-1 px-2 border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 font-mono dark:bg-[#121520] dark:border-[#2D3349] dark:text-white dark:focus:border-sky-400"
                  />
                </div>
              </div>

              {/* Bank Selector for the transfer portion */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-0.5 dark:text-slate-300">
                  Select Destination Bank Account <span className="text-red-500">*</span>
                </label>
                <select
                  id="pos-split-bank-select"
                  value={selectedBankAccountId}
                  onChange={(e) => setSelectedBankAccountId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCompleteSale();
                    }
                  }}
                  className="w-full text-xs font-bold rounded-lg py-1 px-2 border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 cursor-pointer dark:bg-[#121520] dark:border-[#2D3349] dark:text-white"
                  required
                >
                  <option value="">-- Select Bank Account --</option>
                  {bankAccounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} — {acc.account_title || acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Split Summary Footer */}
              <div className="flex justify-between items-center pt-1 border-t border-blue-200 text-xs dark:border-sky-500/20">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Total Tendered:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-sky-300">
                  Rs. {(effectiveSplitCash + effectiveSplitBank).toLocaleString()}
                </span>
              </div>

              {(effectiveSplitCash + effectiveSplitBank) > total && (
                <div className="flex items-center justify-between bg-emerald-100/90 text-emerald-900 px-2 py-0.5 rounded text-[10px] font-bold dark:bg-emerald-950/40 dark:border dark:border-emerald-800 dark:text-emerald-300">
                  <span>Change Return (from Cash):</span>
                  <span className="font-mono text-xs">
                    Rs. {((effectiveSplitCash + effectiveSplitBank) - total).toLocaleString()}
                  </span>
                </div>
              )}

              {(effectiveSplitCash + effectiveSplitBank) < total && (
                <div className="flex items-center justify-between bg-amber-100/90 text-amber-900 px-2 py-0.5 rounded text-[10px] font-bold dark:bg-amber-950/40 dark:border dark:border-amber-800 dark:text-amber-300">
                  <span>Remaining Due:</span>
                  <span className="font-mono text-xs">
                    Rs. {(total - (effectiveSplitCash + effectiveSplitBank)).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Slip Type Options */}
          <div className="p-1.5 bg-slate-100/80 border border-slate-200 rounded-lg dark:bg-[#0c101c] dark:border-[#23283B]">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setSlipMode('SINGLE')}
                className={`py-1 px-2 rounded text-[11px] font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                  slipMode === 'SINGLE'
                    ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold border-amber-500 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-[#161925] dark:text-slate-300 dark:border-[#2D3349] dark:hover:bg-[#1e2337]'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Single (1 Slip)</span>
              </button>
              <button
                type="button"
                onClick={() => setSlipMode('DUPLICATE')}
                className={`py-1 px-2 rounded text-[11px] font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                  slipMode === 'DUPLICATE'
                    ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold border-amber-500 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-[#161925] dark:text-slate-300 dark:border-[#2D3349] dark:hover:bg-[#1e2337]'
                }`}
              >
                <Copy className="w-3 h-3" />
                <span>Duplicate (2 Slips)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-1">
            <button
              type="button"
              onClick={handleHoldBill}
              disabled={cart.length === 0 || createHeldOrderMutation.isPending}
              className="col-span-1 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded-xl text-xs transition border border-amber-300 flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-2xs dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:border-amber-800/60"
              title="Hold current cart and clear screen for next customer (Alt + H / F8)"
            >
              <PauseCircle className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400" />
              <span>Hold Bill</span>
            </button>

            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={!isCartValid || checkoutMutation.isPending}
              className="col-span-2 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md shadow-amber-500/20 active:scale-[0.98] flex justify-center items-center gap-2 cursor-pointer dark:from-amber-500 dark:to-amber-600 dark:text-slate-950"
              title="Complete Sale & Print Thermal Receipt (Ctrl + Enter / F9)"
            >
              {checkoutMutation.isPending ? 'Processing POS Sale...' : 'Complete POS Sale'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerCreated={(newCustomer) => {
          queryClient.invalidateQueries({ queryKey: ['customersSelect'] });
          setSelectedCustomerId(newCustomer.id);
        }}
      />

      {/* Shift Audit Reconciliation Modal */}
      <ShiftAuditModal
        isOpen={isShiftAuditOpen}
        onClose={() => setIsShiftAuditOpen(false)}
      />

      {/* Held Orders Review & Resume Modal */}
      <HeldOrdersModal
        isOpen={isHeldOrdersOpen}
        onClose={() => setIsHeldOrdersOpen(false)}
        heldOrders={heldOrders}
        isLoading={isLoadingHeldOrders}
        onResume={handleResumeHeldOrder}
        onDelete={(orderId) => deleteHeldOrderMutation.mutate(orderId)}
        isDeleting={deleteHeldOrderMutation.isPending}
      />

      {/* Hold Confirmation Modal */}
      <HoldConfirmModal
        isOpen={isHoldConfirmOpen}
        onClose={() => setIsHoldConfirmOpen(false)}
        onConfirm={(refNote) => createHeldOrderMutation.mutate(refNote)}
        customerName={selectedCustomerId ? (customers.find(c => c.id === selectedCustomerId)?.name || 'Walk-In Customer') : 'Walk-In Customer'}
        itemsCount={cart.length}
        totalAmount={total}
        isPending={createHeldOrderMutation.isPending}
      />

      </div>
    </>
  );
}
