import api from './api';
import { Product, CreateProductData, UpdateProductData } from '../types/product.types';
import { ApiSuccess } from '../types/api.types';

export interface ProductBatch {
  id: string;
  product_id: string;
  batch_number: string;
  initial_qty: number;
  remaining_qty: number;
  buy_price_per_kg: number;
  selected_unit: string;
  actual_weight_per_unit: number;
  batch_unit_conversions: Record<string, number> | string;
  created_at: string;
}

export const productsService = {
  getProducts: async (params?: any): Promise<Product[]> => {
    const cleanParams = params && !params.queryKey ? params : undefined;
    const response = await api.get<ApiSuccess<Product[]>>('/products', {
      params: { limit: 500, ...cleanParams },
    });
    return response.data.data;
  },

  getPOSAvailableProducts: async (search?: string): Promise<Product[]> => {
    const response = await api.get<ApiSuccess<Product[]>>('/products/pos-available', {
      params: { search },
    });
    return response.data.data;
  },

  getProductBatches: async (id: string): Promise<ProductBatch[]> => {
    const response = await api.get<ApiSuccess<ProductBatch[]>>(`/products/${id}/batches`);
    return response.data.data;
  },

  getProduct: async (id: string): Promise<Product> => {
    const response = await api.get<ApiSuccess<Product>>(`/products/${id}`);
    return response.data.data;
  },

  createProduct: async (data: CreateProductData): Promise<Product> => {
    const response = await api.post<ApiSuccess<Product>>('/products', data);
    return response.data.data;
  },

  updateProduct: async (id: string, data: UpdateProductData): Promise<Product> => {
    const response = await api.put<ApiSuccess<Product>>(`/products/${id}`, data);
    return response.data.data;
  },

  deleteProduct: async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`);
  },

  getUoms: async (): Promise<any[]> => {
    return [];
  },
};
