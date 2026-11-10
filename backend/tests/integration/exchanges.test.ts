import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
let ownerToken: string;
let cashierToken: string;
let testCategoryId: string;
let productAId: string;
let productBId: string;

async function setupBasicProducts() {
  // Ensure category
  let cat = await db('categories').where({ name: 'TestExchangeCat' }).first();
  if (!cat) {
    const [c] = await db('categories')
      .insert({
        name: 'TestExchangeCat',
        bag_weight_kg: 25.0,
        description: 'Test category for exchanges',
      })
      .returning('*');
    cat = c;
  }
  testCategoryId = cat.id;

  // Product A (200 KG stock)
  let prodA = await db('products').where({ name: 'TestExchangeProd Abed Gold' }).first();
  if (!prodA) {
    const codeA = `PA${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
    const [pA] = await db('products')
      .insert({
        code: codeA,
        name: 'TestExchangeProd Abed Gold',
        category: 'TestExchangeCat',
        category_id: testCategoryId,
        size: '8-11',
        cost_price: 100,
        sale_price: 150,
        opening_stock: 200,
        total_stock_kg: 200,
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
    prodA = pA;

    await db('inventory_batches').insert({
      product_id: prodA.id,
      batch_number: `PB-INIT-A-${Date.now()}`,
      batch_buy_price_per_kg: 100,
      original_qty: 200,
      remaining_qty: 200,
      status: 'ACTIVE',
      size: '8-11',
    });
  }
  productAId = prodA.id;

  // Product B (100 KG stock)
  let prodB = await db('products').where({ name: 'TestExchangeProd Sheesha' }).first();
  if (!prodB) {
    const codeB = `PB${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
    const [pB] = await db('products')
      .insert({
        code: codeB,
        name: 'TestExchangeProd Sheesha',
        category: 'TestExchangeCat',
        category_id: testCategoryId,
        size: '8-11',
        cost_price: 90,
        sale_price: 140,
        opening_stock: 100,
        total_stock_kg: 100,
        rolling_avg_cost_per_kg: 90,
        base_unit: 'KG',
        purchase_unit: 'KG',
        sale_unit: 'KG',
        default_kg_per_purchase_unit: 1.0,
        default_sale_units_per_kg: 1.0,
        unit_conversions: JSON.stringify({}),
        is_active: true,
      })
      .returning('*');
    prodB = pB;

    await db('inventory_batches').insert({
      product_id: prodB.id,
      batch_number: `PB-INIT-B-${Date.now()}`,
      batch_buy_price_per_kg: 90,
      original_qty: 100,
      remaining_qty: 100,
      status: 'ACTIVE',
      size: '8-11',
    });
  }
  productBId = prodB.id;
}

beforeAll(async () => {
  // 1. Owner Login
  const ownerLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = ownerLogin.body?.data?.access_token;

  // 2. Cashier Login
  const cashierLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'cashier@sabirplastic.local', password: 'Cashier@123' });
  cashierToken = cashierLogin.body?.data?.access_token;
});

beforeEach(async () => {
  if (!ownerToken) {
    const ownerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
    ownerToken = ownerLogin.body?.data?.access_token;
  }
  await setupBasicProducts();
});

