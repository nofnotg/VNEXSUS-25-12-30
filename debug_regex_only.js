import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runRegexExtraction(text) {
    if (!text) return [];

    const records = [];
    const lines = text.split('\n');
    // Enhanced Regex to capture YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
    const dateRegex = /(\d{4})[-./](\d{2})[-./](\d{2})/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const dateMatch = line.match(dateRegex);

        if (dateMatch) {
            records.push({
                date: dateMatch[0].replace(/[./]/g, '-'), // Normalize to YYYY-MM-DD
                content: line
            });
        }
    }
    return records;
}

const caseFile = path.join(__dirname, 'src/rag/case_sample/Case2.txt');
const text = fs.readFileSync(caseFile, 'utf-8');

console.log('Analyzing Case2 with Regex...');
const events = runRegexExtraction(text);

console.log(`Extracted ${events.length} events.`);

const targetDate = '2025-02-04';
const found = events.find(e => e.date === targetDate);

if (found) {
    console.log(`✅ Found target date ${targetDate}:`, found);
} else {
    console.log(`❌ Target date ${targetDate} NOT found!`);
}

const dates = events.map(e => e.date).sort();
console.log('All Extracted Dates:', [...new Set(dates)]);
