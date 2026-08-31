import api from './api';

export interface DashboardMetrics {
  todaySales: number;
  todayTransactions: number;
  weeklySales: number;
  monthlySales: number;
}

export const reportsService = {
  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const response = await api.get<{ data: DashboardMetrics }>('/reports/dashboard');
    return response.data.data;
  },
};
