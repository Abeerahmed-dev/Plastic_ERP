import api from './api';
import { PaginationMeta } from '../types/api.types';

export interface PaymentHistoryItem {
  id: string;
  type?: string;
  payment_no: string;
  payment_number?: string;
  debit_note_number?: string;
  invoice_number?: string;
  date: string;
  payment_date?: string;
  method: string;
  payment_method?: string;
  amount: number;
  notes?: string | null;
  return_reason?: string;
  polarity?: string;
  display_type?: string;
  created_at?: string;
}

export interface SupplierPaymentSummary {
  id: string;
  purchase_id: string;
  purchase_invoice_id: string | null;
  parent_invoice_id?: string | null;
  purchase_invoice_number: string;
  invoice_number?: string;
  invoice_type?: string;
  supplier_id: string;
  supplier_name: string;
  supplier_code?: string;
  original_total?: number;
  invoice_total_amount: number;
  total_paid_against_invoice: number;
  total_paid?: number;
  invoice_status: string;
  dynamic_status?: string;
  line_items?: any[];
  linked_debit_notes?: any[];
  payment_history: PaymentHistoryItem[];
}

export interface SupplierPayment extends SupplierPaymentSummary {}

export interface CreateSupplierPaymentData {
  supplier_id: string;
  purchase_invoice_id?: string | null;
  payment_date: string;
  amount: number;
  payment_method: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'PDC';
  bank_account_id?: string | null;
  notes?: string;
  cheque_number?: string;
  cheque_bank_name?: string;
  cheque_due_date?: string;
  cheque_status?: 'PENDING' | 'CLEARED' | 'BOUNCED';
}

export const supplierPaymentsService = {
  getPayments: async (params?: any): Promise<{ data: SupplierPaymentSummary[]; meta: PaginationMeta }> => {
    const response = await api.get('/supplier-payments', { params });
    return response.data;
  },
  createPayment: async (data: CreateSupplierPaymentData): Promise<SupplierPayment> => {
    const response = await api.post('/supplier-payments', data);
    return response.data.data;
  },
  clearCheque: async (id: string): Promise<void> => {
    await api.put(`/supplier-payments/${id}/clear-cheque`);
  }
};
