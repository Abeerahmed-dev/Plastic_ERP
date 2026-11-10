import InvoiceDetailModal, { InvoiceDetailData, InvoiceDetailItem } from './InvoiceDetailModal';

export type { InvoiceDetailData, InvoiceDetailItem };

export interface PurchasingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceDetailData | null;
  onProcessReturn?: (invoiceId: string) => void;
}

export const PurchasingDetailsModal = ({
  isOpen,
  onClose,
  invoice,
  onProcessReturn,
}: PurchasingDetailsModalProps) => {
  return (
    <InvoiceDetailModal
      isOpen={isOpen}
      onClose={onClose}
      invoice={invoice}
      type="purchase"
      onProcessReturn={onProcessReturn}
    />
  );
};

export default PurchasingDetailsModal;

