import { useState, useEffect } from 'react';
import { X, Printer, Calendar, User, RotateCcw, AlertCircle, CheckCircle2, Ban, Edit2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { productsService } from '../services/products.service';
import sabirLogo from '../assets/sabirlogo.png';
import { A4InvoicePrintPortal, prepareInvoiceForPrint } from './print';
import { invoicesService } from '../services/invoices.service';
import { printThermalReceipt } from '../utils/printThermal';
import { getUrduProductName } from '../utils/bilingual';

export interface InvoiceDetailItem {
  id?: string;
  line_item_id?: string;
  product_id: string;
  product_name: string;
  name_urdu?: string | null;
  product_name_urdu?: string | null;
  category?: string;
  product_code?: string;
  product_size?: string | null;
  size?: string | null;
  batch_number?: string;
  batch_weight_per_unit?: number;
  batch_selected_unit?: string;
  quantity: number;
  returned_quantity?: number;
  return_quantity?: number;
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
  type?: string;
  invoice_type?: string;
  parent_invoice_id?: string | null;
  return_reason?: string | null;
  walk_in_customer_name?: string | null;
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
  delivery_charge?: number;
  delivery_charges?: number;
  slip_charges?: number;
  total_amount: number;
  paid_amount: number;
  amount_paid?: number;
  linked_returns_total?: number;
  net_total?: number;
  net_invoice_total?: number;
  balance_due?: number;
  cash_tendered?: number | null;
  change_returned?: number | null;
  notes?: string | null;
  transport?: string | null;
  void_reason?: string | null;
  voided_at?: string | null;
  voided_by_user_id?: string | null;
  items: InvoiceDetailItem[];
  credit_notes?: InvoiceDetailData[];
  linked_debit_notes?: InvoiceDetailData[];
  creator?: { name: string; role?: string };
  created_by_name?: string;
  created_by_role?: string;
}

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceDetailData | null;
  type?: 'sales' | 'purchase';
  onProcessReturn?: (invoiceId: string) => void;
  onEdit?: (invoiceId: string) => void;
}

