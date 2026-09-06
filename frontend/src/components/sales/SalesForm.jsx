import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useProductsStore } from '../../store/products.store';

export default function SalesForm({ onSubmitSuccess, onCancel }) {
  const { products, fetchProducts, getUnitConversions } = useProductsStore();

  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState('Dasti');
  const [actualWeightPerUnit, setActualWeightPerUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const unitConversions = selectedProductId
    ? getUnitConversions(selectedProductId)
    : { Bora: 25.0, Peti: 15.0, Dasti: 0.5, Pura: 5.0, KG: 1.0 };

  const availableUnits = Object.keys(unitConversions);

  const handleProductChange = (e) => {
    const pId = e.target.value;
    setSelectedProductId(pId);
    const prod = products.find((p) => p.id === pId);
    if (prod) {
      setUnitPrice(Number(prod.sale_price || 0));
      const conversions = prod.unit_conversions || { Bora: 25.0, Peti: 15.0, Dasti: 0.5, Pura: 5.0, KG: 1.0 };
      const keys = Object.keys(conversions);
      if (keys.length > 0 && !keys.includes(selectedUnit)) {
        setSelectedUnit(keys[0]);
      }
    }
  };

  const numQuantity = Number(quantity) || 0;
  const currentMultiplier = unitConversions[selectedUnit] !== undefined ? Number(unitConversions[selectedUnit]) : 1.0;
  const calculatedStandardWeight = numQuantity * currentMultiplier;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      setErrorMessage('Please select a product.');
      return;
    }
    if (numQuantity <= 0) {
      setErrorMessage('Quantity must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const payload = {
      customer_id: customerId,
      date: invoiceDate,
      notes: notes,
      items: [
        {
          product_id: selectedProductId,
          quantity: numQuantity,
          selected_unit: selectedUnit,
          unit_price: Number(unitPrice) || 0,
          actual_weight_per_unit: actualWeightPerUnit !== '' ? Number(actualWeightPerUnit) : null,
        },
      ],
    };

    try {
      const response = await axios.post('/api/v1/invoices', payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
      });
      setIsSubmitting(false);
      if (onSubmitSuccess) {
        onSubmitSuccess(response.data);
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to record sales invoice');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100 max-w-xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-slate-800">Sales Item (Dynamic Unit Conversion)</h2>

      {errorMessage && (
        <div className="p-3 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
          {errorMessage}
        </div>
      )}

      {/* Product Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Select Product
        </label>
        <select
          value={selectedProductId}
          onChange={handleProductChange}
          className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">-- Choose Product --</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
      </div>

      {/* Quantity & Unit Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Quantity */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Quantity
          </label>
          <input
            type="number"
            step="0.0001"
            min="0.0001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {/* Read-Only Display String */}
          <p className="mt-1.5 text-xs font-semibold text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-100">
            Calculated Standard Weight: {calculatedStandardWeight.toFixed(2)} KG
          </p>
        </div>

        {/* Dynamic Unit Dropdown */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Selling Unit
          </label>
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableUnits.map((u) => (
              <option key={u} value={u}>
                {u} ({unitConversions[u]} KG)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Override Input */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Actual Kanta Wt of 1 {selectedUnit} (KG) - Optional
        </label>
        <input
          type="number"
          step="0.01"
          placeholder={`Standard is ${currentMultiplier} KG`}
          value={actualWeightPerUnit}
          onChange={(e) => setActualWeightPerUnit(e.target.value)}
          className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1.5 text-xs text-slate-400">
          Leave blank to use standard rate ({currentMultiplier} KG/unit)
        </p>
      </div>

      {/* Unit Price */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Unit Price (Per {selectedUnit})
        </label>
        <input
          type="number"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Save Sales Invoice'}
        </button>
      </div>
    </form>
  );
}
