import { forwardRef } from 'react';
import { ThermalReceipt80mm } from '../../components/print/ThermalReceipt80mm';

interface ReceiptProps {
  invoice: any;
  items: any[];
  cashierName: string;
}

export const ReceiptPrinter = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ invoice, items, cashierName }, ref) => {
    if (!invoice) return null;

    const mergedData = {
      ...invoice,
      items: (items && items.length > 0) ? items : (invoice.items || []),
      created_by_name: cashierName || invoice.created_by_name,
    };

    return (
      <div ref={ref} className="hidden print:block absolute top-0 left-0 w-full bg-white z-[9999]">
        <ThermalReceipt80mm data={mergedData} />
      </div>
    );
  }
);

ReceiptPrinter.displayName = 'ReceiptPrinter';
