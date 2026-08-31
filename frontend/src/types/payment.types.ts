export interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: string | number;
  payment_method: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  customer_id: string;
  customer_name?: string;
  invoice_number?: string | null;
}

export interface CreatePaymentData {
  customer_id: string;
  invoice_id?: string | null;
  payment_date: string;
  amount: number;
  payment_method: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  notes?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'OPENING_BALANCE';
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}
