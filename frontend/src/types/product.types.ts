export interface UnitOfMeasure {
  id: string;
  name: string;
  abbreviation: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  uom_id: string;
  uom_name: string;
  uom_abbreviation: string;
  cost_price: string | number; // sometimes numerical fields come as strings from DB
  sale_price: string | number;
  opening_stock: string | number;
  current_stock?: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductData {
  code?: string;
  name: string;
  description?: string;
  category: string;
  uom_id: string;
  cost_price: number;
  sale_price: number;
  opening_stock: number;
  notes?: string;
}

export interface UpdateProductData {
  code?: string;
  name?: string;
  description?: string;
  category?: string;
  uom_id?: string;
  cost_price?: number;
  sale_price?: number;
  is_active?: boolean;
  notes?: string;
}
