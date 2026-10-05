export interface PaymentHistoryItem {
  id: string;
  payment_no: string;
  payment_number?: string;
  date: string;
  payment_date?: string;
  method: string;
  payment_method?: string;
  amount: number;
  notes?: string | null;
  bank_account_id?: string | null;
  cheque_number?: string | null;
  cheque_bank_name?: string | null;
  cheque_due_date?: string | null;
  cheque_status?: 'PENDING' | 'CLEARED' | 'BOUNCED' | null;
}

export interface CustomerPaymentSummary {
  id: string;
  sales_id?: string;
  invoice_id: string | null;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_code?: string;
  invoice_total_amount: number;
  total_paid_against_invoice: number;
  invoice_status: string;
  payment_history: PaymentHistoryItem[];
}

export interface Payment extends CustomerPaymentSummary {}

export interface CreatePaymentData {
  customer_id: string;
  supplier_id?: string | null;
  invoice_id?: string | null;
  payment_date: string;
  amount: number;
  payment_method: 'CASH' | 'BANK' | 'BANK_TRANSFER' | 'CHEQUE' | 'PDC' | 'DIRECT_TO_SUPPLIER';
  bank_account_id?: string | null;
  notes?: string;
  cheque_number?: string;
  cheque_bank_name?: string;
  cheque_due_date?: string;
  cheque_status?: 'PENDING' | 'CLEARED' | 'BOUNCED';
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'OPENING_BALANCE' | 'CREDIT_NOTE';
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}
