/**
 * 의료 분석 도메인 타입 정의 (단일 소스)
 * 프로젝트 규칙: 모든 타입/모델은 이 파일에서만 정의하고 import
 */

import { z } from 'zod';

// ===== 고급 날짜 분석 타입 =====
export const AdvancedDateRequest = z.object({
  text: z.string().min(1).max(100000),
  options: z.object({
    includeRelative: z.boolean().default(true),
    includeAbsolute: z.boolean().default(true),
    timezone: z.string().default('Asia/Seoul')
  }).optional()
});

export const DateExtraction = z.object({
  type: z.enum(['absolute', 'relative']),
  originalText: z.string(),
  normalizedDate: z.string().optional(),
  confidence: z.number().min(0).max(1),
  position: z.object({
    start: z.number(),
    end: z.number()
  })
});

export const AdvancedDateResponse = z.object({
  success: z.boolean(),
  data: z.object({
    extractedDates: z.array(DateExtraction),
    totalCount: z.number(),
    processingTime: z.number()
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  metadata: z.object({
    processingTime: z.number(),
    version: z.string(),
    traceId: z.string()
  })
});

// ===== 의료 키워드 추출 타입 =====
export const MedicalKeywordRequest = z.object({
  text: z.string().min(1).max(100000),
  options: z.object({
    fuzzyThreshold: z.number().min(0).max(1).default(0.8),
    maxKeywords: z.number().min(1).max(100).default(20),
    includeProbability: z.boolean().default(true)
  }).optional()
});

export const MedicalKeyword = z.object({
  keyword: z.string(),
  category: z.enum(['disease', 'symptom', 'treatment', 'medication', 'procedure', 'anatomy']),
  confidence: z.number().min(0).max(1),
  position: z.object({
    start: z.number(),
    end: z.number()
  }),
  normalizedForm: z.string().optional(),
  kcdCode: z.string().optional()
});

export const MedicalKeywordResponse = z.object({
  success: z.boolean(),
  data: z.object({
    keywords: z.array(MedicalKeyword),
    totalCount: z.number(),
    categories: z.record(z.number())
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  metadata: z.object({
    processingTime: z.number(),
    version: z.string(),
    traceId: z.string()
  })
});

// ===== 텍스트 유사도 및 구조화 요약 타입 =====
export const TextSimilarityRequest = z.object({
  sourceText: z.string().min(1).max(100000),
  targetText: z.string().min(1).max(100000),
  options: z.object({
    algorithm: z.enum(['cosine', 'jaccard', 'rouge']).default('cosine'),
    includeStructuredSummary: z.boolean().default(false)
  }).optional()
});

export const StructuredSummary = z.object({
  diagnosis: z.array(z.string()),
  symptoms: z.array(z.string()),
  treatments: z.array(z.string()),
  hospitalName: z.string().optional(),
  treatmentPeriod: z.object({
    start: z.string().optional(),
    end: z.string().optional()
  }).optional(),
  keyEvents: z.array(z.object({
    date: z.string(),
    event: z.string(),
    category: z.string()
  }))
});

export const TextSimilarityResponse = z.object({
  success: z.boolean(),
  data: z.object({
    similarity: z.number().min(0).max(1),
    algorithm: z.string(),
    structuredSummary: StructuredSummary.optional(),
    qualityMetrics: z.object({
      rougeScore: z.number().optional(),
      bertScore: z.number().optional(),
      coherenceScore: z.number().optional()
    }).optional()
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  metadata: z.object({
    processingTime: z.number(),
    version: z.string(),
    traceId: z.string()
  })
});

// ===== 공통 타입 =====
export const StandardResponse = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  metadata: z.object({
    processingTime: z.number(),
    version: z.string(),
    traceId: z.string()
  })
});

export const ProcessingOptions = z.object({
  timeout: z.number().default(30000),
  retryCount: z.number().default(3),
  enableLogging: z.boolean().default(true),
  maskPII: z.boolean().default(true)
});

// ===== 타입 추론 =====
export type AdvancedDateRequest = z.infer<typeof AdvancedDateRequest>;
export type AdvancedDateResponse = z.infer<typeof AdvancedDateResponse>;
export type DateExtraction = z.infer<typeof DateExtraction>;

export type MedicalKeywordRequest = z.infer<typeof MedicalKeywordRequest>;
export type MedicalKeywordResponse = z.infer<typeof MedicalKeywordResponse>;
export type MedicalKeyword = z.infer<typeof MedicalKeyword>;

export type TextSimilarityRequest = z.infer<typeof TextSimilarityRequest>;
export type TextSimilarityResponse = z.infer<typeof TextSimilarityResponse>;
export type StructuredSummary = z.infer<typeof StructuredSummary>;

export type StandardResponse = z.infer<typeof StandardResponse>;
export type ProcessingOptions = z.infer<typeof ProcessingOptions>;

// ===== 에러 코드 상수 =====
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];