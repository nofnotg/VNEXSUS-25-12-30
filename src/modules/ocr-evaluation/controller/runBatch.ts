import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../../shared/logging/logger';
import { mask } from '../../../shared/security/mask';
import type { CaseEvaluation, CaseFileInfo, Metrics, OcrResult } from '../types';
import { listCaseDirectories, classifyCaseFiles } from '../service/classifier';
import { runOcrOnFile } from '../service/ocrRunner';
import * as pdfProcessor from '../../../../backend/utils/pdfProcessor.js';
import { computeMetrics, compareKeyInfo } from '../service/metrics';

export interface RunOptions {
  rootDir?: string;
  outDir?: string;
}

export async function evaluateCase(caseDir: string, outDir: string): Promise<CaseEvaluation> {
  const caseId = path.basename(caseDir);
  const files = classifyCaseFiles(caseDir);
  const ocrResults: Record<string, OcrResult> = {};
  const metrics: Record<string, Metrics> = {};
  const errors: string[] = [];

  for (const file of files) {
    try {
      // 원문(파싱 전용) 텍스트
      const parseOnly = await pdfProcessor.processPdf(file.filePath, {
        skipOcr: true,
        saveTemp: false,
        fileName: file.fileName,
      });
      const originalText = parseOnly.text || '';

      // OCR/통합 처리 텍스트
      const result = await runOcrOnFile(file);
      ocrResults[file.filePath] = result;
      const generatedText = result.text || '';

      // 메트릭 계산
      const m = computeMetrics(originalText, generatedText);
      const ki = compareKeyInfo(originalText, generatedText);
      metrics[file.filePath] = { ...m, keyInfoAccuracy: ki };
    } catch (error) {
      const err = error as Error;
      const msg = err.message;
      errors.push(msg);
      logger.error({
        event: 'CASE_FILE_ERROR',
        error: { name: err.name, message: err.message, stack: err.stack },
        metadata: { caseId: mask(caseId), fileName: mask(file.fileName) }
      });
    }
  }

  const totals = {
    files: files.length,
    actualReports: files.filter(f => f.type === 'actual_report').length,
    medicalDocs: files.filter(f => f.type === 'medical_doc').length,
    others: files.filter(f => f.type === 'other').length,
  };

  // 평균값 계산
  const vals = Object.values(metrics);
  const avg = (select: (m: Metrics) => number | undefined) => {
    const arr = vals.map(select).filter((v): v is number => typeof v === 'number');
    if (arr.length === 0) return undefined;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };
  const summary = {
    totals,
    averages: {
      charAccuracy: avg(m => m.charAccuracy),
      structureScore: avg(m => m.structureScore),
      tableImageRecognition: avg(m => m.tableImageRecognition),
    },
    commonErrors: Array.from(new Set(errors)).slice(0, 10),
  };

  const evaluation: CaseEvaluation = {
    caseId,
    files,
    ocrResults,
    metrics,
    summary,
  };

  // 저장
  const caseOut = path.join(outDir, caseId);
  fs.mkdirSync(caseOut, { recursive: true });
  fs.writeFileSync(path.join(caseOut, 'evaluation.json'), JSON.stringify(evaluation, null, 2), 'utf-8');
  fs.writeFileSync(path.join(caseOut, 'README.md'), buildCaseMarkdown(evaluation), 'utf-8');

  logger.info({ event: 'CASE_EVALUATED', metadata: { caseId: mask(caseId), outDir: caseOut } });
  return evaluation;
}

export async function runBatch(options: RunOptions = {}): Promise<void> {
  const rootDir = options.rootDir || path.join(process.cwd(), 'src', 'rag', 'case_sample_raw');
  const outDir = options.outDir || path.join(process.cwd(), 'reports', 'evaluation');
  fs.mkdirSync(outDir, { recursive: true });

  logger.info({ event: 'BATCH_START', metadata: { rootDir, outDir } });
  const caseDirs = listCaseDirectories(rootDir);
  for (const dir of caseDirs) {
    await evaluateCase(dir, outDir);
  }
  logger.info({ event: 'BATCH_COMPLETE', metadata: { count: caseDirs.length } });
}

function buildCaseMarkdown(ev: CaseEvaluation): string {
  const s = ev.summary.averages;
  return `# 케이스 평가 보고서 — ${ev.caseId}\n\n` +
    `- 파일 수: ${ev.summary.totals.files}\n` +
    `- 실제 보고서: ${ev.summary.totals.actualReports}\n` +
    `- 의료문서: ${ev.summary.totals.medicalDocs}\n\n` +
    `## 평균 메트릭\n` +
    `- 문자 정확도: ${s.charAccuracy ?? 'N/A'}\n` +
    `- 구조 유지 점수: ${s.structureScore ?? 'N/A'}\n` +
    `- 표/이미지 인식률: ${s.tableImageRecognition ?? 'N/A'}\n\n` +
    `## 흔한 오류\n` +
    `${ev.summary.commonErrors.length > 0 ? ev.summary.commonErrors.map(e => `- ${e}`).join('\n') : '- 없음'}\n`;
}
