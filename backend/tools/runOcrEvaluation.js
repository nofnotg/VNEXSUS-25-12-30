// ESM runtime script to execute OCR evaluation batch without TypeScript runtime
import fs from 'fs';
import path from 'path';
import * as pdfProcessor from '../utils/pdfProcessor.js';
import * as visionService from '../services/visionService.js';
import { logService } from '../utils/logger.js';

function classifyByName(fileName) {
  const low = fileName.toLowerCase();
  const isReport = ['종결보고서','중간보고서','손해사정보고서','최종보고서'].some(k => low.includes(k));
  const isMedical = ['진료','진단서','소견서','의무기록','차트','검사','영상','입원','퇴원','수술','처방','병원','의원','센터'].some(k => low.includes(k));
  return isReport ? 'actual_report' : (isMedical ? 'medical_doc' : 'other');
}

function charAccuracy(a, b) {
  const lenA = a.length, lenB = b.length; if (!lenA && !lenB) return 1;
  const dp = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  const dist = dp[lenA][lenB]; const mx = Math.max(lenA, lenB);
  return mx === 0 ? 1 : 1 - dist / mx;
}

async function evaluateCase(caseDir, outDir) {
  const caseId = path.basename(caseDir);
  const files = fs.readdirSync(caseDir, { withFileTypes: true }).filter(e => e.isFile());
  const status = await visionService.getServiceStatus();
  const useVision = !!status?.available;
  const results = {};
  const metrics = {};
  for (const f of files) {
    const filePath = path.join(caseDir, f.name);
    const type = classifyByName(f.name);
    try {
      const parseOnly = await pdfProcessor.processPdf(filePath, { skipOcr: true, saveTemp: false, fileName: f.name });
      const ocr = await pdfProcessor.processPdf(filePath, { useVision, saveTemp: true, cleanupTemp: true, fileName: f.name });
      results[filePath] = { 
        success: ocr.success,
        textLength: ocr.textLength,
        textSource: ocr.textSource,
        isScannedPdf: ocr.isScannedPdf,
        ocrSource: ocr.ocrSource,
        processingTime: ocr.processingTime,
        type,
      };
      const acc = charAccuracy(parseOnly.text || '', ocr.text || '');
      metrics[filePath] = { charAccuracy: acc };
    } catch (e) {
      logService.error(`[batch] ${caseId} ${f.name} error: ${e.message}`);
    }
  }
  const outCase = path.join(outDir, caseId);
  fs.mkdirSync(outCase, { recursive: true });
  fs.writeFileSync(path.join(outCase, 'evaluation.simple.json'), JSON.stringify({ caseId, results, metrics }, null, 2));

  // Build Markdown summary
  const md = buildCaseMarkdown(caseId, results, metrics);
  fs.writeFileSync(path.join(outCase, 'README.md'), md);
}

async function run() {
  const rootDir = path.join(process.cwd(), 'src', 'rag', 'case_sample_raw');
  const outDir = path.join(process.cwd(), 'reports', 'evaluation');
  fs.mkdirSync(outDir, { recursive: true });
  const dirs = fs.readdirSync(rootDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(d => path.join(rootDir, d.name));
  logService.info(`[batch] start: ${dirs.length} cases`);
  for (const d of dirs) {
    await evaluateCase(d, outDir);
  }
  logService.info('[batch] complete');
}

run().catch(err => { logService.error(`[batch] failed: ${err.message}`); process.exit(1); });

function buildCaseMarkdown(caseId, results, metrics) {
  const rows = Object.keys(results).map(fp => {
    const r = results[fp];
    const m = metrics[fp] || {};
    const name = path.basename(fp);
    const acc = typeof m.charAccuracy === 'number' ? (m.charAccuracy * 100).toFixed(1) + '%' : '-';
    return `| ${name} | ${r.type} | ${r.ocrSource ?? r.textSource ?? '-'} | ${r.textLength ?? '-'} | ${acc} | ${r.processingTime ?? '-'}ms | ${r.success ? '✅' : '❌'} |`;
  });

  const total = rows.length;
  const ok = Object.values(results).filter(r => r.success).length;
  const scanned = Object.values(results).filter(r => r.isScannedPdf).length;

  return `# OCR Evaluation Report: ${caseId}

**Summary**
- Total files: ${total}
- Success: ${ok}
- Scanned PDFs: ${scanned}

**Details**
| File | Type | Source | Text Length | Char Accuracy | Time | OK |
| --- | --- | --- | ---: | ---: | ---: | --- |
${rows.join('\n')}
`;
}
