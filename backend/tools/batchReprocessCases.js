// Batch reprocessing from src/rag/case_sample_raw -> reports/case_sample_reprocessed/{ts}
// Generates CaseN.txt, CaseN_report.txt, CaseN_vnexsus.txt with validation and HTML report
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logService } from '../utils/logger.js';
import * as pdfProcessor from '../utils/pdfProcessor.js';
import postProcessor from '../postprocess/index.js';
import { SourceSpanManager } from '../postprocess/sourceSpanManager.js';
import * as visionService from '../services/visionService.js';
import ReportSubsetValidator from '../eval/report_subset_validator.js';
import { HOSPITAL_TEMPLATES } from '../../src/shared/constants/medical.js';

const ROOT = process.cwd();
try {
  const secureEnv = path.join(ROOT, '.env.secure');
  const defaultEnv = path.join(ROOT, '.env');
  const envPath = fs.existsSync(secureEnv) ? secureEnv : defaultEnv;
  dotenv.config({ path: envPath });

  for (const [k, raw] of Object.entries(process.env)) {
    if (typeof raw !== 'string') continue;
    const replaced = raw.replace(/\$\{([A-Z0-9_]+)\}/g, (_m, name) => (process.env[name] ?? _m));
    if (replaced !== raw) process.env[k] = replaced;
  }

  const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (typeof cred === 'string' && /\$\{[A-Z0-9_]+\}/.test(cred)) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  const embeddedCred = path.join(ROOT, 'backend', 'config', 'gcp-service-account-key.json');
  const resolvedCred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if ((!resolvedCred || (typeof resolvedCred === 'string' && !fs.existsSync(resolvedCred))) && fs.existsSync(embeddedCred)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = embeddedCred;
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasCredFile = typeof credPath === 'string' && credPath.length > 0 && fs.existsSync(credPath);
  const hasApiKey = typeof process.env.GOOGLE_CLOUD_VISION_API_KEY === 'string' && process.env.GOOGLE_CLOUD_VISION_API_KEY.length > 0;
  const allowVision = process.env.USE_VISION !== 'false';
  if (allowVision && (hasCredFile || hasApiKey)) {
    if (process.env.ENABLE_VISION_OCR !== 'true') process.env.ENABLE_VISION_OCR = 'true';
    if (process.env.USE_VISION !== 'true') process.env.USE_VISION = 'true';
  }
} catch {
}
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const REPORTS_PDF_ROOT = (() => {
  const raw = process.env.REPORTS_PDF_ROOT;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
  }
  return 'C:\\VNEXSUS_reports_pdf';
})();
const DEFAULT_SAMPLE_PDF_DIR = path.join(REPORTS_PDF_ROOT, 'sample_pdf');
const DEFAULT_RAW_DIR = path.join(ROOT, 'src', 'rag', 'case_sample_raw');
const CASE_SAMPLE_DIR = path.join(ROOT, 'src', 'rag', 'case_sample');

const parseCliArg = (prefix) => {
  const a = process.argv.find(v => v.startsWith(prefix));
  return a ? a.slice(prefix.length) : null;
};

const cliInput = parseCliArg('--input=');
const envInput = process.env.INPUT_DIR;
const inputCandidate = envInput || cliInput;
const INPUT_DIR = inputCandidate
  ? (path.isAbsolute(inputCandidate) ? inputCandidate : path.join(ROOT, inputCandidate))
  : (fs.existsSync(DEFAULT_SAMPLE_PDF_DIR) ? DEFAULT_SAMPLE_PDF_DIR : DEFAULT_RAW_DIR);

