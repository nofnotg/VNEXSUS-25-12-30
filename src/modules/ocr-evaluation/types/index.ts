// Types for OCR evaluation pipeline
// Node ESM, strict mode assumed
import type { } from 'node:fs';

export type CaseFileType = 'actual_report' | 'medical_doc' | 'other';

export interface CaseFileInfo {
  caseId: string;
  filePath: string;
  fileName: string;
  ext: string;
  type: CaseFileType;
}

export interface OcrStep {
  step: string;
  status: 'success' | 'failed';
  message?: string;
  timestamp?: string;
  duration?: string;
  [key: string]: unknown;
}

export interface OcrResult {
  success: boolean;
  text?: string;
  textLength?: number;
  textSource?: 'pdf_parse_only' | 'ocr_only' | 'pdf_parse_with_ocr';
  isScannedPdf?: boolean;
  pageCount?: number;
  ocrSource?: 'vision' | 'textract';
  processingTime?: string;
  steps?: OcrStep[];
  error?: string;
}

export interface KeyInfoExtraction {
  amounts: string[];
  dates: string[];
  hospitals: string[];
  medicalTerms: string[];
}

export interface Metrics {
  charAccuracy?: number; // 0..1
  structureScore?: number; // 0..1
  keyInfoAccuracy?: {
    amountPrecision?: number;
    datePrecision?: number;
    hospitalRecall?: number;
    medicalTermRecall?: number;
  };
  tableImageRecognition?: number; // ratio 0..1
}

export interface CaseEvaluation {
  caseId: string;
  files: CaseFileInfo[];
  ocrResults: Record<string, OcrResult>; // filePath -> OcrResult
  metrics: Record<string, Metrics>; // filePath -> Metrics
  summary: {
    totals: {
      files: number;
      actualReports: number;
      medicalDocs: number;
      others: number;
    };
    averages: {
      charAccuracy?: number;
      structureScore?: number;
      tableImageRecognition?: number;
    };
    commonErrors: string[];
  };
}

