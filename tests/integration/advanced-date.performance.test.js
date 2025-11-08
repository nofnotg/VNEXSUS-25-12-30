// Integration test for GET /api/advanced-date/performance
import request from 'supertest';
import express from 'express';
import advancedDateRoutes from '../../src/routes/advancedDateRoutes.js';

describe('GET /api/advanced-date/performance', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/advanced-date', advancedDateRoutes);
  });

  test('returns 200 with performance report structure', async () => {
    const res = await request(app).get('/api/advanced-date/performance');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    const report = res.body.report ?? res.body.performance;
    expect(report).toBeDefined();
    expect(report).toHaveProperty('version');
    expect(report).toHaveProperty('metrics');
    expect(res.body).toHaveProperty('system');
  });
});
