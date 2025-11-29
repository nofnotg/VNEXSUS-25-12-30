import request from 'supertest';
import express from 'express';
// Mock the ESM ReportTemplateEngine to avoid import.meta issues in Jest
jest.mock('../../backend/postprocess/reportTemplateEngine.js', () => ({
  __esModule: true,
  default: class MockEngine {
    createHtmlTemplate(data, options = {}) {
      const locale = options.locale ?? 'ko';
      return `<!DOCTYPE html><html lang="${locale}"><head><title>Mock</title></head><body>Mock ${locale}</body></html>`;
    }
    createTextTemplate(data, options = {}) {
      const locale = options.locale ?? 'ko';
      return locale === 'en' ? 'Generated at: 2024-01-01' : '생성 시각: 2024-01-01';
    }
    createJsonTemplate(data) {
      return JSON.stringify(data);
    }
    createMarkdownTemplate() {
      return '# Mock Report';
    }
  }
}));
import reportTemplateRoutes from '../../backend/routes/reportTemplateRoutes.js';

describe('GET /api/report-template/basic', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use('/api/report-template', reportTemplateRoutes);
  });

  test('returns HTML with lang="ko" when locale=ko', async () => {
    const res = await request(app)
      .get('/api/report-template/basic?locale=ko&format=html');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<html lang="ko">');
  });

  test('returns text with English label when locale=en&format=text', async () => {
    const res = await request(app)
      .get('/api/report-template/basic?locale=en&format=text');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('Generated at:');
  });
});
