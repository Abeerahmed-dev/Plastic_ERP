import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ApiSuccess } from '../../types/api.types';
import { StatementOfAccount, StatementEntry } from '../../components/StatementOfAccount';

interface SupplierLedgerProps {
  supplierId: string;
  supplierName?: string;
  supplierCode?: string;
  supplierCity?: string | null;
  supplierPhone?: string | null;
}

export const SupplierLedger = ({
  supplierId,
  supplierName,
  supplierCode,
  supplierCity,
  supplierPhone,
}: SupplierLedgerProps) => {

  const { data: statement = [], isLoading, refetch } = useQuery({
    queryKey: ['suppliers', supplierId, 'statement'],
    queryFn: async () => {
      const response = await api.get<ApiSuccess<StatementEntry[]>>(`/suppliers/${supplierId}/statement`);
      return response.data.data;
    },
  });

  return (
    <StatementOfAccount
      data={statement}
      isLoading={isLoading}
      entityType="supplier"
      entityName={supplierName}
      entityCode={supplierCode}
      entityCity={supplierCity}
      entityPhone={supplierPhone}
      onRefresh={refetch}
    />
  );
};

export default SupplierLedger;

