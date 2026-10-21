import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
const OWNER_EMAIL = 'owner@sabir.local';
const OWNER_PASSWORD = 'Admin@1234';

let ownerToken: string;
let supplierId: string;
let productId: string;
let categoryId: string;
let purchaseInvoiceId: string;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  ownerToken = loginRes.body.data.access_token;

  // Create supplier
  const supplierRes = await request(app)
    .post('/api/v1/suppliers')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Test Return Supplier ' + Date.now(),
      phone: '03001234567',
      city: 'Lahore',
      payment_terms: 30,
      opening_payable: 0,
    });
  supplierId = supplierRes.body.data.id;

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
      .send({ name: 'Raw Material ' + Date.now(), bag_weight_kg: 50 });
    categoryId = catRes.body.data.id;
  }

  // Create product
  const prodRes = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'HDPE Granules ' + Date.now(),
      category_id: categoryId,
      cost_price: 200,
      sale_price: 250,
      total_stock_kg: 0,
      rolling_avg_cost_per_kg: 200,
    });
  productId = prodRes.body.data.id;
});

afterAll(async () => {
  if (supplierId) {
    await db('purchase_invoice_items')
      .whereIn('purchase_invoice_id', function () {
        this.select('id').from('purchase_invoices').where('supplier_id', supplierId);
      })
      .delete();
    await db('inventory_batches')
      .whereIn('purchase_invoice_id', function () {
        this.select('id').from('purchase_invoices').where('supplier_id', supplierId);
      })
      .delete();
    await db('supplier_payments').where('supplier_id', supplierId).delete();
    await db('purchase_invoices').where('supplier_id', supplierId).delete();
    await db('suppliers').where('id', supplierId).delete();
  }
  if (productId) {
    await db('inventory_transactions').where('product_id', productId).delete();
    await db('inventory_batches').where('product_id', productId).delete();
    await db('products').where('id', productId).delete();
  }
  await db.destroy();
});

describe('Phase 1 & Phase 2: Purchase Returns / Debit Notes', () => {
  it('should create a parent purchase invoice and link a dedicated inventory_batch', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        supplier_id: supplierId,
        date: new Date().toISOString().split('T')[0],
        discount: 0,
        items: [
          {
            product_id: productId,
            quantity: 100,
            quantity_kg: 100,
            unit_price: 200,
            price_per_kg: 200,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(Number(res.body.data.total_amount)).toBe(20000);
    purchaseInvoiceId = res.body.data.id;

    // Verify dedicated inventory batch was created with purchase_invoice_id
    const batch = await db('inventory_batches')
      .where({ purchase_invoice_id: purchaseInvoiceId, product_id: productId })
      .first();

    expect(batch).toBeDefined();
    expect(Number(batch.original_qty)).toBe(100);
    expect(Number(batch.remaining_qty)).toBe(100);
    expect(batch.status).toBe('ACTIVE');
  });

  it('Validation Wall: should strictly reject with STOCK_ALREADY_SOLD if stock remaining is insufficient', async () => {
    // Simulate stock consumption (e.g. 90 KG sold, only 10 KG remaining in batch)
    await db('inventory_batches')
      .where({ purchase_invoice_id: purchaseInvoiceId, product_id: productId })
      .update({ remaining_qty: 10 });

    // Attempt to return 50 KG
    const res = await request(app)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        parent_invoice_id: purchaseInvoiceId,
        line_items: [
          {
            product_id: productId,
            return_quantity: 50,
          },
        ],
        return_reason: 'Defective raw material',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('STOCK_ALREADY_SOLD');

    // Restore remaining_qty to 100 for subsequent test
    await db('inventory_batches')
      .where({ purchase_invoice_id: purchaseInvoiceId, product_id: productId })
      .update({ remaining_qty: 100 });
  });

  it('Execution: should process return, deduct BOTH remaining_qty AND original_qty, and generate DEBIT_NOTE', async () => {
    // Process return for 40 KG
    const res = await request(app)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        parent_invoice_id: purchaseInvoiceId,
        line_items: [
          {
            product_id: productId,
            return_quantity: 40,
          },
        ],
        return_reason: 'Damaged packaging',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invoice_type).toBe('DEBIT_NOTE');
    expect(res.body.data.parent_invoice_id).toBe(purchaseInvoiceId);
    expect(Number(res.body.data.total_amount)).toBe(-8000); // 40 * 200

    // Verify negative line items
    expect(res.body.data.items).toBeDefined();
    expect(Number(res.body.data.items[0].quantity)).toBe(-40);
    expect(Number(res.body.data.items[0].total_price)).toBe(-8000);

    // Verify batch remaining_qty AND original_qty were BOTH deducted by 40
    const batch = await db('inventory_batches')
      .where({ purchase_invoice_id: purchaseInvoiceId, product_id: productId })
      .first();

    expect(Number(batch.original_qty)).toBe(60);
    expect(Number(batch.remaining_qty)).toBe(60);
    expect(batch.status).toBe('ACTIVE');
  });

  it('should set status to DEPLETED when remaining_qty hits 0', async () => {
    // Return remaining 60 KG
    const res = await request(app)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        parent_invoice_id: purchaseInvoiceId,
        line_items: [
          {
            product_id: productId,
            return_quantity: 60,
          },
        ],
        return_reason: 'Remaining goods returned',
      });

    expect(res.status).toBe(201);

    const batch = await db('inventory_batches')
      .where({ purchase_invoice_id: purchaseInvoiceId, product_id: productId })
      .first();

    expect(Number(batch.original_qty)).toBe(0);
    expect(Number(batch.remaining_qty)).toBe(0);
    expect(batch.status).toBe('DEPLETED');
  });

  it('Supplier Global Netting: total_billed_liability = SUM(PURCHASE_INVOICE) - SUM(DEBIT_NOTE)', async () => {
    // Record a payment of 20,000 against supplier
    await request(app)
      .post('/api/v1/supplier-payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        supplier_id: supplierId,
        purchase_invoice_id: purchaseInvoiceId,
        payment_date: new Date().toISOString().split('T')[0],
        amount: 20000,
        payment_method: 'CASH',
      });

    // Check GET /api/suppliers
    const suppRes = await request(app)
      .get(`/api/v1/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(suppRes.status).toBe(200);
    const data = suppRes.body.data;

    // Total Purchase: 20000, Total Debit Notes: 20000 -> Net Liability: 0
    expect(Number(data.total_billed_liability)).toBe(0);
    expect(Number(data.outstanding_payable)).toBe(0);
    // Since supplier was fully paid 20,000, excess cash pushed into advance wallet:
    expect(Number(data.advance_payable)).toBe(20000);
  });

  it('Living Invoice Ledger: GET /api/supplier-payments returns invoice with linked_debit_notes and timeline', async () => {
    const ledgerRes = await request(app)
      .get(`/api/supplier-payments?supplier_id=${supplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(ledgerRes.status).toBe(200);
    expect(Array.isArray(ledgerRes.body.data)).toBe(true);

    const inv = ledgerRes.body.data.find((r: any) => r.purchase_invoice_id === purchaseInvoiceId);
    expect(inv).toBeDefined();
    expect(inv.linked_debit_notes.length).toBe(2);

    // Verify mixed timeline contains DEBIT_NOTE events with NEGATIVE polarity
    const debitNoteEvents = inv.payment_history.filter((e: any) => e.type === 'DEBIT_NOTE');
    expect(debitNoteEvents.length).toBe(2);
    expect(debitNoteEvents[0].polarity).toBe('NEGATIVE');
    expect(debitNoteEvents[0].display_type).toBe('Goods Returned to Supplier');
  });
});
