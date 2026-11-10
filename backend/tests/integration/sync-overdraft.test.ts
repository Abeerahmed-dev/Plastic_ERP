import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
let ownerToken: string;
let categoryId: string;
let customerId: string;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = loginRes.body?.data?.access_token;
});

beforeEach(async () => {
  if (!ownerToken) {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
    ownerToken = loginRes.body?.data?.access_token;
  }

  // Ensure category exists
  let cat = await db('categories').where({ name: 'Standard Packaging' }).first();
  if (!cat) {
    const [c] = await db('categories')
      .insert({
        name: 'Standard Packaging',
        bag_weight_kg: 25.0,
        description: 'Standard Packaging 25 KG/Bag',
      })
      .returning('*');
    cat = c;
  }
  categoryId = cat.id;

  // Ensure customer exists
  let cust = await db('customers').where({ name: 'Sync Overdraft Customer' }).first();
  if (!cust) {
    const [c] = await db('customers')
      .insert({
        code: `C${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`,
        name: 'Sync Overdraft Customer',
        phone: '03001234567',
        credit_limit: 500000,
        opening_balance: 0,
        customer_type: 'CASH',
      })
      .returning('*');
    cust = c;
  }
  customerId = cust.id;
});

describe('Step 2: Backend Overdraft Split Engine (Jest Integration)', () => {
  it('should chronologically process offline sync invoices, splitting stock overdraft into fulfilled and deferred quantities with pending_deliveries queue entry', async () => {
    // 1. Seed a test database product with exactly 100 KG of stock @ Rs. 100/KG WAC
    const productCode = `P${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
    const [product] = await db('products')
      .insert({
        code: productCode,
        name: 'Overdraft Test Polymer',
        category: 'Standard Packaging',
        category_id: categoryId,
        size: 'Standard',
        cost_price: 100,
        sale_price: 200,
        opening_stock: 100,
        total_stock_kg: 100,
        rolling_avg_cost_per_kg: 100,
        base_unit: 'KG',
        purchase_unit: 'KG',
        sale_unit: 'KG',
        default_kg_per_purchase_unit: 1.0,
        default_sale_units_per_kg: 1.0,
        unit_conversions: JSON.stringify({}),
        is_active: true,
      })
      .returning('*');

    // Seed active batch of 100 KG @ Rs. 100/KG
    await db('inventory_batches').insert({
      product_id: product.id,
      batch_number: `PB-INIT-OVERDRAFT-${Date.now()}`,
      batch_buy_price_per_kg: 100,
      original_qty: 100,
      remaining_qty: 100,
      status: 'ACTIVE',
      size: 'Standard',
    });

    const now = Date.now();
    const timestampA = now - 60000; // Invoice A occurred earlier (T1)
    const timestampB = now;         // Invoice B occurred later (T2)

    const offlinePayload = [
      {
        offline_id: 'a1111111-1111-4111-8111-111111111111',
        timestamp: timestampA,
        customer_id: customerId,
        items: [
          {
            product_id: product.id,
            quantity: 80, // Requested 80 KG
            unit_price: 200,
            selected_unit: 'KG',
          },
        ],
        payment_method: 'CASH',
      },
      {
        offline_id: 'b2222222-2222-4222-8222-222222222222',
        timestamp: timestampB,
        customer_id: customerId,
        items: [
          {
            product_id: product.id,
            quantity: 90, // Requested 90 KG (exceeds remaining 20 KG available!)
            unit_price: 200,
            selected_unit: 'KG',
          },
        ],
        payment_method: 'CASH',
      },
    ];

    // 2. Hit the POST /api/v1/sync-offline endpoint
    const res = await request(app)
      .post('/api/v1/sync-offline')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(offlinePayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const syncedInvoices = res.body.data;
    expect(Array.isArray(syncedInvoices)).toBe(true);
    expect(syncedInvoices.length).toBe(2);

    const invoiceA = syncedInvoices[0];
    const invoiceB = syncedInvoices[1];

    // 3. THE SPLIT ASSERTION (Invoice A):
    // Requested 80 KG from 100 KG available stock -> 100% fulfilled, 0 deferred
    expect(Number(invoiceA.requested_qty)).toBe(80);
    expect(Number(invoiceA.fulfilled_qty)).toBe(80);
    expect(Number(invoiceA.deferred_qty)).toBe(0);

    const savedItemA = await db('sales_invoice_items')
      .where({ invoice_id: invoiceA.id })
      .first();
    expect(Number(savedItemA.requested_qty)).toBe(80);
    expect(Number(savedItemA.fulfilled_qty)).toBe(80);
    expect(Number(savedItemA.deferred_qty)).toBe(0);
    expect(savedItemA.is_deferred).toBe(false);

    // 4. THE SPLIT ASSERTION (Invoice B):
    // Requested 90 KG when only 20 KG remained (100 - 80) -> fulfilled 20 KG, deferred 70 KG
    expect(Number(invoiceB.requested_qty)).toBe(90);
    expect(Number(invoiceB.fulfilled_qty)).toBe(20);
    expect(Number(invoiceB.deferred_qty)).toBe(70);

    const savedItemB = await db('sales_invoice_items')
      .where({ invoice_id: invoiceB.id })
      .first();
    expect(Number(savedItemB.requested_qty)).toBe(90);
    expect(Number(savedItemB.fulfilled_qty)).toBe(20);
    expect(Number(savedItemB.deferred_qty)).toBe(70);
    expect(savedItemB.is_deferred).toBe(true);

    // 5. THE QUEUE ASSERTION:
    // Assert 70 KG liability inserted into pending_deliveries with estimated_cogs & status = 'PENDING'
    const queueRecord = await db('pending_deliveries')
      .where({ sales_invoice_id: invoiceB.id })
      .first();

    expect(queueRecord).toBeDefined();
    expect(Number(queueRecord.pending_qty)).toBe(70);
    expect(Number(queueRecord.fulfilled_qty)).toBe(0);
    expect(queueRecord.status).toBe('PENDING');

    // Assert estimated_cogs uses previous WAC (Rs. 100/KG):
    // Fulfilled 20 KG @ Rs. 100 = Rs. 2,000 actual
    // Deferred 70 KG @ Rs. 100 WAC = Rs. 7,000 estimated
    // Total estimated COGS = Rs. 9,000
    expect(Number(savedItemB.actual_cogs)).toBe(2000);
    expect(Number(savedItemB.estimated_cogs)).toBe(9000);

    // Assert warehouse shelf stock is now 0 KG (100 - 80 - 20 = 0)
    const refreshedProduct = await db('products').where({ id: product.id }).first();
    expect(Number(refreshedProduct.total_stock_kg)).toBe(0);
  });
});

