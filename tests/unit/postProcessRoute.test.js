import express from 'express';
import request from 'supertest';
import { describe, test, expect, jest } from '@jest/globals';

await jest.unstable_mockModule('../../src/controllers/reportController.js', () => ({
  default: {
    generateReport: jest.fn(async () => ({
      success: true,
      reportPath: '/outputs/job-123/report.json',
      stats: { total: 1, filtered: 0, beforeEnrollment: 0, timeline: 1 },
    })),
  },
}));

const router = (await import('../../src/postprocess/postProcessRoute.js')).default;

describe('POST /api/postprocess/report', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/postprocess', router);

  test('returns 400 for invalid request schema (missing jobId)', async () => {
    const res = await request(app)
      .post('/api/postprocess/report')
      .send({
        parsedEvents: [
          { label: 'Exam', date: '2024-01-01', confidence: 0.9 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(String(res.body.error)).toContain('요청 스키마');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  test('returns 200 for valid request schema and mocks controller', async () => {
    const res = await request(app)
      .post('/api/postprocess/report')
      .send({
        jobId: 'job-123',
        parsedEvents: [
          { label: 'Exam', date: '2024-01-01', confidence: 0.9 },
        ],
        options: { minConfidence: 0.5 },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.reportPath).toBe('string');
  });

  test('returns 500 when controller returns invalid response schema', async () => {
    const reportController = (await import('../../src/controllers/reportController.js')).default;
    reportController.generateReport.mockResolvedValueOnce({ success: 'yes' });

    const res = await request(app)
      .post('/api/postprocess/report')
      .send({
        jobId: 'job-999',
        parsedEvents: [
          { label: 'Exam', date: '2024-01-01', confidence: 0.9 },
        ],
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(String(res.body.error)).toContain('응답 스키마');
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});
