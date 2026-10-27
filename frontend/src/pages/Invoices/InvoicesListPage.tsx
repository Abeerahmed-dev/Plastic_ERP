import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, FileText, RotateCcw, ShoppingCart, Printer, CheckCircle2, ArrowLeft } from 'lucide-react';
import { invoicesService } from '../../services/invoices.service';
import { useAuthStore } from '../../store/auth.store';
import { InvoiceFormModal } from './InvoiceFormModal';
import { ProcessReturnModal } from './ProcessReturnModal';
import InvoiceDetailModal, { InvoiceDetailData } from '../../components/InvoiceDetailModal';
import { CascadingFilterBar } from '../../components/CascadingFilterBar';
import { useCascadingFilters } from '../../hooks/useCascadingFilters';
import { RecordPaymentModal } from '../../components/Modals/RecordPaymentModal';
import { getCustomers } from '../../services/customers.service';
import { Pagination } from '../../components/Common/Pagination';
import { printThermalReceipt } from '../../utils/printThermal';

interface InvoicesListPageProps {
  defaultType?: 'erp' | 'pos' | 'all';
}

export default function InvoicesListPage({ defaultType }: InvoicesListPageProps = {}) {
  const { user, hasPermission } = useAuthStore();
  const userRole = (user?.roleName || user?.role || '').toUpperCase();
  const isCashier = userRole === 'CASHIER';
  const isOwner = userRole === 'OWNER' || userRole === 'ADMIN';

  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get('type');

  const initialTab = (defaultType || (typeParam === 'pos' ? 'pos' : typeParam === 'all' ? 'all' : 'erp')) as 'erp' | 'pos' | 'all';
  const [activeTab, setActiveTab] = useState<'erp' | 'pos' | 'all'>(
    ['erp', 'pos', 'all'].includes(initialTab) ? initialTab : 'erp'
  );

  useEffect(() => {
    if (defaultType && defaultType !== activeTab) {
      setActiveTab(defaultType);
    } else if (typeParam && ['erp', 'pos', 'all'].includes(typeParam) && typeParam !== activeTab) {
      setActiveTab(typeParam as 'erp' | 'pos' | 'all');
    }
  }, [defaultType, typeParam, activeTab]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [detailModalInvoice, setDetailModalInvoice] = useState<InvoiceDetailData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [printingInvoiceId, setPrintingInvoiceId] = useState<string | null>(null);

  const [returnInvoiceId, setReturnInvoiceId] = useState<string | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  const canWrite = isCashier || isOwner || hasPermission('customers:write') || hasPermission('sales:write');

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesService.getInvoices,
  });

  const { data: customersResponse } = useQuery({
    queryKey: ['customers', { page: 1, limit: 100 }],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    staleTime: 30000,
  });
  const customersList = customersResponse?.data || [];

  // Summary counts
  const { erpCount, posCount, allCount, erpTotal, posTotal } = useMemo(() => {
    let erp = 0;
    let pos = 0;
    let eTotal = 0;
    let pTotal = 0;

    for (const inv of invoices) {
      const isPos = String(inv.invoice_number || '').startsWith('POS-') || (inv.notes && inv.notes.includes('POS'));
      const amt = Number(inv.total_amount || 0);
      if (isPos) {
        pos++;
        pTotal += amt;
      } else {
        erp++;
        eTotal += amt;
      }
    }

    return {
      erpCount: erp,
      posCount: pos,
      allCount: invoices.length,
      erpTotal: eTotal,
      posTotal: pTotal,
    };
  }, [invoices]);

  // Filter invoices based on active tab
  const activeInvoices = useMemo(() => {
    if (activeTab === 'pos') {
      return invoices.filter((inv: any) =>
        String(inv.invoice_number || '').startsWith('POS-') || (inv.notes && inv.notes.includes('POS'))
      );
    }
    if (activeTab === 'erp') {
      return invoices.filter((inv: any) =>
        !String(inv.invoice_number || '').startsWith('POS-') && !(inv.notes && inv.notes.includes('POS'))
      );
    }
    return invoices;
  }, [invoices, activeTab]);

  const normalizedInvoices = useMemo(() => {
    return activeInvoices.map((inv: any) => ({
      ...inv,
      city: inv.city || inv.customer_city || null,
      name: inv.customer_name || inv.name || '',
      invoice_number: inv.invoice_number || '',
    }));
  }, [activeInvoices]);

  // Cascading filters hook (dynamically bound to activeTab's invoices)
  const {
    selectedCity,
    selectedName,
    selectedInvoice,
    setSelectedCity,
    setSelectedName,
    setSelectedInvoice,
    availableCities,
    availableNames,
    availableInvoices,
    resetFilters,
  } = useCascadingFilters(normalizedInvoices);

  const handleTabChange = (tab: 'erp' | 'pos' | 'all') => {
    setActiveTab(tab);
    setCurrentPage(1);
    resetFilters();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'erp') {
        next.delete('type');
      } else {
        next.set('type', tab);
      }
      return next;
    });
  };

  const handleOpenInvoice = async (id: string) => {
    try {
      const detail = await invoicesService.getInvoice(id);
      setDetailModalInvoice(detail as any);
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch invoice details:', err);
    }
  };

  const handleInitiateReturn = (id: string) => {
    setReturnInvoiceId(id);
    setIsReturnModalOpen(true);
  };

  const handlePrintThermal = async (invoice: any) => {
    try {
      setPrintingInvoiceId(invoice.id);
      const detail = await invoicesService.getInvoice(invoice.id);
      const items = (detail as any)?.items || [];
      await printThermalReceipt({
        invoice: detail,
        items,
        cashierName: (detail as any)?.creator?.name || (detail as any)?.created_by_name || user?.name || 'Cashier',
        customerName: (detail as any)?.customer_name || 'Walk-In Customer',
      });
    } catch (err) {
      console.error('Failed to print thermal receipt:', err);
    } finally {
      setPrintingInvoiceId(null);
    }
  };

  // Strict multi-condition filter before rendering
  const filteredTableRows = useMemo(() => {
    return normalizedInvoices.filter((row: any) => {
      const matchesCity = selectedCity ? row.city === selectedCity : true;
      const matchesName = selectedName ? row.name === selectedName : true;
      const matchesInvoice = selectedInvoice ? row.invoice_number === selectedInvoice : true;
      return matchesCity && matchesName && matchesInvoice;
    });
  }, [normalizedInvoices, selectedCity, selectedName, selectedInvoice]);

  const totalPages = Math.ceil(filteredTableRows.length / PAGE_SIZE) || 1;
  const paginatedInvoices = filteredTableRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2,
    }).format(Number(val));
  };

  const renderCreatorBadge = (invoice: any) => {
    const role = (invoice.created_by_role || invoice.creator?.role || 'ADMIN').toUpperCase();
    const name = invoice.created_by_name || invoice.creator?.name || 'User';

    if (role === 'CASHIER') {
      return (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200" title={`Issued by Cashier: ${name}`}>
          Cashier
        </span>
      );
    }
    if (role === 'OWNER') {
      return (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200" title={`Issued by Owner: ${name}`}>
          Owner
        </span>
      );
    }
    return (
      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200" title={`Issued by Admin: ${name}`}>
        Admin
      </span>
    );
  };

  const getStatusBadge = (invoice: any) => {
    const isCreditNote = (invoice as any).invoice_type === 'CREDIT_NOTE' || invoice.invoice_number?.startsWith('CN-') || Number(invoice.total_amount) < 0;
    if (isCreditNote) {
      return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-800 border border-red-300">CREDIT NOTE</span>;
    }

    if (invoice.balance_due !== undefined && Number(invoice.balance_due) < 0) {
      return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">OVERPAID</span>;
    }

    const totalAmt = Number(invoice.total_amount || 0);
    const paidAmt = Number(invoice.paid_amount || 0);
    if (totalAmt > 0 && paidAmt >= totalAmt) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Paid
        </span>
      );
    }

    switch (invoice.status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Paid
          </span>
        );
      case 'PARTIAL':
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">Partial</span>;
      case 'UNPAID':
        return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">Unpaid</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 border border-slate-200">{invoice.status}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-start sm:items-center gap-3.5">
          {activeTab === 'pos' && (
            <Link
              to="/pos"
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-950 shadow-xs transition-all active:scale-95 group shrink-0 mt-0.5 sm:mt-0"
              title="Back to POS Billing Screen"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700 group-hover:text-slate-950 transition-transform group-hover:-translate-x-1" />
            </Link>
          )}

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'pos'
                  ? 'POS Sale Invoices (Retail Counter)'
                  : activeTab === 'erp'
                  ? 'ERP Sales Invoices & Credit Notes'
                  : 'All Sales Invoices'}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                activeTab === 'pos'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : activeTab === 'erp'
                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                  : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}>
                {activeTab === 'pos' ? `${posCount} POS Bills` : activeTab === 'erp' ? `${erpCount} ERP Invoices` : `${allCount} Total Invoices`}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === 'pos'
                ? 'Walk-in cash-and-carry retail counter sales history with instant thermal slip printing.'
                : activeTab === 'erp'
                ? 'B2B commercial sales invoices, customer ledger balances, and strict invoice-anchored credit notes.'
                : 'Unified view of commercial B2B sales and retail POS sales history.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {activeTab === 'pos' ? (
          <Link
            to="/pos"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-sm font-bold shadow-sm transition-all active:scale-95 group w-fit"
            title="Return to POS Billing Screen"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400 transition-transform group-hover:-translate-x-1" />
            <span>Back to POS</span>
          </Link>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Plus className="-ml-1 mr-1.5 h-4 w-4 text-slate-500" />
              Record Payment
            </button>

            {canWrite && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="-ml-1 mr-1.5 h-4 w-4 text-slate-950" />
                Create Invoice
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cascading Filter Bar */}
      <div className="mb-6">
        <CascadingFilterBar
          selectedCity={selectedCity}
          selectedName={selectedName}
          selectedInvoice={selectedInvoice}
          onCityChange={(c) => { setSelectedCity(c); setCurrentPage(1); }}
          onNameChange={(n) => { setSelectedName(n); setCurrentPage(1); }}
          onInvoiceChange={(inv) => { setSelectedInvoice(inv); setCurrentPage(1); }}
          availableCities={availableCities}
          availableNames={availableNames}
          availableInvoices={availableInvoices}
          onReset={() => { resetFilters(); setCurrentPage(1); }}
          showInvoice={true}
          nameLabel={activeTab === 'pos' ? 'Walk-in / Customer' : 'Customer'}
          namePlaceholder={activeTab === 'pos' ? 'Filter by POS customer…' : 'Filter by customer…'}
        />
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {activeTab === 'pos' ? 'POS Bill Number' : 'Invoice / Credit Note'}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Billed By
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                {activeTab !== 'pos' && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Balance Due
                  </th>
                )}
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={activeTab === 'pos' ? 6 : 7} className="px-6 py-12 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <span className="mt-2">Loading invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTableRows.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'pos' ? 6 : 7} className="px-6 py-12 text-center text-sm text-slate-500">
                    {selectedCity || selectedName || selectedInvoice
                      ? 'No invoices match the active cascading filters. Try resetting filters.'
                      : activeTab === 'pos'
                      ? 'No POS sale invoices found.'
                      : activeTab === 'erp'
                      ? 'No ERP sales invoices found.'
                      : 'No invoices found.'}
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => {
                  const isPos = String(invoice.invoice_number || '').startsWith('POS-') || (invoice.notes && invoice.notes.includes('POS'));
                  const isCreditNote = (invoice as any).invoice_type === 'CREDIT_NOTE' || invoice.invoice_number?.startsWith('CN-') || Number(invoice.total_amount) < 0;
                  const balanceDue = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0));
                  const isPrinting = printingInvoiceId === invoice.id;

                  return (
                    <tr
                      key={invoice.id}
                      className={`transition-colors ${
                        isCreditNote
                          ? 'bg-red-50/70 border-l-4 border-l-red-500'
                          : isPos
                          ? 'hover:bg-amber-50/30'
                          : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => handleOpenInvoice(invoice.id)}
                            className="flex items-center text-left group p-1.5 -ml-1.5 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer"
                            title="Click to view detailed line items"
                          >
                            <div className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl group-hover:scale-105 transition-all shadow-xs ${
                              isCreditNote
                                ? 'bg-red-100 text-red-700'
                                : isPos
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {isCreditNote ? (
                                <RotateCcw className="h-5 w-5" />
                              ) : isPos ? (
                                <ShoppingCart className="h-5 w-5" />
                              ) : (
                                <FileText className="h-5 w-5" />
                              )}
                            </div>
                            <div className="ml-3">
                              <div className={`text-sm font-bold font-mono group-hover:underline flex items-center gap-1.5 ${
                                isCreditNote
                                  ? 'text-red-900 group-hover:text-red-700'
                                  : isPos
                                  ? 'text-amber-950 group-hover:text-amber-700'
                                  : 'text-slate-900 group-hover:text-purple-700'
                              }`}>
                                <span>{invoice.invoice_number}</span>
                                {isPos && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-200/80 text-amber-900">
                                    POS
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-purple-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                View details →
                              </div>
                            </div>
                          </button>
                          {isOwner && renderCreatorBadge(invoice)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                          <span>{invoice.customer_name}</span>
                          {invoice.customer_name?.toLowerCase().includes('walk-in') && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Walk-in
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{invoice.customer_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-800">
                            {invoice.creator?.name || invoice.created_by_name || 'System'}
                          </span>
                          {isOwner && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {invoice.created_by_role || invoice.creator?.role || 'Staff'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {new Date(invoice.date || invoice.created_at).toLocaleDateString()}
                        </div>
                        {invoice.created_at && (
                          <div className="text-[10px] text-slate-400">
                            {new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isCreditNote ? 'text-red-700 font-bold font-mono' : 'text-slate-900 font-semibold'}`}>
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      {activeTab !== 'pos' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-rose-600">
                          {formatCurrency(balanceDue)}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPos && (
                            <button
                              onClick={() => handlePrintThermal(invoice)}
                              disabled={isPrinting}
                              className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-200 transition-all active:scale-95 shadow-2xs cursor-pointer"
                              title="Print 80mm Thermal Slip"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-700" />
                              <span>{isPrinting ? 'Printing…' : 'Print Slip'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenInvoice(invoice.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-all active:scale-95 shadow-2xs cursor-pointer"
                            title="View Full Invoice Details"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>Details</span>
                          </button>

                          {!isCreditNote && canWrite && (
                            <button
                              onClick={() => handleInitiateReturn(invoice.id)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 transition-all active:scale-95 shadow-2xs cursor-pointer"
                              title="Process Sales Return & Issue Credit Note"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                              <span>Return</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTableRows.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      <InvoiceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          refetch();
        }}
      />

      <InvoiceDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        invoice={detailModalInvoice}
        type="sales"
        onProcessReturn={(invId) => handleInitiateReturn(invId)}
      />

      {returnInvoiceId && (
        <ProcessReturnModal
          parentInvoiceId={returnInvoiceId}
          isOpen={isReturnModalOpen}
          onClose={() => {
            setIsReturnModalOpen(false);
            setReturnInvoiceId(null);
          }}
          onSuccess={() => {
            refetch();
          }}
        />
      )}

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        type="CUSTOMER"
        entityType="customer"
        customers={customersList}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}
