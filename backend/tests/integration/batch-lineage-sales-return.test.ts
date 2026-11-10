import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
const OWNER_EMAIL = 'owner@sabir.local';
const OWNER_PASSWORD = 'Admin@1234';

let ownerToken: string;
let customerId: string;
let productId: string;
let categoryId: string;
let batch1Id: string;
let batch2Id: string;
let salesInvoiceId: string;
let salesInvoiceItemId: string;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  ownerToken = loginRes.body.data.access_token;

  // Create customer
  const customerRes = await request(app)
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Strict Lineage Customer ' + Date.now(),
      phone: '03009998877',
      credit_limit: 500000,
      opening_balance: 0,
    });
  customerId = customerRes.body.data.id;

  // Get or create category
  let catRes = await request(app)
    .get('/api/v1/categories')
    .set('Authorization', `Bearer ${ownerToken}`);

  if (catRes.body.data && catRes.body.data.length > 0) {
    categoryId = catRes.body.data[0].id;
  } else {
    catRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Lineage Category ' + Date.now(), bag_weight_kg: 25 });
    categoryId = catRes.body.data.id;
  }

  // Create product with 0 stock
  const prodRes = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Lineage HDPE Polymer ' + Date.now(),
      category_id: categoryId,
      size: 'Standard',
      cost_price: 100,
      sale_price: 200,
      total_stock_kg: 0,
      rolling_avg_cost_per_kg: 100,
      min_markup_percent: 5,
    });
  if (!prodRes.body.data) {
    console.error('Product creation failed:', prodRes.body);
  }
  productId = prodRes.body.data.id;

  // Create two distinct inventory batches directly to represent historical stock:
  // Batch 1 (older, cheaper): 50 KG @ Rs 100/kg
  const [b1] = await db('inventory_batches')
    .insert({
      product_id: productId,
      batch_number: `PB-LINEAGE-1-${Date.now()}`,
      batch_buy_price_per_kg: 100.00,
      original_qty: 50.00,
      remaining_qty: 50.00,
      status: 'ACTIVE',
      created_at: new Date(Date.now() - 3600000), // 1 hour ago
      updated_at: new Date(Date.now() - 3600000),
    })
    .returning('*');
  batch1Id = b1.id;

  // Batch 2 (newer, expensive): 50 KG @ Rs 150/kg
  const [b2] = await db('inventory_batches')
    .insert({
      product_id: productId,
      batch_number: `PB-LINEAGE-2-${Date.now()}`,
      batch_buy_price_per_kg: 150.00,
      original_qty: 50.00,
      remaining_qty: 50.00,
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');
  batch2Id = b2.id;

  // Update product total_stock_kg to 100 KG
  await db('products')
    .where({ id: productId })
    .update({ total_stock_kg: 100.00 });
});

afterAll(async () => {
  if (salesInvoiceId) {
    const items = await db('sales_invoice_items').where({ invoice_id: salesInvoiceId }).select('id');
    const itemIds = items.map((i: any) => i.id);
    await db('sales_invoice_item_batches').whereIn('sales_invoice_item_id', itemIds).delete();
    await db('sales_invoice_items').where({ invoice_id: salesInvoiceId }).delete();
    await db('sales_invoices').where({ parent_invoice_id: salesInvoiceId }).delete();
    await db('sales_invoices').where({ id: salesInvoiceId }).delete();
  }
  if (productId) {
    await db('inventory_transactions').where('product_id', productId).delete();
    await db('inventory_batches').where('product_id', productId).delete();
    await db('products').where('id', productId).delete();
  }
  if (customerId) {
    await db('customer_payments').where('customer_id', customerId).delete();
    await db('customers').where('id', customerId).delete();
  }
  await db.destroy();
});

