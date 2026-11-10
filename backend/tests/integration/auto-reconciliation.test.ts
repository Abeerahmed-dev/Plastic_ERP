import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
let ownerToken: string;
let categoryId: string;
let customerId: string;
let supplierId: string;

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
  let cust = await db('customers').where({ name: 'Reconciliation Test Customer' }).first();
  if (!cust) {
    const [c] = await db('customers')
      .insert({
        code: `C${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`,
        name: 'Reconciliation Test Customer',
        phone: '03001112233',
        credit_limit: 500000,
        opening_balance: 0,
        customer_type: 'CASH',
      })
      .returning('*');
    cust = c;
  }
  customerId = cust.id;

  // Ensure supplier exists
  let supp = await db('suppliers').where({ name: 'Reconciliation Raw Polymer Supplier' }).first();
  if (!supp) {
    const [s] = await db('suppliers')
      .insert({
        code: `SUPP-${Date.now().toString().slice(-6)}`,
        name: 'Reconciliation Raw Polymer Supplier',
        phone: '03004445566',
        opening_payable: 0,
        payment_terms: 30,
        is_active: true,
      })
      .returning('*');
    supp = s;
  }
  supplierId = supp.id;
});

describe('Step 3: Automatic Financial Reconciliation (Jest Integration)', () => {
  it('should intercept incoming purchase stock to fulfill pending backorders, retroactively reconcile COGS, and add remainder to warehouse shelf stock', async () => {
    // 1. Seed test database product with 0 KG stock and a baseline WAC of Rs. 100/KG
    const productCode = `PREC-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
    const [product] = await db('products')
      .insert({
        code: productCode,
        name: 'Auto Reconciliation Polymer',
        category: 'Standard Packaging',
        category_id: categoryId,
        size: 'Standard',
        cost_price: 100,
        sale_price: 220,
        opening_stock: 0,
        total_stock_kg: 0,
        rolling_avg_cost_per_kg: 100, // Previous WAC: Rs. 100/KG
        base_unit: 'KG',
        purchase_unit: 'KG',
        sale_unit: 'KG',
        default_kg_per_purchase_unit: 1.0,
        default_sale_units_per_kg: 1.0,
        unit_conversions: JSON.stringify({}),
        is_active: true,
      })
      .returning('*');

    // 2. Seed the 70 KG deficit in pending_deliveries via offline sync invoice
    const offlineSyncPayload = [
      {
        offline_id: `rec-offline-${Date.now()}`,
        timestamp: Date.now() - 30000,
        customer_id: customerId,
        items: [
          {
            product_id: product.id,
            quantity: 70, // Backorder / deficit of 70 KG
            unit_price: 220,
            selected_unit: 'KG',
          },
        ],
        payment_method: 'CASH',
      },
    ];

    const syncRes = await request(app)
      .post('/api/v1/sync-offline')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(offlineSyncPayload);

    expect(syncRes.status).toBe(201);
    const [syncedInvoice] = syncRes.body.data;
    expect(Number(syncedInvoice.deferred_qty)).toBe(70);

    // Verify initial deficit state in pending_deliveries & sales_invoice_items
    const initialPending = await db('pending_deliveries')
      .where({ sales_invoice_id: syncedInvoice.id })
      .first();
    expect(initialPending).toBeDefined();
    expect(Number(initialPending.pending_qty)).toBe(70);
    expect(Number(initialPending.fulfilled_qty)).toBe(0);
    expect(initialPending.status).toBe('PENDING');

    const initialItem = await db('sales_invoice_items')
      .where({ invoice_id: syncedInvoice.id })
      .first();
    expect(Number(initialItem.estimated_cogs)).toBe(7000); // 70 KG * Rs. 100 estimated WAC = 7,000
    expect(Number(initialItem.actual_cogs)).toBe(0);
    expect(initialItem.is_deferred).toBe(true);

    // Verify shelf stock is 0
    const stockBeforePurchase = await db('products').where({ id: product.id }).first();
    expect(Number(stockBeforePurchase.total_stock_kg)).toBe(0);

    // 3. THE TRIGGER:
    // Process a new Purchase Invoice (POST /api/v1/purchases) for 100 KG of raw material at a new, higher actual cost (Rs. 150/KG)
    const purchasePayload = {
      supplier_id: supplierId,
      date: new Date().toISOString(),
      discount: 0,
      delivery_charges: 0,
      items: [
        {
          product_id: product.id,
          quantity: 100,
          quantity_kg: 100,
          price_per_kg: 150,
          unit_price: 150,
          selected_unit: 'KG',
        },
      ],
      notes: 'Purchase batch triggering rolling auto-reconciliation',
    };

    const purchaseRes = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(purchasePayload);

    expect(purchaseRes.status).toBe(201);
    expect(purchaseRes.body.success).toBe(true);

    // 4. THE INTERCEPTOR ASSERTION:
    // Assert that the pending_deliveries queue was scanned and the 70 KG record is now marked as FULFILLED
    const reconciledPending = await db('pending_deliveries')
      .where({ id: initialPending.id })
      .first();
    expect(reconciledPending.status).toBe('FULFILLED');
    expect(Number(reconciledPending.pending_qty)).toBe(0);
    expect(Number(reconciledPending.fulfilled_qty)).toBe(70);

    // 5. THE RETROACTIVE COGS ASSERTION:
    // Assert that the system retroactively updated the temporary estimated_cogs on the deferred 70 KG sale
    // with the exact actual_cogs of the new purchase bill (70 KG * Rs. 150 = Rs. 10,500)
    const reconciledItem = await db('sales_invoice_items')
      .where({ id: initialItem.id })
      .first();
    expect(Number(reconciledItem.actual_cogs)).toBe(10500);
    expect(Number(reconciledItem.estimated_cogs)).toBe(10500);
    expect(Number(reconciledItem.applied_cogs_per_kg)).toBe(150);

    // 6. STOCK ASSERTION:
    // Assert the final warehouse shelf stock correctly reads 30 KG (100 KG incoming minus 70 KG auto-fulfilled backorder)
    const finalProduct = await db('products').where({ id: product.id }).first();
    expect(Number(finalProduct.total_stock_kg)).toBe(30);

    // Also assert the newly created purchase batch has remaining_qty = 30 KG
    const purchaseBatch = await db('inventory_batches')
      .where({ purchase_invoice_id: purchaseRes.body.data.id })
      .first();
    expect(purchaseBatch).toBeDefined();
    expect(Number(purchaseBatch.original_qty)).toBe(100);
    expect(Number(purchaseBatch.remaining_qty)).toBe(30);
    expect(purchaseBatch.status).toBe('ACTIVE');
  });
});

