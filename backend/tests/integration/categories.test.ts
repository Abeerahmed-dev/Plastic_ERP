import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
let ownerToken: string;
let createdCategoryId: string;

beforeAll(async () => {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = login.body.data.access_token;
  
  await db('categories').whereILike('name', 'Test%').delete();
});

afterAll(async () => {
  await db('categories').whereILike('name', 'Test%').delete();
  await db.destroy();
});

describe('POST /api/v1/categories', () => {
  it('should create a new category with bag_weight_kg', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test 40s Poly', bag_weight_kg: 40.0, description: 'Test 40 KG Category' });
    
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test 40s Poly');
    expect(Number(res.body.data.bag_weight_kg)).toBe(40.0);
    createdCategoryId = res.body.data.id;
  });

  it('should return 409 for duplicate category name', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test 40s Poly', bag_weight_kg: 40.0 });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/categories', () => {
  it('should return list of categories', async () => {
    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('PUT /api/v1/categories/:id', () => {
  it('should update the category', async () => {
    const res = await request(app)
      .put(`/api/v1/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test 40s Poly Updated', bag_weight_kg: 42.5 });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Test 40s Poly Updated');
    expect(Number(res.body.data.bag_weight_kg)).toBe(42.5);
  });
});

describe('DELETE /api/v1/categories/:id', () => {
  it('should delete the category if unused', async () => {
    const res = await request(app)
      .delete(`/api/v1/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
  });
});
