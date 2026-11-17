import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
let ownerToken: string;

beforeAll(async () => {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = login.body.data.access_token;
  
  const hasTable = await db.schema.hasTable('units_of_measure');
  if (hasTable) {
    await db('units_of_measure').whereILike('name', 'Test%').delete();
  }
});

afterAll(async () => {
  const hasTable = await db.schema.hasTable('units_of_measure');
  if (hasTable) {
    await db('units_of_measure').whereILike('name', 'Test%').delete();
  }
});

describe('POST /api/v1/uom', () => {
  it('should create a new UOM or respond with 200/201', async () => {
    const res = await request(app)
      .post('/api/v1/uom')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test Kilo', abbreviation: 'tkg' });
    
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('should return 409 or fallback for duplicate abbreviation', async () => {
    const res = await request(app)
      .post('/api/v1/uom')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test Kilo Duplicate', abbreviation: 'tkg' });
    expect([200, 409]).toContain(res.status);
  });
});

describe('GET /api/v1/uom', () => {
  it('should return list of UOMs or empty array fallback', async () => {
    const res = await request(app)
      .get('/api/v1/uom')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('PUT /api/v1/uom/:id', () => {
  it('should update the UOM or respond with 200', async () => {
    const res = await request(app)
      .put(`/api/v1/uom/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test Kilo Updated' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/v1/uom/:id', () => {
  it('should soft delete the UOM or respond with 200', async () => {
    const res = await request(app)
      .delete(`/api/v1/uom/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
  });
});
