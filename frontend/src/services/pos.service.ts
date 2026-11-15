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
  split_cash_amount?: number;
  split_bank_amount?: number;
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

export interface POSHeldOrder {
  id: string;
  reference_note: string;
  customer_id?: string | null;
  customer_name?: string | null;
  items: any[];
  subtotal: number;
  discount: number;
  total_amount: number;
  payment_method: string;
  split_cash_amount?: number | null;
  split_bank_amount?: number | null;
  bank_account_id?: string | null;
  slip_mode?: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
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

  getHeldOrders: async (): Promise<POSHeldOrder[]> => {
    const response = await api.get<{ data: POSHeldOrder[] }>('/pos/held-orders');
    return response.data.data;
  },

  createHeldOrder: async (data: any): Promise<POSHeldOrder> => {
    const response = await api.post<{ data: POSHeldOrder }>('/pos/held-orders', data);
    return response.data.data;
  },

  deleteHeldOrder: async (id: string): Promise<void> => {
    await api.delete(`/pos/held-orders/${id}`);
  },
};


