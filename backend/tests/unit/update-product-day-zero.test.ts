import { updateProduct } from '../../src/modules/products/products.repository';
import db from '../../src/db/knex';
import { ValidationError } from '../../src/shared/errors';

jest.mock('../../src/db/knex');

describe('Update Product Day Zero Stock Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should adjust total_stock_kg by delta when modifying opening_stock after transactions, and reject reducing below sold opening batch qty', async () => {
    const mockProduct = {
      id: 'prod-uuid-1',
      code: 'PROD-0001',
      name: 'Polymer Resin',
      opening_stock: '50.0000',
      total_stock_kg: '150.0000',
      cost_price: '100.00',
      rolling_avg_cost_per_kg: '100.00',
      category_id: 'cat-uuid-1',
      category: 'Resin',
      size: 'Standard',
      is_active: true,
    };

    const mockInitBatch = {
      id: 'batch-init-1',
      product_id: 'prod-uuid-1',
      purchase_invoice_id: null,
      batch_buy_price_per_kg: '100.00',
      original_qty: '50.0000',
      remaining_qty: '20.0000', // 30 KG already sold from opening batch
      status: 'ACTIVE',
    };

    const updatedProducts: any[] = [];
    const mockTrx: any = (tableName: string) => {
      const query: any = {
        where: () => query,
        whereNull: () => query,
        whereNotNull: () => query,
        whereNot: () => query,
        orderBy: () => query,
        join: () => query,
        leftJoin: () => query,
        forUpdate: () => query,
        select: () => query,
        count: async () => [{ count: '1' }],
        first: async () => {
          if (tableName === 'products') return mockProduct;
          if (tableName === 'inventory_batches') return mockInitBatch;
          return null;
        },
        update: async (payload: any) => {
          if (tableName === 'products') updatedProducts.push(payload);
          return [1];
        },
        insert: async () => [1],
        then: (resolve: any) => {
          if (tableName === 'inventory_batches') return Promise.resolve([mockInitBatch]).then(resolve);
          return Promise.resolve([]).then(resolve);
        },
      };
      return query;
    };
    mockTrx.schema = {
      hasTable: async () => true,
      hasColumn: async () => true,
    };
    mockTrx.raw = (sql: string, bindings: any[]) => ({ sql, bindings });

    (db.transaction as jest.Mock).mockImplementation(async (callback: any) => callback(mockTrx));

    // Reducing opening stock below 30 KG (already sold from opening batch) should throw ValidationError
    await expect(
      updateProduct('prod-uuid-1', {
        name: 'Polymer Resin Updated',
        opening_stock: 20,
      } as any)
    ).rejects.toThrow(ValidationError);

    // Increasing opening stock from 50 to 80 (+30) should adjust total_stock_kg from 150 to 180
    await updateProduct('prod-uuid-1', {
      name: 'Polymer Resin Updated',
      opening_stock: 80,
    } as any);

    expect(updatedProducts.length).toBeGreaterThan(0);
    expect(updatedProducts[0].opening_stock).toBe(80);
    expect(updatedProducts[0].total_stock_kg).toBe(180);
  });

  it('should allow modifying Day Zero stock and overwrite initial FIFO bucket when transaction_count === 0', async () => {
    const mockProduct = {
      id: 'prod-uuid-2',
      code: 'PROD-0002',
      name: 'Virgin HDPE Granules',
      opening_stock: '20.0000',
      total_stock_kg: '20.0000',
      cost_price: '110.00',
      rolling_avg_cost_per_kg: '110.00',
      category_id: 'cat-uuid-1',
      category: 'HDPE',
      size: 'Standard',
      is_active: true,
    };

    const updatedProductBatches: any[] = [];
    const updatedProducts: any[] = [];
    const mockInitBatch = {
      id: 'batch-init-1',
      product_id: 'prod-uuid-2',
      purchase_invoice_id: null,
      batch_number: 'PB-INIT-1234',
      batch_buy_price_per_kg: '110.00',
      original_qty: '20.0000',
      remaining_qty: '20.0000',
      status: 'ACTIVE',
    };

    const mockTrx: any = (tableName: string) => {
      let hasNotNullFilter = false;
      const query: any = {
        where: () => query,
        whereNull: () => query,
        whereNotNull: () => {
          hasNotNullFilter = true;
          return query;
        },
        whereNot: () => query,
        orderBy: () => query,
        join: () => query,
        leftJoin: () => query,
        forUpdate: () => query,
        select: () => query,
        count: async () => [{ count: '0' }], // 0 transactions!
        first: async () => {
          if (tableName === 'products') return mockProduct;
          if (tableName === 'inventory_batches') return hasNotNullFilter ? null : mockInitBatch;
          if (tableName === 'categories') return { id: 'cat-uuid-1', name: 'HDPE' };
          return null;
        },
        update: async (data: any) => {
          if (tableName === 'inventory_batches') updatedProductBatches.push(data);
          if (tableName === 'products') updatedProducts.push(data);
          return [1];
        },
        insert: async () => [1],
        then: (resolve: any) => {
          if (tableName === 'inventory_batches') {
            return Promise.resolve([{ ...mockInitBatch, remaining_qty: 65, batch_buy_price_per_kg: 125 }]).then(resolve);
          }
          return Promise.resolve([]).then(resolve);
        },
      };
      return query;
    };
    mockTrx.schema = {
      hasTable: async () => true,
      hasColumn: async () => true,
    };
    mockTrx.raw = (sql: string, bindings: any[]) => ({ sql, bindings });

    (db.transaction as jest.Mock).mockImplementation(async (callback: any) => callback(mockTrx));

    await updateProduct('prod-uuid-2', {
      name: 'Virgin HDPE Granules Premium',
      opening_stock: 65,
      historical_wac: 125,
    } as any);

    // Verify inventory batch was updated with new Day Zero values
    expect(updatedProductBatches.length).toBeGreaterThan(0);
    expect(updatedProductBatches[0].original_qty).toBe(65);
    expect(updatedProductBatches[0].remaining_qty).toBe(65);
    expect(updatedProductBatches[0].batch_buy_price_per_kg).toBe(125);

    // Verify products table was updated with recalculated total_stock_kg
    expect(updatedProducts.length).toBeGreaterThan(0);
    expect(updatedProducts[0].opening_stock).toBe(65);
    expect(updatedProducts[0].total_stock_kg).toBe(65);
    expect(updatedProducts[0].cost_price).toBe(125);
    expect(updatedProducts[0].rolling_avg_cost_per_kg).toBe(125);
  });
});

