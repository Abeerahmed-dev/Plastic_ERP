/**
 * Phase 3 QA Matrix: Concurrency & Race Condition Validation Integration Test Suite
 * 
 * Verifications:
 * - Test 6: Database Concurrency & Row-Level Lock (FOR UPDATE) Wall
 * - Simulates two cashiers firing identical POS checkout requests at the exact same millisecond via Promise.all()
 * - Guarantees that exactly one transaction succeeds (201 Created)
 * - Guarantees that the concurrent transaction is blocked by FOR UPDATE and rejected with 400 Bad Request (Insufficient Stock)
 * - Guarantees that physical stock in PostgreSQL does not drop below 0 KG (no negative inventory race condition)
 */

import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();

let authToken: string;
let categoryId: string;
let customerId: string;

/**
 * Helper to ensure a Category exists
 */
async function ensureCategory(): Promise<string> {
  let cat = await db('categories').where({ name: 'Concurrency Test Packaging' }).first();
  if (!cat) {
    const [inserted] = await db('categories')
      .insert({
        name: 'Concurrency Test Packaging',
        bag_weight_kg: 25.0,
        description: 'Category for concurrency and stress testing',
      })
      .returning('*');
    cat = inserted;
  }
  return cat.id;
}

/**
 * Helper to ensure a Customer exists
 */
async function ensureCustomer(): Promise<string> {
  let cust = await db('customers').where({ phone: '03009998877' }).first();
  if (!cust) {
    const [inserted] = await db('customers')
      .insert({
        code: `CUST-RACE-${Date.now().toString().slice(-6)}`,
        name: 'Concurrency Test Customer',
        phone: '03009998877',
        customer_type: 'CASH',
        credit_limit: 100000,
        opening_balance: 0,
        city: 'Gujranwala',
      })
      .returning('*');
    cust = inserted;
  }
  return cust.id;
}

/**
 * Helper to create a product with exact physical stock and an active inventory batch
 */
async function createProductWithStock(totalKg: number, unitCost = 100, salePrice = 200) {
  const uniqueCode = `P-RACE-${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
  const [product] = await db('products')
    .insert({
      code: uniqueCode,
      name: `Race Condition Test Resin ${uniqueCode}`,
      category: 'Concurrency Test Packaging',
      category_id: categoryId,
      size: 'Standard',
      cost_price: unitCost,
      sale_price: salePrice,
      opening_stock: totalKg,
      total_stock_kg: totalKg,
      rolling_avg_cost_per_kg: unitCost,
      fixed_retail_price_per_kg: salePrice,
      base_unit: 'KG',
      purchase_unit: 'KG',
      sale_unit: 'KG',
      default_kg_per_purchase_unit: 1.0,
      default_sale_units_per_kg: 1.0,
      unit_conversions: JSON.stringify({}),
      min_markup_percent: 0,
      low_stock_threshold: 5,
      is_active: true,
    })
    .returning('*');

  // Insert corresponding inventory batch for FIFO depletion
  await db('inventory_batches').insert({
    product_id: product.id,
    batch_number: `BATCH-RACE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    batch_buy_price_per_kg: unitCost,
    original_qty: totalKg,
    remaining_qty: totalKg,
    status: 'ACTIVE',
  });

  return product;
}

/**
 * Helper to obtain a valid cashier or owner auth token
 */
async function getAuthToken(): Promise<string> {
  // Try cashier login first to simulate cashier checkout
  const cashierLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'cashier@sabirplastic.local', password: 'Cashier@123' });

  if (cashierLogin.status === 200 && cashierLogin.body?.data?.access_token) {
    return cashierLogin.body.data.access_token;
  }

  // Ensure cashier user in DB if missing
  const cashierRole = await db('roles').where({ name: 'Cashier' }).first();
  if (cashierRole) {
    const existingCashier = await db('users').where({ email: 'cashier@sabirplastic.local' }).first();
    if (!existingCashier) {
      const passwordHash = await bcrypt.hash('Cashier@123', 10);
      await db('users').insert({
        name: 'Cashier User',
        email: 'cashier@sabirplastic.local',
        password_hash: passwordHash,
        role_id: cashierRole.id,
        is_active: true,
      });

      const retryCashier = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'cashier@sabirplastic.local', password: 'Cashier@123' });
      if (retryCashier.body?.data?.access_token) {
        return retryCashier.body.data.access_token;
      }
    }
  }

  // Fallback to Owner login
  const ownerLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });

  return ownerLogin.body?.data?.access_token;
}

beforeAll(async () => {
  authToken = await getAuthToken();
});

beforeEach(async () => {
  if (!authToken) {
    authToken = await getAuthToken();
  }
  categoryId = await ensureCategory();
  customerId = await ensureCustomer();
});

