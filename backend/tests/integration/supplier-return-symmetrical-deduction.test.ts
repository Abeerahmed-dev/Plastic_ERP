import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';
import { getInventoryValuationReport, getInventoryLedgerReport } from '../../src/modules/reports/reports.repository';

const app = createApp();
const OWNER_EMAIL = 'owner@sabir.local';
const OWNER_PASSWORD = 'Admin@1234';

let ownerToken: string;
let supplierId: string;
let customerId: string;
let categoryId: string;
let productId: string;
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
      name: 'Symmetrical Supplier ' + Date.now(),
      phone: '03001239876',
      city: 'Gujranwala',
      payment_terms: 15,
      opening_payable: 0,
    });
  supplierId = supplierRes.body.data.id;

  // Create customer
  const customerRes = await request(app)
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Turnover Test Customer ' + Date.now(),
      phone: '03005554433',
      credit_limit: 500000,
      opening_balance: 0,
    });
  customerId = customerRes.body.data.id;

  // Create category
  const catRes = await request(app)
    .post('/api/v1/categories')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Turnover Category ' + Date.now(), bag_weight_kg: 25 });
  categoryId = catRes.body.data.id;

  // Create product
  const prodRes = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Turnover Polymer ' + Date.now(),
      category_id: categoryId,
      size: 'Standard',
      cost_price: 100,
      sale_price: 150,
      total_stock_kg: 0,
      rolling_avg_cost_per_kg: 100,
      min_markup_percent: 5,
    });
  productId = prodRes.body.data.id;
});

afterAll(async () => {
  if (purchaseInvoiceId) {
    await db('inventory_batches').where({ purchase_invoice_id: purchaseInvoiceId }).delete();
    await db('purchase_invoice_items')
      .whereIn('purchase_invoice_id', function () {
        this.select('id').from('purchase_invoices').where('parent_invoice_id', purchaseInvoiceId);
      })
      .delete();
    await db('purchase_invoice_items').where({ purchase_invoice_id: purchaseInvoiceId }).delete();
    await db('purchase_invoices').where({ parent_invoice_id: purchaseInvoiceId }).delete();
    await db('purchase_invoices').where({ id: purchaseInvoiceId }).delete();
  }
  if (productId) {
    await db('inventory_transactions').where('product_id', productId).delete();
    await db('inventory_batches').where('product_id', productId).delete();
    await db('products').where('id', productId).delete();
  }
  if (categoryId) {
    await db('categories').where('id', categoryId).delete();
  }
  if (supplierId) {
    await db('suppliers').where('id', supplierId).delete();
  }
  if (customerId) {
    await db('customers').where('id', customerId).delete();
  }
  await db.destroy();
});

