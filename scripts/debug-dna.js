import express from 'express';
import request from 'supertest';
import dnaReportRoutes from '../backend/routes/dnaReportRoutes.js';

async function run() {
  const app = express();
  app.use(express.json());
  app.use('/api/dna-report', dnaReportRoutes);

  const payload = {
    extractedText: '내당최내과의원 2019.11.15 ~ 2024.08.14 / 23회 통원. 협심증 및 당뇨병 진단. AXA 손해보험 가입.',
    patientInfo: {},
    options: { skipLLM: true, enableTranslationEnhancement: true, enableTermProcessing: true },
  };

  const res = await request(app).post('/api/dna-report/generate').send(payload);
  console.log('Status:', res.status);
  console.log('Body:', JSON.stringify(res.body, null, 2));
}

run().catch(err => {
  console.error('Debug run failed:', err);
  process.exit(1);
});