describe('Phase 3 Integration: Concurrency & Race Condition Validation', () => {

  // ==========================================================================
  // TEST 6: CONCURRENCY & RACE CONDITION VALIDATION
  // ==========================================================================
  describe('Test 6: Database Concurrency & Row-Level Lock (FOR UPDATE) Wall', () => {

    it('should allow exactly one checkout to succeed and reject the other when two cashiers hit Checkout simultaneously for full stock (50 KG)', async () => {
      // 1. Seed the test database with a product having exactly 50 KG of physical stock
      const product = await createProductWithStock(50, 100, 200);

      // Verify initial baseline state
      const initialProduct = await db('products').where({ id: product.id }).first();
      expect(Number(initialProduct.total_stock_kg)).toBe(50);

      const initialBatch = await db('inventory_batches').where({ product_id: product.id }).first();
      expect(Number(initialBatch.remaining_qty)).toBe(50);
      expect(initialBatch.status).toBe('ACTIVE');

      // 2. Craft a POST /api/v1/pos/checkout request trying to buy exactly 50 KG
      const checkoutPayload = {
        customer_id: customerId,
        payment_method: 'CASH',
        discount: 0,
        amount_paid: 50 * 200, // 10,000 Rs
        items: [
          {
            product_id: product.id,
            quantity: 50,
            unit_price: 200,
            selected_unit: 'KG',
          },
        ],
      };

      // 3. Use Promise.all() to fire two identical checkout requests simultaneously
      // to simulate two cashiers hitting "Checkout" at the exact same millisecond
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/pos/checkout')
          .set('Authorization', `Bearer ${authToken}`)
          .send(checkoutPayload),
        request(app)
          .post('/api/v1/pos/checkout')
          .set('Authorization', `Bearer ${authToken}`)
          .send(checkoutPayload),
      ]);

      // 4. Assertions:
      // A. Assert that exactly one request succeeds (201 Created)
      const successResponse = [res1, res2].find((r) => r.status === 201);
      const failedResponse = [res1, res2].find((r) => r.status === 400);

      expect(successResponse).toBeDefined();
      expect(failedResponse).toBeDefined();
      expect([res1.status, res2.status].sort()).toEqual([201, 400]);

      // Verify the successful response payload
      expect(successResponse!.body.success).toBe(true);
      expect(successResponse!.body.data?.invoice_number).toMatch(/^POS-/);
      expect(Number(successResponse!.body.data?.total_amount)).toBe(10000);

      // B. Assert that exactly one request is blocked by the database Row-Level Lock (FOR UPDATE)
      // and fails (400 Bad Request or Insufficient Stock)
      expect(failedResponse!.status).toBe(400);
      expect(failedResponse!.body.success).toBe(false);
      expect(
        failedResponse!.body.error || failedResponse!.body.message
      ).toMatch(/Transaction failed: Another user just purchased this stock|INSUFFICIENT_STOCK/i);

      // C. Assert the final physical stock in the database is exactly 0 KG (proving it did not drop to -50 KG)
      const finalProduct = await db('products').where({ id: product.id }).first();
      expect(Number(finalProduct.total_stock_kg)).toBe(0);

      const finalBatches = await db('inventory_batches').where({ product_id: product.id });
      const totalRemainingInBatches = finalBatches.reduce(
        (sum: number, b: any) => sum + Number(b.remaining_qty),
        0
      );
      expect(totalRemainingInBatches).toBe(0);

      // Verify batch status is marked DEPLETED
      expect(finalBatches[0].status).toBe('DEPLETED');

      // Verify only exactly one sales invoice was committed for this product
      const invoiceItems = await db('sales_invoice_items').where({ product_id: product.id });
      expect(invoiceItems.length).toBe(1);
      expect(Number(invoiceItems[0].quantity)).toBe(50);
    });

    it('should reject second concurrent request when stock is partially depleted and remaining is insufficient', async () => {
      // Seed with 50 KG stock
      const product = await createProductWithStock(50, 100, 200);

      // Both try to buy 35 KG simultaneously (total 70 KG > 50 KG)
      const checkoutPayload = {
        customer_id: customerId,
        payment_method: 'CASH',
        discount: 0,
        amount_paid: 35 * 200,
        items: [
          {
            product_id: product.id,
            quantity: 35,
            unit_price: 200,
            selected_unit: 'KG',
          },
        ],
      };

      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/pos/checkout')
          .set('Authorization', `Bearer ${authToken}`)
          .send(checkoutPayload),
        request(app)
          .post('/api/v1/pos/checkout')
          .set('Authorization', `Bearer ${authToken}`)
          .send(checkoutPayload),
      ]);

      expect([resA.status, resB.status].sort()).toEqual([201, 400]);

      // Stock must be exactly 50 - 35 = 15 KG (never negative, and not depleted by second call)
      const finalProduct = await db('products').where({ id: product.id }).first();
      expect(Number(finalProduct.total_stock_kg)).toBe(15);

      const activeBatch = await db('inventory_batches').where({ product_id: product.id }).first();
      expect(Number(activeBatch.remaining_qty)).toBe(15);
      expect(activeBatch.status).toBe('ACTIVE');
    });

  });
});

