import { logger } from '../../shared/logging/logger.js';
import { mask } from '../../shared/security/mask.js';
import type { CaseFileInfo, OcrResult } from '../types/index.ts';
import * as pdfProcessor from '../../../backend/utils/pdfProcessor.js';
import * as visionService from '../../../backend/services/visionService.js';

export async function runOcrOnFile(file: CaseFileInfo): Promise<OcrResult> {
  const start = Date.now();
  try {
    const status = await visionService.getServiceStatus();
    const useVision = !!status?.available;

    logger.info({
      event: 'OCR_RUN_START',
      caseId: mask(file.caseId),
      fileName: mask(file.fileName),
      useVision,
    });

    const result = await pdfProcessor.processPdf(file.filePath, {
      useVision,
      saveTemp: true,
      cleanupTemp: true,
      fileName: file.fileName,
    });

    const end = Date.now();
    logger.info({
      event: 'OCR_RUN_COMPLETE',
      caseId: mask(file.caseId),
      fileName: mask(file.fileName),
      durationMs: end - start,
      textLength: result.textLength,
      textSource: result.textSource,
      isScannedPdf: result.isScannedPdf,
      ocrSource: result.ocrSource,
    });

    return {
      success: !!result.success,
      text: result.text,
      textLength: result.textLength,
      textSource: result.textSource,
      isScannedPdf: result.isScannedPdf,
      pageCount: result.pageCount,
      ocrSource: result.ocrSource,
      processingTime: result.processingTime,
      steps: result.steps ?? [],
      error: result.error,
    };
  } catch (error) {
    logger.error({
      event: 'OCR_RUN_ERROR',
      caseId: mask(file.caseId),
      fileName: mask(file.fileName),
      error: (error as Error).message,
    });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

