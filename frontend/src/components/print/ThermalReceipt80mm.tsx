import React from 'react';
import sabirLogo from '../../assets/sabirlogo.png';

interface ThermalReceiptProps {
  data: any;
}

export const ThermalReceipt80mm: React.FC<ThermalReceiptProps> = ({ data }) => {
  if (!data) return null;

  const invoiceNumber = data.invoice_number || data.code || data.id || 'N/A';

  // Format Date and Time: e.g. 18-Oct-2026, 12:06 am
  const formatDateTime = (dateStr: string | Date | undefined | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day}-${month}-${year}, ${hours}:${minutes} ${ampm}`;
    } catch {
      return String(dateStr);
    }
  };

  const formatNumber = (val: number | string | undefined | null) => {
    const n = Number(val);
    if (isNaN(n)) return '0';
    return n.toLocaleString('en-PK', { maximumFractionDigits: 2 });
  };

  const customerName =
    data.customer_name ||
    data.customer?.name ||
    (data.type === 'purchase' ? (data.supplier_name || 'Supplier') : 'Walk-In Customer');

  const cashierName =
    data.created_by_name ||
    data.creator?.name ||
    data.cashierName ||
    (data.created_by_role ? `${data.created_by_role}` : 'Owner');

  const dateValue = data.date || data.created_at || new Date().toISOString();

  // Normalize items array
  const rawItems: any[] = data.items || data.order_details || [];
  const items = rawItems.map((item) => {
    const name = item.product_name || item.productName || item.product?.name || 'Item';
    const size = item.size || item.product_size || item.variant_size || null;
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const unit = item.selected_unit || item.unit || 'KG';
    const rate = Number(item.unit_price ?? item.price ?? 0);
    const total = Number(item.total_price ?? item.total ?? qty * rate);

    return {
      fullName: size ? `${name} - ${size}` : name,
      qty,
      unit,
      rate,
      total,
    };
  });

  const subtotal = Number(data.subtotal ?? (data.total_amount + (data.discount || 0)));
  const discount = Number(data.discount || 0);
  const netPayable = Number(data.net_invoice_total ?? data.net_total ?? data.total_amount ?? 0);
  const cashTendered = Number(data.paid_amount ?? data.amount_paid ?? data.cash_tendered ?? netPayable);
  const balanceDue = Number(data.balance_due ?? Math.max(0, netPayable - cashTendered));
  const changeDue = Math.max(0, cashTendered - netPayable);

  const invoiceTypeTitle = data.type === 'purchase'
    ? 'PURCHASE BILL'
    : (data.invoice_type === 'CREDIT_NOTE' || invoiceNumber.startsWith('CN-'))
      ? 'CREDIT NOTE'
      : (data.invoice_type === 'DEBIT_NOTE' || invoiceNumber.startsWith('DN-'))
        ? 'DEBIT NOTE'
        : 'CASH RETAIL INVOICE';

  return (
    <div className="w-[80mm] mx-auto bg-white text-black p-0 m-0 font-mono text-[11px] leading-tight box-border print:w-[80mm] print:p-0">
      <div className="p-3">
        {/* Logo & Header */}
        <div className="text-center mb-2 flex flex-col items-center justify-center">
          <img
            src={sabirLogo}
            alt="SPS"
            className="h-12 w-auto object-contain mx-auto mb-1"
          />
          <h1 className="font-bold text-base tracking-wide uppercase leading-tight">
            SABIR PLASTIC
          </h1>
          <p className="text-[10px] text-gray-800 leading-tight mt-0.5">
            Manufacturers & Dealers of Plastic Materials
          </p>
          <div className="flex justify-center mt-2 mb-1">
            <div className="border border-black px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {invoiceTypeTitle}
            </div>
          </div>
        </div>

        {/* Dotted Divider */}
        <div className="border-b border-dashed border-black my-2"></div>

        {/* Metadata Section */}
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between items-start">
            <span className="font-semibold">Invoice #:</span>
            <span className="font-bold font-mono text-right">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="font-semibold">Date:</span>
            <span className="text-right">{formatDateTime(dateValue)}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="font-semibold">Customer:</span>
            <span className="font-bold text-right max-w-[48mm] break-words">{customerName}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="font-semibold">Cashier:</span>
            <span className="text-right">{cashierName}</span>
          </div>
        </div>

        {/* Dotted Divider */}
        <div className="border-b border-dashed border-black my-2"></div>

        {/* Items Table */}
        <table className="w-full text-[11px] mb-1">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1 font-bold text-left">Item</th>
              <th className="py-1 font-bold text-center w-12">Qty</th>
              <th className="py-1 font-bold text-right w-12">Rate</th>
              <th className="py-1 font-bold text-right w-14">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-gray-200">
            {items.map((item, idx) => (
              <tr key={idx} className="align-top">
                <td className="py-1 pr-1 font-medium break-words leading-tight">
                  {item.fullName}
                </td>
                <td className="py-1 text-center whitespace-nowrap">
                  {item.qty} {item.unit}
                </td>
                <td className="py-1 text-right whitespace-nowrap">
                  {formatNumber(item.rate)}
                </td>
                <td className="py-1 text-right whitespace-nowrap font-bold">
                  {formatNumber(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Dotted Divider */}
        <div className="border-b border-dashed border-black my-2"></div>

        {/* Totals Section */}
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>Gross Subtotal:</span>
            <span className="font-semibold">Rs. {formatNumber(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-gray-800">
              <span>Discount:</span>
              <span>-Rs. {formatNumber(discount)}</span>
            </div>
          )}

          <div className="border-t border-black pt-1 my-0.5"></div>

          <div className="flex justify-between font-extrabold text-[13px] py-0.5">
            <span>NET PAYABLE:</span>
            <span>Rs. {formatNumber(netPayable)}</span>
          </div>

          <div className="border-b border-black pb-0.5 mb-1"></div>

          <div className="flex justify-between">
            <span>Cash Tendered:</span>
            <span>Rs. {formatNumber(cashTendered)}</span>
          </div>

          {changeDue > 0 && (
            <div className="flex justify-between text-gray-800">
              <span>Change Due:</span>
              <span>Rs. {formatNumber(changeDue)}</span>
            </div>
          )}

          {balanceDue > 0 && (
            <div className="flex justify-between font-bold text-black">
              <span>Balance Due:</span>
              <span>Rs. {formatNumber(balanceDue)}</span>
            </div>
          )}
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-end pt-6 pb-2 text-[10px]">
          <div className="text-center">
            <div className="text-gray-400 tracking-widest text-[9px]">....................</div>
            <div className="mt-0.5 font-medium">Customer Sign</div>
          </div>
          <div className="text-center">
            <div className="w-28 border-b-2 border-black mb-1"></div>
            <div className="font-bold">Authorized Sign</div>
          </div>
        </div>

        {/* Dotted Divider */}
        <div className="border-b border-dashed border-black my-2"></div>

        {/* Footer */}
        <div className="text-center space-y-1 mt-2">
          <p className="font-bold text-[11px]">Thank You For Your Business!</p>
          <p className="text-[10px] leading-relaxed font-sans px-1 text-center" dir="rtl">
            نوٹ: مال نہ ملنے کی صورت میں 15 دن میں رابطہ کریں اس کے بعد کمپنی ذمہ دار نہیں ہوگی۔ شکریہ
          </p>
          <p className="text-[8.5px] text-gray-700 tracking-tight">
            * Software Generated POS Tax-Compliant Receipt *
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThermalReceipt80mm;