describe('Strict Batch Lineage & Targeted Return Restoration Engine', () => {
  it('Phase 1: sales_invoice_item_batches junction table should exist with required columns', async () => {
    const hasTable = await db.schema.hasTable('sales_invoice_item_batches');
    expect(hasTable).toBe(true);

    const hasId = await db.schema.hasColumn('sales_invoice_item_batches', 'id');
    const hasSalesInvoiceItemId = await db.schema.hasColumn('sales_invoice_item_batches', 'sales_invoice_item_id');
    const hasInventoryBatchId = await db.schema.hasColumn('sales_invoice_item_batches', 'inventory_batch_id');
    const hasQtyDeducted = await db.schema.hasColumn('sales_invoice_item_batches', 'qty_deducted');
    const hasCogsPerKg = await db.schema.hasColumn('sales_invoice_item_batches', 'cogs_per_kg');

    expect(hasId).toBe(true);
    expect(hasSalesInvoiceItemId).toBe(true);
    expect(hasInventoryBatchId).toBe(true);
    expect(hasQtyDeducted).toBe(true);
    expect(hasCogsPerKg).toBe(true);
  });

  it('Phase 2: FIFO Sales Engine should deplete batches in FIFO order and log lineage to sales_invoice_item_batches', async () => {
    // Customer buys 70 KG:
    // Should deplete all 50 KG from Batch 1 (Rs 100/kg) -> status = DEPLETED
    // Should deplete 20 KG from Batch 2 (Rs 150/kg) -> status = ACTIVE, remaining = 30 KG
    const invoiceRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        customer_id: customerId,
        date: new Date().toISOString().split('T')[0],
        discount: 0,
        items: [
          {
            product_id: productId,
            quantity: 70,
            unit_price: 200,
            selected_unit: 'KG',
            size: 'Standard',
          },
        ],
      });

    expect(invoiceRes.status).toBe(201);
    expect(invoiceRes.body.success).toBe(true);
    salesInvoiceId = invoiceRes.body.data.id;

    // Verify batches in database
    const b1 = await db('inventory_batches').where({ id: batch1Id }).first();
    const b2 = await db('inventory_batches').where({ id: batch2Id }).first();

    expect(Number(b1.remaining_qty)).toBe(0);
    expect(b1.status).toBe('DEPLETED');

    expect(Number(b2.remaining_qty)).toBe(30);
    expect(b2.status).toBe('ACTIVE');

    // Retrieve sales_invoice_item
    const itemRow = await db('sales_invoice_items')
      .where({ invoice_id: salesInvoiceId })
      .first();
    expect(itemRow).toBeDefined();
    salesInvoiceItemId = itemRow.id;

    // Query lineage ledger (sales_invoice_item_batches)
    const lineageRecords = await db('sales_invoice_item_batches')
      .where({ sales_invoice_item_id: salesInvoiceItemId })
      .orderBy('created_at', 'asc');

    expect(lineageRecords.length).toBe(2);

    // Record 1: 50 KG from Batch 1 at Rs 100
    const rec1 = lineageRecords.find((r: any) => r.inventory_batch_id === batch1Id);
    expect(rec1).toBeDefined();
    expect(Number(rec1.qty_deducted)).toBe(50);
    expect(Number(rec1.cogs_per_kg)).toBe(100);

    // Record 2: 20 KG from Batch 2 at Rs 150
    const rec2 = lineageRecords.find((r: any) => r.inventory_batch_id === batch2Id);
    expect(rec2).toBeDefined();
    expect(Number(rec2.qty_deducted)).toBe(20);
    expect(Number(rec2.cogs_per_kg)).toBe(150);
  });

  it('Phase 3: Sales Return of 20 KG should target Batch 2 (highest COGS / newest) and reverse at Rs 150/kg', async () => {
    // Return 20 KG against parent invoice
    const returnRes = await request(app)
      .post(`/api/v1/invoices/${salesInvoiceId}/returns`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        return_reason: 'Surplus quantity returned (Test Part 1)',
        items: [
          {
            product_id: productId,
            return_quantity: 20,
          },
        ],
      });

    expect(returnRes.status).toBe(201);
    expect(returnRes.body.success).toBe(true);
    expect(returnRes.body.data.invoice_type).toBe('CREDIT_NOTE');

    // Verify targeted restoration:
    // Batch 2 had 20 KG deducted at 150. The 20 KG return should go 100% into Batch 2!
    // Batch 2 remaining_qty should become 30 + 20 = 50 KG.
    // Batch 1 must remain untouched at 0 KG (DEPLETED) - NO cheap inventory leak!
    const b1 = await db('inventory_batches').where({ id: batch1Id }).first();
    const b2 = await db('inventory_batches').where({ id: batch2Id }).first();

    expect(Number(b2.remaining_qty)).toBe(50);
    expect(b2.status).toBe('ACTIVE');

    expect(Number(b1.remaining_qty)).toBe(0);
    expect(b1.status).toBe('DEPLETED');

    // Check Credit Note item applied_cogs_per_kg: exactly 150 (from Batch 2)
    const creditNoteItem = await db('sales_invoice_items')
      .where({ invoice_id: returnRes.body.data.id })
      .first();

    expect(creditNoteItem).toBeDefined();
    expect(Number(creditNoteItem.applied_cogs_per_kg)).toBe(150);
  });

  it('Phase 3 (Sequential Reversal): Return of remaining 50 KG should target Batch 1, restore 50 KG @ Rs 100, and flip DEPLETED to ACTIVE', async () => {
    // Return remaining 50 KG against parent invoice
    const returnRes = await request(app)
      .post(`/api/v1/invoices/${salesInvoiceId}/returns`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        return_reason: 'Remaining goods returned (Test Part 2)',
        items: [
          {
            product_id: productId,
            return_quantity: 50,
          },
        ],
      });

    expect(returnRes.status).toBe(201);
    expect(returnRes.body.success).toBe(true);

    // Verify targeted restoration:
    // Batch 1 had 50 KG deducted at 100.
    // Batch 1 remaining_qty must become 0 + 50 = 50 KG, and status must flip back to ACTIVE!
    // Batch 2 was already fully restored to 50 KG in Part 1, so it should remain 50 KG.
    const b1 = await db('inventory_batches').where({ id: batch1Id }).first();
    const b2 = await db('inventory_batches').where({ id: batch2Id }).first();

    expect(Number(b1.remaining_qty)).toBe(50);
    expect(b1.status).toBe('ACTIVE');

    expect(Number(b2.remaining_qty)).toBe(50);
    expect(b2.status).toBe('ACTIVE');

    // Check Credit Note item applied_cogs_per_kg: exactly 100 (from Batch 1)
    const creditNoteItem = await db('sales_invoice_items')
      .where({ invoice_id: returnRes.body.data.id })
      .first();

    expect(creditNoteItem).toBeDefined();
    expect(Number(creditNoteItem.applied_cogs_per_kg)).toBe(100);

    // Check total product stock is fully restored to 100 KG
    const product = await db('products').where({ id: productId }).first();
    expect(Number(product.total_stock_kg)).toBe(100);
  });
});
