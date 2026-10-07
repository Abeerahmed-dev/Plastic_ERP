import api from './api';
import { Invoice } from '../types/invoice.types';

export interface POSCheckoutItem {
  product_id: string;
  quantity: number;
  selected_unit?: string;
  unit_price: number;
}

export interface POSCheckoutData {
  customer_id?: string;
  items: POSCheckoutItem[];
  discount?: number;
  amount_paid?: number;
  payment_method?: string;
  bank_account_id?: string;
}

export interface ShiftAuditItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code?: string;
  quantity: number;
  selected_unit: string;
  unit_price: number;
  total_price: number;
  net_kg_processed: number;
}

export interface ShiftAuditInvoice {
  id: string;
  invoice_number: string;
  date: string;
  created_at: string;
  customer_name: string;
  customer_code?: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  items: ShiftAuditItem[];
}

export const posService = {
  checkout: async (data: POSCheckoutData): Promise<Invoice> => {
    const response = await api.post<{ data: Invoice }>('/pos/checkout', data);
    return response.data.data;
  },

  getTodayCashTally: async (): Promise<{ today_cash_tally: number }> => {
    const response = await api.get<{ data: { today_cash_tally: number } }>('/pos/today-tally');
    return response.data.data;
  },

  getShiftAudit: async (): Promise<ShiftAuditInvoice[]> => {
    const response = await api.get<{ data: ShiftAuditInvoice[] }>('/pos/shift-audit');
    return response.data.data;
  },
};


