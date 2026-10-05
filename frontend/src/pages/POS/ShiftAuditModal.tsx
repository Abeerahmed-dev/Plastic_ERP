import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, DollarSign, Calendar, ChevronDown, ChevronUp, Clock, FileText, User, ShoppingBag } from 'lucide-react';
import { posService, ShiftAuditInvoice } from '../../services/pos.service';

interface ShiftAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShiftAuditModal: React.FC<ShiftAuditModalProps> = ({ isOpen, onClose }) => {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['shiftAudit'],
    queryFn: () => posService.getShiftAudit(),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const totalCashCollected = invoices.reduce((acc, inv) => acc + Number(inv.paid_amount || inv.total_amount || 0), 0);
  const formattedToday = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const toggleInvoice = (id: string) => {
    setExpandedInvoiceId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Shift Reconciliation Audit</h2>
              <div className="flex items-center gap-2 text-xs text-emerald-100 mt-0.5 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formattedToday}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Cash Summary Banner */}
        <div className="p-5 bg-emerald-50/80 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
              Today's Total Cash in Drawer
            </span>
            <span className="text-2xl font-black text-emerald-700 font-mono">
              Rs. {totalCashCollected.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 shadow-xs">
            <span>{invoices.length} Sales Transactions Generated</span>
          </div>
        </div>

        {/* Invoice List View */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 font-medium">
              Loading shift transactions...
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No sales transactions recorded for your shift today.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {invoices.map((inv) => {
                const isExpanded = expandedInvoiceId === inv.id;
                const timeStr = new Date(inv.created_at || inv.date).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={inv.id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs transition-all"
                  >
                    {/* Invoice Header Row */}
                    <div
                      onClick={() => toggleInvoice(inv.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 text-sm">
                              {inv.invoice_number}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeStr}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-0.5">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{inv.customer_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-700 block font-mono">
                            Rs. {Number(inv.paid_amount || inv.total_amount).toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            CASH PAID
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Nested Items Accordion */}
                    {isExpanded && (
                      <div className="bg-slate-50/80 p-4 border-t border-slate-100 animate-in slide-in-from-top-1 duration-150">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
                          Line Items Sold ({inv.items?.length || 0})
                        </div>
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="p-2.5">Product Name</th>
                                <th className="p-2.5 text-center">Qty / Unit</th>
                                <th className="p-2.5 text-right">Net KG</th>
                                <th className="p-2.5 text-right">Unit Price</th>
                                <th className="p-2.5 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {inv.items?.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 font-semibold text-slate-800">
                                    {item.product_name}
                                  </td>
                                  <td className="p-2.5 text-center font-medium">
                                    {item.quantity} {item.selected_unit}
                                  </td>
                                  <td className="p-2.5 text-right font-mono text-slate-600">
                                    {Number(item.net_kg_processed || 0).toFixed(2)} KG
                                  </td>
                                  <td className="p-2.5 text-right font-mono">
                                    Rs. {Number(item.unit_price).toLocaleString()}
                                  </td>
                                  <td className="p-2.5 text-right font-bold text-slate-900 font-mono">
                                    Rs. {Number(item.total_price).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            Close Reconciliation Audit
          </button>
        </div>
      </div>
    </div>
  );
};
