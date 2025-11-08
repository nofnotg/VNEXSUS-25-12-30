/**
 * 고급 날짜 분석 타입 정의 (JavaScript with Zod)
 * 
 * TypeScript 타입을 Zod 스키마로 변환하여 런타임 검증 제공
 */

import { z } from 'zod';

// 처리 옵션 스키마
export const ProcessingOptions = z.object({
  includeRelativeDates: z.boolean().default(true),
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
  maxResults: z.number().min(1).max(100).default(50),
  includeMedicalContext: z.boolean().default(true)
});

// 고급 날짜 요청 스키마
export const AdvancedDateRequest = z.object({
  text: z.string().min(1, '텍스트는 필수입니다'),
  options: ProcessingOptions.optional()
});

// 배치 날짜 요청 스키마
export const BatchDateRequest = z.object({
  texts: z.array(z.string().min(1)).min(1).max(100, '최대 100개의 텍스트까지 처리 가능합니다'),
  options: ProcessingOptions.optional()
});

// 날짜 정보 스키마
export const DateInfo = z.object({
  type: z.enum(['absolute', 'relative', 'medical']),
  originalText: z.string(),
  parsedDate: z.string().nullable(),
  year: z.number().optional(),
  month: z.number().optional(),
  day: z.number().optional(),
  relativeExpression: z.string().optional(),
  medicalContext: z.string().optional(),
  position: z.number(),
  context: z.string(),
  medicalKeywords: z.array(z.object({
    keyword: z.string(),
    category: z.string(),
    distance: z.number()
  })),
  confidence: z.number().min(0).max(1)
});

// 고급 날짜 응답 스키마
export const AdvancedDateResponse = z.object({
  dates: z.array(DateInfo),
  metadata: z.object({
    totalFound: z.number(),
    afterFiltering: z.number(),
    confidence: z.number(),
    processingTime: z.number(),
    analysis: z.object({
      dateDistribution: z.object({
        absolute: z.number(),
        relative: z.number(),
        medical: z.number()
      }),
      timeRange: z.object({
        start: z.string(),
        end: z.string(),
        span: z.number()
      }).nullable(),
      medicalEvents: z.array(z.object({
        event: z.string(),
        date: z.string().nullable(),
        confidence: z.number()
      })),
      confidence: z.object({
        high: z.number(),
        medium: z.number(),
        low: z.number()
      })
    })
  })
});

// 의료 키워드 요청 스키마
export const MedicalKeywordRequest = z.object({
  text: z.string().min(1),
  categories: z.array(z.string()).optional(),
  includeContext: z.boolean().default(true)
});

// 키워드 정보 스키마
export const KeywordInfo = z.object({
  keyword: z.string(),
  category: z.string(),
  position: z.number(),
  context: z.string(),
  confidence: z.number()
});

// 의료 키워드 응답 스키마
export const MedicalKeywordResponse = z.object({
  keywords: z.array(KeywordInfo),
  metadata: z.object({
    totalFound: z.number(),
    categories: z.record(z.number()),
    processingTime: z.number()
  })
});

// 텍스트 유사도 요청 스키마
export const TextSimilarityRequest = z.object({
  sourceText: z.string().min(1),
  targetTexts: z.array(z.string().min(1)).min(1).max(50),
  algorithm: z.enum(['cosine', 'jaccard', 'levenshtein']).default('cosine')
});

// 유사도 결과 스키마
export const SimilarityResult = z.object({
  targetIndex: z.number(),
  targetText: z.string(),
  similarity: z.number(),
  algorithm: z.string()
});

// 텍스트 유사도 응답 스키마
export const TextSimilarityResponse = z.object({
  results: z.array(SimilarityResult),
  metadata: z.object({
    sourceText: z.string(),
    algorithm: z.string(),
    processingTime: z.number(),
    averageSimilarity: z.number()
  })
});

// 구조화된 요약 스키마
export const StructuredSummary = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  dates: z.array(z.string()),
  medicalTerms: z.array(z.string()),
  confidence: z.number()
});

// 표준 응답 스키마
export const StandardResponse = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  details: z.any().optional(),
  metadata: z.object({
    requestId: z.string().optional(),
    processingTime: z.number().optional(),
    timestamp: z.string()
  })
});

// 에러 코드 상수
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
};

// 타입 추론을 위한 타입 정의 (JSDoc 주석으로 제공)
/**
 * @typedef {z.infer<typeof ProcessingOptions>} ProcessingOptionsType
 * @typedef {z.infer<typeof AdvancedDateRequest>} AdvancedDateRequestType
 * @typedef {z.infer<typeof BatchDateRequest>} BatchDateRequestType
 * @typedef {z.infer<typeof DateInfo>} DateInfoType
 * @typedef {z.infer<typeof AdvancedDateResponse>} AdvancedDateResponseType
 * @typedef {z.infer<typeof MedicalKeywordRequest>} MedicalKeywordRequestType
 * @typedef {z.infer<typeof KeywordInfo>} KeywordInfoType
 * @typedef {z.infer<typeof MedicalKeywordResponse>} MedicalKeywordResponseType
 * @typedef {z.infer<typeof TextSimilarityRequest>} TextSimilarityRequestType
 * @typedef {z.infer<typeof SimilarityResult>} SimilarityResultType
 * @typedef {z.infer<typeof TextSimilarityResponse>} TextSimilarityResponseType
 * @typedef {z.infer<typeof StructuredSummary>} StructuredSummaryType
 * @typedef {z.infer<typeof StandardResponse>} StandardResponseType
 */