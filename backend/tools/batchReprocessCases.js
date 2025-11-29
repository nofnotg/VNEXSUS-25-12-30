// Batch reprocessing from src/rag/case_sample_raw -> reports/case_sample_reprocessed/{ts}
// Generates CaseN.txt, CaseN_report.txt, CaseN_vnexsus.txt with validation and HTML report
import fs from 'fs';
import path from 'path';
import { logService } from '../utils/logger.js';
import * as pdfProcessor from '../utils/pdfProcessor.js';
import postProcessor from '../postprocess/index.js';
import * as visionService from '../services/visionService.js';
import { HOSPITAL_TEMPLATES } from '../../src/shared/constants/medical.js';

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, 'src', 'rag', 'case_sample_raw');
const CASE_SAMPLE_DIR = path.join(ROOT, 'src', 'rag', 'case_sample');
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_ROOT = path.join(ROOT, 'reports', 'case_sample_reprocessed', TS);
const OUT_CASE_DIR = path.join(OUT_ROOT, 'case_sample');
const MIN_TEXT_LENGTH = Number(process.env.MIN_TEXT_LENGTH || 32);

function ensureDirs() {
  fs.mkdirSync(OUT_CASE_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUT_ROOT, 'artifacts'), { recursive: true });
}

function classifyByName(fileName) {
  const low = fileName.toLowerCase();
  const isReport = ['종결보고서','중간보고서','손해사정보고서','최종보고서','보고서','리포트'].some(k => low.includes(k));
  const isMedical = ['진료','진단서','소견서','의무기록','차트','검사','영상','입원','퇴원','수술','처방','병원','의원','센터'].some(k => low.includes(k));
  return isReport ? 'actual_report' : (isMedical ? 'medical_doc' : 'other');
}

function listRawCaseDirs() {
  const entries = fs.readdirSync(RAW_DIR, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => ({ name: e.name, dir: path.join(RAW_DIR, e.name) }));
}

function nextCaseIndexStart() {
  // Default baseline 14 so we start at 15
  const files = fs.existsSync(CASE_SAMPLE_DIR) ? fs.readdirSync(CASE_SAMPLE_DIR) : [];
  const nums = files.map(f => {
    const m = f.match(/^Case(\d+)\.txt$/i);
    return m ? Number(m[1]) : null;
  }).filter(n => typeof n === 'number');
  const max = nums.length ? Math.max(...nums) : 14;
  return max + 1;
}

async function chooseLargestNonEmptyText(cands, useVision) {
  let best = null; let bestLen = -1;
  for (const c of cands) {
    try {
      const res = await pdfProcessor.processPdf(c.filePath, { useVision, forceOcr: true, saveTemp: false, cleanupTemp: true, fileName: c.name });
      const t = (res.text || '').trim();
      const len = t.length;
      if (len > bestLen && len >= MIN_TEXT_LENGTH) { bestLen = len; best = { ...c, text: t, meta: res }; }
    } catch (err) {
      logService.error(`[batch] extract fail ${c.name}: ${err?.message}`);
    }
  }
  return best; // may be null if all below threshold
}

function extractReportSummarySection(text) {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  const headingRegex = /(경과\s*요약\s*보고서|요약\s*보고서|경과\s*보고서)/i;
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) { startIdx = i; break; }
  }
  if (startIdx === -1) return '';

  const templateHeadings = Object.values(HOSPITAL_TEMPLATES).flatMap(t => [
    ...(t.reportStructure?.header ?? []),
    ...(t.reportStructure?.sections ?? []),
    ...(t.reportStructure?.footer ?? []),
  ]);
  const commonHeadings = ['환자정보','기본 정보','진단','검사결과','치료계획','결론','서명','의료진','작성일','Patient Info','Diagnosis','Lab Results','Plan','Conclusion'];
  const nextHeadingRegex = new RegExp(`^(${[...new Set([...templateHeadings, ...commonHeadings])]
    .map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\s*$`);

  let endIdx = lines.length;
  for (let j = startIdx + 1; j < lines.length; j++) {
    const line = lines[j].trim();
    if (line.length <= 40 && nextHeadingRegex.test(line)) { endIdx = j; break; }
  }
  return lines.slice(startIdx + 1, endIdx).join('\n').trim();
}

