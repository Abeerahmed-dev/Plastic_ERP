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
  // Standalone / legacy product exchange fields
  given_product_id?: string;
  given_quantity?: number;
  received_product_id?: string;
  received_quantity?: number;

  // Invoice-based exchange fields (Return + Re-Sale)
  sales_invoice_item_id?: string;
  original_item_id?: string;
  invoice_id?: string;
  returned_quantity?: number;
  returned_qty?: number;
  new_product_id?: string;
  new_quantity?: number;
  new_unit_price?: number;
  size?: string;
  selected_unit?: string;

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
