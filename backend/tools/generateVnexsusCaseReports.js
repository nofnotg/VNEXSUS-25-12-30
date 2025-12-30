// Generate CaseN_vnexsus.txt using app OCR (Vision) + post-processing pipeline
// Scans src/rag/case_sample_raw/Case{N}/, OCRs all PDFs, merges text,
// runs postprocess to build a text report, and saves to src/rag/case_sample/CaseN_vnexsus.txt

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logService } from '../utils/logger.js';
import * as pdfProcessor from '../utils/pdfProcessor.js';
import postProcessor from '../postprocess/index.js';
import * as visionService from '../services/visionService.js';

const ROOT = process.cwd();
// Prefer .env.secure when present, fallback to .env
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
  // ignore env load errors; script can still proceed with process.env
}
const RAW_DIR = path.join(ROOT, 'src', 'rag', 'case_sample_raw');
const OUT_DIR = path.join(ROOT, 'src', 'rag', 'case_sample');

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function parseCaseIndexFromName(name) {
  const m = name.match(/case\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function getNextVnexsusIndex() {
  ensureOutDir();
  const files = fs.readdirSync(OUT_DIR);
  const nums = files.map(f => {
    const m = f.match(/^Case(\d+)_vnexsus\.txt$/i);
    return m ? Number(m[1]) : null;
  }).filter(n => typeof n === 'number');
  const max = nums.length ? Math.max(...nums) : 14; // default baseline so next is 15
  return max + 1;
}

function collectPdfFiles(caseDir) {
  const entries = fs.readdirSync(caseDir, { withFileTypes: true });
  // 사용자 요구사항: 파일명에 '보고서'가 포함된 PDF는 제외
  const pdfs = entries.filter(e => {
    if (!e.isFile()) return false;
    if (!/\.pdf$/i.test(e.name)) return false;
    return !e.name.includes('보고서');
  });
  return pdfs.map(e => ({ name: e.name, filePath: path.join(caseDir, e.name) }));
}

async function ocrAllPdfs(pdfs, useVision) {
  const texts = [];
  for (const f of pdfs) {
    try {
      const res = await pdfProcessor.processPdf(f.filePath, {
        useVision,
        forceOcr: true,
        saveTemp: false,
        cleanupTemp: true,
        fileName: f.name
      });
      const t = (res.text || '').trim();
      if (t.length > 0) {
        texts.push(t);
        logService.info(`[vnexsus] OCR ok: ${f.name}`, { length: t.length, source: res.ocrSource || res.textSource });
      } else {
        logService.warn(`[vnexsus] OCR empty: ${f.name}`);
      }
    } catch (err) {
      logService.error(`[vnexsus] OCR fail: ${f.name} - ${err.message}`);
    }
  }
  return texts;
}

async function buildTextReport(mergedText, caseIndex) {
  // Minimal patientInfo; enrollmentDate omitted if unknown
  const patientInfo = { name: `Case${caseIndex}` };
  const options = {
    reportFormat: 'text',
    reportTitle: '병력사항 요약 경과표',
    includeRawText: false,
    sortDirection: 'asc',
    periodType: 'all'
  };
  const result = await postProcessor.processForMainApp(mergedText, options);
  const final = result?.finalReport;
  if (!final || !final.filePath) {
    throw new Error('텍스트 보고서 생성 실패: filePath 없음');
  }
  return final.filePath;
}

async function processCase(caseDir, caseIndex, useVision) {
  const pdfs = collectPdfFiles(caseDir);
  if (pdfs.length === 0) {
    logService.warn(`[vnexsus] ${path.basename(caseDir)} no pdf files`);
    return false;
  }

  const texts = await ocrAllPdfs(pdfs, useVision);
  const mergedText = texts.join('\n\n');
  if (mergedText.length === 0) {
    logService.warn(`[vnexsus] ${path.basename(caseDir)} merged text empty`);
    return false;
  }

  // 추출 텍스트 저장: CaseN.txt (src/rag/case_sample)
  const rawOutFile = path.join(OUT_DIR, `Case${caseIndex}.txt`);
  try {
    fs.writeFileSync(rawOutFile, mergedText, 'utf8');
    logService.info(`[vnexsus] saved raw OCR text -> Case${caseIndex}.txt`, { length: mergedText.length });
  } catch (err) {
    logService.error(`[vnexsus] write raw text fail Case${caseIndex}: ${err.message}`);
    return false;
  }

  let reportPath;
  try {
    reportPath = await buildTextReport(mergedText, caseIndex);
  } catch (err) {
    logService.error(`[vnexsus] report build fail Case${caseIndex}: ${err.message}`);
    return false;
  }

  // Copy generated report to target filename
  const outFile = path.join(OUT_DIR, `Case${caseIndex}_vnexsus.txt`);
  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    fs.writeFileSync(outFile, content, 'utf8');
  } catch (err) {
    logService.error(`[vnexsus] write out fail Case${caseIndex}: ${err.message}`);
    return false;
  }

  logService.info(`[vnexsus] generated Case${caseIndex}_vnexsus.txt from ${path.basename(caseDir)}`);
  return true;
}

async function run() {
  ensureOutDir();
  const status = await visionService.getServiceStatus();
  const useVision = !!status?.available;
  if (!useVision) {
    // 환경이 비활성화된 경우에도 파이프라인을 진행하되 pdf-parse 기반으로 처리
    logService.warn('[vnexsus] Vision OCR unavailable. Fallback to pdf-parse only. Configure ENABLE_VISION_OCR=true, USE_VISION=true, GOOGLE_APPLICATION_CREDENTIALS, GCS_BUCKET_NAME for OCR.');
    logService.warn('[vnexsus] OCR env status', {
      ENABLE_VISION_OCR: process.env.ENABLE_VISION_OCR,
      USE_VISION: process.env.USE_VISION,
      hasCredentials: status?.hasCredentials,
      hasBucket: status?.hasBucket
    });
  }

  const rawDirs = fs.readdirSync(RAW_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => ({ name: e.name, path: path.join(RAW_DIR, e.name), index: parseCaseIndexFromName(e.name) }));

  // Default start at 15+; if index missing, use next available
  let nextIdx = getNextVnexsusIndex();
  const targets = rawDirs
    .filter(d => (d.index ?? nextIdx) >= 15)
    .sort((a, b) => (a.index ?? 9999) - (b.index ?? 9999));

  logService.info(`[vnexsus] targets: ${targets.length} dirs`);
  for (const d of targets) {
    const caseIndex = d.index ?? (nextIdx++);
    const ok = await processCase(d.path, caseIndex, useVision);
    if (!ok && d.index == null) {
      // if failed for dynamically assigned index, do not advance nextIdx
      nextIdx = Math.max(nextIdx - 1, 15);
    }
  }
  logService.info('[vnexsus] complete');
}

run().catch(err => { logService.error(`[vnexsus] failed: ${err.message}`); process.exit(1); });