async function processSingleCase(rawDir, caseIndex, useVision) {
  const entries = fs.readdirSync(rawDir, { withFileTypes: true }).filter(e => e.isFile());
  const pdfs = entries.filter(e => /\.pdf$/i.test(e.name));
  if (pdfs.length === 0) {
    logService.warn(`[batch] ${path.basename(rawDir)} no pdf files`);
    return { ok: false };
  }
  const typed = pdfs.map(f => ({ name: f.name, filePath: path.join(rawDir, f.name), type: classifyByName(f.name) }));
  const reportCandidates = typed.filter(t => t.type === 'actual_report');
  const medicalCandidates = typed.filter(t => t.type === 'medical_doc');
  const otherCandidates = typed.filter(t => t.type === 'other');

  const sampleDoc = (medicalCandidates.length ? await chooseLargestNonEmptyText(medicalCandidates, useVision) : await chooseLargestNonEmptyText(otherCandidates, useVision));
  const reportDoc = reportCandidates.length ? await chooseLargestNonEmptyText(reportCandidates, useVision) : null;

  if (!sampleDoc) {
    logService.warn(`[batch] ${path.basename(rawDir)} no non-empty sample doc chosen (>=${MIN_TEXT_LENGTH})`);
    return { ok: false };
  }

  const sampleOut = path.join(OUT_CASE_DIR, `Case${caseIndex}.txt`);
  fs.writeFileSync(sampleOut, (sampleDoc.text || '').trim());

  let reportOutPath = null;
  let reportText = '';
  if (reportDoc && (reportDoc.text || '').length >= MIN_TEXT_LENGTH) {
    const summary = extractReportSummarySection(reportDoc.text || '');
    reportText = (summary && summary.length >= MIN_TEXT_LENGTH) ? summary : (reportDoc.text || '');
    reportOutPath = path.join(OUT_CASE_DIR, `Case${caseIndex}_report.txt`);
    fs.writeFileSync(reportOutPath, reportText.trim());
  }

  // Build vnexsus report via postprocess pipeline
  const mergedText = [sampleDoc.text, reportDoc?.text].filter(Boolean).join('\n\n');
  let vnexsusOutPath = null;
  if (mergedText.length >= MIN_TEXT_LENGTH) {
    try {
      const options = { reportFormat: 'text', reportTitle: '병력사항 요약 경과표', includeRawText: false, sortDirection: 'asc', periodType: 'all' };
      const result = await postProcessor.processForMainApp(mergedText, options);
      const final = result?.finalReport;
      if (final?.filePath && fs.existsSync(final.filePath)) {
        vnexsusOutPath = path.join(OUT_CASE_DIR, `Case${caseIndex}_vnexsus.txt`);
        const content = fs.readFileSync(final.filePath, 'utf8');
        fs.writeFileSync(vnexsusOutPath, content, 'utf8');
      } else {
        logService.warn(`[batch] vnexsus final file missing for Case${caseIndex}`);
      }
    } catch (err) {
      logService.error(`[batch] vnexsus build fail Case${caseIndex}: ${err.message}`);
    }
  }

  return {
    ok: true,
    caseIndex,
    sampleOut,
    reportOut: reportOutPath,
    vnexsusOut: vnexsusOutPath,
    rawDir,
    chosen: { sample: sampleDoc?.name, report: reportDoc?.name },
    lengths: { sample: sampleDoc?.text?.length || 0, report: reportText.length || 0, merged: mergedText.length || 0 }
  };
}

