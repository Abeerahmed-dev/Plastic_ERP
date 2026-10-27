import api from './api';
import { ProductExchange, CreateExchangeData, ExchangeFilters } from '../types/exchange.types';
import { ApiSuccess } from '../types/api.types';

export const exchangesService = {
  getExchanges: async (filters?: ExchangeFilters): Promise<{ rows: ProductExchange[]; total: number }> => {
    const response = await api.get<ApiSuccess<ProductExchange[]>>('/exchanges', {
      params: filters,
    });
    return {
      rows: response.data.data,
      total: response.data.meta?.total ?? response.data.data.length,
    };
  },

  getExchange: async (id: string): Promise<ProductExchange> => {
    const response = await api.get<ApiSuccess<ProductExchange>>(`/exchanges/${id}`);
    return response.data.data;
  },

  createExchange: async (data: CreateExchangeData): Promise<ProductExchange> => {
    const response = await api.post<ApiSuccess<ProductExchange>>('/exchanges', data);
    return response.data.data;
  },
};
