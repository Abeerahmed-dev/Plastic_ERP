import { restoreInventoryBucketsLifo } from '../../src/modules/invoices/invoices.repository';

describe('restoreInventoryBucketsLifo Unit Tests', () => {
  it('should query sales_invoice_item_batches and restore into the exact lineage batch', async () => {
    const mockBatches = [
      {
        id: 'batch-2-uuid',
        original_qty: '50.0000',
        remaining_qty: '30.0000',
        status: 'ACTIVE',
      },
      {
        id: 'batch-1-uuid',
        original_qty: '50.0000',
        remaining_qty: '0.0000',
        status: 'DEPLETED',
      },
    ];

    const updatedBatches: Record<string, any> = {};

    const mockKnex: any = (table: string) => {
      if (table === 'sales_invoice_item_batches as siib') {
        const query: any = {
          join: () => query,
          where: () => query,
          orderBy: () => query,
          select: async () => [
            {
              lineage_id: 'lin-2',
              sales_invoice_item_id: 'sii-123',
              inventory_batch_id: 'batch-2-uuid',
              qty_deducted: '20.0000',
              cogs_per_kg: '150.00',
              batch_id: 'batch-2-uuid',
              original_qty: '50.0000',
              remaining_qty: mockBatches[0].remaining_qty,
              status: mockBatches[0].status,
            },
            {
              lineage_id: 'lin-1',
              sales_invoice_item_id: 'sii-123',
              inventory_batch_id: 'batch-1-uuid',
              qty_deducted: '50.0000',
              cogs_per_kg: '100.00',
              batch_id: 'batch-1-uuid',
              original_qty: '50.0000',
              remaining_qty: mockBatches[1].remaining_qty,
              status: mockBatches[1].status,
            },
          ],
        };
        return query;
      }

      if (table === 'inventory_batches') {
        let whereId: string;
        const query: any = {
          where: (col: string, val: string) => {
            if (col === 'id') whereId = val;
            return query;
          },
          update: async (data: any) => {
            updatedBatches[whereId] = data;
            return [data];
          },
        };
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    };

    mockKnex.raw = true;
    mockKnex.schema = {
      hasTable: async (name: string) => name === 'sales_invoice_item_batches',
    };

    // Test returning 20 KG: should hit batch-2-uuid first @ 150/kg
    const result = await restoreInventoryBucketsLifo(
      mockKnex,
      'sii-123',
      20
    );

    expect(result.totalRestoredCogs).toBe(3000); // 20 * 150
    expect(result.remainingUnallocated).toBe(0);
    expect(result.primaryBatchId).toBe('batch-2-uuid');

    // Batch 2 should be updated from 30 to 50
    expect(updatedBatches['batch-2-uuid']).toBeDefined();
    expect(updatedBatches['batch-2-uuid'].remaining_qty).toBe(50);
    expect(updatedBatches['batch-2-uuid'].status).toBe('ACTIVE');

    // Batch 1 should NOT be touched
    expect(updatedBatches['batch-1-uuid']).toBeUndefined();
  });

  it('should sequential restore across multiple lineage records with correct COGS reversal and status flip', async () => {
    const updatedBatches: Record<string, any> = {};

    const mockKnex: any = (table: string) => {
      if (table === 'sales_invoice_item_batches as siib') {
        const query: any = {
          join: () => query,
          where: () => query,
          orderBy: () => query,
          select: async () => [
            {
              lineage_id: 'lin-2',
              sales_invoice_item_id: 'sii-123',
              inventory_batch_id: 'batch-2-uuid',
              qty_deducted: '20.0000',
              cogs_per_kg: '150.00',
              batch_id: 'batch-2-uuid',
              original_qty: '50.0000',
              remaining_qty: '30.0000',
              status: 'ACTIVE',
            },
            {
              lineage_id: 'lin-1',
              sales_invoice_item_id: 'sii-123',
              inventory_batch_id: 'batch-1-uuid',
              qty_deducted: '50.0000',
              cogs_per_kg: '100.00',
              batch_id: 'batch-1-uuid',
              original_qty: '50.0000',
              remaining_qty: '0.0000',
              status: 'DEPLETED',
            },
          ],
        };
        return query;
      }

      if (table === 'inventory_batches') {
        let whereId: string;
        const query: any = {
          where: (col: string, val: string) => {
            if (col === 'id') whereId = val;
            return query;
          },
          update: async (data: any) => {
            updatedBatches[whereId] = data;
            return [data];
          },
        };
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    };

    mockKnex.raw = true;
    mockKnex.schema = {
      hasTable: async () => true,
    };

    // Customer returns 40 KG in one return:
    // 20 KG from batch 2 @ 150 = 3000
    // 20 KG from batch 1 @ 100 = 2000
    // Total COGS reversed = 5000
    const result = await restoreInventoryBucketsLifo(
      mockKnex,
      'sii-123',
      40
    );

    expect(result.totalRestoredCogs).toBe(5000);
    expect(result.remainingUnallocated).toBe(0);

    // Batch 2: remaining was 30, restored 20 -> 50
    expect(updatedBatches['batch-2-uuid'].remaining_qty).toBe(50);
    expect(updatedBatches['batch-2-uuid'].status).toBe('ACTIVE');

    // Batch 1: remaining was 0 (DEPLETED), restored 20 -> 20, status flipped to ACTIVE
    expect(updatedBatches['batch-1-uuid'].remaining_qty).toBe(20);
    expect(updatedBatches['batch-1-uuid'].status).toBe('ACTIVE');
  });
});

