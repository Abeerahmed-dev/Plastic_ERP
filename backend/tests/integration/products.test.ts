import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
let ownerToken: string;
let createdProductId: string;
let testUomId: string;

beforeAll(async () => {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = login.body.data.access_token;
  
  await db('products').whereILike('name', 'Test%').delete();
  await db('units_of_measure').whereILike('name', 'TestProdUom%').delete();

  const [uom] = await db('units_of_measure').insert({
    name: 'TestProdUom',
    abbreviation: 'tpu',
    is_active: true
  }).returning('id');
  testUomId = uom.id;
});

afterAll(async () => {
  await db('products').whereILike('name', 'Test%').delete();
  await db('units_of_measure').whereILike('name', 'TestProdUom%').delete();
  await db.destroy();
});

describe('POST /api/v1/products', () => {
  it('should create a new product', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Plastic Bag',
        category: 'Plastic Bag',
        uom_id: testUomId,
        cost_price: 10,
        sale_price: 15,
        opening_stock: 100
      });
    
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^PROD-\d{4}$/);
    expect(res.body.data.name).toBe('Test Plastic Bag');
    expect(Number(res.body.data.current_stock)).toBe(100);
    createdProductId = res.body.data.id;
  });

  it('should return 400 for invalid category', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Invalid',
        category: 'InvalidCat',
        uom_id: testUomId
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/products', () => {
  it('should return paginated products list', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  it('should filter products by category', async () => {
    const res = await request(app)
      .get('/api/v1/products?category=Plastic+Bag')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const hasCategory = res.body.data.some((p: any) => p.category === 'Plastic Bag');
    expect(hasCategory).toBe(true);
  });
});

describe('GET /api/v1/products/:id', () => {
  it('should return product details with uom and stock', async () => {
    const res = await request(app)
      .get(`/api/v1/products/${createdProductId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdProductId);
    expect(res.body.data).toHaveProperty('current_stock');
    expect(res.body.data).toHaveProperty('uom_abbreviation', 'tpu');
  });
});

describe('PUT /api/v1/products/:id', () => {
  it('should update product fields except opening_stock', async () => {
    const res = await request(app)
      .put(`/api/v1/products/${createdProductId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sale_price: 20, opening_stock: 999 });
    
    expect(res.status).toBe(200);
    expect(Number(res.body.data.sale_price)).toBe(20);
    
    const check = await request(app)
      .get(`/api/v1/products/${createdProductId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(Number(check.body.data.current_stock)).toBe(100); // stock unchanged
  });
});

describe('DELETE /api/v1/products/:id', () => {
  it('should soft delete product', async () => {
    const res = await request(app)
      .delete(`/api/v1/products/${createdProductId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
  });
});
