import api from './api';
import { Payment, CreatePaymentData } from '../types/payment.types';
import { ApiSuccess } from '../types/api.types';

export const paymentsService = {
  getPayments: async (params?: any): Promise<Payment[]> => {
    const response = await api.get<ApiSuccess<Payment[]>>('/payments', { params });
    return response.data.data;
  },

  createPayment: async (data: CreatePaymentData): Promise<Payment> => {
    const response = await api.post<ApiSuccess<Payment>>('/payments', data);
    return response.data.data;
  },

  createRefund: async (data: {
    customer_id: string;
    amount: number;
    source?: string;
    notes?: string;
    refund_date?: string;
    linked_invoice_id?: string | null;
    source_id?: string | null;
    source_type?: string | null;
  }): Promise<any> => {
    const response = await api.post<ApiSuccess<any>>('/refunds/customer', data);
    return response.data.data;
  },

  logCustomerAdvance: async (data: {
    customer_id: string;
    amount: number;
    payment_date?: string;
    date?: string;
    source?: string;
    notes?: string;
  }): Promise<any> => {
    const response = await api.post<ApiSuccess<any>>('/advances/customer', data);
    return response.data.data;
  },

  logSupplierAdvance: async (data: {
    supplier_id: string;
    amount: number;
    payment_date?: string;
    date?: string;
    source?: string;
    notes?: string;
  }): Promise<any> => {
    const response = await api.post<ApiSuccess<any>>('/advances/supplier', data);
    return response.data.data;
  },

  processCustomerRefund: async (data: {
    customer_id: string;
    amount: number;
    payment_date?: string;
    refund_date?: string;
    date?: string;
    source?: string;
    notes?: string;
    linked_invoice_id?: string | null;
    source_id?: string | null;
    source_type?: 'OVERPAID_INVOICE' | 'ADVANCE' | string | null;
  }): Promise<any> => {
    const response = await api.post<ApiSuccess<any>>('/refunds/customer', data);
    return response.data.data;
  },

  processSupplierRefund: async (data: {
    supplier_id: string;
    amount: number;
    payment_date?: string;
    refund_date?: string;
    date?: string;
    source?: string;
    notes?: string;
    purchase_invoice_id?: string | null;
    source_id?: string | null;
    source_type?: 'OVERPAID_INVOICE' | 'ADVANCE' | string | null;
  }): Promise<any> => {
    const response = await api.post<ApiSuccess<any>>('/refunds/supplier', data);
    return response.data.data;
  },
};
