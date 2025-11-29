import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../shared/logging/logger.js';
import { mask } from '../../shared/security/mask.js';
import type { CaseFileInfo, CaseFileType } from '../types/index.ts';

const REPORT_KEYWORDS = [
  '종결보고서',
  '중간보고서',
  '손해사정보고서',
  '최종보고서',
  '최종 결재',
];

const MEDICAL_KEYWORDS = [
  '진료', '진단서', '소견서', '의무기록', '차트', '검사', '영상',
  '입원', '퇴원', '수술', '처방', '진단', '병원', '의원', '센터',
  '진료비', '청구서', '내역', '초진', '재진', '통원', '수납',
];

function classifyByName(fileName: string): CaseFileType {
  const base = fileName.toLowerCase();
  const containsAny = (list: string[]) => list.some(k => base.includes(k.toLowerCase()));
  if (containsAny(REPORT_KEYWORDS)) return 'actual_report';
  if (containsAny(MEDICAL_KEYWORDS)) return 'medical_doc';
  return 'other';
}

export function listCaseDirectories(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) {
    logger.error({ event: 'CASE_DIR_MISSING', rootDir });
    return [];
  }
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => path.join(rootDir, e.name));
}

export function classifyCaseFiles(caseDir: string): CaseFileInfo[] {
  const caseId = path.basename(caseDir);
  const results: CaseFileInfo[] = [];
  if (!fs.existsSync(caseDir)) return results;

  const entries = fs.readdirSync(caseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(caseDir, entry.name);
    const ext = path.extname(entry.name).replace('.', '').toLowerCase();
    const type = classifyByName(entry.name);
    results.push({ caseId, filePath, fileName: entry.name, ext, type });
  }

  logger.info({
    event: 'CASE_FILE_CLASSIFIED',
    caseId: mask(caseId),
    counts: {
      total: results.length,
      actualReport: results.filter(r => r.type === 'actual_report').length,
      medical: results.filter(r => r.type === 'medical_doc').length,
      other: results.filter(r => r.type === 'other').length,
    }
  });

  return results;
}

