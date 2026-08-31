import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();

// Credentials seeded by 04_default_owner_user.ts
const OWNER_EMAIL = 'owner@sabir.local';
const OWNER_PASSWORD = 'Admin@1234';

let ownerToken: string;
let accountantRoleId: string;
let createdUserId: string;

beforeAll(async () => {
  // Login to get the owner token
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  
  ownerToken = res.body.data.access_token;
  
  // Get Accountant role ID
  const roles = await db('roles').where({ name: 'Accountant' }).first();
  accountantRoleId = roles.id;
});

afterAll(async () => {
  await db.destroy();
});

describe('Users API (Integration)', () => {
  describe('GET /api/v1/users', () => {
    it('should return a list of users for authenticated admin', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${ownerToken}`);
        
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('name');
      expect(res.body.data[0]).toHaveProperty('email');
      expect(res.body.data[0]).toHaveProperty('role_name');
    });

    it('should block unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/users', () => {
    it('should create a new user with valid data', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Accountant',
          email: 'testaccountant@sabir.local',
          password: 'TestPassword123!',
          role_id: accountantRoleId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Test Accountant');
      expect(res.body.data.email).toBe('testaccountant@sabir.local');
      expect(res.body.data.role_id).toBe(accountantRoleId);
      
      createdUserId = res.body.data.id;
    });

    it('should block creation if email already exists', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Another Accountant',
          email: 'testaccountant@sabir.local', // same email
          password: 'TestPassword123!',
          role_id: accountantRoleId,
        });

      expect(res.status).toBe(409); // Conflict
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Email already in use/);
    });

    it('should block creation with invalid schema (e.g. bad email)', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Bad Email User',
          email: 'not-an-email',
          password: 'TestPassword123!',
          role_id: accountantRoleId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should fetch a specific user', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdUserId);
      expect(res.body.data.name).toBe('Test Accountant');
    });

    it('should return 404 for non-existent user', async () => {
      // Generate a random UUID
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app)
        .get(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/users/:id', () => {
    it('should successfully update a user', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Updated Accountant Name',
          is_active: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Accountant Name');
      expect(res.body.data.is_active).toBe(false);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should delete a user', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
      
      // Verify deletion
      const getRes = await request(app)
        .get(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(getRes.status).toBe(404);
    });
  });
});
