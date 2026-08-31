import api from './api';
import { Product, CreateProductData, UpdateProductData, UnitOfMeasure } from '../types/product.types';
import { ApiSuccess } from '../types/api.types';

export const productsService = {
  getProducts: async (): Promise<Product[]> => {
    const response = await api.get<ApiSuccess<Product[]>>('/products');
    return response.data.data;
  },

  getPOSAvailableProducts: async (search?: string): Promise<Product[]> => {
    const response = await api.get<ApiSuccess<Product[]>>('/products/pos-available', {
      params: { search },
    });
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

  getUoms: async (): Promise<UnitOfMeasure[]> => {
    const response = await api.get<ApiSuccess<UnitOfMeasure[]>>('/products/uom');
    return response.data.data;
  },
};
