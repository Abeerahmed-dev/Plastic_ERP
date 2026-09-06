import { create } from 'zustand';
import api from '../services/api';

export interface ReceivePaymentData {
  customer_id: string;
  invoice_id?: string | null;
  payment_date: string;
  amount: number;
  payment_method: 'CASH' | 'BANK' | 'PDC' | 'BANK_TRANSFER' | 'CHEQUE';
  notes?: string;
}

interface PaymentState {
  isSubmitting: boolean;
  error: string | null;
  receivePayment: (data: ReceivePaymentData) => Promise<any>;
}

export const usePaymentStore = create<PaymentState>((set) => ({
  isSubmitting: false,
  error: null,

  receivePayment: async (data: ReceivePaymentData) => {
    set({ isSubmitting: true, error: null });
    try {
      const response = await api.post('/payments', data);
      set({ isSubmitting: false });
      return response.data;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to process payment';
      set({ error: errMsg, isSubmitting: false });
      throw new Error(errMsg);
    }
  },
}));
