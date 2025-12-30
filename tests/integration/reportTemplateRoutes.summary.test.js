import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
// Mock the ESM ReportTemplateEngine to avoid import.meta issues in Jest
await jest.unstable_mockModule('../../backend/postprocess/reportTemplateEngine.js', () => ({
  default: class MockEngine {
    createHtmlTemplate() { return '<!DOCTYPE html><html lang="ko"><body>Mock</body></html>'; }
    createTextTemplate() { return 'Generated at: 2024-01-01'; }
    createJsonTemplate(data) { return JSON.stringify(data); }
    createMarkdownTemplate() { return '# Mock Report'; }
  }
}));
const reportTemplateRoutes = (await import('../../backend/routes/reportTemplateRoutes.js')).default;

describe('GET /api/report-template/summary', () => {
  let app;
  const tempDir = path.join(process.cwd(), 'temp');
  const tempFile = path.join(tempDir, 'test-summary-input.json');

  beforeAll(() => {
    app = express();
    app.use('/api/report-template', reportTemplateRoutes);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const sample = {
      generatedAt: '2024-01-01T00:00:00Z',
      results: [
        {
          name: 'Profile A',
          aggregate: {
            cases: 2,
            totals: { records: 10, episodes: 3 },
            topGroups: [{ group: 'Orthopedic', count: 5 }]
          },
          summary: [
            { hospitals: ['Hospital A'], claimWithinWindowRecords: 2, diseaseAnchors: 3, diseaseTestsWithinTimeframe: 1 }
          ]
        }
      ]
    };
    fs.writeFileSync(tempFile, JSON.stringify(sample), 'utf8');
  });

  afterAll(() => {
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch {}
    try { if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir, { recursive: true }); } catch {}
  });

  test('returns summary contract JSON for valid input path', async () => {
    const res = await request(app)
      .get(`/api/report-template/summary?input=${encodeURIComponent(path.relative(process.cwd(), tempFile))}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const body = typeof res.body === 'object' && Object.keys(res.body).length ? res.body : JSON.parse(res.text);
    expect(body.contractVersion).toBe('v1');
    expect(Array.isArray(body.profiles)).toBe(true);
    expect(body.profiles.length).toBe(1);
    expect(body.profiles[0].metrics.hospitalsUnique).toBe(1);
    expect(body.generatedAt).toBe('2024-01-01T00:00:00Z');
  });

  test('returns 404 when input file is missing', async () => {
    const res = await request(app)
      .get('/api/report-template/summary?input=nonexistent/path/to.json');
    expect(res.status).toBe(404);
    const body = typeof res.body === 'object' && Object.keys(res.body).length ? res.body : JSON.parse(res.text);
    expect(body.success).toBe(false);
    expect(body.message).toBe('input_file_not_found');
  });
});
