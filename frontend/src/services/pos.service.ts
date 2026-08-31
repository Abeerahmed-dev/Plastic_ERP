import api from './api';
import { Invoice } from '../types/invoice.types';

export interface POSCheckoutItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface POSCheckoutData {
  items: POSCheckoutItem[];
  discount?: number;
}

export const posService = {
  checkout: async (data: POSCheckoutData): Promise<Invoice> => {
    const response = await api.post<{ data: Invoice }>('/pos/checkout', data);
    return response.data.data;
  },
};
