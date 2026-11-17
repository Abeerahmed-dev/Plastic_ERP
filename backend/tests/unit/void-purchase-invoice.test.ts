import { voidPurchaseInvoice } from '../../src/modules/purchases/purchases.repository';
import { voidInvoice } from '../../src/modules/invoices/invoices.repository';
import db from '../../src/db/knex';

jest.mock('../../src/db/knex');

describe('Invoice Voiding Architecture Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('voidPurchaseInvoice', () => {
    it('should throw an error if purchase invoice does not exist', async () => {
      const mockTrx: any = (_tableName: string) => {
        const query: any = {
          where: () => query,
          forUpdate: () => query,
          first: async () => null,
        };
        return query;
      };
      (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb(mockTrx));

      await expect(voidPurchaseInvoice('non-existent-id')).rejects.toThrow('Purchase Invoice with ID non-existent-id not found');
    });

    it('should throw an error if purchase invoice is already VOID', async () => {
      const mockTrx: any = (_tableName: string) => {
        const query: any = {
          where: () => query,
          forUpdate: () => query,
          first: async () => ({ id: 'pur-1', status: 'VOID' }),
        };
        return query;
      };
      (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb(mockTrx));

      await expect(voidPurchaseInvoice('pur-1')).rejects.toThrow('Purchase Invoice with ID pur-1 is already VOID');
    });

    it('should throw STOCK_ALREADY_SOLD error if inventory batches were consumed/sold', async () => {
      const mockTrx: any = (tableName: string) => {
        const query: any = {
          where: () => query,
          whereNotIn: () => query,
          forUpdate: () => query,
          first: async () => {
            if (tableName === 'purchase_invoices') return { id: 'pur-1', status: 'ACTIVE' };
            return null;
          },
        };
        // When querying batches
        query.then = (resolve: any) => {
          if (tableName === 'inventory_batches') {
            resolve([
              { id: 'batch-1', original_qty: '50.0000', remaining_qty: '20.0000', product_id: 'prod-1' }
            ]);
          } else if (tableName === 'purchase_invoices') {
            // Debit notes check
            resolve([]);
          } else {
            resolve([]);
          }
        };
        return query;
      };
      (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb(mockTrx));

      await expect(voidPurchaseInvoice('pur-1')).rejects.toThrow('STOCK_ALREADY_SOLD');
    });

    it('should successfully void purchase invoice, deduct product stock, void batches, and unlink supplier payments', async () => {
      const updatedProducts: any[] = [];
      const updatedBatches: any[] = [];
      const updatedInvoices: any[] = [];
      const updatedPayments: any[] = [];
      const insertedTransactions: any[] = [];

      const mockTrx: any = (tableName: string) => {
        const query: any = {
          where: () => query,
          whereNotIn: () => query,
          select: () => query,
          forUpdate: () => query,
          first: async () => {
            if (tableName === 'purchase_invoices') {
              return { id: 'pur-1', invoice_number: 'PUR-0001', status: 'ACTIVE', supplier_id: 'supp-1' };
            }
            return null;
          },
          update: async (data: any) => {
            if (tableName === 'products') updatedProducts.push(data);
            if (tableName === 'inventory_batches') updatedBatches.push(data);
            if (tableName === 'purchase_invoices') updatedInvoices.push(data);
            if (tableName === 'supplier_payments') updatedPayments.push(data);
            return [1];
          },
          insert: async (data: any) => {
            if (tableName === 'inventory_transactions') insertedTransactions.push(data);
            return [1];
          },
          delete: async () => 1,
        };

        query.then = (resolve: any) => {
          if (tableName === 'purchase_invoices') {
            if (updatedInvoices.length > 0) {
              resolve([{ id: 'pur-1', invoice_number: 'PUR-0001', status: 'VOID' }]);
            } else {
              resolve([]); // debit notes check
            }
          } else if (tableName === 'inventory_batches') {
            resolve([
              {
                id: 'batch-1',
                product_id: 'prod-1',
                original_qty: '50.0000',
                remaining_qty: '50.0000',
                batch_buy_price_per_kg: '120.00',
              },
            ]);
          } else if (tableName === 'supplier_payment_allocations') {
            resolve([{ payment_id: 'pay-1' }]);
          } else {
            resolve([]);
          }
        };

        return query;
      };

      mockTrx.schema = {
        hasTable: async () => true,
        hasColumn: async () => true,
      };
      mockTrx.fn = {
        now: () => '2026-11-16T18:00:00Z',
      };
      mockTrx.raw = (sql: string, bindings: any[]) => ({ sql, bindings });

      (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb(mockTrx));

      const result = await voidPurchaseInvoice('pur-1', 'Order cancelled by supplier', 'user-admin');

      expect(result).toBeDefined();
      expect(result.status).toBe('VOID');
      expect(updatedInvoices[0].status).toBe('VOID');
      expect(updatedInvoices[0].void_reason).toBe('Order cancelled by supplier');
      expect(updatedInvoices[0].voided_by_user_id).toBe('user-admin');
      expect(updatedBatches[0].status).toBe('VOID');
      expect(updatedBatches[0].remaining_qty).toBe(0);
      expect(updatedPayments[0].purchase_invoice_id).toBeNull();
      expect(updatedPayments[0].payment_type).toBe('ADVANCE');
    });
  });

  describe('voidInvoice (Sales)', () => {
    it('should throw an error if sales invoice is not found', async () => {
      const mockTrx: any = (_tableName: string) => {
        const query: any = {
          where: () => query,
          forUpdate: () => query,
          first: async () => null,
        };
        return query;
      };
      (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb(mockTrx));

      await expect(voidInvoice('non-existent-sales-id')).rejects.toThrow('Invoice with ID non-existent-sales-id not found');
    });
  });
});
