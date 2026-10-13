import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useProductsStore } from '../../store/products.store';

export default function PurchaseForm({ onSubmitSuccess, onCancel }) {
  const { products, fetchProducts } = useProductsStore();

  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleProductChange = (e) => {
    const pId = e.target.value;
    setSelectedProductId(pId);
    const prod = products.find((p) => p.id === pId);
    if (prod) {
      setUnitPrice(Number(prod.cost_price || 0));
    }
  };

  const numQuantity = Number(quantity) || 0;
  const numUnitPrice = Number(unitPrice) || 0;
  const totalAmount = numQuantity * numUnitPrice;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      setErrorMessage('Please select a product.');
      return;
    }
    if (numQuantity <= 0) {
      setErrorMessage('Quantity (KG) must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const payload = {
      supplier_id: supplierId,
      date: invoiceDate,
      notes: notes,
      items: [
        {
          product_id: selectedProductId,
          quantity: numQuantity,
          selected_unit: 'KG',
          unit_price: numUnitPrice,
        },
      ],
    };

    try {
      const response = await axios.post('/api/v1/purchases', payload, {
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
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to record purchase');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100 max-w-xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-slate-800">Purchase Item (Strict KG Wholesale Model)</h2>

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

      {/* Quantity (KG) */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Quantity (KG)
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      {/* Unit Price per KG */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Price / KG (Rs.)
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

      {/* Total Amount */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-sm font-semibold text-slate-800">
        <span>Line Total:</span>
        <span className="font-mono text-emerald-600 text-base">Rs. {totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
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
          {isSubmitting ? 'Submitting...' : 'Save Purchase'}
        </button>
      </div>
    </form>
  );
}
