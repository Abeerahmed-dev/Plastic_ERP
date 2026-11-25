import { processPOSCheckout } from '../../src/modules/pos/pos.repository';
import db from '../../src/db/knex';

jest.mock('../../src/db/knex');

describe('POS Inventory Overdraft Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should split cart item into fulfilled and deferred quantities when cart_qty > live_stock and queue backorder into pending_deliveries', async () => {
    const mockProduct = {
      id: 'prod-uuid-1',
      name: 'Polymer Resin HD-5211',
      name_urdu: 'پالیمر',
      total_stock_kg: '30.0000',
      rolling_avg_cost_per_kg: '100.0000',
      cost_price: '100.00',
      fixed_retail_price_per_kg: '150.00',
      sale_price: '150.00',
      min_markup_percent: 5,
      bag_weight_kg: 25.0,
      category: 'Raw Materials',
    };

    const mockBatches = [
      {
        id: 'batch-uuid-1',
        product_id: 'prod-uuid-1',
        remaining_qty: '30.0000',
        batch_buy_price_per_kg: '100.0000',
        buy_price_per_kg: '100.0000',
        created_at: new Date('2026-01-01'),
      },
    ];

    const mockCustomer = {
      id: 'cust-walkin-uuid',
      name: 'Walk-In Customer',
      phone: '0000000000',
      credit_limit: 0,
      opening_balance: 0,
    };

    const insertedPendingDeliveries: any[] = [];
    const insertedInvoiceItems: any[] = [];
    const insertedItemBatches: any[] = [];
    const updatedProducts: any[] = [];
    const updatedBatches: any[] = [];

    const mockTrx: any = (tableName: string) => {
      const query: any = {
        where: () => query,
        leftJoin: () => query,
        join: () => query,
        forUpdate: () => query,
        select: () => query,
        orderBy: () => query,
        andWhere: () => query,
        first: async () => {
          if (tableName.includes('customers')) return mockCustomer;
          if (tableName.includes('products')) return mockProduct;
          if (tableName.includes('bank_accounts')) return null;
          if (tableName.includes('inventory_batches')) return mockBatches[0];
          return null;
        },
        update: async (data: any) => {
          if (tableName === 'products') updatedProducts.push(data);
          if (tableName === 'inventory_batches') updatedBatches.push(data);
          return [1];
        },
        insert: (data: any) => {
          const insertQuery: any = {
            returning: async () => {
              if (tableName === 'sales_invoices') {
                return [{ id: 'inv-pos-123', invoice_number: 'POS-1', ...data }];
              }
              if (tableName === 'sales_invoice_items') {
                const inserted = Array.isArray(data)
                  ? data.map((d, idx) => ({ id: `sii-${idx + 1}`, ...d }))
                  : [{ id: 'sii-1', ...data }];
                insertedInvoiceItems.push(...inserted);
                return inserted;
              }
              return Array.isArray(data) ? data : [data];
            },
          };
          if (tableName === 'pending_deliveries') {
            insertedPendingDeliveries.push(...(Array.isArray(data) ? data : [data]));
          }
          if (tableName === 'sales_invoice_item_batches') {
            insertedItemBatches.push(...(Array.isArray(data) ? data : [data]));
          }
          insertQuery.then = (resolve: any) => resolve([1]);
          return insertQuery;
        },
        then: (resolve: any) => {
          if (tableName === 'sales_invoices') return resolve([]);
          if (tableName === 'inventory_batches') return resolve(mockBatches);
          return resolve([]);
        },
      };

      return query;
    };

    mockTrx.raw = (sql: string, bindings: any[]) => ({ sql, bindings });
    mockTrx.schema = {
      hasTable: async () => false,
      hasColumn: async () => true,
    };

    (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
      return await callback(mockTrx);
    });

    // Request 100 KG when only 30 KG is in live_stock:
    // Should fulfill 30 KG @ Rs. 100 = 3,000 COGS
    // Should defer 70 KG @ Rs. 100 (latest batch price) = 7,000 estimated COGS
    // Total estimated COGS = 10,000
    const result = await processPOSCheckout(
      'user-1',
      [
        {
          product_id: 'prod-uuid-1',
          quantity: 100,
          selected_unit: 'KG',
          unit_price: 150,
        },
      ],
      0,
      'Cashier',
      'cust-walkin-uuid',
      15000,
      'CASH'
    );

    // Verify invoice totals and split quantities
    expect(result).toBeDefined();
    expect(result.invoice_number).toMatch(/^POS-/);
    expect(Number(result.requested_qty)).toBe(100);
    expect(Number(result.fulfilled_qty)).toBe(30);
    expect(Number(result.deferred_qty)).toBe(70);

    // Verify sales_invoice_items split record
    expect(insertedInvoiceItems.length).toBe(1);
    const item = insertedInvoiceItems[0];
    expect(Number(item.requested_qty)).toBe(100);
    expect(Number(item.fulfilled_qty)).toBe(30);
    expect(Number(item.deferred_qty)).toBe(70);
    expect(item.is_deferred).toBe(true);
    expect(Number(item.actual_cogs)).toBe(3000);
    expect(Number(item.estimated_cogs)).toBe(10000);

    // Verify backorder inserted into pending_deliveries queue
    expect(insertedPendingDeliveries.length).toBe(1);
    const backorder = insertedPendingDeliveries[0];
    expect(backorder.sales_invoice_id).toBe('inv-pos-123');
    expect(backorder.sales_invoice_item_id).toBe('sii-1');
    expect(backorder.product_id).toBe('prod-uuid-1');
    expect(Number(backorder.pending_qty)).toBe(70);
    expect(Number(backorder.fulfilled_qty)).toBe(0);
    expect(backorder.status).toBe('PENDING');

    // Verify physical stock deduction was only for available 30 KG
    expect(updatedProducts.length).toBe(1);
    expect(updatedProducts[0].total_stock_kg.bindings).toEqual([30]);
  });

  it('should successfully process 100% overdraft checkout when live_stock is 0 without throwing InsufficientStockError', async () => {
    const mockProduct = {
      id: 'prod-uuid-2',
      name: 'Zero Stock Polymer',
      total_stock_kg: '0.0000',
      rolling_avg_cost_per_kg: '120.0000',
      cost_price: '120.00',
      fixed_retail_price_per_kg: '180.00',
      sale_price: '180.00',
      min_markup_percent: 5,
      bag_weight_kg: 25.0,
      category: 'Raw Materials',
    };

    const mockCustomer = {
      id: 'cust-walkin-uuid',
      name: 'Walk-In Customer',
      phone: '0000000000',
      credit_limit: 0,
      opening_balance: 0,
    };

    const insertedPendingDeliveries: any[] = [];
    const insertedInvoiceItems: any[] = [];

    const mockTrx: any = (tableName: string) => {
      const query: any = {
        where: () => query,
        leftJoin: () => query,
        join: () => query,
        forUpdate: () => query,
        select: () => query,
        orderBy: () => query,
        andWhere: () => query,
        first: async () => {
          if (tableName.includes('customers')) return mockCustomer;
          if (tableName.includes('products')) return mockProduct;
          if (tableName.includes('bank_accounts')) return null;
          if (tableName.includes('inventory_batches')) return null;
          return null;
        },
        update: async () => [1],
        insert: (data: any) => {
          const insertQuery: any = {
            returning: async () => {
              if (tableName === 'sales_invoices') {
                return [{ id: 'inv-pos-456', invoice_number: 'POS-2', ...data }];
              }
              if (tableName === 'sales_invoice_items') {
                const inserted = Array.isArray(data)
                  ? data.map((d, idx) => ({ id: `sii-${idx + 1}`, ...d }))
                  : [{ id: 'sii-1', ...data }];
                insertedInvoiceItems.push(...inserted);
                return inserted;
              }
              return Array.isArray(data) ? data : [data];
            },
          };
          if (tableName === 'pending_deliveries') {
            insertedPendingDeliveries.push(...(Array.isArray(data) ? data : [data]));
          }
          insertQuery.then = (resolve: any) => resolve([1]);
          return insertQuery;
        },
        then: (resolve: any) => {
          if (tableName === 'sales_invoices') return resolve([]);
          if (tableName === 'inventory_batches') return resolve([]);
          return resolve([]);
        },
      };

      return query;
    };

    mockTrx.raw = (sql: string, bindings: any[]) => ({ sql, bindings });
    mockTrx.schema = {
      hasTable: async () => false,
      hasColumn: async () => true,
    };

    (db.transaction as jest.Mock).mockImplementation(async (callback: any) => {
      return await callback(mockTrx);
    });

    // Request 50 KG when live_stock is 0:
    // Should NOT throw InsufficientStockError
    // Fulfilled = 0, Deferred = 50
    const result = await processPOSCheckout(
      'user-1',
      [
        {
          product_id: 'prod-uuid-2',
          quantity: 50,
          selected_unit: 'KG',
          unit_price: 180,
        },
      ],
      0,
      'Cashier',
      'cust-walkin-uuid',
      9000,
      'CASH'
    );

    expect(result).toBeDefined();
    expect(Number(result.requested_qty)).toBe(50);
    expect(Number(result.fulfilled_qty)).toBe(0);
    expect(Number(result.deferred_qty)).toBe(50);

    expect(insertedInvoiceItems[0].is_deferred).toBe(true);
    expect(Number(insertedInvoiceItems[0].actual_cogs)).toBe(0);
    expect(Number(insertedInvoiceItems[0].estimated_cogs)).toBe(50 * 120);

    expect(insertedPendingDeliveries.length).toBe(1);
    expect(Number(insertedPendingDeliveries[0].pending_qty)).toBe(50);
    expect(insertedPendingDeliveries[0].status).toBe('PENDING');
  });

  it('should use custom item price from request payload instead of fixed database selling price', async () => {
    const mockProduct = {
      id: 'prod-uuid-3',
      name: 'Polymer Masterbatch Yellow',
      total_stock_kg: '100.0000',
      rolling_avg_cost_per_kg: '100.0000',
      cost_price: '100.00',
      fixed_retail_price_per_kg: '250.00', // Fixed in DB
      sale_price: '250.00',
      min_markup_percent: 5,
      bag_weight_kg: 25.0,
      category: 'Masterbatch',
    };

    const mockCustomer = {
      id: 'cust-walkin-uuid',
      name: 'Walk-In Customer',
      phone: '0000000000',
      credit_limit: 0,
      opening_balance: 0,
    };

    const insertedInvoiceItems: any[] = [];
    const mockTrx: any = (tableName: string) => {
      const query: any = {
        where: () => query,
        leftJoin: () => query,
        join: () => query,
        forUpdate: () => query,
        select: () => query,
        orderBy: () => query,
        andWhere: () => query,
        first: async () => {
          if (tableName.includes('customers')) return mockCustomer;
          if (tableName.includes('products')) return mockProduct;
          return null;
        },
        update: async () => [1],
        insert: (data: any) => {
          const insertQuery: any = {
            returning: async () => {
              if (tableName === 'sales_invoices') {
                return [{ id: 'inv-pos-999', invoice_number: 'POS-99', ...data }];
              }
              if (tableName === 'sales_invoice_items') {
                const inserted = Array.isArray(data)
                  ? data.map((d, idx) => ({ id: `sii-${idx + 1}`, ...d }))
                  : [{ id: 'sii-1', ...data }];
                insertedInvoiceItems.push(...inserted);
                return inserted;
              }
              return Array.isArray(data) ? data : [data];
            },
          };
          insertQuery.then = (resolve: any) => resolve([1]);
          return insertQuery;
        },
        then: (resolve: any) => resolve([]),
      };
      return query;
    };
    mockTrx.raw = (sql: string, bindings: any[]) => ({ sql, bindings });
    mockTrx.schema = {
      hasTable: async () => false,
      hasColumn: async () => true,
    };
    (db.transaction as jest.Mock).mockImplementation(async (callback: any) => callback(mockTrx));

    // Custom price overridden to 195 (different from fixed 250 in DB)
    const result = await processPOSCheckout(
      'user-1',
      [
        {
          product_id: 'prod-uuid-3',
          quantity: 10,
          selected_unit: 'KG',
          unit_price: 195,
        },
      ],
      0,
      'Cashier',
      'cust-walkin-uuid',
      1950,
      'CASH',
      undefined,
      undefined,
      undefined,
      0,
      0
    );

    expect(result).toBeDefined();
    expect(Number(result.subtotal)).toBe(1950);
    expect(Number(result.total_amount)).toBe(1950);
    expect(insertedInvoiceItems.length).toBe(1);
    expect(Number(insertedInvoiceItems[0].unit_price)).toBe(195);
    expect(Number(insertedInvoiceItems[0].total_price)).toBe(1950);
  });
});
