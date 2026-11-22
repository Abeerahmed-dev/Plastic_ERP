export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  size?: string;
  quantity: string | number;
  unit_price: string | number;
  total_price: string | number;
  product_name?: string;
  name_urdu?: string | null;
  product_code?: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  walk_in_customer_name?: string | null;
  customer_name?: string;
  customer_code?: string;
  invoice_number: string;
  invoice_type?: 'SALE' | 'CREDIT_NOTE';
  parent_invoice_id?: string | null;
  return_reason?: string | null;
  date: string;
  due_date: string | null;
  subtotal: string | number;
  discount: string | number;
  delivery_charge?: string | number;
  slip_charges?: string | number;
  total_amount: string | number;
  paid_amount: string | number;
  cash_tendered?: number | null;
  change_returned?: number | null;
  status: 'DRAFT' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  notes: string | null;
  transport?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_by_role?: string | null;
  creator?: {
    name?: string;
    role?: string;
  };
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  credit_notes?: Invoice[];
}

export interface CreateInvoiceItemData {
  product_id: string;
  size?: string;
  quantity: number;
  unit_price: number;
  total?: number;
  total_price?: number;
  selected_unit?: string;
}

export interface CreateInvoiceData {
  customer_id?: string;
  walk_in_customer_name?: string | null;
  date: string;
  due_date?: string | null;
  discount: number;
  delivery_charge?: number;
  slip_charges?: number;
  advance_applied_amount?: number;
  payment_account_id?: string | null;
  payment_method?: string | null;
  payment_splits?: Array<{ payment_account_id: string | number; amount: number }> | null;
  notes?: string;
  transport?: string | null;
  items: CreateInvoiceItemData[];
}
