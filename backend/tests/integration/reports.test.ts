import db from '../../src/db/knex';
import { getMarginAnalyticsReport, getIncomeStatementReport, getIncomeStatementReturnsDetail } from '../../src/modules/reports/reports.repository';

describe('Reports Date Timestamp Safety', () => {
  afterAll(async () => {
    await db.destroy();
  });

  it('should execute getMarginAnalyticsReport with full ISO timestamps without 500 error', async () => {
    const res = await getMarginAnalyticsReport(
      '2026-09-30T19:00:00.000Z',
      '2026-10-14T18:59:59.999Z'
    );
    expect(res).toBeDefined();
    expect(Array.isArray(res.products)).toBe(true);
    expect(Array.isArray(res.customers)).toBe(true);
    expect(Array.isArray(res.trend_data)).toBe(true);
  });

  it('should execute getIncomeStatementReport with full ISO timestamps without error', async () => {
    const res = await getIncomeStatementReport(
      '2026-09-30T19:00:00.000Z',
      '2026-10-14T18:59:59.999Z'
    );
    expect(res).toBeDefined();
    expect(res).toHaveProperty('gross_sales');
    expect(res).toHaveProperty('net_profit');
  });

  it('should execute getIncomeStatementReturnsDetail with full ISO timestamps without error', async () => {
    const res = await getIncomeStatementReturnsDetail(
      '2026-09-30T19:00:00.000Z',
      '2026-10-14T18:59:59.999Z'
    );
    expect(res).toBeDefined();
    expect(Array.isArray(res)).toBe(true);
  });
});
