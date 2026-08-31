import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();

// Credentials seeded by 04_default_owner_user.ts
const OWNER_EMAIL = 'owner@sabir.local';
const OWNER_PASSWORD = 'Admin@1234';

let refreshToken: string;
let accessToken: string;

afterAll(async () => {
  await db.destroy();
});

// ─── Login ────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('should return 200 with tokens on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    expect(res.body.data.user.role).toBe('Owner');
    expect(res.body.data.user.permissions).toContain('customers:read');

    // Save for subsequent tests
    refreshToken = res.body.data.refresh_token;
    accessToken = res.body.data.access_token;
  });

  it('should return 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: 'WrongPass@99' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'SomePass@1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── Me ───────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('should return 200 with current user when JWT is valid', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(OWNER_EMAIL);
    expect(res.body.data.role).toBe('Owner');
  });

  it('should return 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');

    expect(res.status).toBe(401);
  });
});

// ─── Refresh ─────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('should return a new access token with a valid refresh token', async () => {
    // Brief sleep so iat timestamp increments
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.access_token).not.toBe(accessToken);
  });

  it('should return 401 with an invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'totally-fake-token' });

    expect(res.status).toBe(401);
  });
});

// ─── Users endpoint RBAC ─────────────────────────────────────────

describe('GET /api/v1/users', () => {
  it('should return 200 for Owner (has users:read)', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return 401 with no token', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });
});

// ─── Logout ──────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('should return 200 and revoke the refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/logged out/i);
  });

  it('should reject the revoked refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(401);
  });
});
