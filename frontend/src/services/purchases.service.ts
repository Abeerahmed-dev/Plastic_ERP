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
  delivery_charge_per_kg?: number | string;
  landed_cost_per_kg?: number | string;
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
  delivery_charges?: number | string;
  total_amount: number | string;
  paid_amount: number | string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  notes: string | null;
  created_at: string;
  expense_id?: string | null;
  items?: PurchaseInvoiceItem[];
  payments?: any[];
  linked_returns_total?: number | string;
  net_invoice_total?: number | string;
  balance_due?: number | string;
}

export interface StockUpdatePurchaseItem {
  id: string;
  purchase_invoice_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  size: string;
  quantity: number;
  quantity_kg: number;
  unit_price: number;
  base_unit_price: number;
  delivery_charge_per_kg: number;
  landed_cost_per_kg: number;
  current_sale_price: number;
  current_cost_price: number;
  current_wac: number;
  total_stock_kg: number;
}

export interface StockUpdatePurchase {
  id: string;
  invoice_number: string;
  date: string;
  created_at: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  delivery_charges: number;
  expense_id?: string | null;
  supplier_id: string;
  supplier_name: string;
  total_kg: number;
  items: StockUpdatePurchaseItem[];
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

  getRecentForStockUpdate: async (limit: number = 20): Promise<StockUpdatePurchase[]> => {
    const response = await api.get<{ success: boolean; data: StockUpdatePurchase[] }>('/purchases/recent-for-stock-update', {
      params: { limit },
    });
    return response.data.data;
  },

  updateStockDcAndPrices: async (
    purchaseId: string,
    payload: {
      delivery_charges?: number;
      items: Array<{
        product_id: string;
        selling_price: number;
      }>;
    }
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/purchases/${purchaseId}/update-stock-dc-and-prices`, payload);
    return response.data;
  },
};
