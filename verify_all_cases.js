import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CASE_DIR = path.join(__dirname, 'src/rag/case_sample');
const API_URL = 'http://localhost:3030/api/generate-report';
const OUTPUT_FILE = 'batch_verification_results.json';
const REPORT_FILE = 'Batch_Verification_Report.html';
const CONCURRENCY = 5;

async function verifyAllCases() {
    console.log(`Starting batch verification from: ${CASE_DIR} (Concurrency: ${CONCURRENCY})`);

    if (!fs.existsSync(CASE_DIR)) {
        console.error(`Directory not found: ${CASE_DIR}`);
        return;
    }

    const files = fs.readdirSync(CASE_DIR);
    const caseFiles = files.filter(f => f.match(/^Case\d+\.txt$/)).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
    });

    console.log(`Found ${caseFiles.length} case files.`);

    const results = [];

    // Process in chunks
    for (let i = 0; i < caseFiles.length; i += CONCURRENCY) {
        const chunk = caseFiles.slice(i, i + CONCURRENCY);
        console.log(`Processing chunk ${i / CONCURRENCY + 1}/${Math.ceil(caseFiles.length / CONCURRENCY)}: ${chunk.join(', ')}`);

        const chunkPromises = chunk.map(caseFile => processCase(caseFile));
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`Saved results to ${OUTPUT_FILE}`);

    generateHtmlReport(results);
}

async function processCase(caseFile) {
    const caseId = caseFile.replace('.txt', '');
    const reportFile = `${caseId}_report.txt`;
    const casePath = path.join(CASE_DIR, caseFile);
    const reportPath = path.join(CASE_DIR, reportFile);

    try {
        const caseText = fs.readFileSync(casePath, 'utf8');
        let referenceReport = '';
        if (fs.existsSync(reportPath)) {
            referenceReport = fs.readFileSync(reportPath, 'utf8');
        }

        const startTime = Date.now();
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: caseText,
                sessionId: `batch_verify_${caseId}_${Date.now()}`,
                options: {
                    skipLLM: false,
                    useNineItem: true,
                    enableTranslationEnhancement: true
                }
            })
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        let success = false;
        let generatedReport = '';
        let error = null;

        if (response.ok) {
            const json = await response.json();
            if (json.success) {
                success = true;
                generatedReport = json.report || JSON.stringify(json, null, 2);
            } else {
                error = json.message || 'Unknown API error';
            }
        } else {
            error = `HTTP ${response.status} ${response.statusText}`;
        }

        // Simple similarity check
        let similarity = 0;
        if (referenceReport && generatedReport) {
            const setA = new Set(referenceReport.split(/\s+/));
            const setB = new Set(generatedReport.split(/\s+/));
            const intersection = new Set([...setA].filter(x => setB.has(x)));
            const union = new Set([...setA, ...setB]);
            similarity = intersection.size / union.size;
        }

        console.log(`  -> ${caseId}: ${success ? 'Success' : 'Failed'} (${duration}ms)`);

        return {
            caseId,
            success,
            duration,
            error,
            hasReference: !!referenceReport,
            similarity: similarity.toFixed(4),
            generatedReportLength: generatedReport.length,
            referenceReportLength: referenceReport.length
        };

    } catch (err) {
        console.error(`  -> Error processing ${caseId}:`, err);
        return {
            caseId,
            success: false,
            error: err.message
        };
    }
}

function generateHtmlReport(results) {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    const avgDuration = results.reduce((acc, r) => acc + (r.duration || 0), 0) / results.length;

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>Batch Verification Report</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { padding: 20px; background: #f8fafc; }
        .card { margin-bottom: 20px; border: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-success { color: #16a34a; font-weight: bold; }
        .status-fail { color: #dc2626; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="mb-4">Batch Verification Report</h1>
        
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card p-3 text-center">
                    <h3>${results.length}</h3>
                    <div class="text-muted">Total Cases</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card p-3 text-center">
                    <h3 class="text-success">${successCount}</h3>
                    <div class="text-muted">Success</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card p-3 text-center">
                    <h3 class="text-danger">${failCount}</h3>
                    <div class="text-muted">Failed</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card p-3 text-center">
                    <h3>${(avgDuration / 1000).toFixed(2)}s</h3>
                    <div class="text-muted">Avg Duration</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Case ID</th>
                            <th>Status</th>
                            <th>Duration</th>
                            <th>Reference</th>
                            <th>Similarity</th>
                            <th>Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(r => `
                            <tr>
                                <td>${r.caseId}</td>
                                <td class="${r.success ? 'status-success' : 'status-fail'}">${r.success ? 'PASS' : 'FAIL'}</td>
                                <td>${r.duration ? (r.duration / 1000).toFixed(2) + 's' : '-'}</td>
                                <td>${r.hasReference ? '✅' : '❌'}</td>
                                <td>${r.similarity || '0.0000'}</td>
                                <td class="text-danger">${r.error || ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    fs.writeFileSync(REPORT_FILE, html);
    console.log(`Saved report to ${REPORT_FILE}`);
}

verifyAllCases();
