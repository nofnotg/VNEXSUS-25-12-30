import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function main() {
  const Engine = require('../postprocess/enhancedReportTemplateEngine.cjs');
  const engine = new Engine();
  const normalizedData = {
    patientInfo: { patientName: '홍길동', birthDate: '1980-01-02' },
    insuranceInfo: { contractDate: '2022-01-01', productType: '3.2.5' },
    medicalRecords: [
      { date: '2024-1-5', hospital: '삼성서울병원', tests: [{ name: '혈액검사', date: '2024-01-05', result: '정상' }, { name: '혈액검사', date: '2024-01-05', result: '정상' }] },
      { date: '2024/02/07', hospital: '명지병원', tests: [{ name: '조직검사', date: '2024-02-07', reportDate: '2024-02-09', pathologyFindings: 'adenocarcinoma' }] }
    ]
  };
  const res = await engine.generateEnhancedReport(normalizedData, { format: 'text', includeDisclosureReview: true, includeSummary: true, processTerms: false });
  const out = {
    fullReportLen: (res?.fullReport || '').length,
    summaryLen: (res?.summaryReport || '').length,
    disclosure: !!res?.disclosureAnalysis,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch(err => { console.error(err.message || 'error'); process.exit(1); });
