// Unified Case Report Service
// Reusable from CLI script and API controller without breaking existing pipeline.
// - Scans raw case directory for PDFs
// - Excludes filename patterns (e.g., '보고서')
// - Runs OCR via pdfProcessor (Vision/Textract governed by options/env)
// - Saves merged text as CaseN.txt
// - Runs post-processing and saves CaseN_vnexsus.txt

import fs from 'fs';
import path from 'path';
import { logService } from '../utils/logger.js';
import * as defaultPdfProcessor from '../utils/pdfProcessor.js';
import postProcessorDefault from '../postprocess/index.js';

const ROOT = process.cwd();
const DEFAULT_RAW_DIR = path.join(ROOT, 'src', 'rag', 'case_sample_raw');
const DEFAULT_OUT_DIR = path.join(ROOT, 'src', 'rag', 'case_sample');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function collectPdfFiles(caseDir, excludePatterns = []) {
  const entries = fs.readdirSync(caseDir, { withFileTypes: true });
  const pdfs = entries.filter(e => {
    if (!e.isFile()) return false;
    if (!/\.pdf$/i.test(e.name)) return false;
    const name = e.name;
    for (const pat of excludePatterns) {
      if (typeof pat === 'string' && name.includes(pat)) return false;
      if (pat instanceof RegExp && pat.test(name)) return false;
    }
    return true;
  }).map(e => ({ name: e.name, filePath: path.join(caseDir, e.name) }));
  return pdfs;
}

async function ocrAllPdfs(pdfs, useVision, pdfProcessorImpl) {
  const texts = [];
  for (const f of pdfs) {
    try {
      const res = await pdfProcessorImpl.processPdf(f.filePath, {
        useVision,
        forceOcr: true,
        saveTemp: false,
        cleanupTemp: true,
        fileName: f.name
      });
      const t = (res.text || '').trim();
      if (t.length > 0) {
        texts.push(t);
        logService.info(`[caseReportService] OCR ok: ${f.name}`, { length: t.length, source: res.ocrSource || res.textSource });
      } else {
        logService.warn(`[caseReportService] OCR empty: ${f.name}`);
      }
    } catch (err) {
      logService.error(`[caseReportService] OCR fail: ${f.name} - ${err.message}`);
    }
  }
  return texts;
}

async function buildTextReport(mergedText, caseIndex, postProcessorImpl, options = {}) {
  const patientInfo = { name: `Case${caseIndex}` };
  const ppOptions = {
    reportFormat: 'text',
    reportTitle: '병력사항 요약 경과표',
    includeRawText: false,
    sortDirection: 'asc',
    periodType: 'all',
    // Allow test overrides to pass context (e.g., outDir, caseIndex)
    caseIndex,
    outDir: options.outDir
  };
  const result = await postProcessorImpl.processForMainApp(mergedText, ppOptions);
  const final = result?.finalReport;
  if (!final || !final.filePath) {
    throw new Error('텍스트 보고서 생성 실패: filePath 없음');
  }
  return final.filePath;
}

/**
 * Generate VNEXSUS case report from raw case directory.
 * Designed to be safely reused by CLI and API without altering existing pipeline behavior.
 *
 * @param {string} caseDir - Absolute path to raw case directory (contains PDFs)
 * @param {number} caseIndex - Case numeric index (e.g., 15)
 * @param {Object} options
 * @param {boolean} [options.useVision] - Force Vision OCR usage (otherwise inferred by env)
 * @param {string[]} [options.excludePatterns] - Filenames that should be excluded (default ['보고서'])
 * @param {string} [options.outDir] - Output directory (defaults to src/rag/case_sample)
 * @param {Object} [options.overrides] - Dependency overrides for testing/integration
 * @param {Object} [options.overrides.pdfProcessor] - Override pdfProcessor module
 * @param {Object} [options.overrides.postProcessor] - Override postProcessor module
 * @returns {Promise<{ success: boolean, rawTextPath?: string, vnexsusPath?: string }>} Result info
 */
export async function generateFromRawCase(caseDir, caseIndex, options = {}) {
  const outDir = options.outDir || DEFAULT_OUT_DIR;
  const excludePatterns = options.excludePatterns || ['보고서'];
  const useVision = !!options.useVision;

  const pdfProcessorImpl = options?.overrides?.pdfProcessor || defaultPdfProcessor;
  const postProcessorImpl = options?.overrides?.postProcessor || postProcessorDefault;

  ensureDir(outDir);
  const pdfs = collectPdfFiles(caseDir, excludePatterns);
  if (pdfs.length === 0) {
    logService.warn(`[caseReportService] ${path.basename(caseDir)} no pdf files after filter`);
    return { success: false };
  }

  const texts = await ocrAllPdfs(pdfs, useVision, pdfProcessorImpl);
  const mergedText = texts.join('\n\n');
  if (mergedText.length === 0) {
    logService.warn(`[caseReportService] ${path.basename(caseDir)} merged text empty`);
    return { success: false };
  }

  const rawOutFile = path.join(outDir, `Case${caseIndex}.txt`);
  try {
    fs.writeFileSync(rawOutFile, mergedText, 'utf8');
    logService.info(`[caseReportService] saved raw OCR text -> Case${caseIndex}.txt`, { length: mergedText.length });
  } catch (err) {
    logService.error(`[caseReportService] write raw text fail Case${caseIndex}: ${err.message}`);
    return { success: false };
  }

  let reportPath;
  try {
    reportPath = await buildTextReport(mergedText, caseIndex, postProcessorImpl, { outDir });
  } catch (err) {
    logService.error(`[caseReportService] report build fail Case${caseIndex}: ${err.message}`);
    return { success: false };
  }

  const vnexsusOutFile = path.join(outDir, `Case${caseIndex}_vnexsus.txt`);
  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    fs.writeFileSync(vnexsusOutFile, content, 'utf8');
  } catch (err) {
    logService.error(`[caseReportService] write vnexsus out fail Case${caseIndex}: ${err.message}`);
    return { success: false };
  }

  logService.info(`[caseReportService] generated Case${caseIndex}_vnexsus.txt from ${path.basename(caseDir)}`);
  return { success: true, rawTextPath: rawOutFile, vnexsusPath: vnexsusOutFile };
}

export default {
  generateFromRawCase
};

