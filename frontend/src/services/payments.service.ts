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
  }
};
