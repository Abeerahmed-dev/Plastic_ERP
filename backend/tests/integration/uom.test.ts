import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
let ownerToken: string;
let createdUomId: string;

beforeAll(async () => {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });
  ownerToken = login.body.data.access_token;
  
  await db('units_of_measure').whereILike('name', 'Test%').delete();
});

afterAll(async () => {
  await db('units_of_measure').whereILike('name', 'Test%').delete();
  await db.destroy();
});

describe('POST /api/v1/uom', () => {
  it('should create a new UOM', async () => {
    const res = await request(app)
      .post('/api/v1/uom')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test Kilo', abbreviation: 'tkg' });
    
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test Kilo');
    expect(res.body.data.abbreviation).toBe('tkg');
    createdUomId = res.body.data.id;
  });

  it('should return 409 for duplicate abbreviation', async () => {
    const res = await request(app)
      .post('/api/v1/uom')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test Kilo Duplicate', abbreviation: 'tkg' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/uom', () => {
  it('should return list of UOMs', async () => {
    const res = await request(app)
      .get('/api/v1/uom')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('PUT /api/v1/uom/:id', () => {
  it('should update the UOM', async () => {
    const res = await request(app)
      .put(`/api/v1/uom/${createdUomId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test Kilo Updated' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Test Kilo Updated');
  });
});

describe('DELETE /api/v1/uom/:id', () => {
  it('should soft delete the UOM', async () => {
    const res = await request(app)
      .delete(`/api/v1/uom/${createdUomId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/deactivated/i);
  });
});
