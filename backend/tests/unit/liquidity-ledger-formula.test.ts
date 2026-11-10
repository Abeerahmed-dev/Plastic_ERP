import { getLiquidityLedgerReport } from '../../src/modules/reports/reports.repository';
import * as bankRepo from '../../src/modules/bank-accounts/bank-accounts.repository';
import * as custRepo from '../../src/modules/customers/customers.repository';
import * as suppRepo from '../../src/modules/suppliers/suppliers.repository';
import db from '../../src/db/knex';

jest.mock('../../src/db/knex');
jest.mock('../../src/modules/bank-accounts/bank-accounts.repository');
jest.mock('../../src/modules/customers/customers.repository');
jest.mock('../../src/modules/suppliers/suppliers.repository');

describe('Net Business Capital PDC Inclusion Formula Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strictly calculates Net Capital = Total Assets (including Rec PDCs) - Total Liabilities (including Iss PDCs)', async () => {
    // 1. Mock Liquid Funds
    // Cash = 10,000, Bank = 40,000 -> Total Liquid = 50,000
    (bankRepo.getCashDrawerBalance as jest.Mock).mockResolvedValue(10000);
    (bankRepo.findAllBankAccounts as jest.Mock).mockResolvedValue([
      { id: 'bank-1', current_balance: 40000 },
    ]);

    // 2. Mock Customers & Suppliers Net Balances
    (custRepo.computeCustomerNetBalance as jest.Mock).mockResolvedValue({
      outstanding_balance: 15000, // Market Receivables
      advance_credit: 5000,       // Customer Advances Liability
    });
    (suppRepo.computeSupplierNetBalance as jest.Mock).mockResolvedValue({
      outstanding_payable: 25000, // Accounts Payable
      advance_payable: 8000,      // Supplier Advances Asset
    });

    const createChainable = (result: any = []) => {
      const query: any = {
        join: jest.fn().mockImplementation(() => query),
        leftJoin: jest.fn().mockImplementation(() => query),
        where: jest.fn().mockImplementation(() => query),
        whereIn: jest.fn().mockImplementation(() => query),
        whereNull: jest.fn().mockImplementation(() => query),
        whereRaw: jest.fn().mockImplementation(() => query),
        andWhere: jest.fn().mockImplementation(() => query),
        sum: jest.fn().mockImplementation(() => query),
        select: jest.fn().mockImplementation(() => query),
        orderBy: jest.fn().mockImplementation(() => query),
        groupBy: jest.fn().mockImplementation(() => query),
        first: jest.fn().mockImplementation(async () => (Array.isArray(result) ? result[0] : result)),
        then: (resolve: any) => Promise.resolve(result).then(resolve),
      };
      return query;
    };

    // 3. Mock Knex queries:
    // - customer_payments (Pending Received PDCs = 50,000)
    // - supplier_payments (Pending Issued PDCs = 20,000)
    // - expenses / expense_records (Pending OPEX Liability = 10,000)
    // - customers list = [{ id: 'cust-1' }]
    // - suppliers list = [{ id: 'supp-1' }]
    // - products / inventory batches
    const mockDb = db as unknown as jest.Mock;
    (mockDb as any).schema = {
      hasTable: jest.fn().mockImplementation((tbl: string) => Promise.resolve(tbl === 'expenses' || tbl === 'expense_records')),
      hasColumn: jest.fn().mockImplementation(() => Promise.resolve(true)),
    };
    (mockDb as any).raw = jest.fn((str: string) => str);

    mockDb.mockImplementation((tableName: string) => {
      if (tableName === 'customer_payments') {
        return createChainable({ total: 50000 });
      }
      if (tableName === 'supplier_payments') {
        return createChainable({ total: 20000 });
      }
      if (tableName === 'expenses' || tableName === 'expense_records') {
        return createChainable({ total: 10000 });
      }
      if (tableName === 'customers') {
        return createChainable([{ id: 'cust-1' }]);
      }
      if (tableName === 'suppliers') {
        return createChainable([{ id: 'supp-1' }]);
      }
      if (tableName.startsWith('products')) {
        return createChainable([
          {
            product_id: 'prod-1',
            product_name: 'Plastic Pipe 2"',
            product_code: 'PP-02',
            category_name: 'Pipes',
            current_wac: 100,
            min_stock_level: 10,
            max_stock_level: 500,
          },
        ]);
      }
      if (tableName.startsWith('inventory_batches')) {
        return createChainable([
          {
            product_id: 'prod-1',
            original_qty: 500,
            remaining_qty: 300,
            cost_per_kg: 100,
            batch_number: 'B-001',
            status: 'ACTIVE',
            created_at: new Date(),
          },
        ]);
      }
      return createChainable([]);
    });

    const result = await getLiquidityLedgerReport();

    // Verification of individual variables:
    expect(result.cash_drawer).toBe(10000);
    expect(result.bank_balances).toBe(40000);
    expect(result.total_liquid).toBe(50000);
    expect(result.post_dated_cheques).toBe(50000);       // Received PDCs
    expect(result.issued_post_dated_cheques).toBe(20000); // Issued PDCs
    expect(result.market_receivables).toBe(15000);
    expect(result.supplier_advances_asset).toBe(8000);
    expect(result.total_accounts_payable).toBe(25000);
    expect(result.customer_advances_liability).toBe(5000);
    expect(result.pending_expenses_liability).toBe(10000); // Pending OPEX Liability

    // Formula verification:
    // Total Assets = (Cash + Bank) + Market Receivables + Unsold Stock + Supplier Advances + Received PDCs
    const expectedTotalAssets =
      result.total_liquid +
      result.market_receivables +
      result.total_inventory_value +
      result.supplier_advances_asset +
      result.post_dated_cheques;
    expect(result.total_assets).toBe(expectedTotalAssets);

    // Total Liabilities = Accounts Payable + Customer Advances + Issued PDCs + Pending Expenses
    const expectedTotalLiabilities =
      result.total_accounts_payable +
      result.customer_advances_liability +
      result.issued_post_dated_cheques +
      result.pending_expenses_liability;
    expect(result.total_liabilities).toBe(expectedTotalLiabilities);

    // Net Capital = Total Assets - Total Liabilities
    const expectedNetCapital = expectedTotalAssets - expectedTotalLiabilities;
    expect(result.net_business_capital).toBe(expectedNetCapital);

    // Explicit check on liabilities: 25,000 (Payables) + 5,000 (Cust Adv) + 20,000 (Iss PDC) + 10,000 (Pending OPEX) = 60,000
    expect(result.total_liabilities).toBe(60000);
    expect(result.net_business_capital).toBe(result.total_assets - 60000);
  });
});
