/**
 * Dev Case Manager Routes - minimal test
 * Validates direct text report save endpoint
 */
import express from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import devCaseManagerRoutes from '../routes/devCaseManagerRoutes.js';

describe('Dev Case Manager Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/dev/studio', devCaseManagerRoutes);

  const baseDir = process.env.CASE_BASE_DIR
    ? path.resolve(process.env.CASE_BASE_DIR)
    : path.resolve(path.join(__dirname, '../../src/rag'));
  const reportDir = path.join(baseDir, 'case_report');

  beforeAll(() => {
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  });

  afterAll(() => {
    // no-op (keep artifacts for manual inspection)
  });

  it('saves report text to caseX_report.txt', async () => {
    const caseNumber = '9999';
    const res = await request(app)
      .post(`/api/dev/studio/cases/${caseNumber}/report`)
      .send({ text: 'Test report content for case 9999' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.path).toBeDefined();

    const savedPath = path.join(reportDir, `case${caseNumber}_report.txt`);
    expect(fs.existsSync(savedPath)).toBe(true);
    const content = fs.readFileSync(savedPath, 'utf-8');
    expect(content).toContain('Test report content');

    // Verify listing includes the saved report
    const listRes = await request(app).get('/api/dev/studio/cases').expect(200);
    expect(listRes.body.success).toBe(true);
    const found = (listRes.body.cases || []).find(c => c.caseNumber === caseNumber);
    expect(found).toBeDefined();
    expect(found.files.case_report).toBeDefined();
  });
});
