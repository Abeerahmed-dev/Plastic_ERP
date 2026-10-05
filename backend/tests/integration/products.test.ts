import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
let ownerToken: string;
let createdProductId: string;
let testCategoryId: string;

beforeAll(async () => {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = login.body.data.access_token;
  
  await db('products').whereILike('name', 'Test%').delete();
  await db('categories').whereILike('name', 'TestProdCat%').delete();

  const [cat] = await db('categories').insert({
    name: 'TestProdCat',
    bag_weight_kg: 35.0,
    description: 'Test category for products test'
  }).returning('id');
  testCategoryId = cat.id;
});

afterAll(async () => {
  await db('products').whereILike('name', 'Test%').delete();
  await db('categories').whereILike('name', 'TestProdCat%').delete();
  await db.destroy();
});

describe('POST /api/v1/products', () => {
  it('should create a new product linked to category', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Plastic Bag',
        category_id: testCategoryId,
        cost_price: 10,
        sale_price: 15,
        opening_stock: 100
      });
    
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^PROD-\d{4}$/);
    expect(res.body.data.name).toBe('Test Plastic Bag');
    expect(Number(res.body.data.bag_weight_kg)).toBe(35);
    expect(Number(res.body.data.current_stock)).toBe(100);
    createdProductId = res.body.data.id;
  });

  it('should return 400 for missing category_id', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Invalid',
        cost_price: 10
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

  it('should filter products by category search', async () => {
    const res = await request(app)
      .get('/api/v1/products?category=TestProdCat')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const hasCategory = res.body.data.some((p: any) => p.category === 'TestProdCat');
    expect(hasCategory).toBe(true);
  });
});

describe('GET /api/v1/products/:id', () => {
  it('should return product details with category and stock', async () => {
    const res = await request(app)
      .get(`/api/v1/products/${createdProductId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdProductId);
    expect(res.body.data).toHaveProperty('current_stock');
    expect(Number(res.body.data.bag_weight_kg)).toBe(35);
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
    expect(Number(check.body.data.current_stock)).toBe(100);
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
