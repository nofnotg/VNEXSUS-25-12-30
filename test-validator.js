import ReportSubsetValidator from './backend/eval/report_subset_validator.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const validator = new ReportSubsetValidator();
const casesDir = path.join(__dirname, 'src/rag/case_sample');
const outputPath = path.join(__dirname, 'backend/eval/output/baseline_metrics.json');
const htmlPath = path.join(__dirname, 'temp/reports/Report_Subset_Validation.html');
const statsHtmlPath = path.join(__dirname, 'temp/reports/Event_Labeling_Stats.html');

console.log('🔍 베이스라인 검증 시작...');
console.log(`케이스 디렉토리: ${casesDir}\n`);

validator.validateAll(casesDir)
    .then(results => {
        validator.printSummary();
        validator.saveResults(outputPath);
        validator.generateHTMLReport(htmlPath);
        validator.generateLabelingStatsHTML(statsHtmlPath);

        const baselineMetrics = {
            timestamp: results.timestamp,
            casesWithBoth: results.casesWithBoth,
            dateMatchRate: results.dateMatchRate,
            icdMatchRate: results.icdMatchRate,
            hospitalMatchRate: results.hospitalMatchRate,
            missingCasesCount: results.missingEvents.length
        };

        const baselinePath = path.join(__dirname, 'VNEXSUS_dev_plan_tasks/baseline_metrics.json');
        if (!fs.existsSync(path.dirname(baselinePath))) {
            fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
        }
        fs.writeFileSync(baselinePath, JSON.stringify(baselineMetrics, null, 2), 'utf-8');
        console.log(`📊 베이스라인 메트릭 저장: ${baselinePath}\n`);
    })
    .catch(error => {
        console.error('❌ 검증 실패:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
