// Generate CaseN.txt and CaseN_report.txt from src/rag/case_sample_raw
import fs from 'fs';
import path from 'path';
import { logService } from '../utils/logger.js';
import * as pdfProcessor from '../utils/pdfProcessor.js';
import * as visionService from '../services/visionService.js';
import { HOSPITAL_TEMPLATES } from '../../src/shared/constants/medical.js';

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, 'src', 'rag', 'case_sample_raw');
const OUT_DIR = path.join(ROOT, 'src', 'rag', 'case_sample');

function classifyByName(fileName) {
  const low = fileName.toLowerCase();
  const isReport = ['종결보고서','중간보고서','손해사정보고서','최종보고서','보고서','리포트'].some(k => low.includes(k));
  const isMedical = ['진료','진단서','소견서','의무기록','차트','검사','영상','입원','퇴원','수술','처방','병원','의원','센터'].some(k => low.includes(k));
  return isReport ? 'actual_report' : (isMedical ? 'medical_doc' : 'other');
}

function getNextCaseIndex() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = fs.readdirSync(OUT_DIR);
  const nums = files.map(f => {
    const m = f.match(/^Case(\d+)\.txt$/i);
    return m ? Number(m[1]) : null;
  }).filter(n => typeof n === 'number');
  const max = nums.length ? Math.max(...nums) : 14; // start at 15 by default
  return max + 1;
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

  // Build candidate next headings from hospital templates
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

async function processCaseDir(caseDir, caseIndex, useVision) {
  const entries = fs.readdirSync(caseDir, { withFileTypes: true }).filter(e => e.isFile());
  const pdfs = entries.filter(e => /\.pdf$/i.test(e.name));
  if (pdfs.length === 0) {
    logService.warn(`[sample] ${path.basename(caseDir)} no pdf files`);
    return false;
  }
  const typed = pdfs.map(f => ({ name: f.name, filePath: path.join(caseDir, f.name), type: classifyByName(f.name) }));
  const reportCandidates = typed.filter(t => t.type === 'actual_report');
  const medicalCandidates = typed.filter(t => t.type === 'medical_doc');
  const otherCandidates = typed.filter(t => t.type === 'other');
  const chooseLargestText = async (cands) => {
    let best = null; let bestLen = -1;
    for (const c of cands) {
      try {
        const res = await pdfProcessor.processPdf(c.filePath, { useVision, saveTemp: false, cleanupTemp: true, fileName: c.name });
        const len = (res.text || '').length;
        if (len > bestLen) { bestLen = len; best = { ...c, text: res.text || '' }; }
      } catch (err) {
        logService.error(`[sample] extract fail ${c.name}: ${err?.message}`);
      }
    }
    return best;
  };

  const sampleDoc = (medicalCandidates.length ? await chooseLargestText(medicalCandidates) : await chooseLargestText(otherCandidates));
  const reportDoc = reportCandidates.length ? await chooseLargestText(reportCandidates) : null;

  if (!sampleDoc) {
    logService.warn(`[sample] ${path.basename(caseDir)} no sample doc chosen`);
    return false;
  }

  const sampleOut = path.join(OUT_DIR, `Case${caseIndex}.txt`);
  fs.writeFileSync(sampleOut, (sampleDoc.text || '').trim());

  if (reportDoc) {
    const summary = extractReportSummarySection(reportDoc.text || '');
    const reportOut = path.join(OUT_DIR, `Case${caseIndex}_report.txt`);
    fs.writeFileSync(reportOut, summary || (reportDoc.text || '').trim());
  }

  logService.info(`[sample] generated Case${caseIndex} from ${path.basename(caseDir)}`);
  return true;
}

async function run() {
  const status = await visionService.getServiceStatus();
  const useVision = !!status?.available;
  const dirs = fs.readdirSync(RAW_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(d => path.join(RAW_DIR, d.name));
  let idx = getNextCaseIndex();
  logService.info(`[sample] start at Case${idx}, total raw dirs: ${dirs.length}`);
  for (const d of dirs) {
    const ok = await processCaseDir(d, idx, useVision);
    if (ok) idx += 1;
  }
  logService.info('[sample] complete');
}

run().catch(err => { logService.error(`[sample] failed: ${err.message}`); process.exit(1); });

