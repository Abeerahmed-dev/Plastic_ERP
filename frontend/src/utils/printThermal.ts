import sabirLogoThermal from '../assets/sabirlogo_thermal.png';
import { getUrduProductName } from './bilingual';

export interface ThermalReceiptData {
  invoice: any;
  items: any[];
  cashierName: string;
  customerName?: string;
  isDuplicate?: boolean;
  printBoth?: boolean;
}

export function getNextSequentialBillNumber(invoice?: any): string | number {
  if (invoice?.bill_number !== undefined && invoice?.bill_number !== null) {
    return invoice.bill_number;
  }
  if (invoice?.bill_no !== undefined && invoice?.bill_no !== null) {
    return invoice.bill_no;
  }

  const raw = String(invoice?.invoice_number || invoice?.code || '');
  const match = raw.match(/^POS-(\d+)$/i) || raw.match(/^(\d+)$/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (!isNaN(n) && n < 1000000000) {
      if (invoice) invoice.bill_number = n;
      return n;
    }
  }

  // Persistent sequence in localStorage for thermal prints
  try {
    const key = 'pos_bill_print_seq';
    const cur = parseInt(localStorage.getItem(key) || '0', 10);
    const next = (isNaN(cur) ? 0 : cur) + 1;
    localStorage.setItem(key, String(next));
    if (invoice) invoice.bill_number = next;
    return next;
  } catch {
    return 1;
  }
}

