import api from './api';
import { ApiSuccess } from '../types/api.types';

export interface LowStockVariant {
  id: string;
  name: string;
  code: string;
  size: string;
  total_stock_kg: number;
  low_stock_threshold: number;
  deficit_kg: number;
  cost_price: number;
  sale_price: number;
  category_id: string;
  category_name: string;
  bag_weight_kg: number;
}

export const inventoryService = {
  getLowStock: async (): Promise<LowStockVariant[]> => {
    const response = await api.get<ApiSuccess<LowStockVariant[]>>('/inventory/low-stock');
    return response.data.data;
  },
};
