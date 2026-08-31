import db from '../../db/knex';
import { WALKIN_CUSTOMER_PHONE } from '../../db/seeds/06_walkin_customer';

export async function getDashboardMetrics() {
  // 1. Get Walk-in Customer ID
  const walkin = await db('customers').where({ phone: WALKIN_CUSTOMER_PHONE }).first();
  if (!walkin) return { todaySales: 0, todayTransactions: 0, weeklySales: 0, monthlySales: 0 };

  const walkinId = walkin.id;

  const now = new Date();
  
  // Start of Day
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Start of Week (assuming Monday is start of week)
  const day = now.getDay() || 7; 
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);

  // Start of Month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const getMetricsForPeriod = async (startDate: Date) => {
    const result = await db('sales_invoices')
      .where('customer_id', walkinId)
      .andWhere('created_at', '>=', startDate)
      .sum('total_amount as revenue')
      .count('id as count')
      .first();
      
    return {
      revenue: Number(result?.revenue || 0),
      count: Number(result?.count || 0)
    };
  };

  const [today, week, month] = await Promise.all([
    getMetricsForPeriod(startOfDay),
    getMetricsForPeriod(startOfWeek),
    getMetricsForPeriod(startOfMonth)
  ]);

  return {
    todaySales: today.revenue,
    todayTransactions: today.count,
    weeklySales: week.revenue,
    monthlySales: month.revenue,
  };
}