describe('Product-to-Product Exchange Module', () => {
  describe('Authorization Checks', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/exchanges');
      expect(res.status).toBe(401);
    });

    it('should allow Owner to view exchanges', async () => {
      const res = await request(app)
        .get('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should allow Cashier to view exchanges', async () => {
      if (cashierToken) {
        const res = await request(app)
          .get('/api/v1/exchanges')
          .set('Authorization', `Bearer ${cashierToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });
  });

  describe('Validation & Error Handling', () => {
    it('should return 400 if given_product_id and received_product_id are the same', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          given_product_id: productAId,
          given_quantity: 10,
          received_product_id: productAId,
          received_quantity: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if quantity is zero or negative', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          given_product_id: productAId,
          given_quantity: 0,
          received_product_id: productBId,
          received_quantity: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when attempting to give more than available stock', async () => {
      // Product A has 200 KG; attempting to give 500 KG must fail
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          given_product_id: productAId,
          given_quantity: 500,
          received_product_id: productBId,
          received_quantity: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      // Verify Product A stock is intact (rollback)
      const prodA = await db('products').where({ id: productAId }).first();
      expect(Number(prodA.total_stock_kg)).toBe(200);

      // Verify Product B stock is intact (rollback)
      const prodB = await db('products').where({ id: productBId }).first();
      expect(Number(prodB.total_stock_kg)).toBe(100);
    });
  });

  describe('Successful Exchange & Inventory Update', () => {
    it('should successfully execute exchange of 50 KG Product A for 50 KG Product B', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          given_product_id: productAId,
          given_quantity: 50,
          received_product_id: productBId,
          received_quantity: 50,
          notes: 'Test Exchange: 50kg Abed Gold for 50kg Sheesha',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exchange_number).toMatch(/^EXCH-\d{5}$/);
      expect(Number(res.body.data.given_quantity)).toBe(50);
      expect(Number(res.body.data.received_quantity)).toBe(50);
      expect(res.body.data.status).toBe('COMPLETED');

      // 1. Verify Product A stock deducted: 200 -> 150
      const prodA = await db('products').where({ id: productAId }).first();
      expect(Number(prodA.total_stock_kg)).toBe(150);

      // 2. Verify Product B stock increased: 100 -> 150
      const prodB = await db('products').where({ id: productBId }).first();
      expect(Number(prodB.total_stock_kg)).toBe(150);

      // 3. Verify inventory_transactions recorded for both products
      const txA = await db('inventory_transactions')
        .where({ product_id: productAId, transaction_type: 'ADJUSTMENT' })
        .first();
      expect(txA).toBeDefined();
      expect(Number(txA.quantity_kg)).toBe(50);

      const txB = await db('inventory_transactions')
        .where({ product_id: productBId, transaction_type: 'ADJUSTMENT' })
        .first();
      expect(txB).toBeDefined();
      expect(Number(txB.quantity_kg)).toBe(50);

      // 4. Verify new PB-EXCH- batch minted for incoming product with mathematically transferred unit cost (NOT Rs. 0.00!)
      const batchExch = await db('inventory_batches')
        .where({ product_id: productBId })
        .whereILike('batch_number', '%EXCH%')
        .first();
      expect(batchExch).toBeDefined();
      expect(batchExch.batch_number).toMatch(/^PB-EXCH-/);
      expect(Number(batchExch.original_qty)).toBe(50);
      expect(Number(batchExch.remaining_qty)).toBe(50);
      expect(Number(batchExch.batch_buy_price_per_kg)).toBe(100); // 50 KG * Rs. 100 / 50 KG = Rs. 100 (NEVER Rs. 0.00!)
      expect(batchExch.status).toBe('ACTIVE');
    });

    it('should allow Cashier role to execute an exchange independently', async () => {
      if (cashierToken) {
        // Exchange 20 KG of Product B for 25 KG of Product A by Cashier
        const res = await request(app)
          .post('/api/v1/exchanges')
          .set('Authorization', `Bearer ${cashierToken}`)
          .send({
            given_product_id: productBId,
            given_quantity: 20,
            received_product_id: productAId,
            received_quantity: 25,
            notes: 'Cashier swap transaction',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);

        // Product B: was 100, deducted 20 -> 80
        const prodB = await db('products').where({ id: productBId }).first();
        expect(Number(prodB.total_stock_kg)).toBe(80);

        // Product A: was 200, added 25 -> 225
        const prodA = await db('products').where({ id: productAId }).first();
        expect(Number(prodA.total_stock_kg)).toBe(225);
      }
    });

    it('should list all completed exchanges in history with product details', async () => {
      const exchRes = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          given_product_id: productAId,
          given_quantity: 50,
          received_product_id: productBId,
          received_quantity: 50,
          notes: 'Test Exchange: 50kg Abed Gold for 50kg Sheesha',
        });
      const createdExchangeNumber = exchRes.body.data.exchange_number;

      const res = await request(app)
        .get('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const first = res.body.data.find(
        (e: any) => e.exchange_number === createdExchangeNumber,
      );
      expect(first).toBeDefined();
      expect(first.given_product_name).toContain('Abed Gold');
      expect(first.received_product_name).toContain('Sheesha');
      expect(first.created_by_name).toBeDefined();
    });

    it('should filter exchanges by search query', async () => {
      const exchRes = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          given_product_id: productAId,
          given_quantity: 50,
          received_product_id: productBId,
          received_quantity: 50,
          notes: 'Test Exchange: 50kg Abed Gold for 50kg Sheesha',
        });
      const createdExchangeNumber = exchRes.body.data.exchange_number;

      const res = await request(app)
        .get('/api/v1/exchanges')
        .query({ search: createdExchangeNumber })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].exchange_number).toBe(createdExchangeNumber);
    });

    it('should mathematically transfer total asset value into newly minted incoming batch (e.g. 100 KG @ Rs. 150 -> 50 KG @ Rs. 300)', async () => {
      // 1. Create Outgoing Product X with 100 KG stock @ Rs. 150/KG (Total Value = Rs. 15,000)
      const resX = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'TestCostTransfer Out X ' + Date.now(),
          category_id: testCategoryId,
          size: 'Standard',
          cost_price: 150,
          sale_price: 250,
          opening_stock: 100,
        });
      expect(resX.status).toBe(201);
      const prodXId = resX.body.data.id;

      // 2. Create Incoming Product Y with 0 initial stock
      const resY = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'TestCostTransfer In Y ' + Date.now(),
          category_id: testCategoryId,
          size: 'Standard',
          cost_price: 0,
          sale_price: 350,
          opening_stock: 0,
        });
      expect(resY.status).toBe(201);
      const prodYId = resY.body.data.id;

      // 3. Execute Standalone Exchange: 100 KG of Product X for 50 KG of Product Y
      const exchRes = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          given_product_id: prodXId,
          given_quantity: 100,
          received_product_id: prodYId,
          received_quantity: 50,
          notes: 'Asset Value Transfer: 100kg @ 150 -> 50kg @ 300',
        });

      expect(exchRes.status).toBe(201);
      expect(exchRes.body.success).toBe(true);
      expect(Number(exchRes.body.data.given_unit_cost)).toBe(150);
      expect(Number(exchRes.body.data.received_unit_cost)).toBe(300); // 15,000 / 50 = Rs. 300/KG!

      // 4. Verify newly minted batch on Product Y with PB-EXCH- prefix
      const mintedBatch = await db('inventory_batches')
        .where({ product_id: prodYId })
        .first();

      expect(mintedBatch).toBeDefined();
      expect(mintedBatch.batch_number).toMatch(/^PB-EXCH-/);
      expect(Number(mintedBatch.original_qty)).toBe(50);
      expect(Number(mintedBatch.remaining_qty)).toBe(50);
      expect(Number(mintedBatch.batch_buy_price_per_kg)).toBe(300); // LOCKED Rs. 300.00 (NOT Rs. 0.00!)
      expect(mintedBatch.status).toBe('ACTIVE');

      // 5. Verify physical stocks
      const prodX = await db('products').where({ id: prodXId }).first();
      expect(Number(prodX.total_stock_kg)).toBe(0); // 100 - 100 = 0

      const prodY = await db('products').where({ id: prodYId }).first();
      expect(Number(prodY.total_stock_kg)).toBe(50); // 0 + 50 = 50

      // 6. Verify inventory transaction ledger balances exactly
      const txList = await db('inventory_transactions')
        .whereIn('product_id', [prodXId, prodYId])
        .orderBy('created_at', 'asc');

      const txOut = txList.find((t: any) => t.product_id === prodXId);
      const txIn = txList.find((t: any) => t.product_id === prodYId);

      expect(Number(txOut.total_asset_value)).toBe(15000); // Outflow: Rs. 15,000
      expect(Number(txIn.total_asset_value)).toBe(15000);  // Inflow: Rs. 15,000
      expect(Number(txOut.total_asset_value)).toBe(Number(txIn.total_asset_value)); // Perfect balance!
    });
  });

  describe('Invoice-Based Product Exchange: Atomic Return + Re-Sale Architecture', () => {
    let testCustomerId: string;
    let invProductAId: string;
    let invProductBId: string;
    let testInvoiceId: string;
    let testInvoiceItemId: string;

    async function setupInvoiceExchange() {
      // 1. Create a customer
      const [cust] = await db('customers')
        .insert({
          code: `C${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`,
          name: 'Test Exchange Customer ' + Date.now(),
          phone: '03001234567',
          credit_limit: 500000,
          opening_balance: 0,
          city: 'Gujranwala',
          customer_type: 'CREDIT',
        })
        .returning('*');
      testCustomerId = cust.id;

      // 2. Create Product A with 100 KG stock
      const codeA = `PA${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
      const [prodA] = await db('products')
        .insert({
          code: codeA,
          name: 'TestExchangeProd Alpha ' + Date.now(),
          category: 'TestExchangeCat',
          category_id: testCategoryId,
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
      invProductAId = prodA.id;

      await db('inventory_batches').insert({
        product_id: invProductAId,
        batch_number: `PB-PUR-A-${Date.now()}`,
        batch_buy_price_per_kg: 100,
        original_qty: 100,
        remaining_qty: 100,
        status: 'ACTIVE',
      });

      // 3. Create Product B with 100 KG stock @ Rs. 120/kg
      const codeB = `PB${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
      const [prodB] = await db('products')
        .insert({
          code: codeB,
          name: 'TestExchangeProd Beta ' + Date.now(),
          category: 'TestExchangeCat',
          category_id: testCategoryId,
          size: 'Standard',
          cost_price: 120,
          sale_price: 160,
          opening_stock: 100,
          total_stock_kg: 100,
          rolling_avg_cost_per_kg: 120,
          base_unit: 'KG',
          purchase_unit: 'KG',
          sale_unit: 'KG',
          default_kg_per_purchase_unit: 1.0,
          default_sale_units_per_kg: 1.0,
          unit_conversions: JSON.stringify({}),
          is_active: true,
        })
        .returning('*');
      invProductBId = prodB.id;

      await db('inventory_batches').insert({
        product_id: invProductBId,
        batch_number: `PB-PUR-B-${Date.now()}`,
        batch_buy_price_per_kg: 120,
        original_qty: 100,
        remaining_qty: 100,
        status: 'ACTIVE',
      });

      // 4. Create invoice for 100 KG of Product A @ Rs. 200 = Rs. 20,000, paid Rs. 20,000
      const invRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: testCustomerId,
          date: new Date().toISOString().split('T')[0],
          paid_amount: 20000,
          discount: 0,
          items: [
            {
              product_id: invProductAId,
              quantity: 100,
              unit_price: 200,
              size: 'Standard',
              selected_unit: 'KG',
            },
          ],
        });

      testInvoiceId = invRes.body.data.id;
      const itemRow = await db('sales_invoice_items')
        .where({ invoice_id: testInvoiceId })
        .first();
      testInvoiceItemId = itemRow.id;

      // Fully pay the invoice (Rs. 20,000)
      await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: testCustomerId,
          invoice_id: testInvoiceId,
          amount: 20000,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'CASH',
        });
    }

    it('should execute exchange: 50 KG return of Prod A + 50 KG FIFO outflow of Prod B with non-zero COGS and True Net Math surplus to WALLET_ADVANCE', async () => {
      await setupInvoiceExchange();

      // Exchange 50 KG of Product A for 50 KG of Product B @ Rs. 160
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sales_invoice_item_id: testInvoiceItemId,
          returned_quantity: 50,
          new_product_id: invProductBId,
          new_quantity: 50,
          new_unit_price: 160,
          size: 'Standard',
          selected_unit: 'KG',
          notes: 'Customer exchange: 50kg Prod A for 50kg Prod B',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Phase 1 assertions: Proportional Return
      const updatedOriginalItem = await db('sales_invoice_items')
        .where({ id: testInvoiceItemId })
        .first();

      expect(Number(updatedOriginalItem.quantity)).toBe(50); // 100 - 50 = 50 KG
      expect(Number(updatedOriginalItem.total_price)).toBe(10000); // 50 * 200 = 10,000
      expect(Number(updatedOriginalItem.actual_cogs)).toBe(5000); // 50% of 10,000 = 5,000

      // Physical stock of Product A restored
      const prodA = await db('products').where({ id: invProductAId }).first();
      expect(Number(prodA.total_stock_kg)).toBe(50);

      // Batch stock of Product A restored
      const batchA = await db('inventory_batches').where({ product_id: invProductAId }).first();
      expect(Number(batchA.remaining_qty)).toBe(50);
      expect(batchA.status).toBe('ACTIVE');

      // Phase 2 assertions: FIFO Outflow
      const newInvoiceItem = await db('sales_invoice_items')
        .where({ invoice_id: testInvoiceId, product_id: invProductBId })
        .first();

      expect(newInvoiceItem).toBeDefined();
      expect(Number(newInvoiceItem.quantity)).toBe(50);
      expect(Number(newInvoiceItem.unit_price)).toBe(160);
      expect(Number(newInvoiceItem.total_price)).toBe(8000); // 50 * 160 = 8,000

      // Locked actual COGS: 50 * 120 = 6,000 (NEVER Rs. 0 COGS!)
      expect(Number(newInvoiceItem.actual_cogs)).toBe(6000);
      expect(Number(newInvoiceItem.applied_cogs_per_kg)).toBe(120);

      // Product B physical stock depleted
      const prodB = await db('products').where({ id: invProductBId }).first();
      expect(Number(prodB.total_stock_kg)).toBe(50); // was 100, depleted 50

      // Product B batch depleted
      const batchB = await db('inventory_batches').where({ product_id: invProductBId }).first();
      expect(Number(batchB.remaining_qty)).toBe(50);

      // Phase 3 assertions: Total Recalculation & True Net Math
      const updatedInvoice = await db('sales_invoices').where({ id: testInvoiceId }).first();
      // Total amount: 10,000 (Prod A remaining) + 8,000 (Prod B new) = 18,000
      expect(Number(updatedInvoice.total_amount)).toBe(18000);
      // Customer had paid 20,000 -> invoice paid_amount becomes 18,000, surplus is 2,000
      expect(Number(updatedInvoice.paid_amount)).toBe(18000);
      expect(updatedInvoice.status).toBe('PAID');

      // True Net Math check: computeCustomerNetBalance
      const { computeCustomerNetBalance } = await import('../../src/modules/customers/customers.repository');
      const netBal = await computeCustomerNetBalance(testCustomerId);
      // total_billed = 18,000, total_paid = 20,000 -> advance_credit = 2,000!
      expect(netBal.advance_credit).toBe(2000);
      expect(netBal.outstanding_balance).toBe(0);
    });

    it('should handle exchange via /api/v1/invoices/:id/exchange convenience endpoint', async () => {
      await setupInvoiceExchange();

      // Exchange 70 KG of Product A for 70 KG of Product B (leaving 30 KG of Product A)
      const res = await request(app)
        .post(`/api/v1/invoices/${testInvoiceId}/exchange`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sales_invoice_item_id: testInvoiceItemId,
          returned_quantity: 70,
          new_product_id: invProductBId,
          new_quantity: 70,
          new_unit_price: 160,
          size: 'Standard',
          selected_unit: 'KG',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const updatedOriginalItem = await db('sales_invoice_items')
        .where({ id: testInvoiceItemId })
        .first();

      // Original item: was 100 KG, returned 70 -> 30 KG remaining
      expect(Number(updatedOriginalItem.quantity)).toBe(30);
      expect(Number(updatedOriginalItem.total_price)).toBe(6000); // 30 * 200 = 6,000
      expect(Number(updatedOriginalItem.actual_cogs)).toBe(3000); // 3,000 remaining COGS
    });

    it('should enforce Out-of-Stock Guard when active stock is insufficient and allow_backorder is false', async () => {
      await setupInvoiceExchange();

      // Attempt to exchange 10 KG of Product A for 500 KG of Product B (which only has 100 KG remaining)
      const res = await request(app)
        .post(`/api/v1/invoices/${testInvoiceId}/exchange`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sales_invoice_item_id: testInvoiceItemId,
          returned_quantity: 10,
          new_product_id: invProductBId,
          new_quantity: 500, // Excessive: exceeds active batch stock
          new_unit_price: 160,
          size: 'Standard',
          selected_unit: 'KG',
          allow_backorder: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toMatch(/OUT_OF_STOCK|Insufficient|Another user just purchased this stock/i);

      // Verify that no zero-cost or corrupted batches were minted in the database
      const zeroCostBatches = await db('inventory_batches')
        .where({ product_id: invProductBId })
        .where('batch_buy_price_per_kg', '<=', 0);
      expect(zeroCostBatches.length).toBe(0);
    });
  });
});
