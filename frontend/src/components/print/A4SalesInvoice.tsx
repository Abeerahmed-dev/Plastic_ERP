import React from 'react';
import { CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import sabirLogo from '../../assets/sabirlogo.png';

interface A4SalesInvoiceProps {
  data: any;
}

export const A4SalesInvoice: React.FC<A4SalesInvoiceProps> = ({ data }) => {
  if (!data) return null;

  const invoiceNumber = data.invoice_number || data.code || data.id || 'N/A';

  // Format Date: e.g. 17-Oct-2026
  const formatDate = (dateStr: string | Date | undefined | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
    } catch {
      return String(dateStr);
    }
  };

  const formatDecimal = (val: number | string | undefined | null) => {
    const n = Number(val);
    if (isNaN(n)) return '0.00';
    return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatNumber = (val: number | string | undefined | null) => {
    const n = Number(val);
    if (isNaN(n)) return '0';
    return n.toLocaleString('en-PK', { maximumFractionDigits: 2 });
  };

  const isPurchase = data.type === 'purchase';
  const entityName = isPurchase
    ? (data.supplier_name || 'Supplier')
    : (data.customer_name || 'Walk-In Customer');
  const entityCode = isPurchase ? data.supplier_code : data.customer_code;
  const entityPhone = isPurchase ? data.supplier_phone : data.customer_phone;
  const entityCity = isPurchase ? data.supplier_city : data.customer_city;

  const subtotal = Number(data.subtotal ?? (data.total_amount + (data.discount || 0)));
  const discount = Number(data.discount || 0);
  const deliveryCharge = Number(data.delivery_charge || 0);
  const totalAmount = Number(data.total_amount || 0);
  const paidAmount = Number(data.paid_amount ?? data.amount_paid ?? 0);

  const isDebitNote = data.invoice_type === 'DEBIT_NOTE' || invoiceNumber.startsWith('DN-');
  const isCreditNote = data.invoice_type === 'CREDIT_NOTE' || invoiceNumber.startsWith('CN-') || (!isDebitNote && totalAmount < 0);
  const statusUpper = (data.status || 'UNPAID').toUpperCase();

  const childReturns = (isPurchase ? (data.linked_debit_notes || data.credit_notes) : data.credit_notes) || [];
  const totalReturnedAmount = data.linked_returns_total !== undefined
    ? Number(data.linked_returns_total)
    : childReturns.reduce((acc: number, cn: any) => acc + Math.abs(Number(cn.total_amount || 0)), 0);

  const netFinalInvoiceTotal = data.net_invoice_total !== undefined
    ? Number(data.net_invoice_total)
    : Math.round((totalAmount - totalReturnedAmount) * 100) / 100;

  const balanceDue = data.balance_due !== undefined
    ? Number(data.balance_due)
    : Math.round((netFinalInvoiceTotal - paidAmount) * 100) / 100;

  // Normalized items
  const rawItems: any[] = data.items || data.order_details || [];
  const items = rawItems.map((item) => {
    const name = item.product_name || item.productName || item.product?.name || 'Item';
    const code = item.product_code || item.code || item.product?.code || '';
    const size = item.size || item.product_size || item.variant_size || null;
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const unit = item.selected_unit || item.unit || 'KG';
    const unitPrice = Number(item.unit_price ?? item.price ?? 0);
    const totalPrice = Number(item.total_price ?? item.total ?? qty * unitPrice);

    return {
      name,
      code,
      size,
      qty,
      unit,
      unitPrice,
      totalPrice,
    };
  });

  const getStatusBadge = () => {
    if (isDebitNote) {
      return (
        <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
          <RotateCcw className="w-3.5 h-3.5" />
          DEBIT NOTE
        </span>
      );
    }
    if (isCreditNote) {
      return (
        <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-300">
          <RotateCcw className="w-3.5 h-3.5" />
          CREDIT NOTE
        </span>
      );
    }
    if (balanceDue < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
          <AlertCircle className="w-3.5 h-3.5" />
          OVERPAID
        </span>
      );
    }
    if (statusUpper === 'PAID' || balanceDue === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          PAID
        </span>
      );
    }
    if (statusUpper === 'PARTIAL' || (paidAmount > 0 && balanceDue > 0)) {
      return (
        <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
          <AlertCircle className="w-3.5 h-3.5" />
          PARTIAL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
        <AlertCircle className="w-3.5 h-3.5" />
        UNPAID
      </span>
    );
  };

  const invoiceTitle = isPurchase
    ? (isDebitNote ? 'OFFICIAL DEBIT NOTE' : 'OFFICIAL PURCHASE INVOICE')
    : (isCreditNote ? 'OFFICIAL CREDIT NOTE' : 'OFFICIAL SALES INVOICE');

  return (
    <div className="w-full max-w-[210mm] mx-auto bg-white text-black p-6 font-sans box-border print:w-full print:max-w-none print:p-2 print:m-0 break-inside-avoid page-break-inside-avoid">
      {/* Top Header Banner */}
      <div className="text-center mb-4 print:mb-3">
        <img
          src={sabirLogo}
          alt="Sabir Plastic"
          className="h-14 w-auto object-contain mx-auto mb-1.5"
        />
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-tight">
          SABIR PLASTIC
        </h1>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mt-0.5 mb-2">
          {invoiceTitle}
        </p>

        {/* Badges */}
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex items-center px-3.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold font-mono">
            Invoice #{invoiceNumber}
          </span>
          {getStatusBadge()}
        </div>
      </div>

      {/* Customer & Invoice Details Card */}
      <div className="rounded-2xl border border-slate-200 p-4 print:p-3 mb-4 print:mb-3 bg-white space-y-3">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {isPurchase ? 'SUPPLIER DETAILS' : 'BILLED TO'}
          </span>
          <p className="font-bold text-slate-900 text-sm">
            {entityName} {entityCode ? `(${entityCode})` : ''}
          </p>
          {entityPhone && <p className="text-xs text-slate-600 mt-0.5">Phone: {entityPhone}</p>}
          {entityCity && <p className="text-xs text-slate-600 mt-0.5">City: {entityCity}</p>}
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            INVOICE DETAILS
          </span>
          <p className="text-xs text-slate-700 font-medium">
            Date: {formatDate(data.date || data.created_at)}
          </p>
          {data.due_date && (
            <p className="text-xs text-slate-700 font-medium mt-0.5">
              Due Date: {formatDate(data.due_date)}
            </p>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden mb-6">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10 text-center">#</th>
              <th className="px-4 py-3">PRODUCT</th>
              <th className="px-4 py-3 text-center">SIZE</th>
              <th className="px-4 py-3 text-right">ORIGINAL QTY</th>
              <th className="px-4 py-3 text-center">UNIT</th>
              <th className="px-4 py-3 text-right">UNIT PRICE</th>
              <th className="px-4 py-3 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-center text-slate-500 font-medium">
                  {idx + 1}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {item.name} {item.code ? <span className="text-slate-400 font-normal">({item.code})</span> : null}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.size ? (
                    <span className="inline-block px-2.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[11px] font-medium font-mono text-slate-700">
                      {item.size}
                    </span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                  {formatNumber(item.qty)}
                </td>
                <td className="px-4 py-3 text-center text-slate-600 font-medium">
                  {item.unit}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-800">
                  Rs {formatDecimal(item.unitPrice)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                  Rs {formatDecimal(item.totalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="border-t border-slate-200 pt-4 mb-6">
        <div className="flex justify-end">
          <div className="w-80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono">Rs {formatDecimal(subtotal)}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span className="font-mono">-Rs {formatDecimal(discount)}</span>
              </div>
            )}

            {deliveryCharge > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Delivery / Freight:</span>
                <span className="font-mono">+Rs {formatDecimal(deliveryCharge)}</span>
              </div>
            )}

            <div className="border-t border-slate-300 pt-2 flex justify-between font-extrabold text-sm text-slate-900">
              <span>Original Grand Total:</span>
              <span className="font-mono">Rs {formatDecimal(totalAmount)}</span>
            </div>

            {childReturns.length > 0 && (
              <>
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Less Returns:</span>
                  <span className="font-mono">-Rs {formatDecimal(totalReturnedAmount)}</span>
                </div>
                <div className="flex justify-between text-purple-700 font-bold bg-purple-50/50 p-1 rounded">
                  <span>Net Final Total:</span>
                  <span className="font-mono">Rs {formatDecimal(netFinalInvoiceTotal)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Amount Paid:</span>
              <span className="font-mono">Rs {formatDecimal(paidAmount)}</span>
            </div>

            <div className="border-t border-slate-100 pt-2 flex justify-between font-bold">
              <span>Balance Due:</span>
              {balanceDue === 0 || statusUpper === 'PAID' ? (
                <span className="font-mono text-emerald-600">Rs. 0.00 (Fully Settled)</span>
              ) : balanceDue < 0 ? (
                <span className="font-mono text-amber-600">
                  -Rs. {formatDecimal(Math.abs(balanceDue))} (Overpaid)
                </span>
              ) : (
                <span className="font-mono text-rose-600">
                  Rs {formatDecimal(balanceDue)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="pt-8 print:pt-6 pb-2 flex justify-between items-end px-4">
        <div className="text-center">
          <div className="w-52 border-b border-dashed border-slate-400 mb-1.5"></div>
          <p className="text-xs text-slate-600">Receiver's Signature</p>
        </div>

        <div className="text-center">
          <div className="w-56 border-b-2 border-black mb-1.5"></div>
          <p className="text-xs font-bold text-black uppercase tracking-wider">
            AUTHORIZED SIGNATURE
          </p>
        </div>
      </div>
    </div>
  );
};

export default A4SalesInvoice;