export default function InvoiceDetailModal({ isOpen, onClose, invoice, type = 'sales', onProcessReturn, onEdit }: InvoiceDetailModalProps) {
  const { user } = useAuthStore();
  const isCashier = (user?.role || '').toUpperCase() === 'CASHIER';
  const [printCopyMode, setPrintCopyMode] = useState<'ORIGINAL' | 'DUPLICATE' | 'BOTH'>('ORIGINAL');
  const [invoiceToPrint, setInvoiceToPrint] = useState<any | null>(null);
  const [isPrintingA4, setIsPrintingA4] = useState(false);
  const [isPrintingPOS, setIsPrintingPOS] = useState(false);

  useEffect(() => {
    return () => {
      document.body.classList.remove('printing-a4', 'printing-pos');
    };
  }, []);

  const { data: allProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsService.getProducts(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

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

  const entityName = type === 'purchase'
    ? (invoice.supplier_name || 'Party')
    : (invoice.walk_in_customer_name || invoice.customer_name || 'Customer');
  const entityCode = type === 'purchase' ? invoice.supplier_code : invoice.customer_code;
  const entityPhone = type === 'purchase' ? invoice.supplier_phone : invoice.customer_phone;
  const entityCity = type === 'purchase' ? invoice.supplier_city : invoice.customer_city;

  const subtotal = Number(invoice.subtotal || invoice.total_amount + (invoice.discount || 0));
  const discount = Number(invoice.discount || 0);
  const deliveryCharge = type === 'purchase' ? 0 : Number(invoice.delivery_charge || 0);
  const slipCharges = type === 'purchase' ? 0 : Number(invoice.slip_charges || 0);
  const totalAmount = Number(invoice.total_amount || 0);
  const paidAmount = Number(invoice.paid_amount || invoice.amount_paid || 0);

  const isDebitNote = invoice.invoice_type === 'DEBIT_NOTE' || invoice.invoice_number?.startsWith('DN-');
  const isCreditNote = invoice.invoice_type === 'CREDIT_NOTE' || invoice.invoice_number?.startsWith('CN-') || (!isDebitNote && totalAmount < 0);
  const isReturnNote = isDebitNote || isCreditNote;
  const isPosInvoice = type !== 'purchase' && (String(invoice.invoice_number || '').startsWith('POS-') || Boolean(invoice.notes && invoice.notes.includes('POS')));
  const statusUpper = (invoice.status || 'UNPAID').toUpperCase();

  // Child Returns Calculation (Credit Notes for sales, Debit Notes for purchases)
  const childReturns = (type === 'purchase' ? (invoice.linked_debit_notes || invoice.credit_notes) : invoice.credit_notes) || [];
  const hasReturns = childReturns.length > 0 || (invoice.items || []).some((i) => Number(i.returned_quantity || 0) > 0);
  const totalReturnedAmount = invoice.linked_returns_total !== undefined
    ? Number(invoice.linked_returns_total)
    : childReturns.reduce((acc, cn) => acc + Math.abs(Number(cn.total_amount || 0)), 0);

  const netFinalInvoiceTotal = invoice.net_invoice_total !== undefined
    ? Number(invoice.net_invoice_total)
    : Math.round((totalAmount - totalReturnedAmount) * 100) / 100;

  // CRITICAL: True net balance without Math.max(0, ...). Allow negative numbers for OVERPAID state.
  const balanceDue = invoice.balance_due !== undefined
    ? Number(invoice.balance_due)
    : Math.round((netFinalInvoiceTotal - paidAmount) * 100) / 100;

  const totalBags = Math.round(
    (invoice.items || []).reduce((acc, item) => {
      const itemReturnedQty = Number(item.returned_quantity || 0);
      const childCalculatedReturnedQty = childReturns.reduce((cAcc, cn) => {
        const matching = (cn.items || []).filter(
          (i) => (item.id && (i.id === item.id || i.line_item_id === item.id)) || i.product_id === item.product_id
        );
        return cAcc + matching.reduce((sum, ci) => sum + Math.abs(Number(ci.quantity || ci.return_quantity || 0)), 0);
      }, 0);
      const returnedQty = itemReturnedQty > 0 ? itemReturnedQty : childCalculatedReturnedQty;
      const netQty = Math.max(0, Number(item.quantity || 0) - returnedQty);
      const matchingProduct = allProducts.find((p) => p.id === item.product_id);
      const bagWeight = Number((item as any).bag_weight_kg || (item as any).category_bag_weight_kg || matchingProduct?.bag_weight_kg || 25);
      return acc + (bagWeight > 0 ? netQty / bagWeight : 0);
    }, 0) * 100
  ) / 100;

  const getStatusBadge = () => {
    if (statusUpper === 'VOID') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-800 text-white border border-slate-700">
          <Ban className="w-3.5 h-3.5 text-slate-300" />
          VOID
        </span>
      );
    }
    if (isDebitNote) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
          DEBIT NOTE
        </span>
      );
    }
    if (isCreditNote) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-300">
          <RotateCcw className="w-3.5 h-3.5 text-red-600" />
          CREDIT NOTE
        </span>
      );
    }
    if (balanceDue < 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          OVERPAID
        </span>
      );
    }
    if (statusUpper === 'PAID' || balanceDue === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          PAID
        </span>
      );
    }
    if (statusUpper === 'PARTIAL' || (paidAmount > 0 && balanceDue > 0)) {
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

  const handlePrintA4 = async () => {
    if (!invoice) return;
    try {
      setIsPrintingA4(true);
      let fullInvoice: any = invoice;
      if (!fullInvoice.items || fullInvoice.items.length === 0) {
        fullInvoice = await invoicesService.getInvoice(invoice.id);
      }
      const prepared = prepareInvoiceForPrint({
        ...fullInvoice,
        type: fullInvoice.type || (type === 'purchase' ? 'purchase' : 'sales'),
      }, allProducts);
      setInvoiceToPrint(prepared);
    } catch (err) {
      console.error('Failed to prepare invoice for A4 print:', err);
    } finally {
      setIsPrintingA4(false);
    }
  };

  const handlePrintPOS = async () => {
    if (!invoice) return;
    try {
      setIsPrintingPOS(true);
      let fullInvoice: any = invoice;
      if (!fullInvoice.items || fullInvoice.items.length === 0) {
        fullInvoice = await invoicesService.getInvoice(invoice.id);
      }
      const items = fullInvoice.items || [];
      await printThermalReceipt({
        invoice: fullInvoice,
        items,
        cashierName: fullInvoice.creator?.name || fullInvoice.created_by_name || user?.name || 'Cashier',
        customerName: fullInvoice.walk_in_customer_name || fullInvoice.customer_name || 'Walk-In Customer',
      });
    } catch (err) {
      console.error('Failed to print thermal receipt:', err);
    } finally {
      setIsPrintingPOS(false);
    }
  };


  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto print:hidden">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
          {/* Modal Window Top Controls (hidden on print) */}
          <div className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50 gap-2 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {type === 'purchase' ? 'Purchase Invoice' : (isCreditNote ? 'Credit Note' : 'Sales Invoice')}
              </span>
              <span className="font-mono font-bold text-slate-900">#{invoice.invoice_number}</span>
              {getStatusBadge()}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

        {/* Top Center Logo Header Banner (visible on screen and on print) */}
        <div className="text-center pt-5 pb-4 px-6 flex flex-col items-center justify-center border-b border-slate-200 bg-white">
          <img
            src={sabirLogo}
            alt="Sabir Plastic"
            className="h-16 w-auto object-contain mb-2 drop-shadow-sm"
          />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
            SABIR PLASTIC
          </h1>
          <p className="text-xs font-bold text-amber-600 tracking-wider uppercase mt-0.5">
            {type === 'purchase' ? (isDebitNote ? 'Debit Note Invoice' : 'Purchase Invoice / Bill') : (isCreditNote ? 'Credit Note Invoice' : 'Official Sales Invoice')}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2.5">
            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Invoice #{invoice.invoice_number}
            </span>
            <div className="hidden print:inline-block">
              {getStatusBadge()}
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 print:overflow-visible print:p-4">
          {statusUpper === 'VOID' && (
            <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-700 flex items-start gap-3 shadow-md">
              <Ban className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-black uppercase tracking-wider text-red-400">VOIDED INVOICE</span>
                  {invoice.voided_at && (
                    <span className="text-slate-400">
                      • {new Date(invoice.voided_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {invoice.void_reason && (
                  <p className="text-slate-200">
                    <strong className="text-slate-400">Reason:</strong> {invoice.void_reason}
                  </p>
                )}
                <p className="text-slate-400 text-[11px]">
                  Physical stock has been restored to warehouse inventory and payments converted to surplus advance credit.
                </p>
              </div>
            </div>
          )}
          {/* Metadata Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 print:bg-white print:border-slate-300">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {type === 'purchase' ? 'Party Details' : 'Billed To'}
              </span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <User className="w-4 h-4 text-purple-600 print:hidden" />
                {entityName} {entityCode ? `(${entityCode})` : ''}
              </div>
              {entityPhone && <p className="text-xs text-slate-600">Phone: {entityPhone}</p>}
              {entityCity && <p className="text-xs text-slate-500">City: {entityCity}</p>}
              {invoice.transport && invoice.transport.trim() !== '' && (
                <p className="text-xs text-slate-500">Transport: {invoice.transport}</p>
              )}
            </div>

            <div className="space-y-1 md:text-right">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Invoice Details
              </span>
              <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5 md:justify-end">
                <Calendar className="w-4 h-4 text-purple-600 print:hidden" />
                Date: {invoice.date ? new Date(invoice.date).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : 'N/A'}
              </div>
              {type === 'purchase' && invoice.due_date && (
                <p className="text-xs text-slate-500">
                  Due Date: {new Date(invoice.due_date).toLocaleDateString('en-PK', { dateStyle: 'medium' })}
                </p>
              )}
              <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5 md:justify-end mt-1">
                <span className="font-semibold text-slate-500">Billed By:</span>
                <span className="text-slate-900 font-bold">{invoice.creator?.name || invoice.created_by_name || 'System'}</span>
                {invoice.created_by_role && (
                  <span className="inline-flex items-center px-1 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    {invoice.created_by_role}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3 text-right">Original Qty</th>
                  {hasReturns && <th className="py-2.5 px-3 text-right text-red-600">Returned</th>}
                  {hasReturns && <th className="py-2.5 px-3 text-right text-purple-700 font-bold">Net Qty</th>}
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!invoice.items || invoice.items.length === 0) ? (
                  <tr>
                    <td colSpan={hasReturns ? 9 : 7} className="py-6 text-center text-slate-400 italic">
                      No line items found for this invoice.
                    </td>
                  </tr>
                ) : (
                  invoice.items.map((item, idx) => {
                    const unitName = item.selected_unit || 'Dasti';

                    const itemReturnedQty = Number(item.returned_quantity || 0);
                    const childCalculatedReturnedQty = childReturns.reduce((acc, cn) => {
                      const matching = (cn.items || []).filter(
                        (i) => (item.id && (i.id === item.id || i.line_item_id === item.id)) || i.product_id === item.product_id
                      );
                      return acc + matching.reduce((sum, ci) => sum + Math.abs(Number(ci.quantity || ci.return_quantity || 0)), 0);
                    }, 0);

                    const returnedQty = itemReturnedQty > 0 ? itemReturnedQty : childCalculatedReturnedQty;
                    const origQty = Number(item.quantity || 0);
                    const netQty = Math.max(0, origQty - returnedQty);

                    const matchingProduct = allProducts.find((p) => p.id === item.product_id);
                    const productSize =
                      item.product_size ||
                      item.size ||
                      matchingProduct?.size;
                    const urduName = getUrduProductName(
                      item.product_name,
                      item.name_urdu || item.product_name_urdu || matchingProduct?.name_urdu,
                      item.category || matchingProduct?.category
                    );

                    return (
                      <tr key={item.id || idx} className={isReturnNote ? 'bg-red-50/50' : 'hover:bg-slate-50'}>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 leading-snug">
                            {item.product_name}
                            {item.product_code && <span className="ml-1 text-[10px] text-slate-400 font-mono">({item.product_code})</span>}
                          </div>
                          {urduName && (
                            <div className="text-[11px] font-medium text-slate-600 font-serif leading-tight mt-0.5" dir="rtl">
                              {urduName}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {productSize ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-xs text-slate-800 font-semibold border border-slate-200">
                              {productSize}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">
                          {formatNumber(origQty)}
                        </td>
                        {hasReturns && (
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600">
                            {returnedQty > 0 ? `-${formatNumber(returnedQty)}` : '-'}
                          </td>
                        )}
                        {hasReturns && (
                          <td className="py-2.5 px-3 text-right font-mono font-black text-purple-700">
                            {formatNumber(netQty)}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-slate-600 font-medium">{unitName}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatPKR(item.unit_price)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${isReturnNote ? 'text-red-700' : 'text-slate-900'}`}>
                          {formatPKR(item.total_price)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Child Return Notes Section (Credit Notes / Debit Notes) */}
          {childReturns.length > 0 && (
            <div className="p-4 rounded-xl bg-red-50/70 border border-red-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-red-600" />
                  Processed Returns / {type === 'purchase' ? 'Debit Notes' : 'Credit Notes'} ({childReturns.length})
                </span>
                <span className="text-xs font-mono font-bold text-red-700">
                  Total {type === 'purchase' ? 'Debited' : 'Refunded'}: -{formatPKR(totalReturnedAmount)}
                </span>
              </div>
              <div className="space-y-2">
                {childReturns.map((cn) => (
                  <div key={cn.id} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-red-200/60">
                    <div>
                      <span className="font-mono font-bold text-slate-900 mr-2">#{cn.invoice_number}</span>
                      <span className="text-slate-500">{new Date(cn.date).toLocaleDateString('en-GB')}</span>
                      {cn.return_reason && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                          {cn.return_reason}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-red-600">
                      -{formatPKR(Math.abs(cn.total_amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary Footer */}
          <div className="flex flex-col md:flex-row justify-between gap-4 pt-2">
            <div className="text-xs text-slate-500 space-y-1">
              {invoice.notes && (
                <div>
                  <strong className="text-slate-700 block">Notes / Reason:</strong>
                  <p className="italic bg-slate-50 p-2 rounded border border-slate-200">{invoice.notes}</p>
                </div>
              )}
            </div>

            <div className="w-full md:w-72 space-y-2 text-xs border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-6">
              <div className="flex justify-between text-slate-600">
                <span>Total Bags:</span>
                <span className="font-mono font-bold text-slate-800">{formatNumber(totalBags)}</span>
              </div>
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
              {type !== 'purchase' && deliveryCharge > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Delivery / Freight:</span>
                  <span className="font-mono font-semibold">+{formatPKR(deliveryCharge)}</span>
                </div>
              )}
              {type !== 'purchase' && slipCharges > 0 && (
                <div className="flex justify-between text-indigo-600">
                  <span>Slip Charges:</span>
                  <span className="font-mono font-semibold">+{formatPKR(slipCharges)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                <span>Original Grand Total:</span>
                <span className={`font-mono ${isReturnNote ? 'text-red-600 font-bold' : ''}`}>{formatPKR(totalAmount)}</span>
              </div>

              {childReturns.length > 0 && (
                <>
                  <div className="flex justify-between font-bold text-red-600 text-xs">
                    <span>Less Returns ({type === 'purchase' ? 'Debit Notes' : 'Credit Notes'}):</span>
                    <span className="font-mono">-{formatPKR(totalReturnedAmount)}</span>
                  </div>
                  <div className="flex justify-between font-black text-purple-700 text-sm pt-1.5 border-t border-purple-200 bg-purple-50/50 p-1.5 rounded">
                    <span>Net Final Invoice Total:</span>
                    <span className="font-mono">{formatPKR(netFinalInvoiceTotal)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-slate-700 pt-1">
                <span>Amount Paid:</span>
                <span className="font-mono font-medium">{formatPKR(paidAmount)}</span>
              </div>

              {((invoice.cash_tendered !== undefined && invoice.cash_tendered !== null && Number(invoice.cash_tendered) > paidAmount) ||
                (invoice.change_returned !== undefined && invoice.change_returned !== null && Number(invoice.change_returned) > 0)) && (
                <>
                  <div className="flex justify-between text-slate-800">
                    <span>Cash Tendered / نقد وصول:</span>
                    <span className="font-mono font-bold">{formatPKR(Number(invoice.cash_tendered || paidAmount))}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                    <span>Change Returned / بقایا واپسی:</span>
                    <span className="font-mono">{formatPKR(Number(invoice.change_returned || 0))}</span>
                  </div>
                </>
              )}

              {!isCashier && (
                balanceDue < 0 ? (
                  <div className="flex justify-between font-black text-amber-600 text-sm pt-1.5 border-t border-amber-200">
                    <span>Balance Due:</span>
                    <span className="font-mono">- Rs. {Math.abs(balanceDue).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Overpaid)</span>
                  </div>
                ) : balanceDue === 0 ? (
                  <div className="flex justify-between font-bold text-emerald-600 text-xs pt-1 border-t border-emerald-100">
                    <span>Balance Due:</span>
                    <span className="font-mono">Rs. 0.00 (Fully Settled)</span>
                  </div>
                ) : (
                  <div className="flex justify-between font-black text-rose-600 text-sm pt-1.5 border-t border-rose-200">
                    <span>Balance Due:</span>
                    <span className="font-mono">{formatPKR(balanceDue)}</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Signatures Section */}
          <div className="pt-10 pb-2 flex justify-between items-end px-2 print:pt-14">
            <div className="text-center">
              <div className="w-40 sm:w-48 border-b border-dashed border-slate-400 mb-1.5"></div>
              <p className="text-xs font-semibold text-slate-600">Labour Name</p>
            </div>

            <div className="text-center">
              <div className="w-44 sm:w-52 border-b-2 border-slate-800 mb-1.5"></div>
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Authorized Stamp
              </p>
            </div>
          </div>

          {/* Invoice Terms & Urdu Note Footer */}
          <div className="pt-6 mt-4 border-t-2 border-slate-200 text-center space-y-2">
            <p className="text-sm sm:text-base font-bold text-slate-900 tracking-wider uppercase">
              Thank you for your business!
            </p>
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl py-3 px-4 max-w-xl mx-auto space-y-1">
              <p className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed font-sans" dir="rtl">
                نوٹ: مال نہ ملنے کی صورت میں 15 دن میں رابطہ کریں، اس کے بعد کمپنی ذمہ دار نہیں ہوگی۔ شکریہ!
              </p>
              <p className="text-[11px] text-slate-600 font-medium">
                Note: Maal na milne ki soorat 15 din me rabta karen is k baad company zimedar nh hogi. Shukria
              </p>
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

          <div className="flex items-center gap-3">
            {type === 'purchase' && !isReturnNote && !hasReturns && statusUpper !== 'VOID' && statusUpper !== 'CANCELLED' && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(invoice.id);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-sm font-bold shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Edit2 className="w-4 h-4 text-amber-700" />
                Edit Invoice
              </button>
            )}

            {!isCashier && !isReturnNote && onProcessReturn && (
              <button
                onClick={() => {
                  onClose();
                  onProcessReturn(invoice.id);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-bold shadow-xs transition active:scale-95"
              >
                <RotateCcw className="w-4 h-4 text-red-600" />
                Process Return ({type === 'purchase' ? 'Debit Note' : 'Credit Note'})
              </button>
            )}

            {isPosInvoice && (
              <button
                type="button"
                onClick={handlePrintPOS}
                disabled={isPrintingPOS}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 text-sm font-bold shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                🖨️ {isPrintingPOS ? 'Printing…' : 'POS Receipt (80mm)'}
              </button>
            )}

            {!isPosInvoice && (
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Print:</span>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-600 transition">
                  <input
                    type="checkbox"
                    checked={printCopyMode === 'ORIGINAL'}
                    onChange={() => setPrintCopyMode('ORIGINAL')}
                    className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>Original</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-600 transition">
                  <input
                    type="checkbox"
                    checked={printCopyMode === 'DUPLICATE'}
                    onChange={() => setPrintCopyMode('DUPLICATE')}
                    className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>Duplicate</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-600 transition">
                  <input
                    type="checkbox"
                    checked={printCopyMode === 'BOTH'}
                    onChange={() => setPrintCopyMode('BOTH')}
                    className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>Both</span>
                </label>
              </div>
            )}

            {!isPosInvoice && (
              <button
                type="button"
                onClick={handlePrintA4}
                disabled={isPrintingA4}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 text-sm font-bold shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4 text-slate-950" />
                {isPrintingA4 ? 'Loading…' : 'Print A4 Invoice'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* A4 Print Portal */}
    <A4InvoicePrintPortal
      invoice={invoiceToPrint}
      copyMode={printCopyMode}
      onAfterPrint={() => setInvoiceToPrint(null)}
    />
  </>
);
}
