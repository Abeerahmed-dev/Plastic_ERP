import api from './api';
import { Invoice, CreateInvoiceData } from '../types/invoice.types';
import { ApiSuccess } from '../types/api.types';

export const invoicesService = {
  getInvoices: async (): Promise<Invoice[]> => {
    const response = await api.get<ApiSuccess<Invoice[]>>('/invoices');
    return response.data.data;
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const response = await api.get<ApiSuccess<Invoice>>(`/invoices/${id}`);
    return response.data.data;
  },

  createInvoice: async (data: CreateInvoiceData): Promise<Invoice> => {
    const response = await api.post<ApiSuccess<Invoice>>('/invoices', data);
    return response.data.data;
  },

  getInvoiceReturnSummary: async (id: string): Promise<{ parentInvoice: any; items: any[] }> => {
    const response = await api.get<ApiSuccess<{ parentInvoice: any; items: any[] }>>(`/invoices/${id}/returns/summary`);
    return response.data.data;
  },

  createSalesReturn: async (parentInvoiceId: string, data: { return_reason: string; items: { product_id: string; return_quantity: number }[] }): Promise<Invoice> => {
    const response = await api.post<ApiSuccess<Invoice>>(`/sales/${parentInvoiceId}/returns`, data);
    return response.data.data;
  }
};

