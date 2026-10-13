import api from './api';

export interface IncomingPdc {
  id: string;
  payment_id: string | null;
  customer_id: string;
  customer_name?: string;
  customer_code?: string;
  destination_bank_account_id: string | null;
  destination_bank_name?: string;
  destination_account_title?: string;
  destination_account_number?: string;
  cheque_number: string;
  cheque_bank_name: string;
  cheque_due_date: string;
  amount: number;
  status: 'PENDING' | 'CLEARED' | 'BOUNCED';
  notes: string | null;
  payment_number?: string;
  created_at: string;
  updated_at: string;
}

export const incomingPdcsService = {
  async getIncomingPdcs(status?: string): Promise<IncomingPdc[]> {
    const response = await api.get('/incoming-pdcs', {
      params: status ? { status } : {},
    });
    return response.data.data;
  },

  async clearPdc(id: string): Promise<IncomingPdc> {
    const response = await api.post(`/incoming-pdcs/${id}/clear`);
    return response.data.data;
  },

  async bouncePdc(id: string): Promise<IncomingPdc> {
    const response = await api.post(`/incoming-pdcs/${id}/bounce`);
    return response.data.data;
  },
};
