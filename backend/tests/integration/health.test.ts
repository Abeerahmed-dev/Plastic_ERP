import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();

afterAll(async () => {
  await db.destroy();
});

describe('GET /api/v1/health', () => {
  it('should return 200 with healthy status when DB is connected', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.db).toBe('ok');
    expect(res.body.data.service).toBe('Sabir Plastic ERP API');
    expect(res.body.data.timestamp).toBeDefined();
  });

  it('should return JSON content-type', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('Unknown route', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Route not found');
  });
});
