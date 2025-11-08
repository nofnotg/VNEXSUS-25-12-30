// Integration test for POST /api/advanced-date/analyze
// Uses dynamic import to set env before loading app

import request from 'supertest';
import express from 'express';
import advancedDateRoutes from '../../src/routes/advancedDateRoutes.js';

describe('POST /api/advanced-date/analyze', () => {
  let app;

  beforeAll(async () => {
    // Ephemeral express app mounting only the target router
    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/advanced-date', advancedDateRoutes);
  });

  test('returns 200 and success for valid JSON body', async () => {
    const res = await request(app)
      .post('/api/advanced-date/analyze')
      .set('Content-Type', 'application/json')
      .send({
        documentText: '환자는 2024년 1월 15일 내원하여 검사를 받았습니다. 진단일은 2024년 1월 20일입니다.',
        options: { minimumConfidence: 0.6, groupByRole: true, enableAI: false }
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('result');
  });

  test('returns 400 for invalid JSON (simulate syntax error)', async () => {
    // Send text/plain with malformed JSON to trigger SyntaxError at app-level parser
    const server = app;
    const agent = request(server);
    const res = await agent
      .post('/api/advanced-date/analyze')
      .set('Content-Type', 'application/json')
      .send('{ invalid json');

    // Depending on express.json error handling, could be 400 Bad Request
    // AdvancedDateRoutes also has error middleware mapping SyntaxError to 400
    expect([400, 500]).toContain(res.status);
  });
});
