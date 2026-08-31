import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();

let ownerToken: string;
let cashierToken: string;
let createdCustomerId: string;

beforeAll(async () => {
  // Login as Owner
  const ownerLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = ownerLogin.body.data.access_token;

  // Create a Cashier user for RBAC tests
  const cashierRole = await db('roles').where({ name: 'Cashier' }).first<{ id: string }>();
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('Cashier@1234', 10);
  await db('users').insert({
    name: 'Test Cashier',
    email: 'cashier@test.local',
    password_hash: hash,
    role_id: cashierRole.id,
    is_active: true,
  }).onConflict('email').ignore();

  const cashierLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'cashier@test.local', password: 'Cashier@1234' });
  cashierToken = cashierLogin.body.data.access_token;

  // Clean up any test customers from previous runs
  await db('customers').whereILike('name', '%Test Customer%').delete();
});

afterAll(async () => {
  await db('customers').whereILike('name', '%Test Customer%').delete();
  await db.destroy();
});

// ─── Create ───────────────────────────────────────────────────────

describe('POST /api/v1/customers', () => {
  it('should create a customer and return 201 with generated code', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Customer Ahmed',
        phone: '0300-1234567',
        city: 'Karachi',
        region: 'Sindh',
        credit_limit: 500000,
        opening_balance: 75000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toMatch(/^CUST-\d{4}$/);
    expect(res.body.data.name).toBe('Test Customer Ahmed');
    expect(Number(res.body.data.outstanding_balance)).toBe(75000);

    createdCustomerId = res.body.data.id;
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .send({ name: 'No Auth Customer' });
    expect(res.status).toBe(401);
  });

  it('should return 403 for Cashier (no customers:write permission)', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Test Customer Cashier Blocked' });
    expect(res.status).toBe(403);
  });

  it('should return 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone: '0300-0000000' });
    expect(res.status).toBe(400);
  });
});

// ─── List ─────────────────────────────────────────────────────────

describe('GET /api/v1/customers', () => {
  it('should return 200 with paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('page');
  });

  it('should filter by search query', async () => {
    const res = await request(app)
      .get('/api/v1/customers?search=Test+Customer+Ahmed')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toContain('Test Customer Ahmed');
  });

  it('Cashier can read customers (customers:read allowed)', async () => {
    const res = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(200);
  });
});

// ─── Get by ID ────────────────────────────────────────────────────

describe('GET /api/v1/customers/:id', () => {
  it('should return customer with outstanding_balance', async () => {
    const res = await request(app)
      .get(`/api/v1/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdCustomerId);
    expect(res.body.data).toHaveProperty('outstanding_balance');
  });

  it('should return 404 for non-existent ID', async () => {
    const res = await request(app)
      .get('/api/v1/customers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── Update ───────────────────────────────────────────────────────

describe('PUT /api/v1/customers/:id', () => {
  it('should update customer fields', async () => {
    const res = await request(app)
      .put(`/api/v1/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone: '0321-9999999', city: 'Lahore' });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('0321-9999999');
    expect(res.body.data.city).toBe('Lahore');
  });

  it('should not allow updating opening_balance', async () => {
    const res = await request(app)
      .put(`/api/v1/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ opening_balance: 999999 });
    // opening_balance is stripped by updateCustomerSchema
    expect(res.status).toBe(200);
    // re-fetch and confirm balance unchanged
    const check = await request(app)
      .get(`/api/v1/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(Number(check.body.data.outstanding_balance)).toBe(75000);
  });
});

// ─── Deactivate ───────────────────────────────────────────────────

describe('DELETE /api/v1/customers/:id', () => {
  it('should soft-delete the customer', async () => {
    const res = await request(app)
      .delete(`/api/v1/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/deactivated/i);
  });

  it('should not appear in default active list after deactivation', async () => {
    const res = await request(app)
      .get('/api/v1/customers?search=Test+Customer+Ahmed')
      .set('Authorization', `Bearer ${ownerToken}`);
    const found = res.body.data.find((c: { id: string }) => c.id === createdCustomerId);
    expect(found).toBeUndefined();
  });

  it('should return 404 for already non-existent customer on re-delete', async () => {
    // deactivated customer still exists in DB, second delete should still work on it
    // (it returns 200 but sets is_active again — idempotent)
    const res = await request(app)
      .delete('/api/v1/customers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });
});
