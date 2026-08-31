import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, HandCoins } from 'lucide-react';
import { supplierPaymentsService } from '../../services/supplier-payments.service';
import { useAuthStore } from '../../store/auth.store';
import { SupplierPaymentFormModal } from './SupplierPaymentFormModal';

export default function SupplierPaymentsListPage() {
  const { hasPermission } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canWrite = hasPermission('payments:write');

  const { data: paymentsRes, isLoading, refetch } = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => supplierPaymentsService.getPayments({ limit: 50 }),
  });

  const payments = paymentsRes?.data || [];

  const filteredPayments = payments.filter(
    (p) =>
      p.payment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
    }).format(Number(val));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supplier Payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Record and track payments sent to suppliers.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Record Payment
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-xl border-0 py-2.5 pl-10 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-500">Loading payments...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <HandCoins className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900">No payments found</h3>
              <p className="mt-1 text-sm text-slate-500">Get started by recording a new supplier payment.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Payment #</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Date</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Supplier</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-slate-900">Method</th>
                  <th className="px-6 py-3.5 text-right text-sm font-semibold text-slate-900">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-blue-600">
                      {payment.payment_number}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-slate-900">{payment.supplier_name}</div>
                      {payment.purchase_invoice_number && (
                        <div className="text-xs text-slate-500">Inv: {payment.purchase_invoice_number}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {payment.payment_method}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-medium text-slate-900">
                      {formatCurrency(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && (
        <SupplierPaymentFormModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
