import React from 'react';
import { X, Printer, FileText, Calendar, User, Truck, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface InvoiceDetailItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_code?: string;
  batch_number?: string;
  batch_weight_per_unit?: number;
  batch_selected_unit?: string;
  quantity: number;
  selected_unit?: string;
  net_kg_processed?: number;
  unit_price: number;
  total_price: number;
}

export interface InvoiceDetailData {
  id: string;
  invoice_number: string;
  date: string;
  due_date?: string | null;
  status: string;
  customer_name?: string;
  customer_code?: string;
  customer_phone?: string;
  customer_city?: string;
  supplier_name?: string;
  supplier_code?: string;
  supplier_phone?: string;
  supplier_city?: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  notes?: string | null;
  items: InvoiceDetailItem[];
}

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceDetailData | null;
  type?: 'sales' | 'purchase';
}

export default function InvoiceDetailModal({ isOpen, onClose, invoice, type = 'sales' }: InvoiceDetailModalProps) {
  if (!isOpen || !invoice) return null;

  const formatPKR = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatNumber = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(val);
  };

  const entityName = type === 'purchase' ? (invoice.supplier_name || 'Supplier') : (invoice.customer_name || 'Customer');
  const entityCode = type === 'purchase' ? invoice.supplier_code : invoice.customer_code;
  const entityPhone = type === 'purchase' ? invoice.supplier_phone : invoice.customer_phone;
  const entityCity = type === 'purchase' ? invoice.supplier_city : invoice.customer_city;

  const subtotal = Number(invoice.subtotal || invoice.total_amount + (invoice.discount || 0));
  const discount = Number(invoice.discount || 0);
  const totalAmount = Number(invoice.total_amount || 0);
  const paidAmount = Number(invoice.paid_amount || 0);
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  const statusUpper = (invoice.status || 'UNPAID').toUpperCase();

  const getStatusBadge = () => {
    if (statusUpper === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          PAID
        </span>
      );
    }
    if (statusUpper === 'PARTIAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertCircle className="w-3.5 h-3.5" />
          PARTIAL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle className="w-3.5 h-3.5" />
        UNPAID
      </span>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none print:w-full">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 print:bg-white print:border-b-2 print:border-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 print:hidden">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 font-mono tracking-tight">
                {type === 'purchase' ? 'Purchase Invoice' : 'Invoice'} #{invoice.invoice_number}
              </h2>
              <p className="text-xs text-slate-500 font-medium print:hidden">
                Detailed line-item & batch breakdown
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition print:hidden"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 print:overflow-visible print:p-4">
          {/* Metadata Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 print:bg-white print:border-slate-300">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {type === 'purchase' ? 'Supplier Details' : 'Billed To'}
              </span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <User className="w-4 h-4 text-purple-600 print:hidden" />
                {entityName} {entityCode ? `(${entityCode})` : ''}
              </div>
              {entityPhone && <p className="text-xs text-slate-600">Phone: {entityPhone}</p>}
              {entityCity && <p className="text-xs text-slate-500">City: {entityCity}</p>}
            </div>

            <div className="space-y-1 md:text-right">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Invoice Details
              </span>
              <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5 md:justify-end">
                <Calendar className="w-4 h-4 text-purple-600 print:hidden" />
                Date: {invoice.date ? new Date(invoice.date).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : 'N/A'}
              </div>
              {invoice.due_date && (
                <p className="text-xs text-slate-500">
                  Due Date: {new Date(invoice.due_date).toLocaleDateString('en-PK', { dateStyle: 'medium' })}
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Batch Info</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!invoice.items || invoice.items.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                      No line items found for this invoice.
                    </td>
                  </tr>
                ) : (
                  invoice.items.map((item, idx) => {
                    const unitName = item.selected_unit || 'Dasti';
                    const batchNo = item.batch_number || 'DEFAULT';

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {item.product_name}
                          {item.product_code && <span className="ml-1 text-[10px] text-slate-400 font-mono">({item.product_code})</span>}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-purple-700">
                          {batchNo}
                          {item.batch_weight_per_unit && (
                            <span className="block text-[10px] text-slate-500 font-normal">
                              1 {unitName} = {item.batch_weight_per_unit} KG
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">
                          {formatNumber(item.quantity)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">{unitName}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatPKR(item.unit_price)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatPKR(item.total_price)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          <div className="flex flex-col md:flex-row justify-between gap-4 pt-2">
            <div className="text-xs text-slate-500 space-y-1">
              {invoice.notes && (
                <div>
                  <strong className="text-slate-700 block">Notes:</strong>
                  <p className="italic bg-slate-50 p-2 rounded border border-slate-200">{invoice.notes}</p>
                </div>
              )}
            </div>

            <div className="w-full md:w-64 space-y-2 text-xs border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-6">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">{formatPKR(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span className="font-mono font-semibold">-{formatPKR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="font-mono">{formatPKR(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Amount Paid:</span>
                <span className="font-mono font-medium">{formatPKR(paidAmount)}</span>
              </div>

              {balanceDue > 0 ? (
                <div className="flex justify-between font-black text-rose-600 text-sm pt-1.5 border-t border-rose-200">
                  <span>Balance Due:</span>
                  <span className="font-mono">{formatPKR(balanceDue)}</span>
                </div>
              ) : (
                <div className="flex justify-between font-bold text-emerald-600 text-xs pt-1 border-t border-emerald-100">
                  <span>Balance Due:</span>
                  <span className="font-mono">Rs. 0.00 (Fully Paid)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold rounded-xl transition"
          >
            Close
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-md transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
