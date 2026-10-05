import api from './api';

export interface DashboardMetrics {
  todaySales: number;
  todayTransactions: number;
  weeklySales: number;
  monthlySales: number;
}

export interface CashierTallyData {
  cashier_id: string;
  today_date: string;
  customer_payments_cash: number;
  pos_sales_cash: number;
  total_cash_tally: number;
  transaction_count: number;
}

export interface ExpenseBreakdownItem {
  category: string;
  amount: number;
}

export interface IncomeStatementData {
  startDate: string;
  endDate: string;
  gross_sales: number;
  delivery_revenue: number;
  sales_returns: number;
  net_revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  operating_expenses: number;
  expenses_breakdown: ExpenseBreakdownItem[];
  net_profit: number;
  net_margin_pct: number;
}

export interface MarginProductItem {
  product_id: string;
  product_name: string;
  category_name: string;
  total_kg_sold: number;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  avg_sell_price: number;
  avg_wac_cogs: number;
  gross_margin_pct: number;
}

export interface MarginCustomerItem {
  customer_id: string;
  customer_name: string;
  total_volume_kg: number;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  gross_margin_pct: number;
}

export interface SalesTrendDataPoint {
  date: string;
  daily_revenue: number;
  daily_cogs: number;
  daily_profit: number;
  margin_pct: number;
}

export interface MarginAnalyticsData {
  startDate?: string;
  endDate?: string;
  products: MarginProductItem[];
  customers: MarginCustomerItem[];
  trend_data: SalesTrendDataPoint[];
}

export interface FifoBucketItem {
  bucket_id: string;
  batch_number: string;
  created_date: string;
  buy_price_per_kg: number;
  original_stock: number;
  remaining_stock: number;
  status: string;
}

export interface InventoryValuationItem {
  id: string;
  product_name: string;
  code: string;
  category: string;
  current_stock_kg: number;
  stock_on_hand: number;
  current_wac: number;
  asset_value: number;
  total_asset_value: number;
  buckets: FifoBucketItem[];
  lifetime_kg_sold: number;
  lifetime_kg_acquired: number;
  all_time_gross_margin: number;
}

export interface InventoryValuationData {
  total_warehouse_capital: number;
  products: InventoryValuationItem[];
}

export interface SalesReturnDetailItem {
  date: string;
  credit_note_id: string;
  original_invoice_id: string;
  customer_name: string;
  product_name: string;
  returned_kg: number;
  refund_amount: number;
}

export const reportsService = {
  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const response = await api.get<{ data: DashboardMetrics }>('/reports/dashboard');
    return response.data.data;
  },
  getCashierTally: async (): Promise<CashierTallyData> => {
    const response = await api.get<{ data: CashierTallyData }>('/reports/cashier-tally');
    return response.data.data;
  },
  getIncomeStatement: async (startDate?: string, endDate?: string): Promise<IncomeStatementData> => {
    const response = await api.get<{ data: IncomeStatementData }>('/reports/income-statement', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },
  getIncomeStatementReturnsDetail: async (startDate?: string, endDate?: string): Promise<SalesReturnDetailItem[]> => {
    const response = await api.get<{ data: SalesReturnDetailItem[] }>('/reports/income-statement/returns-detail', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },
  getMarginAnalytics: async (startDate?: string, endDate?: string): Promise<MarginAnalyticsData> => {
    const response = await api.get<{ data: MarginAnalyticsData }>('/reports/margin-analytics', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },
  getInventoryValuation: async (): Promise<InventoryValuationData> => {
    const response = await api.get<{ data: InventoryValuationData }>('/reports/inventory-valuation');
    return response.data.data;
  },
};
