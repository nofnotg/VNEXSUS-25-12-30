// Integration test for POST /api/dna-report/generate
import request from 'supertest';
import express from 'express';
import dnaReportRoutes from '../../backend/routes/dnaReportRoutes.js';

describe('POST /api/dna-report/generate', () => {
  let app;

  beforeAll(() => {
    // Ephemeral app mounting only the target router
    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/dna-report', dnaReportRoutes);
  });

  test('returns 200 and success with skipLLM enabled', async () => {
    const res = await request(app)
      .post('/api/dna-report/generate')
      .set('Content-Type', 'application/json')
      .send({
        extractedText: '환자는 2024-01-15 내원하여 혈압 검사 및 진단을 받음.',
        patientInfo: { insuranceCompany: '메디케어손해보험', insuranceJoinDate: '2022-01-01' },
        options: { skipLLM: true, enableTranslationEnhancement: true, enableTermProcessing: true }
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(typeof res.body.report).toBe('string');
    expect(res.body).toHaveProperty('model', 'skipped');
    expect(res.body).toHaveProperty('metadata');
    expect(res.body.metadata).toHaveProperty('translation');
  });

  test('returns 400 for invalid body (missing extractedText)', async () => {
    const res = await request(app)
      .post('/api/dna-report/generate')
      .set('Content-Type', 'application/json')
      .send({ patientInfo: {}, options: { skipLLM: true } });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
  });
});

