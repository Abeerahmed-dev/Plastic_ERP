import db from '../../src/db/knex';
import { createPurchaseInvoice, updateStockDcAndPrices } from '../../src/modules/purchases/purchases.repository';
import { getIncomeStatementReport, getPnLReport } from '../../src/modules/reports/reports.repository';

jest.mock('../../src/db/knex');

describe('Landed Costing & P&L Synchronization Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Phase 1 & Phase 2: Inbound Freight Capitalization & Severed OPEX Bridge', () => {
    it('should capitalize delivery charges into inventory_batches buy_price_per_kg and NOT create an expense record', async () => {
      const insertedBatches: any[] = [];
      const insertedExpenses: any[] = [];
      const insertedInvoices: any[] = [];

      const mockTrx: any = jest.fn((tableName: string) => {
        const query: any = {
          where: jest.fn().mockImplementation(() => query),
          whereIn: jest.fn().mockImplementation(() => query),
          forUpdate: jest.fn().mockImplementation(() => query),
          orderBy: jest.fn().mockImplementation(() => query),
          select: jest.fn().mockImplementation(() => query),
          first: jest.fn().mockImplementation(async () => {
            if (tableName.startsWith('purchase_invoices')) {
              return { invoice_number: 'PUR-0001' };
            }
            if (tableName.startsWith('suppliers')) {
              return { id: 'supp-1', name: 'Plastic Supplier Corp' };
            }
            if (tableName.startsWith('products')) {
              return {
                id: 'prod-plastic-raw',
                name: 'PVC Resin Grade A',
                size: 'Standard',
                total_stock_kg: 0,
                rolling_avg_cost_per_kg: 0,
              };
            }
            return null;
          }),
          insert: jest.fn().mockImplementation((payload: any) => {
            if (tableName === 'inventory_batches') {
              insertedBatches.push(payload);
            }
            if (tableName === 'expenses') {
              insertedExpenses.push(payload);
            }
            if (tableName === 'purchase_invoices') {
              insertedInvoices.push(payload);
            }
            const returnChain = {
              returning: jest.fn().mockResolvedValue([
                { id: `${tableName}-uuid-1`, ...payload },
              ]),
            };
            return returnChain;
          }),
          update: jest.fn().mockResolvedValue([1]),
          del: jest.fn().mockResolvedValue(1),
          then: (resolve: any) => {
            if (tableName === 'pending_deliveries') {
              return Promise.resolve([]).then(resolve);
            }
            return Promise.resolve([]).then(resolve);
          },
        };
        return query;
      });

      mockTrx.raw = (val: string) => val;
      mockTrx.schema = {
        hasTable: jest.fn().mockResolvedValue(true),
        hasColumn: jest.fn().mockResolvedValue(true),
      };

      const mockDb = db as unknown as jest.Mock;
      mockDb.mockImplementation((tableName: string) => mockTrx(tableName));
      (mockDb as any).transaction = jest.fn(async (callback: any) => callback(mockTrx));
      (mockDb as any).raw = (val: string) => val;
      (mockDb as any).schema = {
        hasTable: jest.fn().mockResolvedValue(true),
        hasColumn: jest.fn().mockResolvedValue(true),
      };

      // Input: 100 KG plastic purchased @ Rs. 900/KG + Rs. 10,000 freight
      // Total Invoice KG = 100 KG
      // Freight Per KG = 10,000 / 100 = Rs. 100/KG
      // Expected Landed Cost Per KG = 900 + 100 = Rs. 1,000/KG
      const payload = {
        supplier_id: 'supp-1',
        date: '2026-11-01',
        delivery_charges: 10000,
        discount: 0,
        items: [
          {
            product_id: 'prod-plastic-raw',
            quantity_kg: 100,
            unit_price: 900,
            total_price: 90000,
          },
        ],
      };

      const invoice = await createPurchaseInvoice(payload, 'user-admin-1');

      // 1. Verify invoice was created with expense_id = null
      expect(invoice).toBeDefined();
      expect(insertedInvoices.length).toBe(1);
      expect(insertedInvoices[0].expense_id).toBeNull();
      expect(Number(insertedInvoices[0].delivery_charges)).toBe(10000);

      // 2. Severed OPEX Bridge: Zero rows pushed into expenses table
      expect(insertedExpenses.length).toBe(0);

      // 3. Capitalized Inbound Freight: Batch buy price per KG is Rs. 1000/KG
      expect(insertedBatches.length).toBe(1);
      expect(Number(insertedBatches[0].batch_buy_price_per_kg)).toBe(1000);
      expect(Number(insertedBatches[0].original_qty)).toBe(100);
      expect(insertedBatches[0].status).toBe('ACTIVE');
    });

    it('should sever OPEX bridge and clean up legacy expenses when updateStockDcAndPrices is executed', async () => {
      let expenseDeleted = false;
      const updatedBatches: any[] = [];

      const mockTrx: any = jest.fn((tableName: string) => {
        const query: any = {
          where: jest.fn().mockImplementation(() => query),
          forUpdate: jest.fn().mockImplementation(() => query),
          select: jest.fn().mockImplementation(() => query),
          first: jest.fn().mockImplementation(async () => {
            if (tableName === 'purchase_invoices') {
              return {
                id: 'pur-legacy-1',
                supplier_id: 'supp-1',
                delivery_charges: 5000,
                expense_id: 'exp-legacy-123',
              };
            }
            return null;
          }),
          update: jest.fn().mockImplementation((payload: any) => {
            if (tableName === 'inventory_batches') {
              updatedBatches.push(payload);
            }
            return Promise.resolve([1]);
          }),
          del: jest.fn().mockImplementation(() => {
            if (tableName === 'expenses') {
              expenseDeleted = true;
            }
            return Promise.resolve(1);
          }),
          then: (resolve: any) => {
            if (tableName === 'purchase_invoice_items') {
              return Promise.resolve([
                {
                  id: 'pii-1',
                  product_id: 'prod-plastic-raw',
                  quantity: 100,
                  unit_price: 900,
                },
              ]).then(resolve);
            }
            if (tableName === 'inventory_batches') {
              return Promise.resolve([
                {
                  remaining_qty: 100,
                  batch_buy_price_per_kg: 1000,
                },
              ]).then(resolve);
            }
            return Promise.resolve([]).then(resolve);
          },
        };
        return query;
      });

      mockTrx.schema = {
        hasTable: jest.fn().mockResolvedValue(true),
        hasColumn: jest.fn().mockResolvedValue(true),
      };

      const mockDb = db as unknown as jest.Mock;
      mockDb.mockImplementation((tableName: string) => mockTrx(tableName));
      (mockDb as any).transaction = jest.fn(async (callback: any) => callback(mockTrx));

      // Updating delivery charges to Rs. 10,000
      const result = await updateStockDcAndPrices('pur-legacy-1', {
        delivery_charges: 10000,
        items: [{ product_id: 'prod-plastic-raw', selling_price: 1300 }],
      });

      expect(result.success).toBe(true);
      // Legacy OPEX record must be deleted
      expect(expenseDeleted).toBe(true);
      // Inventory batches must be updated to Landed Cost: 900 + (10000 / 100) = Rs. 1000/KG
      expect(updatedBatches.length).toBeGreaterThan(0);
      expect(Number(updatedBatches[0].batch_buy_price_per_kg)).toBe(1000);
    });
  });

  describe('Phase 3: P&L Synchronization (SUM of actual_cogs)', () => {
    it('Income Statement strictly sums sales_invoice_items.actual_cogs and excludes inbound freight from OPEX', async () => {
      // Setup mock queries for Income Statement:
      // - Gross sales = 150,000, delivery_revenue = 0, returns = 0 -> Net revenue = 150,000
      // - Period sales actual_cogs = 100,000 (100 KG @ Rs. 1000 landed cost)
      // - Operating expenses = 15,000 (excluding freight)
      // - Expected Gross Profit = 150,000 - 100,000 = 50,000
      // - Expected Net Profit = 50,000 - 15,000 = 35,000
      const mockDb = db as unknown as jest.Mock;
      (mockDb as any).raw = (str: string) => str;
      (mockDb as any).schema = {
        hasTable: jest.fn().mockResolvedValue(true),
        hasColumn: jest.fn().mockResolvedValue(true),
      };

      mockDb.mockImplementation((tableName: string) => {
        const query: any = {
          whereNot: jest.fn().mockImplementation(() => query),
          where: jest.fn().mockImplementation(() => query),
          whereIn: jest.fn().mockImplementation(() => query),
          whereRaw: jest.fn().mockImplementation(() => query),
          whereNull: jest.fn().mockImplementation(() => query),
          groupBy: jest.fn().mockImplementation(() => query),
          orderBy: jest.fn().mockImplementation(() => query),
          select: jest.fn().mockImplementation(() => query),
          first: jest.fn().mockImplementation(async () => {
            if (tableName.startsWith('sales_invoices')) {
              return { gross_sales: 150000, delivery_revenue: 0, total_returns: 0 };
            }
            if (tableName.startsWith('sales_invoice_items')) {
              // Simulating SUM(actual_cogs)
              return { total_cogs: 100000 };
            }
            if (tableName.startsWith('expenses')) {
              return { total_expenses: 15000 };
            }
            return null;
          }),
          then: (resolve: any) => {
            if (tableName.startsWith('expenses')) {
              return Promise.resolve([
                { category: 'Utilities', total: 10000 },
                { category: 'Rent', total: 5000 },
              ]).then(resolve);
            }
            return Promise.resolve([]).then(resolve);
          },
        };
        return query;
      });

      const incomeStatement = await getIncomeStatementReport('2026-11-01', '2026-11-30');

      expect(incomeStatement).toBeDefined();
      expect(incomeStatement.net_revenue).toBe(150000);
      expect(incomeStatement.cogs).toBe(100000);
      expect(incomeStatement.gross_profit).toBe(50000); // Net Revenue - SUM(actual_cogs)
      expect(incomeStatement.operating_expenses).toBe(15000);
      expect(incomeStatement.net_profit).toBe(35000); // Gross Profit - OPEX
      expect(incomeStatement.gross_margin_pct).toBe(33.33);
    });

    it('P&L Report matches math with SUM(actual_cogs) and zero freight double-dip', async () => {
      const mockDb = db as unknown as jest.Mock;
      (mockDb as any).raw = (str: string) => str;
      (mockDb as any).schema = {
        hasTable: jest.fn().mockResolvedValue(true),
        hasColumn: jest.fn().mockResolvedValue(true),
      };

      mockDb.mockImplementation((tableName: string) => {
        const query: any = {
          whereNot: jest.fn().mockImplementation(() => query),
          whereIn: jest.fn().mockImplementation(() => query),
          whereRaw: jest.fn().mockImplementation(() => query),
          whereNull: jest.fn().mockImplementation(() => query),
          select: jest.fn().mockImplementation(() => query),
          first: jest.fn().mockImplementation(async () => {
            if (tableName.startsWith('sales_invoices')) {
              return { total: 150000 };
            }
            if (tableName.startsWith('sales_invoice_items')) {
              return { total_cogs: 100000 };
            }
            if (tableName.startsWith('expenses')) {
              return { total: 15000 };
            }
            return null;
          }),
        };
        return query;
      });

      const pnl = await getPnLReport('2026-11-01', '2026-11-30');

      expect(pnl.total_sales).toBe(150000);
      expect(pnl.total_cogs).toBe(100000);
      expect(pnl.gross_profit).toBe(50000);
      expect(pnl.total_expenses).toBe(15000);
      expect(pnl.net_profit).toBe(35000);
    });
  });
});

