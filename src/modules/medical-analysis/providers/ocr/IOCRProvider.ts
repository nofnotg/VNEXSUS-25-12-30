/**
 * OCR Provider Interface
 *
 * 모든 OCR 엔진은 이 인터페이스를 구현해야 함
 * - Vision OCR (Google Vision, Tesseract 등)
 * - Vision LLM (GPT-4o Vision, Claude Vision 등)
 */

export interface OCRBlock {
  text: string;
  bbox?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
  pageIndex?: number; // 페이지 인덱스 (0부터 시작)
}

export interface OCRResult {
  blocks: OCRBlock[];
  metadata: {
    provider: string;
    processingTime: number;
    pageCount: number;
    totalCost?: number;
    model?: string;
    hasCoordinates: boolean; // 좌표 정보 포함 여부
  };
}

export type OCRInput =
  | { type: 'pdf'; path: string }
  | { type: 'image'; path: string }
  | { type: 'images'; paths: string[] }
  | { type: 'base64'; data: string; mimeType: string };

export interface OCRProviderCapabilities {
  supportsVision: boolean; // Vision LLM 여부
  supportsMultipage: boolean;
  supportsCoordinates: boolean; // bbox 좌표 지원 여부
  maxPageSize: number; // bytes
  maxPages: number;
}

/**
 * OCR Provider 인터페이스
 */
export interface IOCRProvider {
  // Provider 정보
  readonly name: string;
  readonly version: string;
  readonly capabilities: OCRProviderCapabilities;

  /**
   * OCR 실행
   */
  extractText(input: OCRInput): Promise<OCRResult>;

  /**
   * 비용 추정
   */
  estimateCost(input: OCRInput): Promise<number>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Provider 초기화
   */
  initialize?(): Promise<void>;

  /**
   * Provider 종료
   */
  shutdown?(): Promise<void>;
}

/**
 * OCR Provider 설정
 */
export interface OCRProviderConfig {
  apiKey?: string;
  timeout?: number;
  retryCount?: number;
  enableLogging?: boolean;
  customOptions?: Record<string, any>;
}
