import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
let ownerToken: string;
let cashierToken: string;
let testCategoryId: string;
let productAId: string;
let productBId: string;

beforeAll(async () => {
  // 1. Owner Login
  const ownerLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = ownerLogin.body.data.access_token;

  // 2. Cashier Login
  const cashierLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'cashier@sabirplastic.local', password: 'Cashier@123' });
  cashierToken = cashierLogin.body?.data?.access_token;

  // 3. Cleanup existing test data
  await db('product_exchanges').delete();
  await db('products').whereILike('name', 'TestExchangeProd%').delete();
  await db('categories').whereILike('name', 'TestExchangeCat%').delete();

  // 4. Create Category
  const [cat] = await db('categories')
    .insert({
      name: 'TestExchangeCat',
      bag_weight_kg: 25.0,
      description: 'Test category for exchanges',
    })
    .returning('id');
  testCategoryId = cat.id;

  // 5. Create Product A (200 KG stock)
  const resA = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'TestExchangeProd Abed Gold',
      category_id: testCategoryId,
      size: '8-11',
      cost_price: 100,
      sale_price: 150,
      opening_stock: 200,
    });
  productAId = resA.body.data.id;

  // 6. Create Product B (100 KG stock)
  const resB = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'TestExchangeProd Sheesha',
      category_id: testCategoryId,
      size: '8-11',
      cost_price: 90,
      sale_price: 140,
      opening_stock: 100,
    });
  productBId = resB.body.data.id;
});

afterAll(async () => {
  await db('product_exchanges').delete();
  await db('products').whereILike('name', 'TestExchangeProd%').delete();
  await db('categories').whereILike('name', 'TestExchangeCat%').delete();
  await db.destroy();
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
    let createdExchangeNumber: string;

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
      createdExchangeNumber = res.body.data.exchange_number;

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

      // 4. Verify inventory_batches received a new batch for Product B
      const batchB = await db('inventory_batches')
        .where({ product_id: productBId })
        .whereILike('batch_number', `%${createdExchangeNumber}%`)
        .first();
      expect(batchB).toBeDefined();
      expect(Number(batchB.remaining_qty)).toBe(50);
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

        // Product B: was 150, deducted 20 -> 130
        const prodB = await db('products').where({ id: productBId }).first();
        expect(Number(prodB.total_stock_kg)).toBe(130);

        // Product A: was 150, added 25 -> 175
        const prodA = await db('products').where({ id: productAId }).first();
        expect(Number(prodA.total_stock_kg)).toBe(175);
      }
    });

    it('should list all completed exchanges in history with product details', async () => {
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
      const res = await request(app)
        .get('/api/v1/exchanges')
        .query({ search: createdExchangeNumber })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].exchange_number).toBe(createdExchangeNumber);
    });
  });
});
