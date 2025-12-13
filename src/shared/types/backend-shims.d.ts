declare module '../../../../backend/utils/pdfProcessor.js' {
  export interface PdfProcessResult {
    success?: boolean;
    text?: string;
    textLength?: number;
    textSource?: string;
    isScannedPdf?: boolean;
    pageCount?: number;
    ocrSource?: string;
    processingTime?: number;
    steps?: string[];
    error?: string;
  }
  export function processPdf(filePath: string, options?: Record<string, unknown>): Promise<PdfProcessResult>;
}

declare module '../../../../backend/services/visionService.js' {
  export function getServiceStatus(): Promise<{ available: boolean } | undefined>;
}

declare module '../../backend/services/core-engine/enhanced/geneExtractor.cjs' {
  const MedicalGeneExtractor: {
    new (options?: Record<string, unknown>): {
      extract(text: string): Promise<Record<string, unknown>>;
    };
  };
  export default MedicalGeneExtractor;
}

declare module '../dna-engine/core/geneExtractor.cjs' {
  const MedicalGeneExtractor: {
    new (options?: Record<string, unknown>): {
      extract(text: string): Promise<Record<string, unknown>>;
    };
  };
  export default MedicalGeneExtractor;
}
