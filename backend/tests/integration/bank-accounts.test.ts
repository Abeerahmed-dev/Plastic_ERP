import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
const OWNER_EMAIL = 'owner@sabir.local';
const OWNER_PASSWORD = 'Admin@1234';

let ownerToken: string;
let createdAccountId: string;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  ownerToken = loginRes.body.data.access_token;
});

afterAll(async () => {
  if (createdAccountId) {
    await db('bank_accounts').where('id', createdAccountId).delete();
  }
  await db.destroy();
});

describe('Bank Accounts Authorization & CRUD', () => {
  it('GET /api/v1/bank-accounts should succeed with 200 for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/bank-accounts')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/v1/bank-accounts should NOT return 403 Forbidden for Owner', async () => {
    const res = await request(app)
      .post('/api/v1/bank-accounts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        account_title: 'Meezan Corporate Operations',
        bank_name: 'Meezan Bank Ltd',
        account_number: 'PK00MEZN' + Date.now().toString().slice(-8),
        iban: 'PK00MEZN0000000000000000',
        initial_balance: 50000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    createdAccountId = res.body.data.id;
  });

  it('PUT /api/v1/bank-accounts/:id should succeed without 403', async () => {
    if (!createdAccountId) return;
    const res = await request(app)
      .put(`/api/v1/bank-accounts/${createdAccountId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        account_title: 'Meezan Corporate Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/bank-accounts/:id/transactions should return transactions list', async () => {
    if (!createdAccountId) return;
    const res = await request(app)
      .get(`/api/v1/bank-accounts/${createdAccountId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
