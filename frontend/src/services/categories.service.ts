import api from './api';

export interface Category {
  id: string;
  name: string;
  bag_weight_kg: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryPayload {
  name: string;
  bag_weight_kg: number;
  description?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  bag_weight_kg?: number;
  description?: string;
}

export const categoriesService = {
  async getCategories(): Promise<Category[]> {
    const res = await api.get('/categories');
    return res.data.data;
  },

  async getCategoryById(id: string): Promise<Category> {
    const res = await api.get(`/categories/${id}`);
    return res.data.data;
  },

  async createCategory(payload: CreateCategoryPayload): Promise<Category> {
    const res = await api.post('/categories', payload);
    return res.data.data;
  },

  async updateCategory(id: string, payload: UpdateCategoryPayload): Promise<Category> {
    const res = await api.put(`/categories/${id}`, payload);
    return res.data.data;
  },

  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/categories/${id}`);
  },
};
