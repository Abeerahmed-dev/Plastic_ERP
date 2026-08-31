import { getDashboardMetrics } from './reports.repository';

export const reportsService = {
  getDashboardMetrics: async () => {
    return await getDashboardMetrics();
  },
};
