import api from './api';
import { PaginationMeta, ApiSuccess } from '../types/api.types';

export interface PurchaseInvoiceItem {
  id?: string;
  purchase_invoice_id?: string;
  product_id: string;
  product_name?: string;
  size?: string;
  quantity: number | string;
  unit_price: number | string;
  total_price?: number | string;
}

export interface PurchaseInvoice {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  invoice_number: string;
  date: string;
  due_date: string | null;
  subtotal: number | string;
  discount: number | string;
  total_amount: number | string;
  paid_amount: number | string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  notes: string | null;
  created_at: string;
  items?: PurchaseInvoiceItem[];
  payments?: any[];
  linked_returns_total?: number | string;
  net_invoice_total?: number | string;
  balance_due?: number | string;
}

export interface PurchaseInvoiceQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  supplier_id?: string;
  startDate?: string;
  endDate?: string;
}

export const purchasesService = {
  getInvoices: async (params?: any): Promise<{ data: PurchaseInvoice[]; meta: PaginationMeta }> => {
    const response = await api.get<{ data: PurchaseInvoice[]; meta: PaginationMeta }>('/purchases', { params });
    return response.data;
  },

  getInvoice: async (id: string): Promise<PurchaseInvoice> => {
    const response = await api.get<ApiSuccess<PurchaseInvoice>>(`/purchases/${id}`);
    return response.data.data;
  },

  createInvoice: async (data: Omit<PurchaseInvoice, 'id' | 'invoice_number' | 'status' | 'paid_amount' | 'created_at'>): Promise<PurchaseInvoice> => {
    const response = await api.post<ApiSuccess<PurchaseInvoice>>('/purchases', data);
    return response.data.data;
  },

  updateInvoiceStatus: async (id: string, data: { status?: string; paid_amount?: number }): Promise<PurchaseInvoice> => {
    const response = await api.patch<ApiSuccess<PurchaseInvoice>>(`/purchases/${id}/status`, data);
    return response.data.data;
  },

  createPurchaseReturn: async (data: {
    parent_invoice_id: string;
    items?: { product_id: string; return_quantity: number }[];
    line_items?: { product_id: string; return_quantity: number }[];
    return_reason?: string;
  }): Promise<any> => {
    const response = await api.post('/purchase-returns', data);
    return response.data.data;
  },

  getInvoiceReturnSummary: async (parentInvoiceId: string): Promise<any> => {
    const response = await api.get(`/purchases/${parentInvoiceId}/returns/summary`);
    return response.data.data;
  },
};

