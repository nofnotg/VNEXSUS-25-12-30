import 'dotenv/config';
import coreEngineService from './backend/services/coreEngineService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CASE_DIR = path.join(process.cwd(), 'src/rag/case_sample');

async function verifyCoverage() {
    console.log('🚀 Starting Coverage Verification (Ground Truth vs App Extraction)\n');

    const files = fs.readdirSync(CASE_DIR).filter(f => f.startsWith('Case') && f.endsWith('.txt') && !f.includes('report') && !f.includes('vnexsus'));

    // Sort numerically
    files.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
    });

    console.log(`Found ${files.length} cases.`);

    const results = [];

    for (const file of files) {
        const caseId = file.replace('.txt', '');
        const reportFile = `${caseId}_report.txt`;
        const reportPath = path.join(CASE_DIR, reportFile);
        const filePath = path.join(CASE_DIR, file);

        if (!fs.existsSync(reportPath)) {
            console.log(`⚠️ Skipping ${caseId}: No Ground Truth Report found.`);
            continue;
        }

        process.stdout.write(`Processing ${caseId}... `);

        try {
            // 1. Run Core Engine (App Extraction)
            const result = await coreEngineService.analyze({
                filePath: filePath,
                contractDate: '2024-01-01',
                options: { chunkSize: 1024 * 50 }
            });

            const extractedEvents = result.events || [];
            const extractedDates = new Set(extractedEvents.map(e => e.date));

            // 2. Load Ground Truth Report
            const reportContent = fs.readFileSync(reportPath, 'utf8');

            // 3. Extract Dates from Ground Truth
            // Regex to capture YYYY-MM-DD, YYYY.MM.DD
            const reportDates = (reportContent.match(/(\d{4})[-./](\d{2})[-./](\d{2})/g) || [])
                .map(d => d.replace(/[./]/g, '-'));

            const uniqueReportDates = [...new Set(reportDates)];

            // 4. Check Coverage
            let matchCount = 0;
            const missingDates = [];

            uniqueReportDates.forEach(date => {
                if (extractedDates.has(date)) {
                    matchCount++;
                } else {
                    missingDates.push(date);
                }
            });

            const coverageScore = uniqueReportDates.length > 0 ? Math.round((matchCount / uniqueReportDates.length) * 100) : 100;

            console.log(`Coverage: ${coverageScore}% (${matchCount}/${uniqueReportDates.length})`);
            if (missingDates.length > 0) {
                console.log(`   ❌ Missing Dates in App Extraction: ${missingDates.join(', ')}`);
            }

            results.push({
                id: caseId,
                coverageScore,
                missingDates
            });

        } catch (error) {
            console.error(`\n❌ Error processing ${caseId}: ${error.message}`);
        }
    }

    // Summary
    const avgCoverage = results.reduce((a, b) => a + b.coverageScore, 0) / results.length;
    console.log(`\n📊 Average Coverage Score: ${Math.round(avgCoverage)}%`);
}

verifyCoverage();
