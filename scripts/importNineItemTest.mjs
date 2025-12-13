import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    const spec = new URL('../backend/services/nineItemReportGenerator.js', import.meta.url).href;
    const module = await import(spec);
    console.log('IMPORT_OK', Object.keys(module));
    const { default: NineItemReportGenerator } = module;
    const gen = new NineItemReportGenerator();
    console.log('INSTANCE_OK', typeof gen.generateReport === 'function');
    const dnaResult = {
      extracted_genes: [
        { content: '2024-01-05 외래 내원. 주증상: 두통.', confidence: 0.7 },
        { content: '검사: Brain CT 2024-01-06 결과: 정상.', confidence: 0.8 },
        { content: '치료: 약물치료 시작 2024-01-07.', confidence: 0.8 },
        { content: '2024-02-10 입원. 수술 2024-02-12. 2024-02-15 퇴원.', confidence: 0.9 },
        { content: '통원 치료 2024-03-01 방문 1회, 2024-03-10 방문 2회.', confidence: 0.6 }
      ],
      causal_network: {}
    };
    const patientInfo = { insuranceCompany: '메디보험', insuranceJoinDate: '2023-12-01' };
    const result = await gen.generateReport(dnaResult, patientInfo, { template: 'standard' });
    console.log('REPORT_PREVIEW', String(result.report).substring(0, 200));
  } catch (e) {
    console.error('IMPORT_ERR', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
