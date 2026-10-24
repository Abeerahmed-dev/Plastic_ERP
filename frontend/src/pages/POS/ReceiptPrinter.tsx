import { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import sabirLogoThermal from '../../assets/sabirlogo_thermal.png';
import { getUrduProductName } from '../../utils/bilingual';
import { getNextSequentialBillNumber } from '../../utils/printThermal';

interface ReceiptProps {
  invoice: any;
  items: any[];
  cashierName: string;
  customerName?: string;
  isDuplicate?: boolean;
}

export const ReceiptPrinter = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ invoice, items, cashierName, customerName, isDuplicate = false }, ref) => {
    if (!invoice) return null;

    const isRefund = Number(invoice.total_amount) < 0;
    const billNumber = getNextSequentialBillNumber(invoice);
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

    const paymentMethod = String(invoice.payment_method || invoice.paymentMethod || 'CASH').toUpperCase();
    const isSplit = paymentMethod === 'SPLIT' || (Number(invoice.split_cash_amount) > 0 && Number(invoice.split_bank_amount) > 0);
    const isBank = !isSplit && (paymentMethod === 'BANK' || paymentMethod === 'BANK_TRANSFER' || !!invoice.bank_name);
    const isCheque = !isSplit && paymentMethod === 'CHEQUE';
    const bankNameStr = invoice.bank_name ? ` (${invoice.bank_name})` : '';

    const splitCash = Number(invoice.split_cash_amount ?? invoice.cash_tendered ?? 0);
    const splitBank = Number(invoice.split_bank_amount ?? 0);

    const paidAmount = Number(invoice.paid_amount ?? invoice.amount_paid ?? 0);
    const cashTendered = isSplit ? splitCash : (isBank || isCheque ? paidAmount : Number(invoice.cash_tendered ?? paidAmount));
    const balanceDue = Number(invoice.balance_due ?? Math.max(0, totalAmount - paidAmount));
    const changeReturn = isBank || isCheque ? 0 : Number(invoice.change_returned ?? Math.max(0, (isSplit ? (splitCash + splitBank) : cashTendered) - totalAmount));

    const receiptContent = (
      <div
        ref={ref}
        id="thermal-pos-receipt"
        className="hidden print:block bg-white text-black p-1 font-mono text-xs leading-snug w-[75mm] max-w-[75mm] mx-auto"
        style={{ width: '75mm', maxWidth: '75mm', height: 'fit-content' }}
      >
        <style>{`
          @media print {
            @page {
              size: 75mm auto;
              margin: 0mm !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              width: 75mm !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: fit-content !important;
              overflow: visible !important;
            }
            #root {
              display: none !important;
            }
            #thermal-pos-receipt {
              display: block !important;
              position: static !important;
              width: 75mm !important;
              max-width: 75mm !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: fit-content !important;
              padding: 1.5mm 2mm !important;
              margin: 0 auto !important;
              box-sizing: border-box !important;
              color: #000000 !important;
              background: #ffffff !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
              break-after: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}</style>

        {/* Header Branding */}
        <div className="text-center mb-1 flex flex-col items-center justify-center">
          <img src={sabirLogoThermal} alt="Sabir Plastic" className="h-10 w-auto object-contain mb-0.5" />
          <h1 className="font-black text-sm tracking-wide uppercase mb-1">SABIR PLASTIC STORE</h1>
          
          {/* Address & Phones Box */}
          <div className="w-full border-2 border-black rounded-sm py-0.5 px-1 mb-1 text-center">
            <p className="text-[9.5px] font-bold text-black leading-tight">Tower Market, Hyderabad</p>
            <p className="text-[8px] font-bold text-black leading-tight tracking-tight mt-0.5">
              022-2612107 | 0333-2396918 | 0333-2696653
            </p>
          </div>

          {/* Sale Bill / Original Bar (SVG ensures 100% solid black background with crisp white text) */}
          <svg width="100%" height="22" viewBox="0 0 200 22" style={{ display: 'block', width: '100%', height: '22px', marginBottom: '4px', overflow: 'hidden' }}>
            <rect x="0.75" y="0.75" width="198.5" height="20.5" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
            <rect x="0" y="0" width="105" height="22" fill="#000000" />
            <text x="52.5" y="15" fill="#ffffff" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="10.5" textAnchor="middle" letterSpacing="0.5">
              {isRefund ? 'REFUND BILL' : 'SALE BILL'}
            </text>
            <line x1="105" y1="0" x2="105" y2="22" stroke="#000000" strokeWidth="1.5" />
            <text x="152.5" y="15" fill="#000000" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize={isDuplicate ? 9 : 9.5} textAnchor="middle">
              {isDuplicate ? 'Duplicate' : 'Original'}
            </text>
          </svg>
        </div>

        {/* Invoice Metadata */}
        <div className="mb-2 border-y border-dashed border-black py-1.5 text-[11px] space-y-0.5">
          <div className="flex justify-between">
            <span className="font-semibold">Bill No:</span>
            <span className="font-black font-mono text-xs">{billNumber}</span>
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
              <th className="py-1 text-left">Item / نام</th>
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
              const englishName = item.productName || item.product_name || 'Item';
              const urduName = getUrduProductName(englishName, item.name_urdu || item.product_name_urdu, item.category);

              return (
                <tr key={idx} className="align-top">
                  <td className="py-1 pr-1 break-words">
                    <div className="font-bold text-[11px] leading-tight">
                      {isItemReturn ? `[REFUND] ${englishName}` : englishName}
                    </div>
                    {urduName && (
                      <div className="text-[10.5px] font-bold text-black font-sans leading-tight mt-0.5" dir="rtl">
                        {urduName}
                      </div>
                    )}
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
          {isDuplicate ? (
            <div className="flex justify-between font-extrabold text-sm border-t border-b border-black py-1 my-1">
              <span>TOTAL / کل رقم:</span>
              <span>Rs. {Math.abs(totalAmount).toLocaleString()}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span>Gross Subtotal / کل رقم:</span>
                <span>Rs. {subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-gray-800">
                  <span>Discount / رعایت:</span>
                  <span>- Rs. {discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm border-t border-b border-black py-1 my-1">
                <span>{isRefund ? 'REFUND DUE / قابل واپسی:' : 'NET PAYABLE / خالص قابل ادا:'}</span>
                <span>Rs. {Math.abs(totalAmount).toLocaleString()}</span>
              </div>
              {!isRefund && (
                <>
                  {isSplit ? (
                    <>
                      <div className="flex justify-between font-semibold text-gray-800">
                        <span>Payment Mode / طریقہ:</span>
                        <span className="font-bold">Split Payment / مشترکہ</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Cash Paid / نقد وصول:</span>
                        <span className="font-bold">Rs. {splitCash.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Bank Transfer{bankNameStr} / بینک:</span>
                        <span className="font-bold">Rs. {splitBank.toLocaleString()}</span>
                      </div>
                    </>
                  ) : isBank ? (
                    <div className="flex justify-between font-semibold">
                      <span>Bank Transfer{bankNameStr} / بینک ٹرانسفر:</span>
                      <span>Rs. {paidAmount.toLocaleString()}</span>
                    </div>
                  ) : isCheque ? (
                    <div className="flex justify-between font-semibold">
                      <span>Cheque Payment{bankNameStr} / چیک وصول:</span>
                      <span>Rs. {paidAmount.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between font-semibold">
                      <span>Cash Tendered / نقد وصول:</span>
                      <span>Rs. {cashTendered.toLocaleString()}</span>
                    </div>
                  )}
                  {changeReturn > 0 && (
                    <div className="flex justify-between font-extrabold text-[12px] bg-gray-100 px-1 py-0.5 my-0.5 border border-dashed border-black">
                      <span>Change Due / بقایا واپسی:</span>
                      <span>Rs. {changeReturn.toLocaleString()}</span>
                    </div>
                  )}
                  {balanceDue > 0 && (
                    <div className="flex justify-between font-extrabold text-[12px] border-t border-dashed border-black pt-1 mt-0.5">
                      <span>Balance Due / باقی رقم:</span>
                      <span>Rs. {balanceDue.toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer Notes & Urdu Term */}
        <div className="text-center text-[9px] mt-1.5 pt-1.5 border-t border-dashed border-black space-y-0.5">
          <p className="font-bold text-[9px]">Thank You For Your Business!</p>
          <p className="text-[10px] font-bold text-black leading-tight font-sans" dir="rtl">
            نوٹ: مال نہ ملنے کی صورت میں 15 دن میں رابطہ کریں اس کے بعد کمپنی ذمہ دار نہیں ہوگی۔ شکریہ
          </p>
          <p className="text-[8px] text-gray-600">
            * Software Generated POS Tax-Compliant Receipt *
          </p>
        </div>
      </div>
    );

    return createPortal(receiptContent, document.body);
  }
);

ReceiptPrinter.displayName = 'ReceiptPrinter';
