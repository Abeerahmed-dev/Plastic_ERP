import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ApiSuccess } from '../../types/api.types';
import { StatementOfAccount, StatementEntry } from '../../components/StatementOfAccount';
import { RecordPaymentModal } from '../../components/Modals/RecordPaymentModal';

interface SupplierLedgerProps {
  supplierId: string;
  supplierName?: string;
  supplierCode?: string;
}

export const SupplierLedger = ({ supplierId, supplierName, supplierCode }: SupplierLedgerProps) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { data: statement = [], isLoading, refetch } = useQuery({
    queryKey: ['suppliers', supplierId, 'statement'],
    queryFn: async () => {
      const response = await api.get<ApiSuccess<StatementEntry[]>>(`/suppliers/${supplierId}/statement`);
      return response.data.data;
    },
  });

  return (
    <>
      <StatementOfAccount
        data={statement}
        isLoading={isLoading}
        entityType="supplier"
        entityName={supplierName}
        entityCode={supplierCode}
        onRefresh={refetch}
        onRecordPayment={() => setIsPaymentModalOpen(true)}
      />
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        entityType="supplier"
        supplierId={supplierId}
        onSuccess={refetch}
      />
    </>
  );
};

export default SupplierLedger;

