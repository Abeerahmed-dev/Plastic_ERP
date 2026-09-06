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

export const reportsService = {
  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const response = await api.get<{ data: DashboardMetrics }>('/reports/dashboard');
    return response.data.data;
  },
  getCashierTally: async (): Promise<CashierTallyData> => {
    const response = await api.get<{ data: CashierTallyData }>('/reports/cashier-tally');
    return response.data.data;
  },
};
