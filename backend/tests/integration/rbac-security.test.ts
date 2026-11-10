/**
 * Phase 3 QA Matrix: Security & RBAC Barricades Integration Test Suite
 * 
 * Verifications:
 * - Test 8: Security & Role-Based Access Control (RBAC) Enforcement
 * - Generates valid JWT authentication tokens for Owner and Cashier roles
 * - Tests restricted financial reporting endpoints (GET /api/v1/reports/pnl, GET /api/v1/reports/sales-margin)
 * - Asserts Owner request returns 200 OK with full financial report data
 * - Asserts Cashier request is intercepted by RBAC middleware and strictly returns 403 Forbidden
 * - Asserts unauthenticated request (no token) returns 401 Unauthorized
 * - Asserts malformed/tampered token returns 401 Unauthorized
 * - Asserts Cashier can still access authorized endpoints (GET /api/v1/reports/cashier-tally), confirming role granularity
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';
import { env } from '../../src/config/env';

const app = createApp();

let ownerToken: string;
let cashierToken: string;
let jwtOwnerToken: string;
let jwtCashierToken: string;

/**
 * Helper to ensure Cashier user exists in test DB and return credentials
 */
async function ensureCashierUser(): Promise<void> {
  const cashierRole = await db('roles').where({ name: 'Cashier' }).first();
  if (!cashierRole) {
    throw new Error('Cashier role missing from test database');
  }

  const existing = await db('users').where({ email: 'cashier@sabirplastic.local' }).first();
  if (!existing) {
    const passwordHash = await bcrypt.hash('Cashier@123', 10);
    await db('users').insert({
      name: 'Cashier User',
      email: 'cashier@sabirplastic.local',
      password_hash: passwordHash,
      role_id: cashierRole.id,
      is_active: true,
    });
  }
}

/**
 * Generate tokens via API login as well as direct cryptographically signed JWTs
 */
async function setupTokens(): Promise<void> {
  // 1. Obtain tokens via /api/v1/auth/login
  const ownerLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@sabir.local', password: 'Admin@1234' });

  expect(ownerLoginRes.status).toBe(200);
  ownerToken = ownerLoginRes.body.data.access_token;
  expect(ownerToken).toBeDefined();

  await ensureCashierUser();
  const cashierLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'cashier@sabirplastic.local', password: 'Cashier@123' });

  expect(cashierLoginRes.status).toBe(200);
  cashierToken = cashierLoginRes.body.data.access_token;
  expect(cashierToken).toBeDefined();

  // 2. Also generate direct valid JWT tokens signed with JWT_SECRET
  const ownerRole = await db('roles').where({ name: 'Owner' }).first();
  const cashierRole = await db('roles').where({ name: 'Cashier' }).first();

  const secret = env.JWT_SECRET || 'test_secret_do_not_use_in_production_ever';

  jwtOwnerToken = jwt.sign(
    {
      sub: '00000000-0000-0000-0000-000000000001',
      name: 'Direct Owner',
      email: 'owner@sabir.local',
      roleId: ownerRole?.id || 'role-owner-id',
      roleName: 'Owner',
      permissions: ['*'],
    },
    secret,
    { expiresIn: '1h' }
  );

  jwtCashierToken = jwt.sign(
    {
      sub: '00000000-0000-0000-0000-000000000002',
      name: 'Direct Cashier',
      email: 'cashier@sabirplastic.local',
      roleId: cashierRole?.id || 'role-cashier-id',
      roleName: 'Cashier',
      permissions: ['sales:read', 'sales:write', 'payments:write'],
    },
    secret,
    { expiresIn: '1h' }
  );
}

beforeAll(async () => {
  await setupTokens();
});

describe('Phase 3 Integration: Security & RBAC Barricades', () => {

  // ==========================================================================
  // TEST 8: SECURITY & RBAC BARRICADES
  // ==========================================================================
  describe('Test 8: Role-Based Access Control on Restricted Financial Endpoints', () => {

    describe('GET /api/v1/reports/pnl (Profit & Loss Report)', () => {

      it('should allow Owner request to succeed with 200 OK and return PnL financial metrics', async () => {
        const res = await request(app)
          .get('/api/v1/reports/pnl')
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
        // Verify key financial PnL reporting fields are accessible
        expect(res.body.data).toHaveProperty('total_sales');
        expect(res.body.data).toHaveProperty('net_profit');
        expect(res.body.data).toHaveProperty('gross_profit');
      });

      it('should allow directly generated Owner JWT to succeed with 200 OK', async () => {
        const res = await request(app)
          .get('/api/v1/reports/pnl')
          .set('Authorization', `Bearer ${jwtOwnerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
      });

      it('should strictly intercept Cashier request and return 403 Forbidden', async () => {
        const res = await request(app)
          .get('/api/v1/reports/pnl')
          .set('Authorization', `Bearer ${cashierToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error || res.body.message).toMatch(
          /Access denied: Operation requires one of the following roles: OWNER, ADMIN/i
        );
      });

      it('should strictly intercept directly signed Cashier JWT and return 403 Forbidden', async () => {
        const res = await request(app)
          .get('/api/v1/reports/pnl')
          .set('Authorization', `Bearer ${jwtCashierToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error || res.body.message).toMatch(
          /Access denied: Operation requires one of the following roles: OWNER, ADMIN/i
        );
      });

      it('should return 401 Unauthorized when no authentication token is provided', async () => {
        const res = await request(app).get('/api/v1/reports/pnl');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error || res.body.message).toMatch(/Authorization header missing or malformed/i);
      });

      it('should return 401 Unauthorized when an invalid or malformed token is sent', async () => {
        const res = await request(app)
          .get('/api/v1/reports/pnl')
          .set('Authorization', 'Bearer invalid.token.payload');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error || res.body.message).toMatch(/Token invalid or expired/i);
      });

    });

    describe('GET /api/v1/reports/sales-margin (Sales Margin Analytics Report)', () => {

      it('should allow Owner request to succeed with 200 OK', async () => {
        const res = await request(app)
          .get('/api/v1/reports/sales-margin')
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
        expect(res.body.data).toHaveProperty('products');
        expect(res.body.data).toHaveProperty('customers');
        expect(res.body.data).toHaveProperty('trend_data');
      });

      it('should strictly intercept Cashier request and return 403 Forbidden', async () => {
        const res = await request(app)
          .get('/api/v1/reports/sales-margin')
          .set('Authorization', `Bearer ${cashierToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error || res.body.message).toMatch(
          /Access denied: Operation requires one of the following roles: OWNER, ADMIN/i
        );
      });

      it('should return 401 Unauthorized for unauthenticated request', async () => {
        const res = await request(app).get('/api/v1/reports/sales-margin');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error || res.body.message).toMatch(/Authorization header missing or malformed/i);
      });

    });

    describe('RBAC Granularity Validation (Permitted Endpoints for Cashier)', () => {

      it('should confirm Cashier token is valid and permitted on role-appropriate endpoints (e.g. cashier-tally)', async () => {
        const res = await request(app)
          .get('/api/v1/reports/cashier-tally')
          .set('Authorization', `Bearer ${cashierToken}`);

        // Cashier role is explicitly permitted on cashier-tally
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

    });

  });
});
