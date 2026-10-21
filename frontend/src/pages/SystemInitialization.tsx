import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Package,
  Users,
  Truck,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { productsService } from '../services/products.service';
import { Product } from '../types/product.types';
import {
  onboardingService,
  CustomerOnboardingInput,
  SupplierOnboardingInput,
  InventoryOnboardingInput,
} from '../services/onboarding.service';

type ActiveTab = 'stock' | 'customers' | 'suppliers';

interface StockRow {
  id: string;
  product_id: string;
  initial_kg: string;
  avg_buy_price_per_kg: string;
  notes: string;
}

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  city: string;
  opening_balance: string;
}

interface SupplierRow {
  id: string;
  name: string;
  phone: string;
  city: string;
  opening_balance: string;
}

export function SystemInitialization() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stock');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic Row States
  const [stockRows, setStockRows] = useState<StockRow[]>([
    { id: '1', product_id: '', initial_kg: '', avg_buy_price_per_kg: '', notes: '' },
  ]);

  const [customerRows, setCustomerRows] = useState<CustomerRow[]>([
    { id: '1', name: '', phone: '', city: '', opening_balance: '' },
  ]);

  const [supplierRows, setSupplierRows] = useState<SupplierRow[]>([
    { id: '1', name: '', phone: '', city: '', opening_balance: '' },
  ]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const data = await productsService.getProducts();
      setProducts(data || []);
    } catch (err: any) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // ── Stock Row Actions ───────────────────────────────────
  const addStockRow = () => {
    setStockRows((prev) => [
      ...prev,
      { id: Date.now().toString(), product_id: '', initial_kg: '', avg_buy_price_per_kg: '', notes: '' },
    ]);
  };

  const removeStockRow = (id: string) => {
    if (stockRows.length <= 1) return;
    setStockRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateStockRow = (id: string, field: keyof StockRow, val: string) => {
    setStockRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    );
  };

  // ── Customer Row Actions ────────────────────────────────
  const addCustomerRow = () => {
    setCustomerRows((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', phone: '', city: '', opening_balance: '' },
    ]);
  };

  const removeCustomerRow = (id: string) => {
    if (customerRows.length <= 1) return;
    setCustomerRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateCustomerRow = (id: string, field: keyof CustomerRow, val: string) => {
    setCustomerRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    );
  };

  // ── Supplier Row Actions ────────────────────────────────
  const addSupplierRow = () => {
    setSupplierRows((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', phone: '', city: '', opening_balance: '' },
    ]);
  };

  const removeSupplierRow = (id: string) => {
    if (supplierRows.length <= 1) return;
    setSupplierRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateSupplierRow = (id: string, field: keyof SupplierRow, val: string) => {
    setSupplierRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    );
  };

  // ── Submissions ─────────────────────────────────────────
  const handleSubmitStock = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const validItems: InventoryOnboardingInput[] = [];
    for (const r of stockRows) {
      if (!r.product_id) continue;
      const initial_kg = parseFloat(r.initial_kg);
      const avg_buy_price_per_kg = parseFloat(r.avg_buy_price_per_kg);

      if (isNaN(initial_kg) || initial_kg <= 0) {
        setErrorMessage('Please enter a valid stock quantity (KG) greater than 0 for selected products.');
        return;
      }
      if (isNaN(avg_buy_price_per_kg) || avg_buy_price_per_kg < 0) {
        setErrorMessage('Please enter a valid average buy price per KG.');
        return;
      }

      validItems.push({
        product_id: r.product_id,
        initial_kg,
        avg_buy_price_per_kg,
        notes: r.notes || 'Day Zero Stock Initialization',
      });
    }

    if (validItems.length === 0) {
      setErrorMessage('Please select at least one product and specify its initial stock quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onboardingService.bulkInventory(validItems);
      setSuccessMessage(res.data?.message || `Successfully initialized ${validItems.length} product stock item(s).`);
      setStockRows([{ id: Date.now().toString(), product_id: '', initial_kg: '', avg_buy_price_per_kg: '', notes: '' }]);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to initialize inventory.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCustomers = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const validCustomers: CustomerOnboardingInput[] = [];
    for (const r of customerRows) {
      if (!r.name.trim()) continue;
      const opening_balance = parseFloat(r.opening_balance || '0');

      if (isNaN(opening_balance)) {
        setErrorMessage(`Invalid opening balance for customer "${r.name}".`);
        return;
      }

      validCustomers.push({
        name: r.name.trim(),
        phone: r.phone.trim() || null,
        city: r.city.trim() || null,
        opening_balance,
      });
    }

    if (validCustomers.length === 0) {
      setErrorMessage('Please enter at least one customer name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onboardingService.bulkCustomers(validCustomers);
      setSuccessMessage(res.data?.message || `Successfully initialized ${validCustomers.length} customer record(s).`);
      setCustomerRows([{ id: Date.now().toString(), name: '', phone: '', city: '', opening_balance: '' }]);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to initialize customer udhaar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitSuppliers = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const validSuppliers: SupplierOnboardingInput[] = [];
    for (const r of supplierRows) {
      if (!r.name.trim()) continue;
      const opening_balance = parseFloat(r.opening_balance || '0');

      if (isNaN(opening_balance)) {
        setErrorMessage(`Invalid opening balance for supplier "${r.name}".`);
        return;
      }

      validSuppliers.push({
        name: r.name.trim(),
        phone: r.phone.trim() || null,
        city: r.city.trim() || null,
        opening_balance,
      });
    }

    if (validSuppliers.length === 0) {
      setErrorMessage('Please enter at least one supplier name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onboardingService.bulkSuppliers(validSuppliers);
      setSuccessMessage(res.data?.message || `Successfully initialized ${validSuppliers.length} supplier debt record(s).`);
      setSupplierRows([{ id: Date.now().toString(), name: '', phone: '', city: '', opening_balance: '' }]);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to initialize supplier debt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate totals
  const totalStockAssetValue = stockRows.reduce((sum, r) => {
    const kg = parseFloat(r.initial_kg) || 0;
    const price = parseFloat(r.avg_buy_price_per_kg) || 0;
    return sum + kg * price;
  }, 0);

  const totalCustomerUdhaar = customerRows.reduce((sum, r) => sum + (parseFloat(r.opening_balance) || 0), 0);
  const totalSupplierPayable = supplierRows.reduce((sum, r) => sum + (parseFloat(r.opening_balance) || 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* ⚠️ Mandatory Safety UX Warning Banner */}
      <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-5 shadow-sm flex items-start gap-4">
        <div className="p-3 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-amber-900 tracking-tight">
            System Initialization Notice
          </h2>
          <p className="mt-1 text-sm font-medium text-amber-800 leading-relaxed">
            Use these forms <span className="font-bold underline">ONLY</span> to input your physical paper records on your first day of using the ERP.
            These transactions inject Day Zero opening stock and capital balances directly without generating false purchase invoices, inflated sales revenue, or standard double-entry ledger distortions.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-2">
          <button
            onClick={() => { setActiveTab('stock'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'stock'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Package className="h-4 w-4" />
            1. Existing Stock (Inventory)
          </button>

          <button
            onClick={() => { setActiveTab('customers'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'customers'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            2. Customer Udhaar (Receivables)
          </button>

          <button
            onClick={() => { setActiveTab('suppliers'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'suppliers'
                ? 'bg-white text-emerald-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Truck className="h-4 w-4" />
            3. Party Debt (Payables)
          </button>
        </div>

        {/* Tab 1: Existing Stock */}
        {activeTab === 'stock' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Physical Stock Opening Balances</h3>
                <p className="text-xs text-slate-500">Record initial warehouse inventory without supplier purchase invoices.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">
                  Total Asset Value: <span className="text-blue-600 font-bold text-sm">Rs. {totalStockAssetValue.toLocaleString()}</span>
                </span>
                <button
                  onClick={addStockRow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                >
                  <Plus className="h-4 w-4 text-slate-500" />
                  Add Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4 min-w-[240px]">Product</th>
                    <th className="py-3 px-4 w-40 text-right">Initial Stock (KG)</th>
                    <th className="py-3 px-4 w-44 text-right">Avg Buy Price / KG (Rs.)</th>
                    <th className="py-3 px-4 w-44 text-right">Total Asset Value</th>
                    <th className="py-3 px-4 min-w-[180px]">Notes</th>
                    <th className="py-3 px-4 w-14 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockRows.map((row, index) => {
                    const kg = parseFloat(row.initial_kg) || 0;
                    const price = parseFloat(row.avg_buy_price_per_kg) || 0;
                    const assetVal = kg * price;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-center font-semibold text-slate-400">{index + 1}</td>
                        <td className="py-3 px-4">
                          <select
                            value={row.product_id}
                            onChange={(e) => updateStockRow(row.id, 'product_id', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">-- Select Product --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.code})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            placeholder="0.00"
                            value={row.initial_kg}
                            onChange={(e) => updateStockRow(row.id, 'initial_kg', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-right font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            placeholder="0.00"
                            value={row.avg_buy_price_per_kg}
                            onChange={(e) => updateStockRow(row.id, 'avg_buy_price_per_kg', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-right font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">
                          Rs. {assetVal.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="e.g., Physical Audit 01-Jan"
                            value={row.notes}
                            onChange={(e) => updateStockRow(row.id, 'notes', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => removeStockRow(row.id)}
                            disabled={stockRows.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmitStock}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Submit Inventory Opening Stock
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Customer Udhaar */}
        {activeTab === 'customers' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Customer Udhaar (Opening Receivables)</h3>
                <p className="text-xs text-slate-500">Record customer paper debt balances owed to your business at go-live.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">
                  Total Receivables: <span className="text-indigo-600 font-bold text-sm">Rs. {totalCustomerUdhaar.toLocaleString()}</span>
                </span>
                <button
                  onClick={addCustomerRow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                >
                  <Plus className="h-4 w-4 text-slate-500" />
                  Add Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4 min-w-[200px]">Customer Name</th>
                    <th className="py-3 px-4 w-40">Phone</th>
                    <th className="py-3 px-4 w-36">City</th>
                    <th className="py-3 px-4 w-48 text-right">Opening Balance (Udhaar Owed)</th>
                    <th className="py-3 px-4 w-14 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerRows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-center font-semibold text-slate-400">{index + 1}</td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="e.g., General Plastic Store"
                          value={row.name}
                          onChange={(e) => updateCustomerRow(row.id, 'name', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="0300-1234567"
                          value={row.phone}
                          onChange={(e) => updateCustomerRow(row.id, 'phone', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Lahore"
                          value={row.city}
                          onChange={(e) => updateCustomerRow(row.id, 'city', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={row.opening_balance}
                          onChange={(e) => updateCustomerRow(row.id, 'opening_balance', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-right font-bold text-indigo-700 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => removeCustomerRow(row.id)}
                          disabled={customerRows.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmitCustomers}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Submit Customer Opening Debt
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Supplier Debt */}
        {activeTab === 'suppliers' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Party Debt (Opening Payables)</h3>
                <p className="text-xs text-slate-500">Record money your business owes to parties at system go-live.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">
                  Total Payables: <span className="text-rose-600 font-bold text-sm">Rs. {totalSupplierPayable.toLocaleString()}</span>
                </span>
                <button
                  onClick={addSupplierRow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                >
                  <Plus className="h-4 w-4 text-slate-500" />
                  Add Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4 min-w-[200px]">Party Name</th>
                    <th className="py-3 px-4 w-40">Phone</th>
                    <th className="py-3 px-4 w-36">City</th>
                    <th className="py-3 px-4 w-48 text-right">Opening Balance (Payable Owed)</th>
                    <th className="py-3 px-4 w-14 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierRows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-center font-semibold text-slate-400">{index + 1}</td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="e.g., Polymer Traders Ltd"
                          value={row.name}
                          onChange={(e) => updateSupplierRow(row.id, 'name', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="0321-7654321"
                          value={row.phone}
                          onChange={(e) => updateSupplierRow(row.id, 'phone', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Gujranwala"
                          value={row.city}
                          onChange={(e) => updateSupplierRow(row.id, 'city', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={row.opening_balance}
                          onChange={(e) => updateSupplierRow(row.id, 'opening_balance', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-right font-bold text-rose-700 focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => removeSupplierRow(row.id)}
                          disabled={supplierRows.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmitSuppliers}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Submit Party Opening Debt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SystemInitialization;
