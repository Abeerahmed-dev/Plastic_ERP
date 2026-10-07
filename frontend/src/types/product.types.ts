export interface Category {
  id: string;
  name: string;
  bag_weight_kg: number;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  size?: string | null;
  description: string | null;
  category_id: string;
  category_name?: string;
  category?: string;
  bag_weight_kg?: number;
  cost_price: string | number;
  sale_price: string | number;
  fixed_retail_price_per_kg?: string | number;
  opening_stock: string | number;
  current_stock?: number;
  total_stock_kg?: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductData {
  code?: string;
  name: string;
  size?: string;
  description?: string;
  category_id: string;
  cost_price: number;
  sale_price: number;
  opening_stock: number;
  notes?: string;
}

export interface UpdateProductData {
  code?: string;
  name?: string;
  size?: string;
  description?: string;
  category_id?: string;
  cost_price?: number;
  sale_price?: number;
  is_active?: boolean;
  notes?: string;
}
