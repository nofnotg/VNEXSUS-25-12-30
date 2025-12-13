import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CASE_DIR = path.join(__dirname, 'src/rag/case_sample');

function parseVnexusFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const events = [];
    const lines = content.split('\n');

    let currentEvent = {};

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        if (line.startsWith('날짜:')) {
            if (currentEvent.date) events.push(currentEvent);
            currentEvent = { date: line.replace('날짜:', '').trim() };
        } else if (line.startsWith('병원명:')) {
            currentEvent.hospital = line.replace('병원명:', '').trim();
        } else if (line.startsWith('진단명:')) {
            currentEvent.diagnosis = line.replace('진단명:', '').trim();
        } else if (line.startsWith('치료내용:')) {
            currentEvent.treatment = line.replace('치료내용:', '').trim();
        }
    });
    if (currentEvent.date) events.push(currentEvent);
    return events;
}

function parseGeneratedReport(reportContent) {
    // Simple extraction of dates and keywords for now
    const dates = reportContent.match(/\d{4}[-.]\d{2}[-.]\d{2}/g) || [];
    return dates.map(d => d.replace(/\./g, '-'));
}

function verifySubset(caseId) {
    const vnexusPath = path.join(CASE_DIR, `${caseId}_vnexsus.txt`);
    const reportPath = path.join(CASE_DIR, `${caseId}_report.txt`); // Using Ground Truth for now as proxy for "Good Generation"

    if (!fs.existsSync(vnexusPath)) {
        console.log(`Skipping ${caseId}: No vnexsus.txt found`);
        return;
    }

    console.log(`Analyzing ${caseId}...`);
    const vnexusEvents = parseVnexusFile(vnexusPath);
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    const reportDates = parseGeneratedReport(reportContent);

    const vnexusDates = new Set(vnexusEvents.map(e => e.date));

    let matchCount = 0;
    let mismatchCount = 0;
    const mismatches = [];

    reportDates.forEach(date => {
        if (vnexusDates.has(date)) {
            matchCount++;
        } else {
            mismatchCount++;
            mismatches.push(date);
        }
    });

    const inclusionRate = (matchCount / reportDates.length) * 100;

    console.log(`   Inclusion Rate: ${inclusionRate.toFixed(2)}%`);
    console.log(`   Matches: ${matchCount}, Mismatches: ${mismatchCount}`);
    if (mismatches.length > 0) {
        console.log(`   Mismatched Dates in Report:`, mismatches);
    }
}

verifySubset('Case2');
