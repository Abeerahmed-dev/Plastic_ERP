export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  size?: string;
  quantity: string | number;
  unit_price: string | number;
  total_price: string | number;
  product_name?: string;
  product_code?: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
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
  total_amount: string | number;
  paid_amount: string | number;
  status: 'DRAFT' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  notes: string | null;
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
  customer_id: string;
  date: string;
  due_date?: string;
  discount: number;
  notes?: string;
  items: CreateInvoiceItemData[];
}
