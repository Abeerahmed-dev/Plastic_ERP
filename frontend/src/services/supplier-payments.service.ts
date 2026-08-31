import api from './api';
import { PaginationMeta } from '../types/api.types';

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  purchase_invoice_id: string | null;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  supplier_name?: string;
  purchase_invoice_number?: string;
}

export interface CreateSupplierPaymentData {
  supplier_id: string;
  purchase_invoice_id?: string | null;
  payment_date: string;
  amount: number;
  payment_method: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  notes?: string;
}

export const supplierPaymentsService = {
  getPayments: async (params?: any): Promise<{ data: SupplierPayment[]; meta: PaginationMeta }> => {
    const response = await api.get('/supplier-payments', { params });
    return response.data;
  },
  createPayment: async (data: CreateSupplierPaymentData): Promise<SupplierPayment> => {
    const response = await api.post('/supplier-payments', data);
    return response.data.data;
  }
};