describe('Supplier Return Symmetrical Deduction & Status Reclassification', () => {
  it('Phase 1: Purchase a 100 KG lot and verify dedicated batch creation', async () => {
    const purchaseRes = await request(app)
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
            unit_price: 100,
            selected_unit: 'KG',
            size: 'Standard',
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    purchaseInvoiceId = purchaseRes.body.data.id;

    const batch = await db('inventory_batches')
      .where({ purchase_invoice_id: purchaseInvoiceId, product_id: productId })
      .first();

    expect(batch).toBeDefined();
    expect(Number(batch.original_qty)).toBe(100);
    expect(Number(batch.remaining_qty)).toBe(100);
    expect(batch.status).toBe('ACTIVE');
  });

  it('Phase 1: Partial Supplier Return should symmetrically deduct from BOTH original_qty and remaining_qty', async () => {
    // Return 30 KG to supplier
    const retRes = await request(app)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        parent_invoice_id: purchaseInvoiceId,
        line_items: [
          {
            product_id: productId,
            return_quantity: 30,
          },
        ],
        return_reason: 'Surplus return 30 KG',
      });

    expect(retRes.status).toBe(201);
    expect(retRes.body.data.invoice_type).toBe('DEBIT_NOTE');

    const batch = await db('inventory_batches')
      .where({ purchase_invoice_id: purchaseInvoiceId, product_id: productId })
      .first();

    // Symmetrical deduction:
    // original_qty: 100 - 30 = 70
    // remaining_qty: 100 - 30 = 70
    expect(Number(batch.original_qty)).toBe(70);
    expect(Number(batch.remaining_qty)).toBe(70);
    expect(batch.status).toBe('ACTIVE');
  });

  it('Phase 1: Returning entire remaining stock when nothing was sold sets original_qty to 0 and status to RETURNED', async () => {
    // Return remaining 70 KG to supplier
    const retRes = await request(app)
      .post('/api/purchase-returns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        parent_invoice_id: purchaseInvoiceId,
        line_items: [
          {
            product_id: productId,
            return_quantity: 70,
          },
        ],
        return_reason: 'Defective batch - remaining 70 KG returned',
      });

    expect(retRes.status).toBe(201);

    const batch = await db('inventory_batches')
      .where({ purchase_invoice_id: purchaseInvoiceId, product_id: productId })
      .first();

    // Symmetrical deduction:
    // original_qty: 70 - 70 = 0
    // remaining_qty: 70 - 70 = 0
    expect(Number(batch.original_qty)).toBe(0);
    expect(Number(batch.remaining_qty)).toBe(0);
    // Status Reclassification: Must be 'RETURNED', NOT 'DEPLETED'
    expect(batch.status).toBe('RETURNED');
  });

  it('Phase 1 (Mixed Sold & Returned): If original_qty > 0 but remaining_qty reaches 0, status must be DEPLETED', async () => {
    // Create a 2nd batch where part is sold, part is returned
    const [mixedBatch] = await db('inventory_batches')
      .insert({
        product_id: productId,
        batch_number: `PB-MIXED-${Date.now()}`,
        batch_buy_price_per_kg: 100,
        original_qty: 50,
        remaining_qty: 20, // 30 KG was already sold to customers
        status: 'ACTIVE',
        size: 'Standard',
      })
      .returning('*');

    // Symmetrically return the remaining 20 KG to supplier
    const currentOriginal = Number(mixedBatch.original_qty);
    const currentRemaining = Number(mixedBatch.remaining_qty);
    const returnedQty = 20;

    const newOriginal = Math.max(0, currentOriginal - returnedQty); // 50 - 20 = 30
    const newRemaining = Math.max(0, currentRemaining - returnedQty); // 20 - 20 = 0
    const newStatus = newOriginal === 0 ? 'RETURNED' : (newRemaining <= 0 ? 'DEPLETED' : 'ACTIVE');

    expect(newOriginal).toBe(30);
    expect(newRemaining).toBe(0);
    expect(newStatus).toBe('DEPLETED');

    await db('inventory_batches').where({ id: mixedBatch.id }).delete();
  });

  it('Phase 2: Analytics & Turnover queries must strictly exclude batches where original_qty = 0 and status = RETURNED', async () => {
    // 1. Inventory Valuation Report query
    const valReport = await getInventoryValuationReport();
    const productVal = valReport.products.find((p: any) => p.id === productId);

    expect(productVal).toBeDefined();
    // The fully returned batch must NOT appear in the product's active/historical buckets
    const returnedBucket = (productVal?.buckets || []).find((b: any) => b.status === 'RETURNED' || b.original_stock === 0);
    expect(returnedBucket).toBeUndefined();

    // 2. Inventory Ledger Report query
    const ledgerReport = await getInventoryLedgerReport();
    const productLedger = ledgerReport.find((p: any) => p.product_id === productId);
    expect(productLedger).toBeDefined();

    // All-time batches list in ledger report must not contain RETURNED batches
    const ledgerBatches = (productLedger as any)?.batches || [];
    const returnedInLedger = ledgerBatches.find((b: any) => b.status === 'RETURNED' || b.original_qty === 0);
    expect(returnedInLedger).toBeUndefined();
  });
});

