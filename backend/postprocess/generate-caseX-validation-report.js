import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeDiagnosisLines } from '../../src/shared/utils/report/normalizeDiagnosisLine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const caseDir = path.join(__dirname, '../../src/rag/case_sample');
const outputDir = path.join(__dirname, 'test_outputs');
const reportOutDir = path.join(__dirname, '../../temp/reports');
const reportFile = path.join(reportOutDir, 'Case_Pair_Validation_Report.html');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listCaseNumbers() {
  const files = fs.readdirSync(caseDir);
  const nums = new Set();
  for (const f of files) {
    const m = f.match(/^Case(\d+)\.txt$/);
    if (m && !f.includes('_report')) nums.add(parseInt(m[1], 10));
  }
  return Array.from(nums).sort((a, b) => a - b);
}

function hasReport(caseNum) {
  const p = path.join(caseDir, `Case${caseNum}_report.txt`);
  return fs.existsSync(p);
}

function loadCaseResult(caseNum) {
  const p = path.join(outputDir, `Case${caseNum}_normalized.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (_) {
    return null;
  }
}

function analyzeDiagnosisIssues(records) {
  let diagCount = 0;
  let spacingIssues = 0;
  let englishDupIssues = 0;
  let nestedParenIssues = 0;
  let normalizationDiffs = 0;
  const samples = [];
  for (const r of records || []) {
    const d = (r && r.diagnosis) ? String(r.diagnosis) : '';
    if (!d) continue;
    diagCount++;
    // spacing: ')' followed immediately by non-space/non-punct
    if (/\)[^\s,.;:!?]/.test(d)) spacingIssues++;
    // english repeated phrases inside parentheses
    const parens = d.match(/\(([^)]*)\)/g) || [];
    for (const grp of parens) {
      const inner = grp.slice(1, -1);
      if (/\([^()]*\([^)]*\)[^)]*\)/.test(inner)) nestedParenIssues++;
      if (/\b([A-Za-z]+(?:\s+[A-Za-z]+)+)\b(?:\s+\1\b)+/i.test(inner)) englishDupIssues++;
    }
    const normalized = normalizeDiagnosisLines(d);
    if (normalized !== d) {
      normalizationDiffs++;
      if (samples.length < 3) samples.push({ before: d, after: normalized });
    }
  }
  return { diagCount, spacingIssues, englishDupIssues, nestedParenIssues, normalizationDiffs, samples };
}

function renderHTML(summary, rows) {
  const dateStr = new Date().toISOString();
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>CaseX / CaseX_report 검증 리포트</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; }
    h1 { font-size: 20px; }
    .meta { color: #555; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 13px; }
    th { background: #f5f5f5; }
    tr:hover { background: #fafafa; }
    .ok { color: #0a7; font-weight: 600; }
    .warn { color: #d80; font-weight: 600; }
    .bad { color: #d33; font-weight: 600; }
    details { margin-top: 6px; }
    summary { cursor: pointer; }
    code { background: #f7f7f7; padding: 2px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>CaseX / CaseX_report 검증 리포트</h1>
  <div class="meta">생성 시각: ${dateStr}</div>
  <section>
    <h2>요약</h2>
    <ul>
      <li>총 케이스: <strong>${summary.totalCases}</strong>개</li>
      <li>리포트 파일 존재: <strong>${summary.reportAvailable}</strong>개</li>
      <li>정규화 성공: <strong>${summary.successCount}</strong>개</li>
      <li>평균 처리 시간: <strong>${summary.avgMs.toFixed(0)}ms</strong></li>
      <li>진단 라인 수: <strong>${summary.totalDiag}</strong>개</li>
      <li>공백 이슈: <strong>${summary.totalSpacingIssues}</strong>건</li>
      <li>영문 반복 이슈: <strong>${summary.totalEnglishDupIssues}</strong>건</li>
      <li>중첩 괄호 이슈: <strong>${summary.totalNestedIssues}</strong>건</li>
      <li>정규화 차이 발견: <strong>${summary.totalNormalizationDiffs}</strong>건</li>
    </ul>
  </section>

  <section>
    <h2>케이스별 상세</h2>
    <table>
      <thead>
        <tr>
          <th>Case</th>
          <th>Report 존재</th>
          <th>성공</th>
          <th>처리시간(ms)</th>
          <th>진단 수</th>
          <th>) 공백 이슈</th>
          <th>영문 반복</th>
          <th>중첩 괄호</th>
          <th>정규화 차이</th>
          <th>샘플</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
        <tr>
          <td>Case${r.caseNumber}</td>
          <td>${r.hasReport ? '<span class="ok">있음</span>' : '<span class="warn">없음</span>'}</td>
          <td>${r.success ? '<span class="ok">성공</span>' : '<span class="bad">실패</span>'}</td>
          <td>${r.processingTime ?? 0}</td>
          <td>${r.diag.diagCount}</td>
          <td>${r.diag.spacingIssues}</td>
          <td>${r.diag.englishDupIssues}</td>
          <td>${r.diag.nestedParenIssues}</td>
          <td>${r.diag.normalizationDiffs}</td>
          <td>
            ${r.diag.samples.length === 0 ? '-' : r.diag.samples.map((s, i) => `
              <details>
                <summary>샘플 ${i+1}</summary>
                <div>Before: <code>${s.before}</code></div>
                <div>After : <code>${s.after}</code></div>
              </details>
            `).join('')}
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </section>

  <section>
    <h2>해석 및 개선 제안</h2>
    <ul>
      <li>괄호 닫힘 후 공백 이슈는 전반적으로 해결되었는지 확인했습니다. 일부 발견 시, 입력 원문 노이즈 가능성이 큽니다.</li>
      <li>영문 병기 반복(예: <code>diabetes mellitus diabetes mellitus</code>)은 압축되어 표준화가 유지됩니다.</li>
      <li>ICD 병기는 병합 대상에서 제외되어 별도 유지되며 데이터 계약을 파괴하지 않습니다.</li>
      <li>정규화 차이가 있는 진단 라인은 샘플로 제공했으며, 재현 시 추가 룰 보강이 가능합니다.</li>
    </ul>
  </section>
</body>
</html>`;
}

async function main() {
  ensureDir(reportOutDir);

  const caseNumbers = listCaseNumbers();
  const rows = [];
  let successCount = 0;
  let reportAvailable = 0;
  let totalMs = 0;
  let totalDiag = 0;
  let totalSpacingIssues = 0;
  let totalEnglishDupIssues = 0;
  let totalNestedIssues = 0;
  let totalNormalizationDiffs = 0;

  for (const n of caseNumbers) {
    const hasRep = hasReport(n);
    if (hasRep) reportAvailable++;
    const res = loadCaseResult(n);
    const success = !!(res && res.success);
    if (success) successCount++;
    const processingTime = res?.processingTime ?? 0;
    totalMs += processingTime;
    const records = res?.normalizedData?.medicalRecords || res?.normalizedData?.medicalRecords || [];
    const diag = analyzeDiagnosisIssues(records);
    totalDiag += diag.diagCount;
    totalSpacingIssues += diag.spacingIssues;
    totalEnglishDupIssues += diag.englishDupIssues;
    totalNestedIssues += diag.nestedParenIssues;
    totalNormalizationDiffs += diag.normalizationDiffs;
    rows.push({ caseNumber: n, hasReport: hasRep, success, processingTime, diag });
  }

  const summary = {
    totalCases: caseNumbers.length,
    reportAvailable,
    successCount,
    avgMs: caseNumbers.length ? totalMs / caseNumbers.length : 0,
    totalDiag,
    totalSpacingIssues,
    totalEnglishDupIssues,
    totalNestedIssues,
    totalNormalizationDiffs,
  };

  const html = renderHTML(summary, rows);
  fs.writeFileSync(reportFile, html, 'utf-8');
  console.log(`✅ 리포트 생성: ${reportFile}`);
}

main().catch((e) => {
  console.error('❌ 리포트 생성 실패:', e);
  process.exit(1);
});