function validateOutputs(startIndex, endIndex) {
  const issues = [];
  const existsCase = (i, suffix='') => fs.existsSync(path.join(OUT_CASE_DIR, `Case${i}${suffix}.txt`));
  const readLen = (i, suffix='') => {
    const fp = path.join(OUT_CASE_DIR, `Case${i}${suffix}.txt`);
    return fs.existsSync(fp) ? (fs.readFileSync(fp, 'utf8').trim().length) : 0;
  };
  for (let i = startIndex; i <= endIndex; i++) {
    const hasTxt = existsCase(i);
    const hasReport = existsCase(i, '_report');
    const hasV = existsCase(i, '_vnexsus');
    if (!hasTxt) issues.push({ case: i, type: 'missing', file: 'CaseN.txt' });
    if (hasTxt && readLen(i) === 0) issues.push({ case: i, type: 'empty', file: 'CaseN.txt' });
    if (hasReport && readLen(i, '_report') === 0) issues.push({ case: i, type: 'empty', file: 'CaseN_report.txt' });
    if (hasV && readLen(i, '_vnexsus') === 0) issues.push({ case: i, type: 'empty', file: 'CaseN_vnexsus.txt' });
  }
  fs.writeFileSync(path.join(OUT_ROOT, 'validation.json'), JSON.stringify({ startIndex, endIndex, issues }, null, 2));
  return issues;
}

function compareReports(caseIndex, rawText, appReportText) {
  const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const a = normalize(rawText);
  const b = normalize(appReportText);
  const jaccard = (() => {
    const ta = new Set(a.split(/\s+/));
    const tb = new Set(b.split(/\s+/));
    const inter = [...ta].filter(x => tb.has(x)).length;
    const union = new Set([...ta, ...tb]).size;
    return union ? inter / union : 0;
  })();
  const keywords = ['보험','병원','진단','경과','보고서'];
  const contains = Object.fromEntries(keywords.map(k => [k, b.includes(k)]));
  const lengthRatio = a.length ? (b.length / a.length) : 0;
  const bulletLines = (appReportText || '').split(/\r?\n/).filter(l => /^[-*•]/.test(l.trim())).length;
  return { caseIndex, jaccard, keywords: contains, lengthRatio, bulletLines };
}

