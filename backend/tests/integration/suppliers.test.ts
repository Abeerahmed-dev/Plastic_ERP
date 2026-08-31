import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();

let ownerToken: string;
let createdSupplierId: string;

beforeAll(async () => {
  const ownerLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = ownerLogin.body.data.access_token;

  await db('suppliers').whereILike('name', '%Test Supplier%').delete();
});

afterAll(async () => {
  await db('suppliers').whereILike('name', '%Test Supplier%').delete();
  await db.destroy();
});

describe('POST /api/v1/suppliers', () => {
  it('should create a supplier with generated SUPP- code', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Supplier Karachi',
        phone: '021-1234567',
        city: 'Karachi',
        region: 'Sindh',
        payment_terms: 45,
        opening_payable: 120000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^SUPP-\d{4}$/);
    expect(res.body.data.name).toBe('Test Supplier Karachi');
    expect(Number(res.body.data.outstanding_payable)).toBe(120000);
    createdSupplierId = res.body.data.id;
  });

  it('should return 401 without token', async () => {
    const res = await request(app).post('/api/v1/suppliers').send({ name: 'Ghost' });
    expect(res.status).toBe(401);
  });

  it('should return 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone: '021-0000000' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/suppliers', () => {
  it('should return paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/suppliers')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('total');
  });

  it('should search by name', async () => {
    const res = await request(app)
      .get('/api/v1/suppliers?search=Test+Supplier+Karachi')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/suppliers/:id', () => {
  it('should return supplier with outstanding_payable', async () => {
    const res = await request(app)
      .get(`/api/v1/suppliers/${createdSupplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('outstanding_payable');
    expect(res.body.data.payment_terms).toBe(45);
  });

  it('should return 404 for unknown ID', async () => {
    const res = await request(app)
      .get('/api/v1/suppliers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/suppliers/:id', () => {
  it('should update supplier fields', async () => {
    const res = await request(app)
      .put(`/api/v1/suppliers/${createdSupplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ payment_terms: 60, city: 'Lahore' });
    expect(res.status).toBe(200);
    expect(res.body.data.payment_terms).toBe(60);
    expect(res.body.data.city).toBe('Lahore');
  });
});

describe('DELETE /api/v1/suppliers/:id', () => {
  it('should soft-delete the supplier', async () => {
    const res = await request(app)
      .delete(`/api/v1/suppliers/${createdSupplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/deactivated/i);
  });

  it('should not appear in active list after deactivation', async () => {
    const res = await request(app)
      .get('/api/v1/suppliers?search=Test+Supplier+Karachi')
      .set('Authorization', `Bearer ${ownerToken}`);
    const found = res.body.data.find((s: { id: string }) => s.id === createdSupplierId);
    expect(found).toBeUndefined();
  });
});
