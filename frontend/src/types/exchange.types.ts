export interface ProductExchange {
  id: string;
  exchange_number: string;
  exchange_date: string;
  given_product_id: string;
  given_quantity: number;
  given_unit_cost: number;
  received_product_id: string;
  received_quantity: number;
  received_unit_cost: number;
  notes?: string | null;
  status: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  given_product_name?: string;
  given_product_code?: string;
  given_product_size?: string;
  received_product_name?: string;
  received_product_code?: string;
  received_product_size?: string;
  created_by_name?: string;
}

export interface CreateExchangeData {
  given_product_id: string;
  given_quantity: number;
  received_product_id: string;
  received_quantity: number;
  exchange_date?: string;
  notes?: string;
}

export interface ExchangeFilters {
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
