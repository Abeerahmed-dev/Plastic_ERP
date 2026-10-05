import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import api from '../../services/api';
import { LedgerEntry } from '../../types/payment.types';
import { ApiSuccess } from '../../types/api.types';

interface CustomerLedgerProps {
  customerId: string;
}

export const CustomerLedger = ({ customerId }: CustomerLedgerProps) => {
  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ['customers', customerId, 'ledger'],
    queryFn: async () => {
      const response = await api.get<ApiSuccess<LedgerEntry[]>>(`/customers/${customerId}/ledger`);
      return response.data.data;
    },
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading ledger...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
      <div className="p-6 border-b border-slate-200 flex items-center justify-between print:hidden">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Account Ledger</h3>
          <p className="text-sm text-slate-500">Chronological history of all invoices and payments.</p>
        </div>
        <button
          onClick={handlePrint}
          className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
        >
          <Printer className="mr-2 h-4 w-4" />
          Print / PDF
        </button>
      </div>
      
      {/* Print Header (Only visible when printing) */}
      <div className="hidden print:block p-8 border-b border-slate-200 mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Customer Statement</h1>
        <p className="text-sm text-slate-500">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Debit (Dr)</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Credit (Cr)</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {ledger.map((entry, index) => (
              <tr key={entry.id || index} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {new Date(entry.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    entry.type === 'INVOICE' ? 'bg-blue-50 text-blue-700 ring-blue-700/10' :
                    entry.type === 'PAYMENT' ? 'bg-emerald-50 text-emerald-700 ring-emerald-700/10' :
                    entry.type === 'CREDIT_NOTE' ? 'bg-red-50 text-red-700 ring-red-700/10 font-bold' :
                    'bg-slate-50 text-slate-700 ring-slate-700/10'
                  }`}>
                    {entry.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                  {entry.reference}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-700">
                  {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-700">
                  {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                  entry.balance < 0 ? 'text-red-600' : 'text-slate-900'
                }`}>
                  {formatCurrency(entry.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
