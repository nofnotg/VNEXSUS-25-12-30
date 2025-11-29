/**
 * Demo: Generate Enhanced HTML Report
 */
const fs = require('fs');
const path = require('path');
const ReportTemplateEngine = require('./reportTemplateEngine.cjs');

async function main() {
  const engine = new ReportTemplateEngine();

  // Sample test data (aligned with testEnhancedReportGeneration.js)
  const testData = {
    patientInfo: {
      name: '홍길동',
      birthDate: '1980-05-15',
      gender: '남성',
      address: '서울시 강남구',
      phone: '010-1234-5678'
    },
    insuranceInfo: {
      contractDate: '2023-01-15',
      productName: '건강보험',
      insurer: '삼성화재',
      disclosureStandard: '3개월·2년·5년 이내'
    },
    medicalRecords: [
      {
        date: '2023-02-10',
        hospital: '서울대학교병원',
        reason: '흉통',
        diagnosis: 'Acute myocardial infarction 급성심근경색증 (ICD: I21.9)',
        treatment: 'PCI (Percutaneous Coronary Intervention), Stenting',
        testResults: [
          { name: 'Cardiac MRI', date: '2023-02-10', reportDate: '2023-02-11', result: 'LVEF 40%' },
          { name: 'Coronary angiography', date: '2023-02-10', result: 'LAD 90% stenosis, TIMI 0→3 after PCI' },
          { name: 'Troponin I', date: '2023-02-10', result: '17.2 ng/mL (high)' }
        ]
      }
    ]
  };

  const options = {
    format: 'html',
    includeDisclosureReview: true,
    includeSummary: true,
    processTerms: true
  };

  const result = await engine.generateEnhancedReport(testData, options);
  const html = result.fullReport;

  const reportsDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, 'Enhanced_Report_Demo.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(JSON.stringify({ level: 'info', event: 'enhanced_html_written', path: outPath }));
}

main().catch((err) => {
  console.error(JSON.stringify({ level: 'error', event: 'demo_failed', message: err?.message }));
  process.exit(1);
});

