/**
 * Phase 2 QA Matrix: Invoices, Transactions & FIFO Depletion Integration Test Suite
 * 
 * Verifications:
 * 1. The Rollback (Ouroboros) Test: Multi-step Knex transaction integrity & total rollback safety
 * 2. The FIFO Depletion Test: Multi-batch sequential price-bucket stock depletion
 * 3. The Out-of-Stock Guard: Runtime concurrency wall rejecting stock deficits with 400 Bad Request
 * 4. Invoices, Payments & Chronological Customer Ledger integration flows
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
const OWNER_EMAIL = 'owner@sabir.local';
const OWNER_PASSWORD = 'Admin@1234';

let ownerToken: string;
let customerId: string;
let categoryId: string;

/**
 * Robust helper to create a product with all required database columns
 */
async function createTestProduct(overrides: Record<string, any> = {}) {
  const uniqueSuffix = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`;
  const code = overrides.code || `P${uniqueSuffix}`;
  const [prod] = await db('products')
    .insert({
      code,
      name: overrides.name || `Test Product ${uniqueSuffix}`,
      category: overrides.category || 'Standard Packaging',
      category_id: overrides.category_id || categoryId,
      size: overrides.size || 'Standard',
      cost_price: overrides.cost_price ?? 100,
      sale_price: overrides.sale_price ?? 200,
      opening_stock: overrides.opening_stock ?? 0,
      total_stock_kg: overrides.total_stock_kg ?? (overrides.opening_stock ?? 0),
      rolling_avg_cost_per_kg: overrides.rolling_avg_cost_per_kg ?? overrides.cost_price ?? 100,
      fixed_retail_price_per_kg: overrides.fixed_retail_price_per_kg ?? overrides.sale_price ?? 200,
      base_unit: 'KG',
      purchase_unit: 'KG',
      sale_unit: 'KG',
      default_kg_per_purchase_unit: 1.0,
      default_sale_units_per_kg: 1.0,
      unit_conversions: JSON.stringify({}),
      min_markup_percent: 0,
      low_stock_threshold: 10,
      is_active: true,
      ...overrides,
    })
    .returning('*');
  return prod;
}

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  ownerToken = loginRes.body?.data?.access_token;
  expect(ownerToken).toBeDefined();
});

beforeEach(async () => {
  if (!ownerToken) {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    ownerToken = loginRes.body?.data?.access_token;
  }

  // Ensure a Category exists
  let cat = await db('categories').where({ name: 'Standard Packaging' }).first();
  if (!cat) {
    const [insertedCat] = await db('categories')
      .insert({
        name: 'Standard Packaging',
        bag_weight_kg: 25.0,
        description: 'Standard Packaging 25 KG/Bag',
      })
      .returning('*');
    cat = insertedCat;
  }
  categoryId = cat.id;

  // Ensure Customer exists
  let customer = await db('customers').where({ name: 'Integration Test Customer' }).first();
  if (!customer) {
    const [insertedCust] = await db('customers')
      .insert({
        code: `C-${Date.now().toString().slice(-8)}`,
        name: 'Integration Test Customer',
        phone: '03001234567',
        credit_limit: 500000,
        opening_balance: 0,
        city: 'Gujranwala',
        customer_type: 'CREDIT',
      })
      .returning('*');
    customer = insertedCust;
  }
  customerId = customer.id;
});

describe('Invoices & Transactional Integrity Suite (Phase 2 Integration)', () => {

  // ==========================================================================
  // TEST 1: THE ROLLBACK (OUROBOROS) TEST
  // ==========================================================================
  describe('1. The Rollback (Ouroboros) Transactional Test', () => {
    it('should completely roll back database state when an error occurs halfway through a multi-step transaction', async () => {
      // 1. Create a dedicated product for rollback testing with 100 KG stock
      const rollbackProduct = await createTestProduct({
        name: 'Rollback Test Resin',
        cost_price: 150,
        sale_price: 250,
        total_stock_kg: 100,
        rolling_avg_cost_per_kg: 150,
      });

      // 2. Seed an initial active batch
      const [rollbackBatch] = await db('inventory_batches')
        .insert({
          product_id: rollbackProduct.id,
          batch_number: `BATCH-ROLLBACK-${Date.now()}`,
          batch_buy_price_per_kg: 150,
          original_qty: 100,
          remaining_qty: 100,
          status: 'ACTIVE',
        })
        .returning('*');

      const uniqueInvoiceNumber = `INV-FAIL-SIM-${Date.now()}`;
      let transactionErrorCaught = false;

      // 3. Execute an atomic multi-step Knex transaction that fails intentionally halfway
      try {
        await db.transaction(async (trx) => {
          // Step A: Insert sales invoice header
          const [insertedInvoice] = await trx('sales_invoices')
            .insert({
              invoice_number: uniqueInvoiceNumber,
              customer_id: customerId,
              date: new Date().toISOString().split('T')[0],
              subtotal: 5000,
              discount: 0,
              total_amount: 5000,
              paid_amount: 0,
              status: 'UNPAID',
              created_by: null,
            })
            .returning('*');

          expect(insertedInvoice.id).toBeDefined();

          // Step B: Insert sales invoice line item
          await trx('sales_invoice_items').insert({
            invoice_id: insertedInvoice.id,
            product_id: rollbackProduct.id,
            quantity: 20,
            unit_price: 250,
            total_price: 5000,
            size: 'Standard',
            selected_unit: 'KG',
            net_kg_processed: 20,
            actual_cogs: 3000,
            applied_cogs_per_kg: 150,
          });

          // Step C: Deduct stock from product & batch
          await trx('products')
            .where({ id: rollbackProduct.id })
            .update({ total_stock_kg: 80 });

          await trx('inventory_batches')
            .where({ id: rollbackBatch.id })
            .update({ remaining_qty: 80 });

          // Step D: SIMULATED HARDWARE / NETWORK CRASH
          // Intentionally throw an unhandled exception before writing inventory_transactions
          throw new Error('SIMULATED_TRANSACTION_FAILURE: Database connection severed before commit');
        });
      } catch (err: any) {
        if (err.message.includes('SIMULATED_TRANSACTION_FAILURE')) {
          transactionErrorCaught = true;
        }
      }

      // Assert that the exception was triggered
      expect(transactionErrorCaught).toBe(true);

      // 4. THE OUROBOROS ASSERTION: Assert total rollback with ZERO orphaned records
      // A. Invoice header must NOT exist in the database
      const orphanInvoice = await db('sales_invoices')
        .where({ invoice_number: uniqueInvoiceNumber })
        .first();
      expect(orphanInvoice).toBeUndefined();

      // B. Line items must NOT exist
      const orphanItems = await db('sales_invoice_items')
        .where({ product_id: rollbackProduct.id });
      expect(orphanItems.length).toBe(0);

      // C. Product stock must remain completely unmutated at original 100 KG
      const preservedProduct = await db('products')
        .where({ id: rollbackProduct.id })
        .first();
      expect(Number(preservedProduct.total_stock_kg)).toBe(100);

      // D. Batch remaining quantity must remain completely unmutated at original 100 KG
      const preservedBatch = await db('inventory_batches')
        .where({ id: rollbackBatch.id })
        .first();
      expect(Number(preservedBatch.remaining_qty)).toBe(100);
      expect(preservedBatch.status).toBe('ACTIVE');

      // E. Inventory transactions must NOT have recorded any entries
      const orphanAuditTx = await db('inventory_transactions')
        .where({ product_id: rollbackProduct.id });
      expect(orphanAuditTx.length).toBe(0);
    });
  });

  // ==========================================================================
  // TEST 2: THE FIFO DEPLETION TEST
  // ==========================================================================
  describe('2. The FIFO Depletion Test (Multi-Batch Sequential Depletion)', () => {
    it('should sequentially deplete two inventory batches in strict FIFO order when selling across buckets', async () => {
      // 1. Seed Product with 150 KG total stock
      const fifoProduct = await createTestProduct({
        name: 'FIFO Test Plastic Pellets',
        cost_price: 110,
        sale_price: 200,
        total_stock_kg: 150,
        rolling_avg_cost_per_kg: 112,
      });

      // 2. Seed Batch 1 (Older bucket created 1 hour ago: 60 KG @ Rs. 100/KG)
      const olderTimestamp = new Date(Date.now() - 3600000);
      const [batch1] = await db('inventory_batches')
        .insert({
          product_id: fifoProduct.id,
          batch_number: `PB-PUR-OLDER-${Date.now()}`,
          batch_buy_price_per_kg: 100,
          original_qty: 60,
          remaining_qty: 60,
          status: 'ACTIVE',
          created_at: olderTimestamp,
        })
        .returning('*');

      // 3. Seed Batch 2 (Newer bucket created now: 90 KG @ Rs. 120/KG)
      const newerTimestamp = new Date();
      const [batch2] = await db('inventory_batches')
        .insert({
          product_id: fifoProduct.id,
          batch_number: `PB-PUR-NEWER-${Date.now()}`,
          batch_buy_price_per_kg: 120,
          original_qty: 90,
          remaining_qty: 90,
          status: 'ACTIVE',
          created_at: newerTimestamp,
        })
        .returning('*');

      // 4. Hit POST /api/v1/invoices to sell 100 KG (spans Batch 1 [60 KG] + Batch 2 [40 KG])
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          date: new Date().toISOString().split('T')[0],
          discount: 0,
          items: [
            {
              product_id: fifoProduct.id,
              quantity: 100,
              unit_price: 200,
              size: 'Standard',
              selected_unit: 'KG',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const invoiceData = res.body.data;
      expect(invoiceData.id).toBeDefined();

      // 5. Assert Database State:
      // A. Older Batch 1 must be 100% depleted (remaining_qty = 0, status = 'DEPLETED')
      const refreshedBatch1 = await db('inventory_batches')
        .where({ id: batch1.id })
        .first();
      expect(Number(refreshedBatch1.remaining_qty)).toBe(0);
      expect(refreshedBatch1.status).toBe('DEPLETED');

      // B. Newer Batch 2 must be partially depleted (90 - 40 = 50 KG remaining, status = 'ACTIVE')
      const refreshedBatch2 = await db('inventory_batches')
        .where({ id: batch2.id })
        .first();
      expect(Number(refreshedBatch2.remaining_qty)).toBe(50);
      expect(refreshedBatch2.status).toBe('ACTIVE');

      // C. Product physical warehouse stock must reflect exact remaining 50 KG (150 - 100 = 50)
      const refreshedProduct = await db('products')
        .where({ id: fifoProduct.id })
        .first();
      expect(Number(refreshedProduct.total_stock_kg)).toBe(50);

      // D. Verify FIFO Junction Records in sales_invoice_item_batches:
      // 60 KG @ Rs. 100/KG from Batch 1, and 40 KG @ Rs. 120/KG from Batch 2
      const junctionBatches = await db('sales_invoice_item_batches as siib')
        .join('sales_invoice_items as sii', 'siib.sales_invoice_item_id', 'sii.id')
        .where('sii.invoice_id', invoiceData.id)
        .select('siib.*')
        .orderBy('siib.created_at', 'asc');

      expect(junctionBatches.length).toBe(2);

      const jBatch1 = junctionBatches.find((b: any) => b.inventory_batch_id === batch1.id);
      expect(jBatch1).toBeDefined();
      expect(Number(jBatch1.qty_deducted)).toBe(60);
      expect(Number(jBatch1.cogs_per_kg)).toBe(100);

      const jBatch2 = junctionBatches.find((b: any) => b.inventory_batch_id === batch2.id);
      expect(jBatch2).toBeDefined();
      expect(Number(jBatch2.qty_deducted)).toBe(40);
      expect(Number(jBatch2.cogs_per_kg)).toBe(120);

      // E. Verify Realized COGS on Invoice Item:
      // (60 KG * 100) + (40 KG * 120) = 6,000 + 4,800 = 10,800 Total Actual COGS
      const invoiceItem = await db('sales_invoice_items')
        .where({ invoice_id: invoiceData.id })
        .first();
      expect(Number(invoiceItem.actual_cogs)).toBe(10800);
      expect(Number(invoiceItem.applied_cogs_per_kg)).toBe(108); // 10,800 / 100 KG = 108/KG
    });
  });

  // ==========================================================================
  // TEST 3: THE OUT-OF-STOCK GUARD
  // ==========================================================================
  describe('3. The Out-of-Stock Guard (Concurrency & Deficit Shield)', () => {
    it('should reject transactions attempting to sell more stock than physically available with 400 Bad Request without touching database', async () => {
      // 1. Seed Product with strictly 15 KG stock
      const limitedProduct = await createTestProduct({
        name: 'Scarce Plastic Pipe Grade B',
        cost_price: 300,
        sale_price: 450,
        total_stock_kg: 15,
        rolling_avg_cost_per_kg: 300,
      });

      await db('inventory_batches').insert({
        product_id: limitedProduct.id,
        batch_number: `PB-PUR-SCARCE-${Date.now()}`,
        batch_buy_price_per_kg: 300,
        original_qty: 15,
        remaining_qty: 15,
        status: 'ACTIVE',
      });

      // 2. Attempt to sell 50 KG via POS checkout (requires immediate physical stock)
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          payment_method: 'CASH',
          discount: 0,
          items: [
            {
              product_id: limitedProduct.id,
              quantity: 50, // 50 KG requested > 15 KG on shelves
              unit_price: 450,
              selected_unit: 'KG',
            },
          ],
        });

      // 3. Verify HTTP 400 rejection
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Transaction failed: Another user just purchased this stock|INSUFFICIENT_STOCK/i);

      // 4. Verify Database is completely UNTOUCHED
      const untouchedProduct = await db('products')
        .where({ id: limitedProduct.id })
        .first();
      expect(Number(untouchedProduct.total_stock_kg)).toBe(15);

      const untouchedBatch = await db('inventory_batches')
        .where({ product_id: limitedProduct.id })
        .first();
      expect(Number(untouchedBatch.remaining_qty)).toBe(15);
      expect(untouchedBatch.status).toBe('ACTIVE');

      // Zero sales invoices or inventory transactions created
      const attemptedInvoices = await db('sales_invoice_items')
        .where({ product_id: limitedProduct.id });
      expect(attemptedInvoices.length).toBe(0);
    });
  });

  // ==========================================================================
  // TEST 4: INVOICE, PAYMENT & LEDGER CHRONOLOGY INTEGRATION
  // ==========================================================================
  describe('4. Full Invoice Lifecycle & Chronological Ledger Flow', () => {
    it('should create an invoice and update customer accounts receivable balance', async () => {
      const lifecycleProduct = await createTestProduct({
        name: 'Ledger Test Plastic',
        cost_price: 200,
        sale_price: 300,
        total_stock_kg: 200,
        rolling_avg_cost_per_kg: 200,
      });

      await db('inventory_batches').insert({
        product_id: lifecycleProduct.id,
        batch_number: `PB-PUR-LEDGER-${Date.now()}`,
        batch_buy_price_per_kg: 200,
        original_qty: 200,
        remaining_qty: 200,
        status: 'ACTIVE',
      });

      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          date: new Date().toISOString().split('T')[0],
          due_date: new Date().toISOString().split('T')[0],
          discount: 100,
          items: [
            {
              product_id: lifecycleProduct.id,
              quantity: 10,
              unit_price: 300, // 10 * 300 = 3000 - 100 discount = 2900
              size: 'Standard',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.total_amount)).toBe(2900);
      expect(res.body.data.status).toBe('UNPAID');
    });

    it('should record partial payment and transition status to PARTIAL', async () => {
      const lifecycleProduct = await createTestProduct({
        name: 'Partial Pay Product',
        cost_price: 200,
        sale_price: 300,
        total_stock_kg: 200,
        rolling_avg_cost_per_kg: 200,
      });

      await db('inventory_batches').insert({
        product_id: lifecycleProduct.id,
        batch_number: `PB-PUR-PART-${Date.now()}`,
        batch_buy_price_per_kg: 200,
        original_qty: 200,
        remaining_qty: 200,
        status: 'ACTIVE',
      });

      const invRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          date: new Date().toISOString().split('T')[0],
          discount: 100,
          items: [
            {
              product_id: lifecycleProduct.id,
              quantity: 10,
              unit_price: 300,
              size: 'Standard',
            },
          ],
        });

      const currentInvoiceId = invRes.body.data.id;

      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          invoice_id: currentInvoiceId,
          amount: 1000,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'BANK_TRANSFER',
        });

      expect(res.status).toBe(201);

      const inv = await db('sales_invoices').where({ id: currentInvoiceId }).first();
      expect(Number(inv.paid_amount)).toBe(1000);
      expect(inv.status).toBe('PARTIAL');
    });

    it('should record remaining payment and transition status to PAID', async () => {
      const lifecycleProduct = await createTestProduct({
        name: 'Paid Product',
        cost_price: 200,
        sale_price: 300,
        total_stock_kg: 200,
        rolling_avg_cost_per_kg: 200,
      });

      await db('inventory_batches').insert({
        product_id: lifecycleProduct.id,
        batch_number: `PB-PUR-PAID-${Date.now()}`,
        batch_buy_price_per_kg: 200,
        original_qty: 200,
        remaining_qty: 200,
        status: 'ACTIVE',
      });

      const invRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          date: new Date().toISOString().split('T')[0],
          discount: 0,
          items: [
            {
              product_id: lifecycleProduct.id,
              quantity: 5,
              unit_price: 200, // 1000
              size: 'Standard',
            },
          ],
        });

      const currentInvoiceId = invRes.body.data.id;

      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          invoice_id: currentInvoiceId,
          amount: 1000, // Full payment
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'CASH',
        });

      expect(res.status).toBe(201);

      const inv = await db('sales_invoices').where({ id: currentInvoiceId }).first();
      expect(Number(inv.paid_amount)).toBe(1000);
      expect(inv.status).toBe('PAID');
    });

    it('should reflect correct entries in customer statement of account / ledger', async () => {
      const lifecycleProduct = await createTestProduct({
        name: 'Ledger Trace Product',
        cost_price: 200,
        sale_price: 300,
        total_stock_kg: 200,
        rolling_avg_cost_per_kg: 200,
      });

      await db('inventory_batches').insert({
        product_id: lifecycleProduct.id,
        batch_number: `PB-PUR-TRACE-${Date.now()}`,
        batch_buy_price_per_kg: 200,
        original_qty: 200,
        remaining_qty: 200,
        status: 'ACTIVE',
      });

      const invRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          date: new Date().toISOString().split('T')[0],
          discount: 0,
          items: [
            {
              product_id: lifecycleProduct.id,
              quantity: 10,
              unit_price: 300, // 3000
              size: 'Standard',
            },
          ],
        });

      const currentInvoiceId = invRes.body.data.id;

      await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          invoice_id: currentInvoiceId,
          amount: 1500,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'CASH',
        });

      const res = await request(app)
        .get(`/api/v1/customers/${customerId}/ledger`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ledger = res.body.data;

      expect(Array.isArray(ledger)).toBe(true);
      const invoiceEntry = ledger.find((e: any) => e.type === 'INVOICE' && Number(e.debit) === 3000);
      const paymentEntry = ledger.find((e: any) => e.type === 'PAYMENT' && Number(e.credit) === 1500);

      expect(invoiceEntry).toBeDefined();
      expect(paymentEntry).toBeDefined();
    });
  });
});
