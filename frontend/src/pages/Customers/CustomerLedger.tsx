import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ApiSuccess } from '../../types/api.types';
import { StatementOfAccount, StatementEntry } from '../../components/StatementOfAccount';

interface CustomerLedgerProps {
  customerId: string;
  customerName?: string;
  customerCode?: string;
  customerCity?: string | null;
  customerPhone?: string | null;
}

export const CustomerLedger = ({
  customerId,
  customerName,
  customerCode,
  customerCity,
  customerPhone,
}: CustomerLedgerProps) => {
  const { data: statement = [], isLoading, refetch } = useQuery({
    queryKey: ['customers', customerId, 'statement'],
    queryFn: async () => {
      const response = await api.get<ApiSuccess<StatementEntry[]>>(`/customers/${customerId}/statement`);
      return response.data.data;
    },
  });

  return (
    <StatementOfAccount
      data={statement}
      isLoading={isLoading}
      entityType="customer"
      entityName={customerName}
      entityCode={customerCode}
      entityCity={customerCity}
      entityPhone={customerPhone}
      onRefresh={refetch}
    />
  );
};

export default CustomerLedger;
