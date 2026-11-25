import api from './api';
import { Invoice, CreateInvoiceData } from '../types/invoice.types';
import { ApiSuccess } from '../types/api.types';

export const invoicesService = {
  getInvoices: async (params?: any): Promise<Invoice[]> => {
    const isParamObject = params && !params.queryKey && typeof params === 'object';
    const queryParams = isParamObject ? params : undefined;
    const response = await api.get<ApiSuccess<Invoice[]>>('/invoices', { params: queryParams });
    return response.data.data;
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const response = await api.get<ApiSuccess<Invoice>>(`/invoices/${id}`);
    return response.data.data;
  },

  createInvoice: async (
    data: CreateInvoiceData & { offline_id?: string; offline_timestamp?: number }
  ): Promise<Invoice> => {
    const response = await api.post<ApiSuccess<Invoice>>('/invoices', data, {
      timeout: 6000,
    });
    return response.data.data;
  },

  getInvoiceReturnSummary: async (id: string): Promise<{ parentInvoice: any; items: any[] }> => {
    const response = await api.get<ApiSuccess<{ parentInvoice: any; items: any[] }>>(`/invoices/${id}/returns/summary`);
    return response.data.data;
  },

  createSalesReturn: async (parentInvoiceId: string, data: { return_reason: string; items: { product_id: string; return_quantity: number }[] }): Promise<Invoice> => {
    const response = await api.post<ApiSuccess<Invoice>>(`/sales/${parentInvoiceId}/returns`, data);
    return response.data.data;
  },

  voidInvoice: async (id: string, voidReason?: string | null): Promise<any> => {
    const response = await api.post<ApiSuccess<any>>(`/invoices/${id}/void`, { voidReason: voidReason || '' });
    return response.data;
  }
};