const MODE = path.basename(INPUT_DIR).toLowerCase() === 'sample_pdf' ? 'sample_pdf' : 'case_sample_raw';
const OUT_ROOT = path.join(REPORTS_PDF_ROOT, MODE === 'sample_pdf' ? 'VNEXSUS_Report' : 'case_sample_reprocessed', TS);
const OUT_CASE_DIR = OUT_ROOT;
const MIN_TEXT_LENGTH = Number(process.env.MIN_TEXT_LENGTH || 32);
const DOC_TEXT_LENGTH_MIN = Number(process.env.DOC_TEXT_LENGTH_MIN || 32);
const INCLUDE_REPORT_PDF_IN_INPUT = process.env.INCLUDE_REPORT_PDF_IN_INPUT === 'true';
const FORCE_OCR = process.env.FORCE_OCR !== 'false';
const MAX_OCR_PAGES = (() => {
  const raw = process.env.MAX_OCR_PAGES;
  const n = typeof raw === 'string' && raw.length > 0 ? Number(raw) : Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return null;
})();
const LOCAL_OCR_DEFAULT_MAX_PAGES = (() => {
  const raw = process.env.LOCAL_OCR_DEFAULT_MAX_PAGES;
  const n = typeof raw === 'string' && raw.length > 0 ? Number(raw) : Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 10;
})();
const PARALLEL_LIMIT = (() => {
  const cliParallel = parseCliArg('--parallel=');
  const raw = process.env.PARALLEL_LIMIT ?? cliParallel ?? '';
  const n = typeof raw === 'string' && raw.length > 0 ? Number(raw) : Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 4;
})();
function listDirs(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(p, d.name));
}
function pickLatestPreparedCoords() {
  const base = path.join(REPORTS_PDF_ROOT, 'prepared_coordinate_cases');
  if (!fs.existsSync(base)) return null;
  const stamps = listDirs(base);
  if (!stamps.length) return null;
  const scored = stamps.map(s => ({ dir: s, mtime: fs.statSync(s).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
  const latest = scored[0]?.dir;
  if (!latest) return null;
  const coords = path.join(latest, 'coords');
  return fs.existsSync(coords) ? coords : null;
}
const OCR_OVERRIDE_DIR = (() => {
  const cli = parseCliArg('--ocrOverrideDir=');
  const raw = process.env.OCR_OVERRIDE_DIR ?? cli ?? '';
  if (typeof raw === 'string' && raw.length > 0) {
    const p = path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
    return p;
  }
  const def = pickLatestPreparedCoords();
  return def || null;
})();

function pickOcrMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  return {
    success: !!meta.success,
    textLength: typeof meta.textLength === 'number' ? meta.textLength : undefined,
    pageCount: typeof meta.pageCount === 'number' ? meta.pageCount : undefined,
    isScannedPdf: typeof meta.isScannedPdf === 'boolean' ? meta.isScannedPdf : undefined,
    textSource: meta.textSource,
    ocrSource: meta.ocrSource,
    ocrRawPrefix: meta.ocrRawPrefix,
    ocrRawFiles: Array.isArray(meta.ocrRawFiles) ? meta.ocrRawFiles : undefined,
    hasBlocks: Array.isArray(meta.blocks) && meta.blocks.length > 0
  };
}

function normalizeWhitespace(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function computeJaccard(a, b) {
  const aa = normalizeWhitespace(a);
  const bb = normalizeWhitespace(b);
  if (!aa || !bb) return 0;
  const ta = new Set(aa.split(/\s+/));
  const tb = new Set(bb.split(/\s+/));
  const inter = [...ta].filter(x => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
}

function safeReadText(filePath) {
  try {
    if (!filePath) return '';
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return '';
  }
}

function effectiveTextLength(s) {
  if (typeof s !== 'string') return 0;
  return s.replace(/\s+/g, '').length;
}

function listBaselineReports() {
  if (!fs.existsSync(CASE_SAMPLE_DIR)) return [];
  const files = fs.readdirSync(CASE_SAMPLE_DIR);
  const reports = [];
  for (const f of files) {
    const m = f.match(/^Case(\d+)_report\.txt$/i);
    if (!m) continue;
    reports.push({
      caseNumber: Number(m[1]),
      filePath: path.join(CASE_SAMPLE_DIR, f)
    });
  }
  reports.sort((a, b) => a.caseNumber - b.caseNumber);
  return reports;
}

function sanitizeName(s) {
  return String(s || '').replace(/[^\w\-가-힣]/g, '_');
}

function findBestOcrBlock(blocks, anchorTerms) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  const terms = (anchorTerms || []).filter(t => typeof t === 'string' && t.trim().length >= 2);
  if (terms.length === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const b of blocks) {
    const t = (b?.text || '').replace(/\s+/g, ' ');
    if (!t) continue;
    let score = 0;
    for (const term of terms) {
      if (t.includes(term)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }

  if (!best || bestScore <= 0) return null;
  return { block: best, score: bestScore };
}

function buildEvidenceAndCoverage(organizedData, rawText, ocrBlocks) {
  const sourceSpanManager = new SourceSpanManager();
  const items = Array.isArray(organizedData) ? organizedData : [];
  const blocks = Array.isArray(ocrBlocks) ? ocrBlocks : [];
  const blocksWithBbox = blocks.filter(b => b?.bbox && Number.isFinite(b.bbox.width) && Number.isFinite(b.bbox.height) && (b.bbox.width > 0 || b.bbox.height > 0));
  const pagesCovered = new Set(blocksWithBbox.map(b => b.page).filter(n => typeof n === 'number' && Number.isFinite(n)));

  const pseudoEvents = [];
  let coordMatched = 0;
  const coordPages = new Set();
  const sampleMatches = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const tempEvent = {
      id: `item_${i + 1}`,
      date: it.date || '날짜미상',
      hospital: it.hospital || '병원명 미상',
      diagnosis: {
        name: it.diagnosis || it.diagnosisName || '',
        code: it.diagnosisCode || null
      },
      procedures: Array.isArray(it.procedures) ? it.procedures : []
    };

    const block = {
      date: tempEvent.date,
      hospital: tempEvent.hospital,
      diagnosis: tempEvent.diagnosis.name,
      diagnosisCode: tempEvent.diagnosis.code,
      procedures: tempEvent.procedures,
      rawText: it.content || it.rawText || ''
    };

    const span = sourceSpanManager.attachSourceSpan(tempEvent, rawText || '', block, blocks);
    pseudoEvents.push({ ...tempEvent, sourceSpan: span });

    const anchorTerms = Array.isArray(span?.anchorTerms) ? span.anchorTerms : [];
    const matched = findBestOcrBlock(blocksWithBbox, anchorTerms);
    if (matched) {
      coordMatched += 1;
      if (typeof matched.block.page === 'number' && Number.isFinite(matched.block.page)) {
        coordPages.add(matched.block.page);
      }
      if (sampleMatches.length < 10) {
        sampleMatches.push({
          itemIndex: i + 1,
          date: tempEvent.date,
          hospital: tempEvent.hospital,
          blockPage: matched.block.page,
          blockScore: matched.score,
          bbox: matched.block.bbox
        });
      }
    }
  }

  const attachment = sourceSpanManager.calculateAttachmentRate(pseudoEvents);
  const coordRate = items.length > 0 ? coordMatched / items.length : 0;

  return {
    items: {
      total: items.length,
      rawTextLength: (rawText || '').length
    },
    sourceSpan: {
      ...attachment,
      rate: Number(attachment.rate),
      ratePercent: `${(Number(attachment.rate) * 100).toFixed(1)}`
    },
    coordinates: {
      blocksTotal: blocks.length,
      blocksWithBbox: blocksWithBbox.length,
      pagesWithBbox: pagesCovered.size,
      matchedItems: coordMatched,
      matchRate: coordRate,
      matchRatePercent: `${(coordRate * 100).toFixed(1)}`,
      matchedPages: coordPages.size,
      sampleMatches
    }
  };
}

function ensureDirs() {
  fs.mkdirSync(OUT_CASE_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUT_ROOT, 'artifacts'), { recursive: true });
}

function classifyByName(fileName) {
  const low = fileName.toLowerCase();
  const isReport = [
    '종결보고서',
    '중간보고서',
    '손해사정보고서',
    '손해사정',
    '자문회신',
    '회신원',
    '최종보고서',
    '보고서',
    '리포트',
    '문답서',
    '사정서',
  ].some(k => low.includes(k));
  const isMedical = ['진료','진단서','소견서','의무기록','차트','검사','영상','입원','퇴원','수술','처방','병원','의원','센터'].some(k => low.includes(k));
  return isReport ? 'actual_report' : (isMedical ? 'medical_doc' : 'other');
}

function inferCaseIndexFromName(name) {
  if (typeof name !== 'string') return null;
  const m = name.match(/case\s*0*(\d+)/i) || name.match(/^0*(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function listRawCaseDirs() {
  const entries = fs.readdirSync(INPUT_DIR, { withFileTypes: true });
  const dirs = entries
    .filter(e => e.isDirectory())
    .map(e => ({ kind: 'dir', name: e.name, dir: path.join(INPUT_DIR, e.name), inferredCaseIndex: inferCaseIndexFromName(e.name) }));
  dirs.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const files = entries
    .filter(e => e.isFile() && /\.pdf$/i.test(e.name))
    .map(e => ({ kind: 'file', name: e.name, dir: INPUT_DIR, filePath: path.join(INPUT_DIR, e.name), inferredCaseIndex: inferCaseIndexFromName(e.name) }));
  files.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const cases = dirs.length > 0 ? dirs : files;
  const limitArg = parseCliArg('--limit=');
  const envLimit = process.env.LIMIT_CASES;
  const n = Number(envLimit || limitArg || 0);
  if (Number.isFinite(n) && n > 0) return cases.slice(0, n);
  return cases;
}

function nextCaseIndexStart() {
  if (MODE === 'sample_pdf') return 1;
  // Default baseline 14 so we start at 15
  const files = fs.existsSync(CASE_SAMPLE_DIR) ? fs.readdirSync(CASE_SAMPLE_DIR) : [];
  const nums = files.map(f => {
    const m = f.match(/^Case(\d+)\.txt$/i);
    return m ? Number(m[1]) : null;
  }).filter(n => typeof n === 'number');
  const max = nums.length ? Math.max(...nums) : 14;
  return max + 1;
}

async function ocrAllPdfs(typed, useVision) {
  const results = [];
  for (const t of typed) {
    try {
      const ext = typeof t?.ext === 'string' && t.ext.length > 0 ? t.ext : path.extname(t.filePath || '').toLowerCase();
      if (ext && ext !== '.pdf') {
        const buf = fs.readFileSync(t.filePath);
        let text = '';
        let ocrSource = 'none';
        if (useVision) {
          try {
            const imageRes = await visionService.extractTextFromImage(buf);
            text = (imageRes?.text || '').trim();
            ocrSource = 'vision_image';
          } catch (_) {
          }
        }

        if (effectiveTextLength(text) < DOC_TEXT_LENGTH_MIN) {
          const { createWorker } = await import('tesseract.js');
          const worker = await createWorker();
          try {
            const langRaw = typeof process.env.LOCAL_OCR_LANG === 'string' && process.env.LOCAL_OCR_LANG.trim().length > 0 ? process.env.LOCAL_OCR_LANG.trim() : 'kor+eng';
            await worker.loadLanguage(langRaw);
            await worker.initialize(langRaw);
            const rec = await worker.recognize(buf);
            text = (typeof rec?.data?.text === 'string' ? rec.data.text : '').trim();
            ocrSource = 'local_tesseract_image';
          } finally {
            await worker.terminate();
          }
        }

        const okText = effectiveTextLength(text) >= DOC_TEXT_LENGTH_MIN;
        const blocks = text.length > 0 ? [{ page: 1, text: text.slice(0, 512), bbox: { x: 0, y: 0, width: 1, height: 1 } }] : [];
        results.push({
          ...t,
          success: okText,
          text,
          meta: {
            success: okText,
            textLength: text.length,
            pageCount: 1,
            isScannedPdf: true,
            textSource: 'ocr_only',
            ocrSource,
            blocks,
            blocksSource: blocks.length > 0 ? 'synthetic_image' : 'none'
          }
        });
        continue;
      }
      const localMaxPages = MAX_OCR_PAGES ?? LOCAL_OCR_DEFAULT_MAX_PAGES;
      const res = await pdfProcessor.processPdf(t.filePath, {
        useVision,
        forceOcr: FORCE_OCR,
        skipOcr: false,
        useLocalOcr: true,
        enableVisionImageFallback: useVision,
        maxOcrPages: localMaxPages,
        collectBlocks: true,
        saveTemp: false,
        cleanupTemp: true,
        fileName: t.name
      });
      const text = (res.text || '').trim();
      const okText = effectiveTextLength(text) >= DOC_TEXT_LENGTH_MIN;
      results.push({
        ...t,
        success: !!res.success && okText,
        text,
        meta: res
      });
    } catch (err) {
      results.push({
        ...t,
        success: false,
        text: '',
        meta: null,
        error: err?.message
      });
    }
  }
  return results;
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

function collectPdfFilesRecursive(baseDir) {
  const out = [];
  const stack = [{ dir: baseDir, rel: '' }];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) break;
    let entries = [];
    try {
      entries = fs.readdirSync(cur.dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entries) {
      if (e.name === '.' || e.name === '..') continue;
      if (e.isDirectory()) {
        const nextRel = cur.rel ? path.join(cur.rel, e.name) : e.name;
        stack.push({ dir: path.join(cur.dir, e.name), rel: nextRel });
        continue;
      }
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!['.pdf', '.tif', '.tiff', '.png', '.jpg', '.jpeg'].includes(ext)) continue;
      const relPath = cur.rel ? path.join(cur.rel, e.name) : e.name;
      out.push({ name: relPath, filePath: path.join(cur.dir, e.name), baseName: e.name, ext });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return out;
}

async function processSingleCase(caseUnit, caseIndex, useVision) {
  const rawDir = caseUnit?.kind === 'file' ? caseUnit.dir : caseUnit?.dir;
  const caseName = caseUnit?.name ? String(caseUnit.name) : (rawDir ? path.basename(rawDir) : `Case${caseIndex}`);

  let ocrResults = null;
  let includedDocs = [];
  let excludedReports = [];
  let mergedText = '';
  let warnings = [];
  let mergedEffectiveLen = 0;
  let mergedOk = false;

  // Try offline overrides FIRST to allow offline-only processing without input PDFs
  const overrideRoot = OCR_OVERRIDE_DIR && fs.existsSync(OCR_OVERRIDE_DIR) ? OCR_OVERRIDE_DIR : null;
  const candidateDirs = overrideRoot ? [path.join(overrideRoot, `Case${caseIndex}`), path.join(overrideRoot, sanitizeName(caseName)), overrideRoot] : [];
  const overrideCaseDir = candidateDirs.find(p => p && fs.existsSync(p)) || overrideRoot;
  const overrideJson = overrideCaseDir ? (fs.existsSync(path.join(overrideCaseDir, `Case${caseIndex}_offline_ocr.json`)) ? path.join(overrideCaseDir, `Case${caseIndex}_offline_ocr.json`) : path.join(overrideCaseDir, `${sanitizeName(caseName)}_offline_ocr.json`)) : null;
  const overrideTxt = overrideCaseDir ? (fs.existsSync(path.join(overrideCaseDir, `Case${caseIndex}_merged.txt`)) ? path.join(overrideCaseDir, `Case${caseIndex}_merged.txt`) : path.join(overrideCaseDir, `${sanitizeName(caseName)}_merged.txt`)) : null;
  const overrideReportJson = overrideCaseDir ? (fs.existsSync(path.join(overrideCaseDir, `Case${caseIndex}_report.json`)) ? path.join(overrideCaseDir, `Case${caseIndex}_report.json`) : path.join(overrideCaseDir, `${sanitizeName(caseName)}_report.json`)) : null;
  const overrideReportTxt = overrideCaseDir ? (fs.existsSync(path.join(overrideCaseDir, `Case${caseIndex}_report.txt`)) ? path.join(overrideCaseDir, `Case${caseIndex}_report.txt`) : path.join(overrideCaseDir, `${sanitizeName(caseName)}_report.txt`)) : null;
  if (overrideRoot && (!overrideJson || !fs.existsSync(overrideJson) || !overrideTxt || !fs.existsSync(overrideTxt))) {
    return {
      ok: false,
      caseIndex,
      caseName,
      rawDir,
      reason: 'missing_offline_coords',
      warnings: ['coords_only_mode'],
      chosen: { includedFiles: [], excludedReports: [] },
      lengths: { sample: 0, report: 0, merged: 0 },
      effectiveLengths: { merged: 0, vnexsus: 0 },
      ocr: { sample: null, report: null, blocks: { total: 0 }, scannedPdfCount: 0, ocrSourceCounts: {}, blocksSourceCounts: {} },
      postprocessMs: null,
      coverage: null
    };
  }
  if (overrideJson && fs.existsSync(overrideJson) && overrideTxt && fs.existsSync(overrideTxt)) {
    try {
      const inject = JSON.parse(fs.readFileSync(overrideJson, 'utf-8'));
      mergedText = fs.readFileSync(overrideTxt, 'utf-8').trim();
      mergedEffectiveLen = effectiveTextLength(mergedText);
      mergedOk = mergedEffectiveLen >= MIN_TEXT_LENGTH;
      const blocks = Array.isArray(inject?.blocks) ? inject.blocks : [];
      const hasBbox = blocks.some(b => b?.bbox && Number.isFinite(b.bbox.width) && Number.isFinite(b.bbox.height) && (b.bbox.width > 0 || b.bbox.height > 0));
      if (!hasBbox) warnings.push('offline_blocks_missing_bbox');
      const pageCount = Number(inject?.pageCount || 0);
      ocrResults = [{
        name: `offline_case_${caseIndex}`,
        type: 'medical_doc',
        success: mergedOk,
        text: mergedText,
        meta: {
          success: mergedOk,
          textLength: mergedText.length,
          pageCount,
          isScannedPdf: false,
          textSource: 'offline_ocr',
          ocrSource: 'offline_ocr',
          blocks,
          blocksSource: 'offline_ocr'
        }
      }];
      includedDocs = [{ name: path.basename(overrideTxt) }];
      excludedReports = [];
    } catch (e) {
      warnings.push(`override_load_error:${e.message}`);
    }
  }
  if (!ocrResults && overrideReportJson && fs.existsSync(overrideReportJson) && overrideReportTxt && fs.existsSync(overrideReportTxt)) {
    try {
      const inject = JSON.parse(fs.readFileSync(overrideReportJson, 'utf-8'));
      mergedText = fs.readFileSync(overrideReportTxt, 'utf-8').trim();
      mergedEffectiveLen = effectiveTextLength(mergedText);
      mergedOk = mergedEffectiveLen >= MIN_TEXT_LENGTH;
      const blocks = Array.isArray(inject?.blocks) ? inject.blocks : [];
      const hasBbox = blocks.some(b => b?.bbox && Number.isFinite(b.bbox.width) && Number.isFinite(b.bbox.height) && (b.bbox.width > 0 || b.bbox.height > 0));
      if (!hasBbox) warnings.push('offline_blocks_missing_bbox');
      const pageCount = Number(inject?.pageCount || 0);
      ocrResults = [{
        name: `offline_case_${caseIndex}`,
        type: 'medical_doc',
        success: mergedOk,
        text: mergedText,
        meta: {
          success: mergedOk,
          textLength: mergedText.length,
          pageCount,
          isScannedPdf: false,
          textSource: 'offline_ocr',
          ocrSource: 'offline_ocr',
          blocks,
          blocksSource: 'offline_ocr'
        }
      }];
      includedDocs = [{ name: path.basename(overrideReportTxt) }];
      excludedReports = [];
    } catch (e) {
      warnings.push(`override_load_error:${e.message}`);
    }
  }

  // If no override available, proceed with actual input files
  const pdfs = caseUnit?.kind === 'file'
    ? [{ name: caseUnit.name, filePath: caseUnit.filePath, baseName: caseUnit.name, ext: path.extname(caseUnit.filePath || caseUnit.name || '').toLowerCase() }]
    : collectPdfFilesRecursive(rawDir);
  if (!ocrResults && pdfs.length === 0) {
    logService.warn(`[batch] ${caseName} no supported files and no offline overrides`);
    return { ok: false, caseIndex, caseName, rawDir, reason: 'no_input_files' };
  }
  const typed = ocrResults ? [] : pdfs.map(f => ({ name: f.name, filePath: f.filePath, ext: f.ext, type: classifyByName(f.baseName || f.name) }));
  if (!ocrResults) {
    ocrResults = await ocrAllPdfs(typed, useVision);
    includedDocs = ocrResults
      .filter(r => effectiveTextLength(r.text || '') >= DOC_TEXT_LENGTH_MIN)
      .filter(r => INCLUDE_REPORT_PDF_IN_INPUT || r.type !== 'actual_report');
    excludedReports = ocrResults
      .filter(r => effectiveTextLength(r.text || '') >= DOC_TEXT_LENGTH_MIN)
      .filter(r => r.type === 'actual_report');
    mergedText = includedDocs.map(r => r.text).filter(Boolean).join('\n\n');
    mergedEffectiveLen = effectiveTextLength(mergedText);
    mergedOk = mergedEffectiveLen >= MIN_TEXT_LENGTH;
    if (!mergedOk) {
      warnings.push(`merged_too_short(effective=${mergedEffectiveLen}<${MIN_TEXT_LENGTH})`);
      logService.warn(`[batch] ${path.basename(rawDir)} merged text too short (effective ${mergedEffectiveLen} < ${MIN_TEXT_LENGTH})`);
    }
  }

  const sampleOut = path.join(OUT_CASE_DIR, `Case${caseIndex}.txt`);
  fs.writeFileSync(sampleOut, mergedText.trim());

  let reportOutPath = null;
  let reportText = '';
  if (excludedReports.length > 0) {
    const firstReport = excludedReports[0];
    const summary = extractReportSummarySection(firstReport.text || '');
    reportText = (summary && summary.length >= MIN_TEXT_LENGTH) ? summary : (firstReport.text || '');
    reportOutPath = path.join(OUT_CASE_DIR, `Case${caseIndex}_report.txt`);
    fs.writeFileSync(reportOutPath, reportText.trim());
  }

  if (MODE === 'sample_pdf' && excludedReports.length > 0) {
    const firstReport = excludedReports[0];
    const summary = extractReportSummarySection(firstReport.text || '');
    const out = path.join(OUT_ROOT, 'artifacts', `Case${caseIndex}_report_ocr.txt`);
    fs.writeFileSync(out, (summary && summary.length >= MIN_TEXT_LENGTH ? summary : firstReport.text).trim(), 'utf8');
  }

  const fileSummary = ocrResults.map(r => ({
    name: r.name,
    type: r.type,
    success: r.success,
    textLength: (r.text || '').length,
    ocr: pickOcrMeta(r.meta),
    blocks: Array.isArray(r.meta?.blocks) ? r.meta.blocks.length : 0,
    blocksSource: r.meta?.blocksSource,
    ocrSource: r.meta?.ocrSource,
    textSource: r.meta?.textSource,
    isScannedPdf: r.meta?.isScannedPdf
  }));
  fs.writeFileSync(path.join(OUT_ROOT, 'artifacts', `Case${caseIndex}_inputs.json`), JSON.stringify({ caseIndex, caseName: path.basename(rawDir), files: fileSummary }, null, 2), 'utf8');
  const aggregatedBlocks = ocrResults.flatMap(r => (Array.isArray(r?.meta?.blocks) ? r.meta.blocks : []));
  if (aggregatedBlocks.length > 0) {
    fs.writeFileSync(path.join(OUT_ROOT, 'artifacts', `Case${caseIndex}_blocks.json`), JSON.stringify({ caseIndex, blocks: aggregatedBlocks }, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUT_ROOT, 'artifacts', `Case${caseIndex}_report.json`), JSON.stringify({ text: mergedText, blocks: aggregatedBlocks }, null, 2), 'utf8');
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['page','blockIndex','text','xMin','yMin','xMax','yMax','width','height','confidence','synthetic'].join(',')
    ];
    for (const b of aggregatedBlocks) {
      const bb = b.bbox || {};
      rows.push([
        b.page ?? '',
        b.blockIndex ?? '',
        esc(b.text ?? ''),
        bb.xMin ?? '',
        bb.yMin ?? '',
        bb.xMax ?? '',
        bb.yMax ?? '',
        bb.width ?? '',
        bb.height ?? '',
        typeof b.confidence === 'number' ? b.confidence : '',
        b.synthetic === true ? 'true' : 'false'
      ].join(','));
    }
    fs.writeFileSync(path.join(OUT_ROOT, 'artifacts', `Case${caseIndex}_blocks.csv`), rows.join('\n'), 'utf-8');
  } else {
    fs.writeFileSync(path.join(OUT_ROOT, 'artifacts', `Case${caseIndex}_report.json`), JSON.stringify({ text: mergedText, blocks: [] }, null, 2), 'utf8');
  }

  // Build vnexsus report via postprocess pipeline
  let vnexsusOutPath = null;
  let postprocessMs = null;
  let postResult = null;
  try {
    const options = { reportFormat: 'text', reportTitle: '병력사항 요약 경과표', includeRawText: false, sortDirection: 'asc', periodType: 'all' };
    const start = Date.now();
    if (mergedText.trim().length > 0) {
      postResult = await postProcessor.processForMainApp(mergedText, options);
      postprocessMs = Date.now() - start;
    } else {
      warnings.push('postprocess_skipped_empty_text');
    }

    const final = postResult?.finalReport;
    const finalTextPath = final?.results?.text?.filePath || final?.results?.json?.filePath || final?.filePath;
    if (finalTextPath && fs.existsSync(finalTextPath)) {
      vnexsusOutPath = path.join(OUT_CASE_DIR, `Case${caseIndex}_vnexsus.txt`);
      const content = fs.readFileSync(finalTextPath, 'utf8');
      fs.writeFileSync(vnexsusOutPath, content, 'utf8');
    } else {
      warnings.push('vnexsus_missing');
      logService.warn(`[batch] vnexsus final file missing for Case${caseIndex}`);
    }
  } catch (err) {
    warnings.push(`postprocess_error:${err.message}`);
    logService.error(`[batch] vnexsus build fail Case${caseIndex}: ${err.message}`);
  }
  if (!vnexsusOutPath) {
    vnexsusOutPath = path.join(OUT_CASE_DIR, `Case${caseIndex}_vnexsus.txt`);
    fs.writeFileSync(vnexsusOutPath, mergedText.trim(), 'utf8');
  }

  const vnexsusText = safeReadText(vnexsusOutPath);
  const vnexsusEffectiveLen = effectiveTextLength(vnexsusText);
  const vnexsusOk = vnexsusEffectiveLen >= MIN_TEXT_LENGTH;

  const allOcrBlocks = ocrResults.flatMap(r => (Array.isArray(r?.meta?.blocks) ? r.meta.blocks : []));
  const ocrMetaList = ocrResults.map(r => r?.meta).filter(Boolean);
  const scannedPdfCount = ocrMetaList.filter(m => m?.isScannedPdf === true).length;
  const ocrSourceCounts = ocrMetaList.reduce((acc, m) => {
    const k = typeof m?.ocrSource === 'string' && m.ocrSource.length > 0 ? m.ocrSource : 'none';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const blocksSourceCounts = ocrMetaList.reduce((acc, m) => {
    const k = typeof m?.blocksSource === 'string' && m.blocksSource.length > 0 ? m.blocksSource : (Array.isArray(m?.blocks) && m.blocks.length > 0 ? 'ocr' : 'none');
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const organized = Array.isArray(postResult?.organizedData) ? postResult.organizedData : [];
  const evidence = buildEvidenceAndCoverage(organized, mergedText, allOcrBlocks);

  return {
    ok: mergedOk && vnexsusOk,
    caseIndex,
    caseName,
    sampleOut,
    reportOut: reportOutPath,
    vnexsusOut: vnexsusOutPath,
    rawDir,
    reason: mergedOk && vnexsusOk ? null : (!mergedOk ? 'merged_too_short' : 'vnexsus_too_short'),
    warnings,
    chosen: {
      includedFiles: includedDocs.map(d => d.name),
      excludedReports: excludedReports.map(d => d.name)
    },
    lengths: { sample: mergedText.length || 0, report: reportText.length || 0, merged: mergedText.length || 0 },
    effectiveLengths: { merged: mergedEffectiveLen, vnexsus: vnexsusEffectiveLen },
    ocr: {
      sample: null,
      report: null,
      blocks: { total: allOcrBlocks.length },
      scannedPdfCount,
      ocrSourceCounts,
      blocksSourceCounts
    },
    postprocessMs,
    coverage: evidence
  };
}

function validateOutputs(caseIndices) {
  const issues = [];
  const existsCase = (i, suffix='') => fs.existsSync(path.join(OUT_CASE_DIR, `Case${i}${suffix}.txt`));
  const readLen = (i, suffix='') => {
    const fp = path.join(OUT_CASE_DIR, `Case${i}${suffix}.txt`);
    return fs.existsSync(fp) ? (fs.readFileSync(fp, 'utf8').trim().length) : 0;
  };
  const indices = Array.from(new Set((caseIndices || []).filter(n => typeof n === 'number' && Number.isFinite(n) && n > 0))).sort((a, b) => a - b);
  for (const i of indices) {
    const hasTxt = existsCase(i);
    const hasReport = existsCase(i, '_report');
    const hasV = existsCase(i, '_vnexsus');
    if (!hasTxt) issues.push({ case: i, type: 'missing', file: 'CaseN.txt' });
    if (hasTxt && readLen(i) === 0) issues.push({ case: i, type: 'empty', file: 'CaseN.txt' });
    if (hasReport && readLen(i, '_report') === 0) issues.push({ case: i, type: 'empty', file: 'CaseN_report.txt' });
    if (hasV && readLen(i, '_vnexsus') === 0) issues.push({ case: i, type: 'empty', file: 'CaseN_vnexsus.txt' });
  }
  const startIndex = indices.length ? indices[0] : 0;
  const endIndex = indices.length ? indices[indices.length - 1] : 0;
  fs.writeFileSync(path.join(OUT_ROOT, 'validation.json'), JSON.stringify({ startIndex, endIndex, indices, issues }, null, 2));
  return issues;
}

function validateOfflineOverrides(assigned) {
  try {
    const out = [];
    for (const r of assigned) {
      const caseIndex = r?.caseIndex;
      const caseName = r?.name ? String(r.name) : (r?.dir ? path.basename(r.dir) : `Case${caseIndex}`);
      const overrideRoot = OCR_OVERRIDE_DIR && fs.existsSync(OCR_OVERRIDE_DIR) ? OCR_OVERRIDE_DIR : null;
      const candidateDirs = overrideRoot ? [path.join(overrideRoot, `Case${caseIndex}`), path.join(overrideRoot, sanitizeName(caseName)), overrideRoot] : [];
      const overrideCaseDir = candidateDirs.find(p => p && fs.existsSync(p)) || overrideRoot;
      const j1 = overrideCaseDir ? path.join(overrideCaseDir, `Case${caseIndex}_offline_ocr.json`) : null;
      const j2 = overrideCaseDir ? path.join(overrideCaseDir, `${sanitizeName(caseName)}_offline_ocr.json`) : null;
      const t1 = overrideCaseDir ? path.join(overrideCaseDir, `Case${caseIndex}_merged.txt`) : null;
      const t2 = overrideCaseDir ? path.join(overrideCaseDir, `${sanitizeName(caseName)}_merged.txt`) : null;
      const jsonPath = [j1, j2].find(p => p && fs.existsSync(p)) || null;
      const txtPath = [t1, t2].find(p => p && fs.existsSync(p)) || null;
      const item = { caseIndex, caseName, dir: overrideCaseDir || '-', jsonPath: jsonPath || '-', txtPath: txtPath || '-' };
      if (!jsonPath) item.issue = 'missing_offline_json';
      else if (!txtPath) item.issue = 'missing_merged_txt';
      else {
        try {
          const inject = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          const blocks = Array.isArray(inject?.blocks) ? inject.blocks : [];
          const bboxBlocks = blocks.filter(b => b?.bbox && Number.isFinite(b.bbox.width) && Number.isFinite(b.bbox.height) && (b.bbox.width > 0 || b.bbox.height > 0));
          item.blocks = blocks.length;
          item.blocksWithBbox = bboxBlocks.length;
          if (blocks.length > 0 && bboxBlocks.length === 0) item.issue = 'no_bbox_in_blocks';
        } catch (e) {
          item.issue = 'invalid_offline_json';
        }
      }
      out.push(item);
    }
    fs.writeFileSync(path.join(OUT_ROOT, 'offline_preflight.json'), JSON.stringify({ ts: TS, items: out }, null, 2), 'utf8');
    return out;
  } catch (_) {
    return [];
  }
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
  const useVision = process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION !== 'false';
  if (!status?.available) {
    logService.warn('[batch] Vision OCR status reports unavailable; will still attempt if enabled.', status);
  }
  if (!useVision) logService.error('[batch] Vision OCR disabled. Set ENABLE_VISION_OCR=true and USE_VISION=true.');

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
  if (MODE !== 'sample_pdf' && caseIdx < 15) caseIdx = 15;
  const usedCaseIndex = new Set();
  let cursor = caseIdx;
  const assigned = rawDirs.map((r) => {
    const inferred = typeof r?.inferredCaseIndex === 'number' && Number.isFinite(r.inferredCaseIndex) && r.inferredCaseIndex > 0
      ? Math.floor(r.inferredCaseIndex)
      : null;
    let chosen = inferred;
    if (chosen !== null && usedCaseIndex.has(String(chosen))) {
      chosen = null;
    }
    if (chosen === null) {
      while (usedCaseIndex.has(String(cursor))) cursor += 1;
      chosen = cursor;
      cursor += 1;
    }
    usedCaseIndex.add(String(chosen));
    return { ...r, caseIndex: chosen };
  });

  const offlinePreflight = validateOfflineOverrides(assigned);
  const allowSet = new Set(
    (Array.isArray(offlinePreflight) ? offlinePreflight : [])
      .filter(x => !x.issue && typeof x.caseIndex === 'number' && Number.isFinite(x.caseIndex))
      .map(x => x.caseIndex)
  );
  let runAssigned = assigned.filter(a => allowSet.has(a.caseIndex));
  const limitRaw = process.env.LIMIT_CASE_COUNT;
  const limit = typeof limitRaw === 'string' && limitRaw.length > 0 ? Number(limitRaw) : Number(limitRaw);
  if (Number.isFinite(limit) && limit > 0) {
    runAssigned = runAssigned.slice(0, limit);
  }

  const runPool = async (items, limit, fn) => {
    const safeLimit = Math.max(1, Math.floor(limit || 1));
    const out = new Array(items.length);
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const i = cursor;
        cursor += 1;
        if (i >= items.length) return;
        try {
          out[i] = await fn(items[i], i);
        } catch (err) {
          out[i] = { ok: false, caseIndex: items[i]?.caseIndex, caseName: items[i]?.name, rawDir: items[i]?.dir, reason: 'worker_error', error: err?.message };
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(safeLimit, items.length) }, () => worker()));
    return out;
  };

  const results = await runPool(runAssigned, PARALLEL_LIMIT, async (r) => processSingleCase(r, r.caseIndex, useVision));
  const processed = results.filter(Boolean);
  const processedOk = processed.filter(p => p?.ok);

  const assignedIndices = runAssigned.map(a => a.caseIndex).filter(n => typeof n === 'number' && Number.isFinite(n));
  const startIndex = assignedIndices.length ? Math.min(...assignedIndices) : 0;
  const endIndex = assignedIndices.length ? Math.max(...assignedIndices) : 0;

  const manifest = { ts: TS, outDir: OUT_CASE_DIR, startIndex, endIndex, caseIndices: assignedIndices, processed };
  fs.writeFileSync(path.join(OUT_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const issues = validateOutputs(assignedIndices);

  const baselineReports = listBaselineReports();
  const subsetValidator = new ReportSubsetValidator();
  const matchCandidates = processed
    .filter(p => p?.vnexsusOut && fs.existsSync(p.vnexsusOut))
    .map(p => {
      const vnexsusText = safeReadText(p.vnexsusOut);
      return {
        caseIndex: p.caseIndex,
        caseName: p.caseName,
        vnexsusPath: p.vnexsusOut,
        vnexsusText,
        vnexsusEffectiveLen: effectiveTextLength(vnexsusText)
      };
    });

  const pairValidationSkips = {
    noReport: 0,
    missingFiles: 0,
    emptyReport: 0,
    emptyVnexsus: 0
  };
  const emptyMatching = () => ({
    dates: { matched: [], missing: [], matchRate: 0 },
    icds: { matched: [], missing: [], matchRate: 0 },
    hospitals: { matched: [], missing: [], matchRate: 0 }
  });

  const pairValidationRows = processed.map(p => {
    const base = { caseIndex: p?.caseIndex ?? null, caseName: p?.caseName ?? null };
    const fallbackReport = typeof p?.caseIndex === 'number'
      ? path.join(CASE_SAMPLE_DIR, `Case${p.caseIndex}_report.txt`)
      : null;
    const reportPath = p?.reportOut && fs.existsSync(p.reportOut)
      ? p.reportOut
      : (fallbackReport && fs.existsSync(fallbackReport) ? fallbackReport : null);
    if (!reportPath) {
      pairValidationSkips.noReport += 1;
      return { ...base, status: 'SKIPPED', skipReason: 'no_report' };
    }
    if (!p?.vnexsusOut || !fs.existsSync(reportPath) || !fs.existsSync(p.vnexsusOut)) {
      pairValidationSkips.missingFiles += 1;
      return { ...base, status: 'SKIPPED', skipReason: 'missing_files' };
    }

    const reportText = safeReadText(reportPath);
    const vnexsusText = safeReadText(p.vnexsusOut);
    const reportEffectiveLen = effectiveTextLength(reportText);
    const vnexsusEffectiveLen = effectiveTextLength(vnexsusText);
    const reportOk = reportEffectiveLen >= MIN_TEXT_LENGTH;
    const vnexsusOk = vnexsusEffectiveLen >= MIN_TEXT_LENGTH;
    if (!reportOk) pairValidationSkips.emptyReport += 1;
    if (!vnexsusOk) pairValidationSkips.emptyVnexsus += 1;

    if (!reportOk) {
      return {
        ...base,
        status: 'INVALID',
        reportPath,
        vnexsusPath: p.vnexsusOut,
        combinedScore: 0,
        labelScore: 0,
        jaccard: 0,
        matching: emptyMatching(),
        hasMissing: true,
        reportEffectiveLen,
        vnexsusEffectiveLen,
        inputOk: false
      };
    }

    const r = subsetValidator.validateCase(`Case${p.caseIndex}`, reportText, vnexsusText);
    const e = subsetValidator.enrichWithLabels(r);
    const j = computeJaccard(reportText, vnexsusText);
    const combined = (e.labelScore * 0.7) + (j * 0.3);
    return {
      ...base,
      status: vnexsusOk ? 'EVALUATED' : 'EVALUATED_PARTIAL',
      reportPath,
      vnexsusPath: p.vnexsusOut,
      combinedScore: combined,
      labelScore: e.labelScore,
      jaccard: j,
      matching: e.matching,
      hasMissing: e.hasMissing || !vnexsusOk,
      reportEffectiveLen,
      vnexsusEffectiveLen,
      inputOk: reportOk && vnexsusOk
    };
  });

  const pairEvaluations = pairValidationRows.filter(r => r.status !== 'SKIPPED');

  const pairSummary = (() => {
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const matched = pairEvaluations.length;
    const passCount = pairEvaluations.filter(v => !v.hasMissing && v.inputOk).length;
    const passRate = matched > 0 ? passCount / matched : 0;
    return {
      matched,
      passCount,
      passRate,
      avgCombinedScore: avg(pairEvaluations.map(v => v.combinedScore)),
      avgLabelScore: avg(pairEvaluations.map(v => v.labelScore)),
      avgJaccard: avg(pairEvaluations.map(v => v.jaccard)),
      avgDateMatchRate: avg(pairEvaluations.map(v => v.matching?.dates?.matchRate ?? 0)),
      avgIcdMatchRate: avg(pairEvaluations.map(v => v.matching?.icds?.matchRate ?? 0)),
      avgHospitalMatchRate: avg(pairEvaluations.map(v => v.matching?.hospitals?.matchRate ?? 0))
    };
  })();

  fs.writeFileSync(
    path.join(OUT_ROOT, 'pair_validations.json'),
    JSON.stringify({ summary: pairSummary, skips: pairValidationSkips, rows: pairValidationRows }, null, 2),
    'utf8'
  );

  const edges = [];
  for (const b of baselineReports) {
    const reportText = safeReadText(b.filePath);
    if (!reportText || reportText.trim().length === 0) continue;
    for (const c of matchCandidates) {
      const r = subsetValidator.validateCase(`Case${b.caseNumber}`, reportText, c.vnexsusText);
      const e = subsetValidator.enrichWithLabels(r);
      const j = computeJaccard(reportText, c.vnexsusText);
      const combined = (e.labelScore * 0.7) + (j * 0.3);
      edges.push({
        baselineCase: b.caseNumber,
        baselinePath: b.filePath,
        matchedCaseIndex: c.caseIndex,
        matchedCaseName: c.caseName,
        vnexsusPath: c.vnexsusPath,
        combinedScore: combined,
        labelScore: e.labelScore,
        jaccard: j,
        matching: e.matching,
        hasMissing: e.hasMissing
      });
    }
  }

  const edgesByBaseline = (() => {
    const m = new Map();
    for (const e of edges) {
      const key = String(e.baselineCase);
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => (b.combinedScore - a.combinedScore) || (b.labelScore - a.labelScore) || (b.jaccard - a.jaccard));
      m.set(k, arr);
    }
    return m;
  })();

  const dedupedSubsetMatches = [];
  const usedMatched = new Set();
  for (const b of baselineReports) {
    const key = String(b.caseNumber);
    const candidates = edgesByBaseline.get(key) ?? [];
    const picked = candidates.find(c => !usedMatched.has(String(c.matchedCaseIndex)));
    if (!picked) continue;
    usedMatched.add(String(picked.matchedCaseIndex));
    dedupedSubsetMatches.push({ ...picked, baselineCase: Number(picked.baselineCase) });
  }

  const subsetSummary = (() => {
    if (dedupedSubsetMatches.length === 0) {
      return { baselineReports: baselineReports.length, matched: 0, passCount: 0, passRate: 0 };
    }
    const matched = dedupedSubsetMatches.length;
    const passCount = dedupedSubsetMatches.filter(m => !m.hasMissing).length;
    const passRate = matched > 0 ? passCount / matched : 0;
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const avgDate = avg(dedupedSubsetMatches.map(m => m.matching?.dates?.matchRate ?? 0));
    const avgICD = avg(dedupedSubsetMatches.map(m => m.matching?.icds?.matchRate ?? 0));
    const avgHosp = avg(dedupedSubsetMatches.map(m => m.matching?.hospitals?.matchRate ?? 0));
    const avgLabel = avg(dedupedSubsetMatches.map(m => m.labelScore));
    const avgJac = avg(dedupedSubsetMatches.map(m => m.jaccard));
    return {
      baselineReports: baselineReports.length,
      matched,
      passCount,
      passRate,
      avgDateMatchRate: avgDate,
      avgIcdMatchRate: avgICD,
      avgHospitalMatchRate: avgHosp,
      avgLabelScore: avgLabel,
      avgJaccard: avgJac
    };
  })();

  fs.writeFileSync(path.join(OUT_ROOT, 'subset_matches.json'), JSON.stringify({ summary: subsetSummary, matches: dedupedSubsetMatches }, null, 2), 'utf8');

  const clamp01 = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  };
  const toPercent = (x) => `${(clamp01(x) * 100).toFixed(1)}%`;
  const p95 = (arr) => {
    const nums = (arr || []).filter(n => typeof n === 'number' && Number.isFinite(n)).slice().sort((a, b) => a - b);
    if (nums.length === 0) return null;
    const idx = Math.min(nums.length - 1, Math.ceil(nums.length * 0.95) - 1);
    return nums[idx];
  };

  const matchByCase = (() => {
    const m = new Map();
    for (const sm of dedupedSubsetMatches) {
      const key = sm.matchedCaseIndex;
      const cur = m.get(key) ?? { labelScores: [], jaccards: [], passFlags: [], dateRates: [], icdRates: [], hospRates: [], baselineCases: [] };
      cur.labelScores.push(sm.labelScore);
      cur.jaccards.push(sm.jaccard);
      cur.passFlags.push(!sm.hasMissing);
      cur.dateRates.push(sm.matching?.dates?.matchRate ?? 0);
      cur.icdRates.push(sm.matching?.icds?.matchRate ?? 0);
      cur.hospRates.push(sm.matching?.hospitals?.matchRate ?? 0);
      cur.baselineCases.push(sm.baselineCase);
      m.set(key, cur);
    }
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const finalize = new Map();
    for (const [k, v] of m.entries()) {
      const passRate = v.passFlags.length ? v.passFlags.filter(Boolean).length / v.passFlags.length : 0;
      finalize.set(k, {
        baselineCases: v.baselineCases,
        avgLabelScore: avg(v.labelScores),
        avgJaccard: avg(v.jaccards),
        avgDateMatchRate: avg(v.dateRates),
        avgIcdMatchRate: avg(v.icdRates),
        avgHospitalMatchRate: avg(v.hospRates),
        passRate
      });
    }
    return finalize;
  })();

  const computeScores = (p) => {
    const sourceSpan = clamp01(p?.coverage?.sourceSpan?.rate);
    const coordMatch = clamp01(p?.coverage?.coordinates?.matchRate);
    const pagesWithBbox = Number(p?.coverage?.coordinates?.pagesWithBbox ?? 0);
    const matchedItems = Number(p?.coverage?.coordinates?.matchedItems ?? 0);
    const blocksTotal = Number(p?.ocr?.blocks?.total ?? 0);
    const mergedLen = Number(p?.lengths?.merged ?? 0);

    const matchAgg = matchByCase.get(p.caseIndex);
    const accBase = matchAgg ? clamp01((matchAgg.avgLabelScore * 0.7) + (matchAgg.avgJaccard * 0.3)) : null;
    const inclusion = matchAgg ? clamp01(matchAgg.passRate) : null;

    const coverage = clamp01((sourceSpan * 0.6) + (coordMatch * 0.4));

    const perfMs = typeof p?.postprocessMs === 'number' && Number.isFinite(p.postprocessMs) ? p.postprocessMs : null;
    const perfScore = perfMs === null ? 0 : clamp01(1 - (perfMs - 500) / 9500);

    const hasCoordSignal = pagesWithBbox > 0 && blocksTotal > 0;
    const innovation = clamp01(
      (hasCoordSignal ? 0.5 : 0) +
      (matchedItems > 0 ? 0.3 : 0) +
      (mergedLen >= 5000 ? 0.2 : mergedLen >= 1500 ? 0.1 : 0)
    );

    const feasibility = clamp01((coverage * 0.5) + (perfScore * 0.5));

    const accuracy = accBase;
    const risk = clamp01(1 - (((accuracy ?? 0) * 0.5) + (coverage * 0.5)));

    const quality = clamp01(
      ((accuracy ?? 0) * 0.45) +
      (coverage * 0.35) +
      (perfScore * 0.10) +
      ((inclusion ?? 0) * 0.10)
    );

    const strengths = [];
    const weaknesses = [];

    if (sourceSpan >= 0.75) strengths.push(`SourceSpan ${toPercent(sourceSpan)}`);
    if (coordMatch >= 0.35) strengths.push(`좌표 매칭 ${toPercent(coordMatch)}`);
    if (mergedLen >= 4000) strengths.push(`원문 길이 ${mergedLen.toLocaleString()}자`);
    if (perfMs !== null && perfMs <= 2500) strengths.push(`후처리 ${perfMs}ms`);
    if (matchAgg && (accuracy ?? 0) >= 0.7) strengths.push(`정확도 ${toPercent(accuracy)}`);
    if (matchAgg && (inclusion ?? 0) >= 0.7) strengths.push(`포함도 ${toPercent(inclusion)}`);

    if (sourceSpan < 0.5) weaknesses.push(`SourceSpan ${toPercent(sourceSpan)}`);
    if (coordMatch < 0.2) weaknesses.push(`좌표 매칭 ${toPercent(coordMatch)}`);
    if (mergedLen < 1500) weaknesses.push(`원문 길이 ${mergedLen.toLocaleString()}자`);
    if (blocksTotal === 0) weaknesses.push('OCR 블록 0');
    if (perfMs !== null && perfMs > 8000) weaknesses.push(`후처리 ${perfMs}ms`);
    if (matchAgg && (accuracy ?? 0) < 0.45) weaknesses.push(`정확도 ${toPercent(accuracy)}`);
    if (matchAgg && (inclusion ?? 0) < 0.45) weaknesses.push(`포함도 ${toPercent(inclusion)}`);
    if (!useVision) weaknesses.push('Vision OCR 비활성');

    return {
      accuracy,
      inclusion,
      innovation,
      feasibility,
      risk,
      coverage,
      performance: perfScore,
      quality,
      strengths: strengths.slice(0, 4),
      weaknesses: weaknesses.slice(0, 4),
      matchAgg
    };
  };

  const caseRows = processed.map(p => ({ p, s: computeScores(p) }));
  const okRows = caseRows.filter(r => r.p?.ok);
  const qualitySorted = okRows.slice().sort((a, b) => (b.s.quality - a.s.quality));
  const top5 = qualitySorted.slice(0, 5);
  const bottom5 = qualitySorted.slice(-5).reverse();
  const postTimes = okRows.map(r => r.p.postprocessMs).filter(n => typeof n === 'number' && Number.isFinite(n));
  const perfSummary = {
    avgPostprocessMs: postTimes.length ? Math.round(postTimes.reduce((a, b) => a + b, 0) / postTimes.length) : null,
    p95PostprocessMs: p95(postTimes)
  };

  // HTML report
  const html = `<!doctype html>
  <html lang="ko"><head><meta charset="utf-8" />
  <title>케이스 재처리 리포트 (${TS})</title>
  <style>
  body{font-family:system-ui,Segoe UI,Arial;padding:20px;color:#222}
  code{background:#f6f6f6;padding:2px 4px;border-radius:4px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
  th{background:#f4f4f4}
  .muted{color:#666}
  .ok{color:#0a7}
  .bad{color:#c33}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .card{border:1px solid #eee;border-radius:10px;padding:12px;background:#fff}
  .bar{height:10px;border-radius:6px;background:#eee;overflow:hidden}
  .bar>span{display:block;height:100%;background:#2563eb}
  .bar.red>span{background:#dc2626}
  .kpi{display:flex;gap:14px;flex-wrap:wrap}
  .kpi>div{border:1px solid #eee;border-radius:10px;padding:10px 12px;background:#fff;min-width:220px}
  .mono{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace}
  </style>
  </head><body>
  <h1>케이스 재처리 리포트</h1>
  <p>출력 디렉토리: <code>${OUT_CASE_DIR}</code></p>
  <h2>처리 범위</h2>
  <ul>
    <li>시작: Case${startIndex}</li>
    <li>끝: Case${endIndex}</li>
    <li>총 입력 디렉토리: ${assigned.length}</li>
    <li>성공 케이스: ${processedOk.length}</li>
    <li>병렬 처리: ${Math.max(1, PARALLEL_LIMIT)}개</li>
  </ul>
  <h2>요약 지표</h2>
  <div class="kpi">
    <div><div class="muted">Vision OCR</div><div><span class="${useVision ? 'ok' : 'bad'}">${useVision ? '활성' : '비활성'}</span></div></div>
    <div><div class="muted">후처리 평균(ms)</div><div>${perfSummary.avgPostprocessMs ?? '-'}</div></div>
    <div><div class="muted">후처리 P95(ms)</div><div>${perfSummary.p95PostprocessMs ?? '-'}</div></div>
    <div><div class="muted">Subset PassRate</div><div>${(subsetSummary.passRate * 100).toFixed(1)}%</div></div>
  </div>
  <h2>유효성 검사</h2>
  <p>이슈 수: ${issues.length}</p>
  <table><thead><tr><th>Case</th><th>이슈 유형</th><th>파일</th></tr></thead><tbody>
    ${issues.map(i => `<tr><td>${i.case}</td><td>${i.type}</td><td>${i.file}</td></tr>`).join('')}
  </tbody></table>
  <h2>입력 리포트 ⊆ VNEXSUS 검증 (동일 케이스)</h2>
  <ul>
    <li>검증 쌍 수: ${pairSummary.matched}</li>
    <li>완전 포함(pass) 수: ${pairSummary.passCount} (통과율 ${(pairSummary.passRate * 100).toFixed(1)}%)</li>
    <li>평균 날짜/ICD/병원 매칭률: ${(pairSummary.avgDateMatchRate * 100).toFixed(1)}% / ${(pairSummary.avgIcdMatchRate * 100).toFixed(1)}% / ${(pairSummary.avgHospitalMatchRate * 100).toFixed(1)}%</li>
    <li>평균 LabelScore: ${(pairSummary.avgLabelScore * 100).toFixed(1)}% · 평균 Jaccard: ${(pairSummary.avgJaccard * 100).toFixed(1)}% · 평균 Combined: ${(pairSummary.avgCombinedScore * 100).toFixed(1)}%</li>
    <li>스킵 사유: 리포트없음 ${pairValidationSkips.noReport} · 파일없음 ${pairValidationSkips.missingFiles} · 리포트빈값 ${pairValidationSkips.emptyReport} · VNEXSUS빈값 ${pairValidationSkips.emptyVnexsus}</li>
  </ul>
  <table><thead><tr><th>Case</th><th>상태</th><th>ReportLen</th><th>VNEXSUSLen</th><th>LabelScore</th><th>Jaccard</th><th>Combined</th><th>날짜</th><th>ICD</th><th>병원</th><th>Pass</th></tr></thead><tbody>
    ${pairValidationRows.map(v => {
      if (v.status === 'SKIPPED') {
        return `<tr><td>Case${v.caseIndex ?? '-'}</td><td>SKIPPED (${v.skipReason})</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>❌</td></tr>`;
      }
      const label = (v.labelScore * 100).toFixed(1);
      const jac = (v.jaccard * 100).toFixed(1);
      const comb = (v.combinedScore * 100).toFixed(1);
      const date = ((v.matching?.dates?.matchRate ?? 0) * 100).toFixed(1);
      const icd = ((v.matching?.icds?.matchRate ?? 0) * 100).toFixed(1);
      const hosp = ((v.matching?.hospitals?.matchRate ?? 0) * 100).toFixed(1);
      const pass = (!v.hasMissing && v.inputOk) ? '✅' : '❌';
      return `<tr><td>Case${v.caseIndex ?? '-'}</td><td>${v.status}</td><td>${v.reportEffectiveLen ?? '-'}</td><td>${v.vnexsusEffectiveLen ?? '-'}</td><td>${label}%</td><td>${jac}%</td><td>${comb}%</td><td>${date}%</td><td>${icd}%</td><td>${hosp}%</td><td>${pass}</td></tr>`;
    }).join('')}
  </tbody></table>
  <h2>정확도/포함도 정의</h2>
  <ul>
    <li>LabelScore: (매칭된 날짜+ICD+병원) / (Report에 등장한 전체 날짜+ICD+병원)</li>
    <li>Jaccard: Report 텍스트 vs VNEXSUS 텍스트 토큰 집합 유사도</li>
    <li>정확도(Accuracy): 0.7 × LabelScore + 0.3 × Jaccard (베이스라인 매칭된 케이스만 산출)</li>
    <li>포함도(Inclusion): 베이스라인 매칭에서 PassRate (Report ⊆ VNEXSUS의 통과율)</li>
  </ul>
  <h2>Top/Bottom (품질)</h2>
  <div class="grid">
    <div class="card">
      <div class="muted">Top 5</div>
      <table><thead><tr><th>Case</th><th>품질</th><th>정확도</th><th>커버리지</th></tr></thead><tbody>
        ${top5.map(r => `<tr><td>Case${r.p.caseIndex}</td><td>${(r.s.quality * 100).toFixed(1)}</td><td>${r.s.accuracy === null ? '-' : (r.s.accuracy * 100).toFixed(1)}</td><td>${(r.s.coverage * 100).toFixed(1)}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card">
      <div class="muted">Bottom 5</div>
      <table><thead><tr><th>Case</th><th>품질</th><th>정확도</th><th>커버리지</th></tr></thead><tbody>
        ${bottom5.map(r => `<tr><td>Case${r.p.caseIndex}</td><td>${(r.s.quality * 100).toFixed(1)}</td><td>${r.s.accuracy === null ? '-' : (r.s.accuracy * 100).toFixed(1)}</td><td>${(r.s.coverage * 100).toFixed(1)}</td></tr>`).join('')}
      </tbody></table>
    </div>
  </div>
  <h2>처리 매니페스트 (케이스별 점수)</h2>
  <table><thead><tr>
    <th>Case</th><th>Raw Dir</th><th>상태</th>
    <th>정확도</th><th>포함도</th><th>혁신성</th><th>가능성</th><th>위험성</th>
    <th>커버리지</th><th>좌표</th><th>OCR Blocks</th><th>후처리</th><th>원문 길이</th><th>강점/약점</th>
  </tr></thead><tbody>
    ${caseRows.map(({ p, s }) => {
      const ok = !!p?.ok;
      const acc = s.accuracy === null ? '-' : `${(s.accuracy * 100).toFixed(1)}%`;
      const inc = s.inclusion === null ? '-' : `${(s.inclusion * 100).toFixed(1)}%`;
      const inv = `${(s.innovation * 100).toFixed(1)}%`;
      const fea = `${(s.feasibility * 100).toFixed(1)}%`;
      const risk = `${(s.risk * 100).toFixed(1)}%`;
      const cov = `${(s.coverage * 100).toFixed(1)}%`;
      const coord = p?.coverage?.coordinates?.matchRatePercent ?? '0.0%';
      const blocks = p?.ocr?.blocks?.total ?? 0;
      const ms = p?.postprocessMs ?? '-';
      const len = p?.lengths?.merged ?? 0;
      const detail = `<details><summary class="muted">보기</summary>
        <div class="muted">Baseline 매칭: ${s.matchAgg ? Array.from(new Set(s.matchAgg.baselineCases)).map(n => `Case${n}`).join(', ') : '-'}</div>
        <div class="muted">라벨/유사도: ${s.matchAgg ? `${(s.matchAgg.avgLabelScore * 100).toFixed(1)}% · ${(s.matchAgg.avgJaccard * 100).toFixed(1)}%` : '-'}</div>
        <div class="muted">강점: ${s.strengths.length ? s.strengths.join(' · ') : '-'}</div>
        <div class="muted">약점: ${s.weaknesses.length ? s.weaknesses.join(' · ') : '-'}</div>
      </details>`;
      return `<tr>
        <td>Case${p?.caseIndex ?? '-'}</td>
        <td>${p?.rawDir ? path.basename(p.rawDir) : '-'}</td>
        <td>${ok ? '<span class="ok">OK</span>' : `<span class="bad">FAIL</span> <span class="muted">${p?.reason ?? ''}</span>`}</td>
        <td>${acc}</td>
        <td>${inc}</td>
        <td>${inv}</td>
        <td>${fea}</td>
        <td>${risk}</td>
        <td><div class="bar"><span style="width:${(s.coverage * 100).toFixed(1)}%"></span></div><div class="muted">${cov}</div></td>
        <td>${coord}</td>
        <td>${blocks}</td>
        <td>${ms === '-' ? '-' : `${ms}ms`}</td>
        <td>${len.toLocaleString()}</td>
        <td>${detail}</td>
      </tr>`;
    }).join('')}
  </tbody></table>
  <h2>46개 Report ⊆ VNEXSUS 대응(베이스라인 CaseX_report.txt)</h2>
  <ul>
    <li>베이스라인 리포트 수: ${subsetSummary.baselineReports}</li>
    <li>매칭 산출 수: ${subsetSummary.matched}</li>
    <li>완전 포함(pass) 수: ${subsetSummary.passCount} (통과율 ${(subsetSummary.passRate * 100).toFixed(1)}%)</li>
    <li>평균 날짜/ICD/병원 매칭률: ${(subsetSummary.avgDateMatchRate * 100).toFixed(1)}% / ${(subsetSummary.avgIcdMatchRate * 100).toFixed(1)}% / ${(subsetSummary.avgHospitalMatchRate * 100).toFixed(1)}%</li>
    <li>평균 LabelScore: ${(subsetSummary.avgLabelScore * 100).toFixed(1)}% · 평균 Jaccard: ${(subsetSummary.avgJaccard * 100).toFixed(1)}%</li>
  </ul>
  <table><thead><tr><th>Baseline</th><th>Matched</th><th>LabelScore</th><th>Jaccard</th><th>날짜</th><th>ICD</th><th>병원</th><th>Pass</th></tr></thead><tbody>
    ${dedupedSubsetMatches.map(m => `<tr><td>Case${m.baselineCase}</td><td>Case${m.matchedCaseIndex} (${m.matchedCaseName})</td><td>${(m.labelScore * 100).toFixed(1)}%</td><td>${(m.jaccard * 100).toFixed(1)}%</td><td>${(m.matching?.dates?.matchRate * 100).toFixed(1)}%</td><td>${(m.matching?.icds?.matchRate * 100).toFixed(1)}%</td><td>${(m.matching?.hospitals?.matchRate * 100).toFixed(1)}%</td><td>${m.hasMissing ? '❌' : '✅'}</td></tr>`).join('')}
  </tbody></table>
  <h2>개발 현황 평가</h2>
  <ul>
    <li>Vision OCR 가용성: ${useVision ? '활성' : '비활성'} (환경변수 필요)</li>
    <li>빈 파일 방지 임계치: ${MIN_TEXT_LENGTH}자</li>
    <li>성능 측정: 후처리 평균 ${perfSummary.avgPostprocessMs ?? '-'}ms · P95 ${perfSummary.p95PostprocessMs ?? '-'}ms</li>
  </ul>
  <h2>개선 제안</h2>
  <ul>
    <li>OCR 블록 텍스트 정규화(공백/줄바꿈) 후 anchor 매칭 안정화</li>
    <li>event 단위(날짜/병원/진단)별 bbox 후보 다중 선택 및 합성</li>
    <li>Report ⊆ VNEXSUS 실패 케이스의 누락 Top-N 자동 집계</li>
    <li>문서별 OCR 재시도 및 백오프 추가</li>
  </ul>
  </body></html>`;
  const htmlPath = path.join(OUT_ROOT, 'report.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  try {
    const execDir = path.join(ROOT, 'VNEXSUS_A-B-C_Execution_Plan');
    if (!fs.existsSync(execDir)) fs.mkdirSync(execDir, { recursive: true });

    const reasonCounts = processed.reduce((acc, p) => {
      const key = p?.ok ? 'ok' : (p?.reason || 'unknown');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const warningCounts = processed.reduce((acc, p) => {
      const warns = Array.isArray(p?.warnings) ? p.warnings : [];
      for (const w of warns) {
        const key = typeof w === 'string' && w.length > 0 ? w : 'unknown';
        acc[key] = (acc[key] ?? 0) + 1;
      }
      return acc;
    }, {});
    const ocrAgg = processed.reduce((acc, p) => {
      const c = p?.ocr?.ocrSourceCounts || {};
      for (const [k, v] of Object.entries(c)) {
        const kk = typeof k === 'string' && k.length > 0 ? k : 'none';
        const vv = typeof v === 'number' && Number.isFinite(v) ? v : 0;
        acc[kk] = (acc[kk] ?? 0) + vv;
      }
      return acc;
    }, {});

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const okCover = processedOk.map(p => ({
      s: Number(p?.coverage?.sourceSpan?.rate ?? 0),
      c: Number(p?.coverage?.coordinates?.matchRate ?? 0)
    })).filter(v => Number.isFinite(v.s) && Number.isFinite(v.c));
    const avgSourceSpanRate = okCover.length ? avg(okCover.map(v => v.s)) : 0;
    const avgCoordMatchRate = okCover.length ? avg(okCover.map(v => v.c)) : 0;
    const coverageAvg = clamp01((avgSourceSpanRate * 0.6) + (avgCoordMatchRate * 0.4));
    const perfNorm = perfSummary.avgPostprocessMs === null ? 0 : clamp01(1 - ((perfSummary.avgPostprocessMs - 500) / 9500));
    const potentialScore = clamp01((subsetSummary.passRate * 0.5) + (coverageAvg * 0.3) + (perfNorm * 0.2));
    const potentialLabel = potentialScore >= 0.7 ? '높음' : (potentialScore >= 0.5 ? '중간' : '보통');
    const accAvg = clamp01(pairSummary.avgCombinedScore ?? 0);
    const execHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
    <title>VNEXSUS A-B-C Execution Plan (${TS})</title>
    <style>
    body{font-family:system-ui,Segoe UI,Arial;padding:20px;color:#222;background:#fafafa}
    code{background:#f2f2f2;padding:2px 4px;border-radius:4px}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
    th{background:#f4f4f4}
    .kpi{display:flex;gap:12px;flex-wrap:wrap}
    .kpi>div{border:1px solid #eee;border-radius:10px;padding:10px 12px;background:#fff;min-width:220px}
    .ok{color:#0a7}
    .bad{color:#c33}
    .muted{color:#666}
    .card{border:1px solid #eee;border-radius:10px;padding:12px;background:#fff;margin-top:12px}
    .bar{height:10px;border-radius:6px;background:#eee;overflow:hidden}
    .bar>span{display:block;height:100%;background:#2563eb}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    </style></head><body>
    <h1>VNEXSUS A-B-C Execution Plan</h1>
    <div class="kpi">
      <div><div class="muted">생성 시각</div><div>${TS}</div></div>
      <div><div class="muted">입력 디렉토리</div><div><code>${INPUT_DIR}</code></div></div>
      <div><div class="muted">출력 리포트</div><div><code>${OUT_ROOT}</code></div></div>
      <div><div class="muted">총 케이스</div><div>${assigned.length}</div></div>
      <div><div class="muted">성공 케이스</div><div>${processedOk.length}</div></div>
      <div><div class="muted">병렬 처리</div><div>${Math.max(1, PARALLEL_LIMIT)}</div></div>
    </div>

    <h2>A. 업로드 → OCR → 텍스트 추출</h2>
    <ul>
      <li>Vision OCR: ${useVision ? '<span class="ok">활성</span>' : '<span class="bad">비활성</span>'}</li>
      <li>Local OCR 기본 최대 페이지: ${LOCAL_OCR_DEFAULT_MAX_PAGES}${MAX_OCR_PAGES ? ` (override MAX_OCR_PAGES=${MAX_OCR_PAGES})` : ''}</li>
      <li>OCR 소스 분포: ${Object.entries(ocrAgg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' · ') || '-'}</li>
    </ul>

    <h2>B. 후처리 → VNEXSUS 보고서 생성</h2>
    <ul>
      <li>후처리 평균(ms): ${perfSummary.avgPostprocessMs ?? '-'}</li>
      <li>후처리 P95(ms): ${perfSummary.p95PostprocessMs ?? '-'}</li>
      <li>실패/경고 원인 Top: ${Object.entries({ ...reasonCounts, ...warningCounts }).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${v}`).join(' · ') || '-'}</li>
    </ul>

    <h2>C. 검증 → 수치화 리포팅</h2>
    <ul>
      <li>동일 케이스 검증(Report ⊆ VNEXSUS): ${pairSummary.matched}쌍 · pass ${(pairSummary.passRate * 100).toFixed(1)}%</li>
      <li>베이스라인 46개 매칭: ${subsetSummary.matched}쌍 · pass ${(subsetSummary.passRate * 100).toFixed(1)}%</li>
      <li>유효성 검사 이슈: ${issues.length}건</li>
    </ul>

    <div class="card">
      <div class="muted">앱 가능성 종합 평가</div>
      <div>가능성: <strong>${potentialLabel}</strong> · 점수 ${(potentialScore * 100).toFixed(1)}%</div>
      <div class="grid">
        <div class="card">
          <div class="muted">정확도(평균)</div>
          <div><div class="bar"><span style="width:${(accAvg * 100).toFixed(1)}%"></span></div></div>
          <div>${(accAvg * 100).toFixed(1)}%</div>
        </div>
        <div class="card">
          <div class="muted">커버리지(평균)</div>
          <div><div class="bar"><span style="width:${(coverageAvg * 100).toFixed(1)}%"></span></div></div>
          <div>${(coverageAvg * 100).toFixed(1)}%</div>
        </div>
        <div class="card">
          <div class="muted">후처리 성능(정규화)</div>
          <div><div class="bar"><span style="width:${(perfNorm * 100).toFixed(1)}%"></span></div></div>
          <div>${(perfNorm * 100).toFixed(1)}%</div>
        </div>
        <div class="card">
          <div class="muted">베이스라인 통과율</div>
          <div><div class="bar"><span style="width:${(subsetSummary.passRate * 100).toFixed(1)}%"></span></div></div>
          <div>${(subsetSummary.passRate * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="muted">인사이트</div>
      <ul>
        <li>입력 커버리지 개선이 정확도와 통과율을 동시 향상</li>
        <li>OCR 페이지 샘플링·워커 재사용으로 처리시간 단축 기대</li>
        <li>병원명·날짜 정규화 강화를 통한 라벨 매칭 안정화</li>
        <li>검증 후보 스크리닝으로 교차 검증 비용 대폭 절감</li>
      </ul>
    </div>

    <div class="card">
      <div class="muted">발전 방향</div>
      <ul>
        <li>Vision 이미지 폴백 상시 활성 및 자격증명 정비</li>
        <li>보고서 성격 문서 포함 정책 조정으로 최소 길이 확보</li>
        <li>라벨링 사전 구축: 날짜/ICD/병원 표준화 테이블 확장</li>
        <li>후처리 파이프라인 병렬화·캐시로 평균 처리시간 50%↓</li>
        <li>검증 스크리닝: 빠른 유사도 근사로 후보 70% 축소</li>
      </ul>
    </div>

    <h2>파이프라인 상태(케이스별)</h2>
    <table><thead><tr><th>Case</th><th>상태</th><th>원인</th><th>mergedLen</th><th>vnexsusLen</th><th>OCR blocks</th></tr></thead><tbody>
    ${processed.map(p => {
      const ok = !!p?.ok;
      const mergedLen = p?.effectiveLengths?.merged ?? '-';
      const vlen = p?.effectiveLengths?.vnexsus ?? '-';
      const blocks = p?.ocr?.blocks?.total ?? 0;
      return `<tr><td>Case${p?.caseIndex ?? '-'}</td><td>${ok ? '<span class="ok">OK</span>' : '<span class="bad">FAIL</span>'}</td><td>${p?.reason ?? '-'}</td><td>${mergedLen}</td><td>${vlen}</td><td>${blocks}</td></tr>`;
    }).join('')}
    </tbody></table>
    </body></html>`;

    fs.writeFileSync(path.join(execDir, 'report.html'), execHtml, 'utf8');
  } catch (e) {
    logService.warn(`[batch] failed to write execution plan report: ${e?.message}`);
  }

  try {
    if (typeof visionService.closePdfRenderBrowser === 'function') {
      await visionService.closePdfRenderBrowser();
    }
  } catch (_) {
  }

  logService.info(`[batch] completed. Outputs at ${OUT_ROOT}`);
}

run().catch(err => { logService.error(`[batch] failed: ${err.message}`); process.exit(1); });
