import React from 'react';
import { CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import sabirLogo from '../../assets/sabirlogo.png';
import { getUrduProductName } from '../../utils/bilingual';

interface A4SalesInvoiceProps {
  data: any;
}

export const A4SalesInvoice: React.FC<A4SalesInvoiceProps> = ({ data }) => {
  if (!data) return null;
  const invoice = data;

  const invoiceNumber = String(data.invoice_number || data.code || data.id || 'N/A');
  const billNumber = data.bill_number
    ? String(data.bill_number)
    : (invoiceNumber.startsWith('POS-') ? invoiceNumber.replace(/^POS-/i, '') : invoiceNumber);

  // Format Date & Time: e.g. 14-Nov-2026, 09:47 pm
  const formatDateTime = (dateStr: string | Date | undefined | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const datePart = `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
      const timePart = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).toLowerCase();
      return `${datePart}, ${timePart}`;
    } catch {
      return String(dateStr);
    }
  };

  const formatDateOnly = (dateStr: string | Date | undefined | null) => {
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
    return n.toLocaleString('en-PK', { maximumFractionDigits: 3 });
  };

  const isPurchase = data.type === 'purchase' || data.invoice_type === 'PURCHASE';
  const entityLabel = isPurchase ? 'Party' : 'Customer';
  const entityName = isPurchase
    ? (data.supplier_name || data.supplier?.name || data.party_name || 'Party')
    : (data.walk_in_customer_name || data.customer_name || data.customer?.name || 'Walk-In Customer');
  const entityCode = isPurchase ? (data.supplier_code || data.supplier?.code) : (data.customer_code || data.customer?.code);
  const entityPhone = isPurchase ? (data.supplier_phone || data.supplier?.phone) : (data.customer_phone || data.customer?.phone);
  const entityCity = isPurchase ? (data.supplier_city || data.city || data.supplier?.city) : (data.customer_city || data.customer?.city);

  const cashierOrCreator = data.created_by_name || data.creator?.name || data.cashierName || 'admin';
  const invoiceDate = data.date || data.created_at || data.invoice_date;

  const subtotal = Number(data.subtotal ?? (data.total_amount + (data.discount || 0)));
  const discount = Number(data.discount || 0);
  const deliveryCharge = Number(data.delivery_charge || data.delivery_charges || 0);
  const slipCharges = Number(data.slip_charges || data.slipCharges || 0);
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

  const isDuplicate = Boolean(
    data.isDuplicate ||
    data.duplicate ||
    data.is_duplicate ||
    data.copyType === 'DUPLICATE' ||
    data.copy_type === 'DUPLICATE'
  );
  const copyBadgeText = data.copyLabel || (isDuplicate ? 'Duplicate' : 'Original');

  // ── Group Line Items by Base Product Name ──
  const rawItems: any[] = data.items || data.order_details || [];

  interface VariantItem {
    size: string;
    urduSize?: string;
    qty: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    code?: string;
  }

  interface GroupedProductItem {
    baseName: string;
    urduBase?: string;
    code?: string;
    category?: string;
    unit: string;
    variants: VariantItem[];
    totalQty: number;
    totalPrice: number;
    unitPrice: number;
    hasMultipleRates: boolean;
  }

  const groupedMap = new Map<string, GroupedProductItem>();
  let totalBagsRaw = 0;

  for (const item of rawItems) {
    const rawEnglishName = String(
      item.product_name || item.productName || item.product?.name || item.name || 'Item'
    ).trim();
    const rawSize = String(item.size || item.product_size || item.variant_size || '').trim();

    let baseName = rawEnglishName;
    let sizePart = rawSize;

    if (!sizePart && rawEnglishName.includes(' - ')) {
      const idx = rawEnglishName.lastIndexOf(' - ');
      baseName = rawEnglishName.substring(0, idx).trim();
      sizePart = rawEnglishName.substring(idx + 3).trim();
    } else if (sizePart && rawEnglishName.endsWith(` - ${sizePart}`)) {
      baseName = rawEnglishName.slice(0, -(` - ${sizePart}`.length)).trim();
    }

    const key = baseName.trim().toLowerCase();
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const bagWeight = Number(item.bag_weight_kg || item.category_bag_weight_kg || item.product?.bag_weight_kg || 25);
    if (bagWeight > 0) {
      totalBagsRaw += qty / bagWeight;
    }
    const unit = item.selected_unit || item.unit || 'KG';
    const unitPrice = Number(item.unit_price ?? item.price ?? 0);
    const totalPrice = Number(item.total_price ?? item.total ?? qty * unitPrice);
    const code = item.product_code || item.code || item.product?.code || '';

    const urduBase = getUrduProductName(baseName, item.name_urdu || item.product_name_urdu, item.category);
    const urduSize = sizePart ? (getUrduProductName(sizePart) || sizePart) : '';

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        baseName,
        urduBase,
        code,
        category: item.category,
        unit,
        variants: [
          {
            size: sizePart,
            urduSize,
            qty,
            unit,
            unitPrice,
            totalPrice,
            code,
          },
        ],
        totalQty: qty,
        totalPrice,
        unitPrice,
        hasMultipleRates: false,
      });
    } else {
      const existing = groupedMap.get(key)!;
      // If variant with same size already exists, merge quantities
      const sameSizeVariant = existing.variants.find(
        (v) => (v.size || '').toLowerCase() === (sizePart || '').toLowerCase()
      );
      if (sameSizeVariant) {
        sameSizeVariant.qty += qty;
        sameSizeVariant.totalPrice += totalPrice;
      } else {
        existing.variants.push({
          size: sizePart,
          urduSize,
          qty,
          unit,
          unitPrice,
          totalPrice,
          code,
        });
      }
      existing.totalQty += qty;
      existing.totalPrice += totalPrice;
      if (Math.abs(existing.unitPrice - unitPrice) > 0.01) {
        existing.hasMultipleRates = true;
      }
    }
  }

  const groupedItems = Array.from(groupedMap.values());

  const totalWeight = groupedItems.reduce((sum, item) => sum + item.totalQty, 0);
  const formattedTotalWeight = Number(totalWeight.toFixed(3)).toString();
  const totalBags = Math.round(totalBagsRaw * 100) / 100;
  const formattedTotalBags = Number(totalBags.toFixed(2)).toLocaleString('en-PK');

  const getStatusBadge = () => {
    if (isDebitNote) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <RotateCcw className="w-3 h-3" />
          DEBIT NOTE
        </span>
      );
    }
    if (isCreditNote) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
          <RotateCcw className="w-3 h-3" />
          CREDIT NOTE
        </span>
      );
    }
    if (balanceDue < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertCircle className="w-3 h-3" />
          OVERPAID
        </span>
      );
    }
    if (statusUpper === 'PAID' || balanceDue === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          PAID
        </span>
      );
    }
    if (statusUpper === 'PARTIAL' || (paidAmount > 0 && balanceDue > 0)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertCircle className="w-3 h-3" />
          PARTIAL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
        <AlertCircle className="w-3 h-3" />
        UNPAID
      </span>
    );
  };

  const billTypeTitle = isPurchase
    ? (isDebitNote ? 'DEBIT NOTE' : 'PURCHASE BILL')
    : (isCreditNote ? 'CREDIT NOTE' : 'SALE BILL');

  return (
    <div
      className="w-full max-w-[210mm] mx-auto bg-white text-black p-6 font-sans box-border print:w-full print:max-w-none print:p-2 print:m-0 break-inside-avoid page-break-inside-avoid"
      style={{ backgroundColor: '#ffffff', color: '#000000', colorScheme: 'light' }}
    >
      {/* ── Top Header Brand matching POS Slip (Logo, Title, Address Box, Two-Tone Banner) ── */}
      <div className="text-center mb-3">
        {/* SPS Logo */}
        <img
          src={sabirLogo}
          alt="SPS"
          className="h-16 w-auto object-contain mx-auto mb-1"
        />

        {/* Store Title */}
        <h1 className="text-2xl font-black text-black uppercase tracking-wider leading-tight" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>
          SABIR PLASTIC STORE
        </h1>

        {/* Address & Phone Numbers Border Box */}
        <div className="border border-black rounded-md py-1 px-4 my-2 text-center max-w-sm mx-auto box-border">
          <div className="text-xs font-bold text-black leading-tight">Tower Market, Hyderabad</div>
          <div className="text-[11px] font-bold text-black leading-tight mt-0.5 tracking-tight">
            022-2612107 | 0333-2396918 | 0333-2696653
          </div>
        </div>

        {/* Two-Tone Title Banner (Black Left + White Right with Border) */}
        <div className="flex border-2 border-black max-w-xs mx-auto my-2 text-xs font-black overflow-hidden rounded shadow-2xs">
          <div className="w-1/2 bg-black text-white py-1 px-2 text-center tracking-wider uppercase flex items-center justify-center">
            {billTypeTitle}
          </div>
          <div className="w-1/2 bg-white text-black py-1 px-2 text-center tracking-wider flex items-center justify-center border-l-2 border-black">
            {copyBadgeText}
          </div>
        </div>
      </div>

      {/* Dotted / Dashed Separator */}
      <div className="border-b border-dashed border-black mb-2.5"></div>

      {/* ── Invoice & Party / Customer Details Metadata ── */}
      <div className="text-xs leading-relaxed mb-3">
        <div className="grid grid-cols-2 gap-4">
          {/* Left Column: Bill No, Date, Cashier/Creator */}
          <div className="space-y-1">
            <div className="flex items-center">
              <span className="w-24 font-bold text-slate-800">Bill No:</span>
              <span className="font-black font-mono text-sm text-black">{billNumber}</span>
            </div>
            <div className="flex items-center">
              <span className="w-24 font-semibold text-slate-700">Date:</span>
              <span className="text-black font-medium">{formatDateTime(invoiceDate)}</span>
            </div>
            <div className="flex items-center">
              <span className="w-24 font-semibold text-slate-700">{isPurchase ? 'Received By:' : 'Cashier:'}</span>
              <span className="text-black font-bold">{cashierOrCreator}</span>
            </div>
            {isPurchase && data.due_date && (
              <div className="flex items-center">
                <span className="w-24 font-semibold text-slate-700">Due Date:</span>
                <span className="text-black font-medium">{formatDateOnly(data.due_date)}</span>
              </div>
            )}
          </div>

          {/* Right Column: Party / Customer Name (with City), Phone, Status */}
          <div className="space-y-1">
            <div className="flex items-start">
              <span className="w-24 font-bold text-slate-800">{entityLabel}:</span>
              <span className="font-black text-black text-sm flex-1 break-words">
                {entityName}{entityCode ? ` (${entityCode})` : ''} {entityCity ? `(${entityCity})` : ''}
              </span>
            </div>
            {invoice.transport && String(invoice.transport).trim() !== '' && (
              <div className="flex items-center">
                <span className="w-24 font-semibold text-slate-700">Transport:</span>
                <span className="text-black font-medium">{invoice.transport}</span>
              </div>
            )}
            {entityPhone && (
              <div className="flex items-center">
                <span className="w-24 font-semibold text-slate-700">Phone:</span>
                <span className="text-black font-medium">{entityPhone}</span>
              </div>
            )}
            <div className="flex items-center">
              <span className="w-24 font-semibold text-slate-700">Status:</span>
              <div>{getStatusBadge()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dotted / Dashed Separator */}
      <div className="border-b border-dashed border-black mb-3"></div>

      {/* ── Line Items Table with Grouped Variants on Single Line ── */}
      <table className="w-full text-xs border-collapse mb-2">
        <thead>
          <tr className="border-b-2 border-black text-black uppercase font-bold text-[11px]">
            <th className="py-2 px-2 w-7 text-center">#</th>
            <th className="py-2 px-2 w-[18%] text-left">Product</th>
            <th className="py-2 px-2 w-[40%] text-left">Sizes & Breakdown</th>
            <th className="py-2 px-2 w-16 text-center whitespace-nowrap">Total Qty</th>
            <th className="py-2 px-2 w-10 text-center whitespace-nowrap">Unit</th>
            <th className="py-2 px-2 w-28 text-right whitespace-nowrap">Rate (Rs.)</th>
            <th className="py-2 px-2 w-24 text-right whitespace-nowrap">Total (Rs.)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {groupedItems.map((group, idx) => (
            <tr key={idx} className="align-middle">
              {/* Sr No */}
              <td className="py-2 px-2 text-center text-slate-600 font-semibold">
                {idx + 1}
              </td>

              {/* Product Base Name & Urdu Name (No ID/Code) */}
              <td className="py-2 px-2">
                <div className="font-bold text-slate-900 text-xs">
                  {group.baseName}
                </div>
                {group.urduBase && (
                  <div className="text-[11px] font-bold text-black mt-0.5 text-left" dir="rtl" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
                    {group.urduBase}
                  </div>
                )}
              </td>

              {/* Sizes and Quantities side-by-side fraction boxes (strictly on one single line) */}
              <td className="py-2 px-2">
                <div className="flex flex-nowrap items-center gap-1.5 py-0.5">
                  {group.variants.map((v, vIdx) => (
                    <div
                      key={vIdx}
                      className="inline-flex flex-col items-center border border-black rounded px-1.5 py-0.5 bg-white text-center shrink-0 min-w-[36px]"
                    >
                      {/* Top: Size */}
                      <span className="text-[10px] font-black text-black border-b border-black w-full text-center leading-tight pb-0.5 whitespace-nowrap">
                        {v.size || 'Std'}
                      </span>
                      {/* Bottom: Quantity */}
                      <span className="text-[10.5px] font-bold text-black font-mono leading-tight pt-0.5 whitespace-nowrap">
                        {formatNumber(v.qty)}
                      </span>
                    </div>
                  ))}
                </div>
              </td>

              {/* Total Quantity for this product */}
              <td className="py-2 px-2 text-center font-black font-mono text-xs whitespace-nowrap">
                {formatNumber(group.totalQty)}
              </td>

              {/* Unit */}
              <td className="py-2 px-2 text-center font-bold text-slate-700 text-xs whitespace-nowrap">
                {group.unit}
              </td>

              {/* Unit Rate */}
              <td className="py-2 px-2 text-right font-mono font-medium text-xs">
                {group.hasMultipleRates ? (
                  <div className="flex flex-col items-end gap-0.5 text-right font-mono">
                    {group.variants.map((v, vIdx) => (
                      <div key={vIdx} className="text-xs whitespace-nowrap">
                        {v.size && (
                          <span className="text-[10px] text-slate-600 font-sans mr-1 font-semibold">
                            {v.size}:
                          </span>
                        )}
                        <span className="font-bold text-black">{formatDecimal(v.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="whitespace-nowrap">{formatDecimal(group.unitPrice)}</span>
                )}
              </td>

              {/* Line Total */}
              <td className="py-2 px-2 text-right font-mono font-bold text-xs whitespace-nowrap">
                {formatDecimal(group.totalPrice)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black border-b border-black font-bold text-xs bg-slate-50">
            <td colSpan={2} className="py-2 px-2 text-left font-black">
              Total Weight:
            </td>
            <td className="py-2 px-2 text-left text-slate-500 font-normal text-[11px]">
              {groupedItems.length} Products ({groupedItems.reduce((acc, g) => acc + g.variants.length, 0)} Items • {formattedTotalBags} Bags)
            </td>
            <td className="py-2 px-2 text-center font-mono font-black whitespace-nowrap">
              {formattedTotalWeight}
            </td>
            <td className="py-2 px-2 text-center font-black">
              KG
            </td>
            <td className="py-2 px-2"></td>
            <td className="py-2 px-2 text-right font-mono font-black whitespace-nowrap">
              Rs. {formatDecimal(subtotal)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Financial Summary & Returns Block ── */}
      <div className="flex justify-end my-3">
        <div className="w-80 border border-black rounded-lg p-3 text-xs space-y-1.5 bg-white">
          <div className="flex justify-between text-slate-700">
            <span className="font-semibold">Total Bags:</span>
            <span className="font-mono font-bold">{formattedTotalBags}</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span className="font-semibold">Gross Subtotal:</span>
            <span className="font-mono font-bold">Rs. {formatDecimal(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-rose-700 font-semibold">
              <span>Discount:</span>
              <span className="font-mono font-bold">- Rs. {formatDecimal(discount)}</span>
            </div>
          )}

          {deliveryCharge > 0 && (
            <div className="flex justify-between text-blue-700 font-semibold">
              <span>Delivery / Freight:</span>
              <span className="font-mono font-bold">+ Rs. {formatDecimal(deliveryCharge)}</span>
            </div>
          )}

          {slipCharges > 0 && (
            <div className="flex justify-between text-indigo-700 font-semibold">
              <span>Slip Charges:</span>
              <span className="font-mono font-bold">+ Rs. {formatDecimal(slipCharges)}</span>
            </div>
          )}

          {childReturns.length > 0 && (
            <>
              <div className="flex justify-between text-rose-700 font-semibold">
                <span>Less Returns:</span>
                <span className="font-mono font-bold">- Rs. {formatDecimal(totalReturnedAmount)}</span>
              </div>
            </>
          )}

          <div className="border-t-2 border-black pt-1.5 flex justify-between font-black text-sm text-black">
            <span>NET PAYABLE:</span>
            <span className="font-mono text-base">Rs. {formatDecimal(netFinalInvoiceTotal)}</span>
          </div>

          <div className="flex justify-between text-slate-800 pt-0.5">
            <span className="font-semibold">Amount Paid:</span>
            <span className="font-mono font-bold">Rs. {formatDecimal(paidAmount)}</span>
          </div>

          <div className="border-t border-dashed border-black pt-1.5 flex justify-between font-bold text-xs">
            <span>Balance Due:</span>
            {balanceDue <= 0 || statusUpper === 'PAID' ? (
              <span className="font-mono font-black text-emerald-700">Rs. 0.00 (Fully Settled)</span>
            ) : balanceDue < 0 ? (
              <span className="font-mono font-black text-amber-700">
                -Rs. {formatDecimal(Math.abs(balanceDue))} (Overpaid)
              </span>
            ) : (
              <span className="font-mono font-black text-rose-700">
                Rs. {formatDecimal(balanceDue)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer Urdu Highlight Box & Business Note ── */}
      <div className="text-center mt-3 pt-2 border-t border-dashed border-black">
        <p className="font-bold text-xs text-black">Thank You For Your Business!</p>

        {/* Highlighted Urdu Warning Box */}
        <div className="border-2 border-black rounded-md py-1.5 px-3 my-2 text-center max-w-lg mx-auto box-border">
          <p className="text-xs font-bold text-black leading-relaxed" dir="rtl" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
            نوٹ: مال نہ ملنے کی صورت میں 15 دن میں رابطہ کریں اس کے بعد کمپنی ذمہ دار نہیں ہوگی۔ شکریہ
          </p>
        </div>

        {/* Software Manufacturer Credits */}
        <p className="text-[10px] text-black font-semibold mt-1">
          *software manufactured by PENTACORE SOLUTION | ph no 0335-3392443 / 0333-8200344*
        </p>
      </div>

      {/* ── Signatures ── */}
      <div className="pt-8 print:pt-6 pb-2 flex justify-between items-end px-6">
        <div className="text-center">
          <div className="w-52 border-b border-dashed border-black mb-1.5"></div>
          <p className="text-xs font-semibold text-slate-800">
            Labour Name
          </p>
        </div>

        <div className="text-center">
          <div className="w-56 border-b-2 border-black mb-1.5"></div>
          <p className="text-xs font-black text-black uppercase tracking-wider">
            AUTHORIZED STAMP
          </p>
        </div>
      </div>
    </div>
  );
};

export default A4SalesInvoice;
