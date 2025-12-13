import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CoreEngineService from './backend/services/coreEngineService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugExtraction() {
    const coreEngine = new CoreEngineService();
    const caseFile = path.join(__dirname, 'src/rag/case_sample/Case2.txt');
    const text = fs.readFileSync(caseFile, 'utf-8');

    console.log('Analyzing Case2...');
    const result = await coreEngine.analyze({ text });

    console.log(`Extracted ${result.events.length} events.`);

    // Check for specific missing date
    const targetDate = '2025-02-04';
    const found = result.events.find(e => e.date === targetDate);

    if (found) {
        console.log(`✅ Found target date ${targetDate}:`, found);
    } else {
        console.log(`❌ Target date ${targetDate} NOT found!`);
    }

    // Print all dates to see coverage
    const dates = result.events.map(e => e.date).sort();
    console.log('All Extracted Dates:', [...new Set(dates)]);
}

debugExtraction();
