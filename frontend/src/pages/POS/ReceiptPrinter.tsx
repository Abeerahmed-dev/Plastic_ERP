import { forwardRef } from 'react';

interface ReceiptProps {
  invoice: any;
  items: any[];
  cashierName: string;
}

export const ReceiptPrinter = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ invoice, items, cashierName }, ref) => {
    return (
      <div ref={ref} className="hidden print:block w-[80mm] bg-white text-black p-4 font-mono text-sm leading-tight">
        <div className="text-center mb-4">
          <h1 className="font-bold text-lg mb-1">SABIR PLASTIC</h1>
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
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-1 pr-1 truncate max-w-[40mm]">{item.productName}</td>
                <td className="py-1 text-right">{item.quantity}</td>
                <td className="py-1 text-right">{item.unit_price}</td>
                <td className="py-1 text-right">{item.quantity * item.unit_price}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-400 pt-2 mb-4 text-right">
          <p>Subtotal: Rs. {invoice.subtotal}</p>
          {invoice.discount > 0 && <p>Discount: Rs. {invoice.discount}</p>}
          <p className="font-bold text-lg mt-1">TOTAL: Rs. {invoice.total_amount}</p>
        </div>

        <div className="text-center text-xs mt-6 pt-4 border-t border-dashed border-gray-400">
          <p>Thank you for shopping with us!</p>
          <p>Software by Antigravity</p>
        </div>
      </div>
    );
  }
);
ReceiptPrinter.displayName = 'ReceiptPrinter';