async function run() {
  ensureDirs();
  const status = await visionService.getServiceStatus();
  const useVision = !!status?.available;
  if (!useVision) {
    logService.error('[batch] Vision OCR unavailable. Set ENABLE_VISION_OCR=true and USE_VISION=true.');
  }

  const rawDirs = listRawCaseDirs();
  let caseIdx = nextCaseIndexStart();
  // Allow override via env or CLI arg
  const envStart = process.env.START_CASE_INDEX ? Number(process.env.START_CASE_INDEX) : undefined;
  const cliArg = process.argv.find(a => /^--start=\d+$/.test(a));
  const cliStart = cliArg ? Number(cliArg.split('=')[1]) : undefined;
  const requestedStart = envStart ?? cliStart;
  if (typeof requestedStart === 'number' && Number.isFinite(requestedStart)) {
    caseIdx = requestedStart;
  }
  if (caseIdx < 15) caseIdx = 15; // enforce minimum start at 15
  const processed = [];
  const perf = { totalFiles: 0, ocrSuccess: 0, scannedPdf: 0, durations: [] };

  for (const r of rawDirs) {
    const res = await processSingleCase(r.dir, caseIdx, useVision);
    if (res.ok) {
      processed.push(res);
      caseIdx += 1;
      perf.totalFiles += 1;
      // no granular time collected here; pdfProcessor logs detail already
    }
  }

  const startIndex = processed.length ? processed[0].caseIndex : caseIdx;
  const endIndex = processed.length ? processed[processed.length - 1].caseIndex : (caseIdx - 1);

  const manifest = { ts: TS, outDir: OUT_CASE_DIR, startIndex, endIndex, processed };
  fs.writeFileSync(path.join(OUT_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const issues = validateOutputs(startIndex, endIndex);

  // Comparative analysis (best-effort): compare app report with raw report candidate
  const comparisons = [];
  for (const p of processed) {
    try {
      // Prefer VNEXSUS output for app-side comparison
      if (!p.vnexsusOut) continue;
      const appReportText = fs.readFileSync(p.vnexsusOut, 'utf8');
      // Baseline: re-OCR the chosen report file and extract summary section
      const chosenReportFile = p.chosen?.report;
      if (!chosenReportFile) continue;
      const rawReportPath = path.join(p.rawDir, chosenReportFile);
      const res = await pdfProcessor.processPdf(rawReportPath, { useVision, forceOcr: true, saveTemp: false, cleanupTemp: true, fileName: chosenReportFile });
      const rawSummary = extractReportSummarySection((res.text || '').trim());
      comparisons.push(compareReports(p.caseIndex, rawSummary || res.text || '', appReportText));
    } catch (err) {
      logService.warn(`[batch] compare fail Case${p.caseIndex}: ${err.message}`);
    }
  }
  fs.writeFileSync(path.join(OUT_ROOT, 'comparison.json'), JSON.stringify({ comparisons }, null, 2));

  // HTML report
  const html = `<!doctype html>
  <html lang="ko"><head><meta charset="utf-8" />
  <title>케이스 재처리 리포트 (${TS})</title>
  <style>body{font-family:system-ui,Segoe UI,Arial;padding:20px;color:#222} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#f4f4f4} .ok{color:#0a7} .bad{color:#c33}</style>
  </head><body>
  <h1>케이스 재처리 리포트</h1>
  <p>출력 디렉토리: <code>${OUT_CASE_DIR}</code></p>
  <h2>처리 범위</h2>
  <ul>
    <li>시작: Case${startIndex}</li>
    <li>끝: Case${endIndex}</li>
    <li>총 처리 케이스: ${processed.length}</li>
  </ul>
  <h2>유효성 검사</h2>
  <p>이슈 수: ${issues.length}</p>
  <table><thead><tr><th>Case</th><th>이슈 유형</th><th>파일</th></tr></thead><tbody>
    ${issues.map(i => `<tr><td>${i.case}</td><td>${i.type}</td><td>${i.file}</td></tr>`).join('')}
  </tbody></table>
  <h2>처리 매니페스트</h2>
  <table><thead><tr><th>Case</th><th>Raw Dir</th><th>선택 샘플</th><th>선택 보고서</th><th>길이(샘플/보고서/병합)</th></tr></thead><tbody>
    ${processed.map(p => `<tr><td>${p.caseIndex}</td><td>${path.basename(p.rawDir)}</td><td>${p.chosen.sample || '-'}</td><td>${p.chosen.report || '-'}</td><td>${p.lengths.sample}/${p.lengths.report}/${p.lengths.merged}</td></tr>`).join('')}
  </tbody></table>
  <h2>보고서 비교 분석(VNEXSUS vs Raw 요약)</h2>
  <table><thead><tr><th>Case</th><th>자카드 유사도</th><th>길이비율(App/Raw)</th><th>리스트 라인 수</th><th>키워드(보험/병원/진단/경과/보고서)</th></tr></thead><tbody>
    ${comparisons.map(c => `<tr><td>${c.caseIndex}</td><td>${(c.jaccard*100).toFixed(1)}%</td><td>${c.lengthRatio.toFixed(2)}</td><td>${c.bulletLines}</td><td>${['보험','병원','진단','경과','보고서'].map(k=>c.keywords[k]?'✅':'❌').join(' / ')}</td></tr>`).join('')}
  </tbody></table>
  <h2>개발 현황 평가</h2>
  <ul>
    <li>Vision OCR 가용성: ${useVision ? '활성' : '비활성'} (환경변수 필요)</li>
    <li>빈 파일 방지 임계치: ${MIN_TEXT_LENGTH}자</li>
    <li>성능 측정: 상세 로그에 처리시간 출력(logger)</li>
  </ul>
  <h2>개선 제안</h2>
  <ul>
    <li>문서별 OCR 재시도 및 백오프 추가</li>
    <li>보고서 섹션 추출 시 병원별 템플릿 확장</li>
    <li>키워드·구조 검증을 통합 파이프라인 단계로 승격</li>
    <li>에러·빈출 포맷(XFA 등) 대응전략 수립</li>
  </ul>
  </body></html>`;
  const htmlPath = path.join(OUT_ROOT, 'report.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  logService.info(`[batch] completed. Outputs at ${OUT_ROOT}`);
}

run().catch(err => { logService.error(`[batch] failed: ${err.message}`); process.exit(1); });
