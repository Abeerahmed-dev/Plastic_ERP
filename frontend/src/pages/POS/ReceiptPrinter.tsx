import { forwardRef } from 'react';
import sabirLogo from '../../assets/sabirlogo.png';

interface ReceiptProps {
  invoice: any;
  items: any[];
  cashierName: string;
}

export const ReceiptPrinter = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ invoice, items, cashierName }, ref) => {
    const isRefund = Number(invoice.total_amount) < 0;

    return (
      <div ref={ref} className="hidden print:block w-[80mm] bg-white text-black p-4 font-mono text-sm leading-tight">
        <div className="text-center mb-3 flex flex-col items-center justify-center">
          <img src={sabirLogo} alt="Sabir Plastic" className="h-12 w-auto object-contain mb-1" />
          <h1 className="font-bold text-lg mb-0.5">SABIR PLASTIC</h1>
          <p className="text-xs text-gray-600">Walk-in POS Receipt</p>
        </div>

        <div className="mb-4 border-b border-dashed border-gray-400 pb-2">
          <p>Receipt #: {invoice.code || invoice.id?.slice(0, 8)}</p>
          <p>Date: {new Date(invoice.created_at || invoice.date).toLocaleString()}</p>
          <p>Cashier: {cashierName}</p>
        </div>

        <table className="w-full mb-4 text-xs">
          <thead>
            <tr className="border-b border-dashed border-gray-400 text-left">
              <th className="py-1">Item</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Price</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isItemReturn = item.isReturn || item.quantity < 0;
              const displayQty = isItemReturn ? -Math.abs(item.quantity) : item.quantity;
              const lineTotal = displayQty * item.unit_price;

              return (
                <tr key={idx}>
                  <td className="py-1 pr-1 max-w-[40mm] break-words">
                    {isItemReturn ? `[RETURNED] ${item.productName}` : item.productName}
                  </td>
                  <td className="py-1 text-right">{displayQty}</td>
                  <td className="py-1 text-right">{item.unit_price}</td>
                  <td className="py-1 text-right">{lineTotal.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-400 pt-2 mb-4 text-right">
          <p>Subtotal: Rs. {Number(invoice.subtotal).toLocaleString()}</p>
          {Number(invoice.discount) > 0 && <p>Discount: Rs. {Number(invoice.discount).toLocaleString()}</p>}
          <p className="font-bold text-lg mt-1">
            {isRefund ? `REFUND: Rs. ${Math.abs(Number(invoice.total_amount)).toLocaleString()}` : `TOTAL: Rs. ${Number(invoice.total_amount).toLocaleString()}`}
          </p>
        </div>

        {/* Signature Lines */}
        <div className="flex justify-between items-end pt-5 pb-2 text-[10px]">
          <div className="text-center">
            <div className="w-20 border-b border-dashed border-gray-400 mb-1"></div>
            <p className="text-gray-600">Receiver Sign</p>
          </div>
          <div className="text-center">
            <div className="w-24 border-b border-gray-700 mb-1"></div>
            <p className="font-bold text-gray-800">Authorized Sign</p>
          </div>
        </div>

        <div className="text-center text-xs mt-4 pt-3 border-t border-dashed border-gray-400 space-y-1">
          <p className="font-bold">Thank you for your business!</p>
          <p className="text-[11px] leading-tight" dir="rtl">
            نوٹ: مال نہ ملنے کی صورت میں 15 دن میں رابطہ کریں اس کے بعد کمپنی ذمہ دار نہیں ہوگی۔ شکریہ
          </p>
          <p className="text-[10px] text-gray-600 leading-tight">
            Note: Maal na milne ki soorat 15 din me rabta karen is k baad company zimedar nh hogi. Shukria
          </p>
        </div>
      </div>
    );
  }
);
ReceiptPrinter.displayName = 'ReceiptPrinter';

