// Preview generator for Enhanced Report HTML
// Node 18+ ESM script that constructs normalizedData and writes HTML to reports/enhanced_report_preview.html
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const EnhancedReportTemplateEngine = require('../backend/postprocess/enhancedReportTemplateEngine.cjs');

async function main() {
  const engine = new EnhancedReportTemplateEngine();

  // Build normalized data from provided sample
  const normalizedData = {
    patientInfo: {
      name: '김태형',
      birthDate: '1960-08-09'
    },
    insuranceInfo: {
      contractDate: '2024-10-01',
      productName: '미제공',
      insurer: '미제공',
      productType: '3.2.5'
    },
    medicalRecords: [
      {
        date: '2024-12-12',
        hospital: '굿웰스의원',
        diagnosis: '상병 상세불명의 흉통 (Chest pain) (ICD: R07.4)',
        treatment: '진료 및 검사 요청'
      },
      {
        date: '2024-12-31',
        hospital: '신촌세브란스병원',
        diagnosis: '안정형 협심증 (Stable angina pectoris) (ICD: I20.9)',
        treatment: 'Coronary angiography 시행'
      },
      {
        date: '2025-01-09',
        hospital: '신촌세브란스병원',
        diagnosis: '안정형 협심증 (Stable angina pectoris) (ICD: I20.9)',
        treatment: '약물 조정 및 추후 관리 계획'
      },
      {
        date: '2025-01-14',
        hospital: '신촌세브란스병원',
        diagnosis: '신규 발견 당뇨병 (Newly detected diabetes) (ICD: E11.9)',
        treatment: '당뇨병(Diabetes Mellitus) 관리 및 치료 계획 수립'
      }
    ]
  };

  const options = {
    format: 'html',
    includeDisclosureReview: true,
    includeSummary: true,
    processTerms: true
  };

  const { fullReport } = await engine.generateEnhancedReport(normalizedData, options);

  const reportsDir = path.resolve(__dirname, '../reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const outFile = path.join(reportsDir, 'enhanced_report_preview.html');
  fs.writeFileSync(outFile, fullReport, 'utf8');
  console.log(`Preview HTML written: ${outFile}`);
}

main().catch((err) => {
  console.error('Failed to generate preview:', err);
  process.exitCode = 1;
});

