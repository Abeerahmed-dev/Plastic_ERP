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
  }
};