export async function printThermalReceipt(data: ThermalReceiptData) {
  const { invoice, items, cashierName, customerName, isDuplicate = false, printBoth = false } = data;
  if (!invoice) return;

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
  const deliveryCharge = Number(invoice.delivery_charge ?? invoice.delivery_charges ?? invoice.deliveryCharges ?? 0);
  const slipCharges = Number(invoice.slip_charges ?? invoice.slipCharges ?? 0);
  const totalAmount = Number(invoice.total_amount || 0);

  // Total weight calculation
  const totalWeight = items.reduce((sum, item) => {
    const isItemReturn = item.isReturn || item.quantity < 0;
    const unitMultiplier = (item.selected_unit?.toLowerCase() === 'bag' || item.selected_unit?.toLowerCase() === 'bora')
      ? Number(item.bag_weight_kg || 25.0)
      : (Number(item.actual_weight_per_unit) > 0 ? Number(item.actual_weight_per_unit) : 1.0);
    const rawQty = Math.abs(Number(item.quantity) || 0);
    const qtyKg = Number(item.net_kg_processed) !== 0 && !isNaN(Number(item.net_kg_processed))
      ? Math.abs(Number(item.net_kg_processed))
      : rawQty * unitMultiplier;
    return isItemReturn ? sum - qtyKg : sum + qtyKg;
  }, 0);
  const formattedTotalWeight = Number(totalWeight.toFixed(2)).toString();

  // Payment method & tender calculation
  const paymentMethod = String(invoice.payment_method || invoice.paymentMethod || 'CASH').toUpperCase();
  const isSplit = paymentMethod === 'SPLIT' || (Number(invoice.split_cash_amount) > 0 && Number(invoice.split_bank_amount) > 0);
  const isBank = !isSplit && (paymentMethod === 'BANK' || paymentMethod === 'BANK_TRANSFER' || !!invoice.bank_name);
  const isCheque = !isSplit && paymentMethod === 'CHEQUE';
  const bankNameStr = '';

  const splitCash = Number(invoice.split_cash_amount ?? invoice.cash_tendered ?? 0);
  const splitBank = Number(invoice.split_bank_amount ?? 0);

  const paidAmount = Number(invoice.paid_amount ?? invoice.amount_paid ?? 0);
  const cashTendered = isSplit ? splitCash : (isBank || isCheque ? paidAmount : Number(invoice.cash_tendered ?? paidAmount));
  const balanceDue = Number(invoice.balance_due ?? Math.max(0, totalAmount - paidAmount));
  const changeReturn = isBank || isCheque ? 0 : Number(invoice.change_returned ?? Math.max(0, (isSplit ? (splitCash + splitBank) : cashTendered) - totalAmount));

  // Safe printable width for Black Copper BC-86AC: 66mm
  // Column distribution: 52% Item & Urdu, 14% Qty, 17% Rate, 17% Total
  const itemsHtml = items.map((item) => {
    const isItemReturn = item.isReturn || item.quantity < 0;
    const displayQty = isItemReturn ? -Math.abs(item.quantity) : item.quantity;
    const lineTotal = displayQty * item.unit_price;
    const rawEnglishName = item.productName || item.product_name || 'Item';

    // Parse base product name and size/variant to prevent BiDi inversion
    let baseName = rawEnglishName;
    let sizePart = (item.size || item.product_size || item.variant_size || '').trim();

    // Check if English name has parentheses like "abid gold (9x15)" or "abid gold(9x15)"
    const parenMatch = rawEnglishName.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (parenMatch) {
      baseName = parenMatch[1].trim();
      if (!sizePart) {
        sizePart = parenMatch[2].trim();
      }
    } else if (!sizePart && rawEnglishName.includes(' - ')) {
      const idx = rawEnglishName.lastIndexOf(' - ');
      baseName = rawEnglishName.substring(0, idx).trim();
      sizePart = rawEnglishName.substring(idx + 3).trim();
    } else if (sizePart && rawEnglishName.endsWith(` - ${sizePart}`)) {
      baseName = rawEnglishName.slice(0, -(` - ${sizePart}`.length)).trim();
    }

    // Clean any remaining parentheses size from baseName so Urdu only has pure name
    baseName = baseName.replace(/\s*\([^)]*\)$/, '').trim();

    // Ensure English name always has a space before size e.g. "abid gold (9x15)"
    let englishName = rawEnglishName.replace(/([^\s])\(([^)]+)\)$/, '$1 ($2)');
    if (sizePart && !englishName.includes(sizePart)) {
      englishName = `${englishName} (${sizePart})`;
    }

    const urduBase = getUrduProductName(baseName, item.name_urdu || item.product_name_urdu, item.category);

    return `
      <tr style="vertical-align: top; border-bottom: 1px dotted #bbb;">
        <td style="padding: 3px 1px; width: 50%; text-align: left; vertical-align: top;">
          <div style="font-family: Tahoma, Verdana, Arial, sans-serif; font-weight: 800; font-size: 12.5px; line-height: 1.25; letter-spacing: 0.2px; text-align: left; color: #000;">
            ${isItemReturn ? '[REFUND] ' : ''}${englishName}
          </div>
          ${urduBase ? `
            <div style="font-size: 12px; font-weight: bold; color: #000; text-align: left; line-height: 1.3; margin-top: 1px; direction: ltr; unicode-bidi: isolate;">
              <span dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">${urduBase}</span>
            </div>
          ` : ''}
        </td>
        <td style="padding: 3px 1px; width: 14%; text-align: center; vertical-align: top; font-family: Tahoma, Arial, sans-serif; font-size: 11.5px; font-weight: 700;">
          ${displayQty}
        </td>
        <td style="padding: 3px 1px; width: 18%; text-align: right; vertical-align: top; font-family: Tahoma, Arial, sans-serif; font-size: 11.5px; font-weight: 700;">
          ${Number(item.unit_price).toLocaleString()}
        </td>
        <td style="padding: 3px 3px 3px 1px; width: 18%; text-align: right; vertical-align: top; font-family: Tahoma, Arial, sans-serif; font-weight: 800; font-size: 11.5px;">
          ${lineTotal.toLocaleString()}
        </td>
      </tr>
    `;
  }).join('');

  const renderSlipSection = (asDuplicate: boolean) => `
    <div class="single-slip" style="width: 100%;">
      <!-- Logo & Header -->
      <div class="text-center" style="margin-bottom: 3px;">
        <img src="${sabirLogoThermal}" alt="Logo" style="height: 38px; max-width: 140px; object-fit: contain; margin-bottom: 2px;" />
        <h1 style="font-size: 15px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 3px; font-family: 'Arial Black', Arial, sans-serif;">SABIR PLASTIC STORE</h1>
        
        <!-- Address & Phones Box -->
        <div style="border: 1.5px solid #000; border-radius: 4px; padding: 3px 2px; margin-bottom: 4px; text-align: center; box-sizing: border-box;">
          <div style="font-size: 10.5px; font-weight: bold; color: #000; line-height: 1.2;">Tower Market, Hyderabad</div>
          <div style="font-size: 9.2px; font-weight: bold; color: #000; line-height: 1.25; margin-top: 1.5px; letter-spacing: -0.1px;">
            022-2612107 | 0333-2396918 | 0333-2696653
          </div>
        </div>

        <!-- Sale Bill / Original or Duplicate Bar -->
        <svg width="100%" height="22" viewBox="0 0 200 22" style="display: block; width: 100%; height: 22px; margin-bottom: 4px; overflow: hidden;">
          <!-- Outer Border -->
          <rect x="0.75" y="0.75" width="198.5" height="20.5" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
          <!-- Solid Black Left Half -->
          <rect x="0" y="0" width="105" height="22" fill="#000000" />
          <!-- White SALE BILL Text -->
          <text x="52.5" y="15" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="11" text-anchor="middle" letter-spacing="0.5">
            ${isRefund ? 'REFUND BILL' : 'SALE BILL'}
          </text>
          <!-- Center Divider -->
          <line x1="105" y1="0" x2="105" y2="22" stroke="#000000" stroke-width="1.5" />
          <!-- Black Original / Duplicate Text -->
          <text x="152.5" y="15" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${asDuplicate ? '9.5' : '10'}" text-anchor="middle">
            ${asDuplicate ? 'Duplicate' : 'Original'}
          </text>
        </svg>
      </div>

      <!-- Invoice Details -->
      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3.5px 0; margin-bottom: 4px; font-size: 11px; line-height: 1.4;">
        <div class="flex">
          <span style="font-weight: bold;">Bill No:</span>
          <span style="font-weight: 900; font-size: 13px; font-family: Tahoma, Arial, sans-serif;">${billNumber}</span>
        </div>
        <div class="flex">
          <span>Date:</span>
          <span style="font-weight: 600;">${invoiceDate}</span>
        </div>
        <div class="flex">
          <span>Customer:</span>
          <span style="font-weight: bold;">${customerName || invoice.walk_in_customer_name || invoice.customer_name || 'Walk-in Customer'}</span>
        </div>
        ${invoice.transport && String(invoice.transport).trim() !== '' ? `
        <div class="flex">
          <span>Transport:</span>
          <span style="font-weight: bold;">${invoice.transport}</span>
        </div>
        ` : ''}
        <div class="flex">
          <span>Cashier:</span>
          <span style="font-weight: 600;">${cashierName}</span>
        </div>
      </div>

      <!-- Items Table (66mm width with safety right margin) -->
      <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 4px; font-size: 11px;">
        <thead>
          <tr style="border-bottom: 1.5px solid #000; font-weight: bold;">
            <th style="padding: 2.5px 1px; width: 50%; text-align: left;">Item</th>
            <th style="padding: 2.5px 1px; width: 14%; text-align: center;">KG</th>
            <th style="padding: 2.5px 1px; width: 18%; text-align: right;">Rate</th>
            <th style="padding: 2.5px 3px 2.5px 1px; width: 18%; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr style="border-top: 1px dashed #000; font-weight: bold; font-size: 11.5px;">
            <td style="padding: 3px 1px; width: 50%; text-align: left;">Total Weight:</td>
            <td style="padding: 3px 1px; width: 14%; text-align: center; white-space: nowrap;">${formattedTotalWeight} KG</td>
            <td style="padding: 3px 1px; width: 18%;"></td>
            <td style="padding: 3px 3px 3px 1px; width: 18%;"></td>
          </tr>
        </tfoot>
      </table>

      <!-- Financial Summary -->
      <div style="padding-top: 2px; margin-bottom: 4px; font-size: 11.5px; font-family: Tahoma, Arial, sans-serif;">
        ${asDuplicate ? `
          ${slipCharges > 0 ? `
            <div class="flex" style="margin-bottom: 2px; padding-right: 2px;">
              <span>Slip Charges:</span>
              <span>+ Rs. ${slipCharges.toLocaleString()}</span>
            </div>
          ` : ''}
          <div class="flex" style="font-weight: 900; font-size: 13px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 3px 0; margin: 2px 0; padding-right: 2px;">
            <span>TOTAL:</span>
            <span>Rs. ${Math.abs(totalAmount).toLocaleString()}</span>
          </div>
        ` : `
          <div class="flex" style="margin-bottom: 2px; padding-right: 2px;">
            <span>Gross Subtotal:</span>
            <span style="font-weight: 700;">Rs. ${subtotal.toLocaleString()}</span>
          </div>
          ${discount > 0 ? `
            <div class="flex" style="margin-bottom: 2px; padding-right: 2px;">
              <span>Discount:</span>
              <span>- Rs. ${discount.toLocaleString()}</span>
            </div>
          ` : ''}
          ${deliveryCharge > 0 ? `
            <div class="flex" style="margin-bottom: 2px; padding-right: 2px;">
              <span>Delivery:</span>
              <span>+ Rs. ${deliveryCharge.toLocaleString()}</span>
            </div>
          ` : ''}
          ${slipCharges > 0 ? `
            <div class="flex" style="margin-bottom: 2px; padding-right: 2px;">
              <span>Slip Charges:</span>
              <span>+ Rs. ${slipCharges.toLocaleString()}</span>
            </div>
          ` : ''}
          <div class="flex" style="font-weight: 900; font-size: 13px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 3px 0; margin: 2.5px 0; padding-right: 2px;">
            <span>${isRefund ? 'REFUND DUE:' : 'NET PAYABLE:'}</span>
            <span>Rs. ${Math.abs(totalAmount).toLocaleString()}</span>
          </div>
          ${!isRefund ? `
            ${isSplit ? `
              <div class="flex" style="font-weight: 700; margin-bottom: 2px; padding-right: 2px;">
                <span>Payment Mode:</span>
                <span style="font-weight: bold;">Split (Cash + Bank)</span>
              </div>
              <div class="flex" style="font-weight: 700; margin-bottom: 2px; padding-right: 2px;">
                <span>Cash Paid / نقد:</span>
                <span style="font-weight: bold;">Rs. ${splitCash.toLocaleString()}</span>
              </div>
              <div class="flex" style="font-weight: 700; margin-bottom: 2px; padding-right: 2px;">
                <span>Bank Transfer${bankNameStr} / بینک:</span>
                <span style="font-weight: bold;">Rs. ${splitBank.toLocaleString()}</span>
              </div>
            ` : isBank ? `
              <div class="flex" style="font-weight: 700; margin-bottom: 2px; padding-right: 2px;">
                <span>Bank Transfer${bankNameStr}:</span>
                <span>Rs. ${paidAmount.toLocaleString()}</span>
              </div>
            ` : isCheque ? `
              <div class="flex" style="font-weight: 700; margin-bottom: 2px; padding-right: 2px;">
                <span>Cheque Payment${bankNameStr}:</span>
                <span>Rs. ${paidAmount.toLocaleString()}</span>
              </div>
            ` : `
              <div class="flex" style="font-weight: 700; margin-bottom: 2px; padding-right: 2px;">
                <span>Cash Tendered:</span>
                <span>Rs. ${cashTendered.toLocaleString()}</span>
              </div>
            `}
            ${changeReturn > 0 ? `
              <div class="flex" style="font-weight: bold; font-size: 12px; background: #eee; padding: 2px 3px; border: 1px dashed #000; margin-top: 2px;">
                <span>Change Due:</span>
                <span>Rs. ${changeReturn.toLocaleString()}</span>
              </div>
            ` : ''}
            ${balanceDue > 0 ? `
              <div class="flex" style="font-weight: bold; font-size: 12px; border-top: 1px dashed #000; padding: 2.5px 0; margin-top: 2px;">
                <span>Balance Due / باقی:</span>
                <span>Rs. ${balanceDue.toLocaleString()}</span>
              </div>
            ` : ''}
          ` : ''}
        `}
      </div>

      <!-- Footer Notes -->
      <div style="text-align: center; font-size: 10px; margin-top: 2px; padding-top: 2.5px; border-top: 1px dashed #000; line-height: 1.25;">
        <p style="font-weight: bold;">Thank You For Your Business!</p>
        <div style="border: 1.5px solid #000; border-radius: 4px; padding: 3px 4px; margin: 3px auto 2px auto; text-align: center; box-sizing: border-box;">
          <p style="font-size: 11px; font-weight: bold; color: #000; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; text-align: center; line-height: 1.35; margin: 0;" dir="rtl">
            نوٹ: مال نہ ملنے کی صورت میں 15 دن میں رابطہ کریں اس کے بعد کمپنی ذمہ دار نہیں ہوگی۔ شکریہ
          </p>
        </div>
        <p style="font-size: 10px; color: #111; margin-top: 4px;">*software manufactured by PENTACORE SOLUTION </br> ph no 0335-3392443 / 0333-8200344*</p>
      </div>
    </div>
  `;

  // Remove existing print iframe if any
  const existingIframe = document.getElementById('thermal-print-frame');
  if (existingIframe) {
    existingIframe.remove();
  }
  const iframe = document.createElement('iframe');
  iframe.id = 'thermal-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '80mm';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-9999';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${printBoth ? 'Receipt-Both' : (isDuplicate ? 'Duplicate' : 'Receipt')}-${billNumber}</title>
        <style>
          @page {
            margin: 0 !important;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Tahoma, Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.3;
          }
          .receipt-container {
            width: 76mm;
            max-width: 76mm;
            margin: 0 !important;
            padding: 0;
            box-sizing: border-box;
          }
          .slip-page {
            width: 76mm;
            max-width: 76mm;
            margin: 0 !important;
            padding: 0mm 2mm 6mm 1mm;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .slip-page.has-next {
            page-break-after: always;
            break-after: page;
          }
          @media print {
            @page {
              margin: 0 !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .receipt-container {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            .slip-page {
              margin: 0 !important;
              padding: 2mm 2mm 6mm 1mm !important;
              width: 76mm !important;
              max-width: 76mm !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .slip-page.has-next {
              page-break-after: always !important;
              break-after: page !important;
            }
          }
          .text-center { text-align: center; }
          .flex { display: flex; justify-content: space-between; align-items: center; }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          ${printBoth ? `
            <div class="slip-page has-next">
              ${renderSlipSection(false)}
            </div>
            <div class="slip-page">
              ${renderSlipSection(true)}
            </div>
          ` : `
            <div class="slip-page">
              ${renderSlipSection(isDuplicate)}
            </div>
          `}
        </div>
      </body>
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for images and fonts to be ready in the isolated iframe, then print immediately
  // Logo aur fonts load hone ka intezar
  await Promise.all(
    Array.from(doc.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = img.onerror = () => res();
          })
    )
  );
  try { await (doc as any).fonts?.ready; } catch { /* ignore font readiness errors */ }

  // Receipt ki asli height measure karein
  const slipPages = doc.querySelectorAll('.slip-page');
  let heightMm = 0;
  if (slipPages.length > 1) {
    const heights = Array.from(slipPages).map((el) => Math.ceil((el as HTMLElement).getBoundingClientRect().height));
    const maxHeightPx = Math.max(...heights);
    heightMm = Math.ceil((maxHeightPx * 25.4) / 96) + 4; // 4mm safety
    iframe.style.height = `${maxHeightPx}px`;
  } else {
    const container = doc.querySelector('.receipt-container') as HTMLElement;
    const heightPx = Math.ceil(container.getBoundingClientRect().height);
    heightMm = Math.ceil((heightPx * 25.4) / 96) + 4; // 4mm safety
    iframe.style.height = `${heightPx}px`;
  }
 
  // Page ki exact size set karein (size: auto ki jagah)
  const pageStyle = doc.createElement('style');
  pageStyle.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; }`;
  doc.head.appendChild(pageStyle);

  return new Promise<void>((resolve) => {
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    const win = iframe.contentWindow;
    if (win) {
      win.onafterprint = finish;
      win.focus();
      win.print();
    }
    setTimeout(finish, 500);
  });
}
