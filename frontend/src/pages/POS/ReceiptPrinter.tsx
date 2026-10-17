import { forwardRef } from 'react';
import sabirLogo from '../../assets/sabirlogo.png';

interface ReceiptProps {
  invoice: any;
  items: any[];
  cashierName: string;
  customerName?: string;
}

export const ReceiptPrinter = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ invoice, items, cashierName, customerName }, ref) => {
    if (!invoice) return null;

    const isRefund = Number(invoice.total_amount) < 0;
    const invoiceNumber = invoice.invoice_number || invoice.code || (invoice.id ? invoice.id.slice(0, 8) : 'POS-RECEIPT');
    const invoiceDate = invoice.created_at || invoice.date ? new Date(invoice.created_at || invoice.date).toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) : new Date().toLocaleString();

    const subtotal = Number(invoice.subtotal || invoice.total_amount || 0);
    const discount = Number(invoice.discount || 0);
    const totalAmount = Number(invoice.total_amount || 0);
    const paidAmount = Number(invoice.paid_amount ?? invoice.amount_paid ?? totalAmount);
    const changeReturn = Math.max(0, paidAmount - totalAmount);

    return (
      <div
        ref={ref}
        id="thermal-pos-receipt"
        className="hidden print:block fixed inset-0 top-0 left-0 bg-white text-black p-3 font-mono text-xs leading-snug w-[80mm] max-w-[80mm] z-[9999]"
        style={{ width: '80mm' }}
      >
        <style>{`
          @media print {
            @page {
              size: 80mm 297mm;
              margin: 0mm;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            #thermal-pos-receipt {
              display: block !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              padding: 3mm 2mm !important;
              box-sizing: border-box !important;
            }
          }
        `}</style>

        {/* Header Branding */}
        <div className="text-center mb-2 flex flex-col items-center justify-center">
          <img src={sabirLogo} alt="Sabir Plastic" className="h-10 w-auto object-contain mb-1" />
          <h1 className="font-extrabold text-base tracking-wider uppercase">SABIR PLASTIC</h1>
          <p className="text-[10px] text-gray-700">Manufacturers & Dealers of Plastic Materials</p>
          <p className="text-[10px] font-bold mt-0.5 border border-black px-2 py-0.5 rounded-sm inline-block">
            {isRefund ? '** REFUND RECEIPT **' : 'CASH RETAIL INVOICE'}
          </p>
        </div>

        {/* Invoice Metadata */}
        <div className="mb-2 border-y border-dashed border-black py-1.5 text-[11px] space-y-0.5">
          <div className="flex justify-between">
            <span className="font-semibold">Invoice #:</span>
            <span className="font-bold">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{invoiceDate}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer:</span>
            <span className="font-semibold">{customerName || invoice.customer_name || 'Walk-in Customer'}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{cashierName}</span>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full mb-2 text-[11px]">
          <thead>
            <tr className="border-b border-black text-left font-bold">
              <th className="py-1 text-left">Item</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-right">Rate</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dotted divide-gray-300">
            {items.map((item, idx) => {
              const isItemReturn = item.isReturn || item.quantity < 0;
              const displayQty = isItemReturn ? -Math.abs(item.quantity) : item.quantity;
              const unit = item.selected_unit || 'KG';
              const lineTotal = displayQty * item.unit_price;

              return (
                <tr key={idx} className="align-top">
                  <td className="py-1 pr-1 break-words">
                    <span className="font-medium">
                      {isItemReturn ? `[REFUND] ${item.productName || item.product_name}` : (item.productName || item.product_name)}
                    </span>
                  </td>
                  <td className="py-1 text-center whitespace-nowrap">
                    {displayQty} <span className="text-[9px] uppercase">{unit}</span>
                  </td>
                  <td className="py-1 text-right whitespace-nowrap">{Number(item.unit_price).toLocaleString()}</td>
                  <td className="py-1 text-right font-semibold whitespace-nowrap">{lineTotal.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Financial Summary */}
        <div className="border-t border-dashed border-black pt-1.5 mb-2 text-[11px] space-y-0.5">
          <div className="flex justify-between">
            <span>Gross Subtotal:</span>
            <span>Rs. {subtotal.toLocaleString()}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-gray-800">
              <span>Discount:</span>
              <span>- Rs. {discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-extrabold text-sm border-t border-b border-black py-1 my-1">
            <span>{isRefund ? 'REFUND DUE:' : 'NET PAYABLE:'}</span>
            <span>Rs. {Math.abs(totalAmount).toLocaleString()}</span>
          </div>
          {!isRefund && (
            <>
              <div className="flex justify-between">
                <span>Cash Tendered:</span>
                <span>Rs. {paidAmount.toLocaleString()}</span>
              </div>
              {changeReturn > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Change Returned:</span>
                  <span>Rs. {changeReturn.toLocaleString()}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Signature Lines */}
        <div className="flex justify-between items-end pt-4 pb-2 text-[10px]">
          <div className="text-center">
            <div className="w-20 border-b border-dashed border-black mb-1"></div>
            <p className="text-gray-700">Customer Sign</p>
          </div>
          <div className="text-center">
            <div className="w-24 border-b border-black mb-1"></div>
            <p className="font-bold">Authorized Sign</p>
          </div>
        </div>

        {/* Footer Notes & Urdu Term */}
        <div className="text-center text-[10px] mt-2 pt-2 border-t border-dashed border-black space-y-1">
          <p className="font-bold">Thank You For Your Business!</p>
          <p className="text-[11px] leading-tight font-serif" dir="rtl">
            نوٹ: مال نہ ملنے کی صورت میں 15 دن میں رابطہ کریں اس کے بعد کمپنی ذمہ دار نہیں ہوگی۔ شکریہ
          </p>
          <p className="text-[9px] text-gray-600">
            * Software Generated POS Tax-Compliant Receipt *
          </p>
        </div>
      </div>
    );
  }
);

ReceiptPrinter.displayName = 'ReceiptPrinter';
