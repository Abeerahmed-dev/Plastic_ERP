export interface PaymentHistoryItem {
  id: string;
  type?: 'PAYMENT' | 'CREDIT_NOTE' | 'REFUND' | string;
  polarity?: 'POSITIVE' | 'NEGATIVE' | string;
  display_type?: string;
  payment_no: string;
  payment_number?: string;
  credit_note_number?: string;
  date: string;
  payment_date?: string;
  method: string;
  payment_method?: string;
  amount: number;
  notes?: string | null;
  return_reason?: string | null;
  bank_account_id?: string | null;
  cheque_number?: string | null;
  cheque_bank_name?: string | null;
  cheque_due_date?: string | null;
  cheque_status?: 'PENDING' | 'CLEARED' | 'BOUNCED' | null;
}

export interface InvoiceLineItem {
  id?: string;
  product_id?: string;
  product_name: string;
  product_size?: string | null;
  size?: string | null;
  quantity?: number;
  net_qty?: number;
  selected_unit?: string;
  actual_weight_per_unit?: number | null;
  net_kg_processed?: number | null;
  unit_price: number;
  total_price?: number;
  total?: number;
}

export interface CustomerPaymentSummary {
  id: string;
  sales_id?: string;
  invoice_id: string | null;
  parent_invoice_id?: string | null;
  invoice_number: string;
  invoice_type?: string;
  type?: string;
  payment_method?: string;
  customer_id: string;
  customer_name: string;
  customer_code?: string;
  original_total?: number;
  invoice_total_amount: number;
  total_paid?: number;
  total_paid_against_invoice: number;
  invoice_status: string;
  dynamic_status?: string;
  line_items?: InvoiceLineItem[];
  linked_credit_notes?: any[];
  linked_refunds?: any[];
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

export interface RefundableCreditSource {
  id: string;
  type: 'OVERPAID_INVOICE' | 'ADVANCE';
  reference: string;
  available_credit: number;
  date: string;
}

