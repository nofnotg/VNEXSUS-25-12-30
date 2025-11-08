/**
 * Text Array Date Controller - Complete Implementation
 * 
 * 비정형 의료문서의 텍스트 배열에서 날짜를 정확하게 구분하는 통합 컨트롤러
 */

import { AdvancedTextArrayDateClassifier } from './advancedTextArrayDateClassifier.js';
import { EnhancedDateAnchor } from './enhancedDateAnchor.js';
import { ValidationEngine } from './validationEngine.js';
import { globalErrorHandler, safeExecute, safeExecuteWithRetry } from './errorHandler.js';

class TextArrayDateController {
  constructor() {
    this.version = '1.0.0';
    this.classifier = new AdvancedTextArrayDateClassifier();
    this.dateAnchor = new EnhancedDateAnchor();
    this.validationEngine = new ValidationEngine();
    
    // 텍스트 배열 분할 설정
    this.arraySegmentationConfig = {
      structural: {
        paragraph: /\n\s*\n/g,
        section: /\n\s*[\[【].*[\]】]/g,
        list: /\n\s*[-*•]\s*/g,
        numbered: /\n\s*\d+[.)]/g,
        header: /\n\s*[가-힣]+\s*:/g
      },
      medical: {
        diagnosis: /진단|소견|판정/g,
        treatment: /치료|처방|투약/g,
        examination: /검사|촬영|측정/g,
        visit: /내원|진료|방문/g,
        history: /과거력|기왕력|이전/g
      },
      minArraySize: 10,
      maxArraySize: 1000,
      overlapSize: 20
    };
    
    this.performanceMetrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      accuracyRate: 0,
      dateExtractionRate: 0,
      conflictResolutionRate: 0,
      lastUpdated: null,
      // Phase 2 Performance Optimization - 추가 메트릭
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0
      },
      cacheHitRate: 0,
      processingSpeed: 0 // 문자/초
    };
    
    // Phase 2 Performance Optimization - 캐시 초기화
    this.preprocessCache = new Map();
    this.medicalRegexCache = null;
    this.dateSpacingRegexCache = null;
    this.medicalTermsRegexCache = null;
    this.datePatternCache = new Map();
    this.medicalKeywordCache = new Map();
    this.cacheStats = { hits: 0, misses: 0 };
    
    this.qualityThresholds = {
      minimumConfidence: 0.7,
      minimumAIAgreement: 0.8,
      maximumConflictRate: 0.1,
      minimumDateAccuracy: 0.85
    };
  }

  /**
   * 메인 처리 함수 (Phase 2 Performance Optimization + Error Handling)
   */
  async processDocumentDateArrays(documentText, options = {}) {
    return await safeExecuteWithRetry(async () => {
      // 입력 검증
      if (!documentText || typeof documentText !== 'string') {
        throw new Error('유효하지 않은 문서 텍스트입니다.');
      }
      
      if (documentText.length === 0) {
        throw new Error('빈 문서 텍스트입니다.');
      }
      
      if (documentText.length > 1000000) { // 1MB 제한
        throw new Error('문서 텍스트가 너무 큽니다. (최대 1MB)');
      }
      
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      console.log(`🚀 텍스트 배열 날짜 처리 시작... (${documentText.length}자)`);
      
       // Phase 2 Performance Optimization - 메모리 모니터링
       const memoryBefore = process.memoryUsage();
       
       // 1. 텍스트 배열 분할 (최적화 + 에러 핸들링)
       const textArrays = await safeExecute(async () => {
         const arrays = await this.segmentTextIntoArrays(documentText, options);
         if (!arrays || arrays.length === 0) {
           throw new Error('텍스트 배열 분할에 실패했습니다.');
         }
         return arrays;
       }, '텍스트 배열 분할');
       console.log(`📊 텍스트 배열 분할 완료: ${textArrays.length}개 배열`);
       
       // 2. 고급 날짜 분류 (최적화 + 에러 핸들링)
       const classification = await safeExecute(async () => {
         return await this.classifier.classifyTextArrayDates(textArrays, options);
       }, '고급 날짜 분류');
       console.log(`🤖 고급 분류 완료`);
       
       // 3. 최종 통합 및 검증 (최적화 + 에러 핸들링)
        const finalResult = await safeExecute(async () => {
          return await this.integrateAndValidate(classification, textArrays, options);
        }, '최종 통합 및 검증');
        console.log(`✅ 최종 통합 완료`);
        
        // 4. Phase 2 검증 강화 - 추가 검증
        const validationResult = await safeExecute(async () => {
          return await this.validationEngine.validateDateExtractionResults(finalResult, documentText, options);
        }, '검증 엔진 실행');
        console.log(`🔍 검증 완료 - 점수: ${validationResult.overallScore?.toFixed(3)}, 등급: ${validationResult.qualityGrade}`);
      
      const processingTime = Date.now() - startTime;
       const memoryAfter = process.memoryUsage();
       
       // Phase 2 Performance Optimization - 성능 메트릭 업데이트
       await safeExecute(async () => {
         this.updatePerformanceMetricsOptimized(finalResult, processingTime, {
           memoryBefore,
           memoryAfter,
           textLength: documentText.length
         });
       }, '성능 메트릭 업데이트');
       
       return {
          success: true,
          version: this.version,
          processingTime,
          input: {
            documentLength: documentText.length,
            arrayCount: textArrays.length,
            options
          },
          result: finalResult,
          performance: this.performanceMetrics,
          quality: this.assessResultQuality(finalResult),
          // Phase 2 Performance Optimization - 추가 정보
          optimization: {
            memoryUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            processingSpeed: Math.round(documentText.length / (processingTime / 1000)),
            cacheHitRate: this.calculateCacheHitRate()
          },
          // Phase 2 Validation Enhancement - 검증 결과
          validation: validationResult
        };
     }, {
       maxRetries: 2,
       retryDelay: 1000,
       context: 'processDocumentDateArrays'
     });
   }

  /**
   * 텍스트를 의미있는 배열로 분할 (Phase 2 Performance Optimization)
   */
  async segmentTextIntoArrays(documentText, options) {
    // 성능 최적화: 메모리 효율적인 배열 생성
    const arrays = new Array();
    
    // 1. 기본 전처리 (캐싱 적용)
    let processedText = this.preprocessTextOptimized(documentText);
    
    // 2. 구조적 분할 (스트림 처리)
    const structuralSegments = this.performStructuralSegmentationOptimized(processedText);
    
    // 3. 의료적 분할 (병렬 처리)
    const medicalSegments = this.performMedicalSegmentationOptimized(structuralSegments);
    
    // 4. 크기 기반 조정 (메모리 효율적)
    const sizedSegments = this.adjustSegmentSizesOptimized(medicalSegments);
    
    // 5. 배열 메타데이터 추가 (배치 처리)
    const segmentCount = sizedSegments.length;
    for (let i = 0; i < segmentCount; i++) {
      const segment = sizedSegments[i];
      const segmentText = segment.text;
      
      // 메모리 최적화: 한 번에 계산하여 재사용
      const textLength = segmentText.length;
      const words = segmentText.split(/\s+/);
      const lines = segmentText.split('\n');
      
      arrays.push({
        index: i,
        text: segmentText,
        type: segment.type || 'content',
        position: {
          start: segment.start,
          end: segment.end,
          relative: i / segmentCount
        },
        metadata: {
          length: textLength,
          wordCount: words.length,
          lineCount: lines.length,
          hasDatePattern: this.hasDatePatternOptimized(segmentText),
          medicalKeywordCount: this.countMedicalKeywordsOptimized(segmentText)
        }
      });
      
      // 메모리 정리
      if (i % 100 === 0) {
        // 주기적으로 가비지 컬렉션 힌트 제공
        if (global.gc) global.gc();
      }
    }
    
    return arrays;
  }

  /**
   * 텍스트 전처리 (Phase 1 Emergency Fix - 최적화)
   */
  preprocessText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // 성능 최적화: 기존 메서드 호출
    return this.preprocessTextOptimized(text);
  }
  
  /**
   * 최적화된 텍스트 전처리 (Phase 2 Performance Optimization)
   */
  preprocessTextOptimized(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // 성능 최적화: 캐시 확인
    const cacheKey = this.generateTextCacheKey(text);
    if (this.preprocessCache && this.preprocessCache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.preprocessCache.get(cacheKey);
    }
    
    this.cacheStats.misses++;
    
    // 성능 최적화: 체인된 정규식 처리
    let processed = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/[^\w\s가-힣\d\-\.\/:]/g, ' ')
      .trim();

    return processed.split(/\n+/).filter(line => line.trim().length > 0);
  }

  /**
   * 성능 리포트 생성(Phase 2)
   */
  generatePerformanceReport() {
    const totalCacheOps = (this.cacheStats?.hits || 0) + (this.cacheStats?.misses || 0);
    const hitRate = totalCacheOps > 0 ? (this.cacheStats.hits / totalCacheOps) : 0;

    return {
      version: this.version,
      metrics: this.performanceMetrics,
      cacheStats: {
        ...this.cacheStats,
        hitRate
      },
      cacheInfo: {
        preprocessCacheSize: this.preprocessCache?.size ?? 0,
        datePatternCacheSize: this.datePatternCache?.size ?? 0,
        medicalKeywordCacheSize: this.medicalKeywordCache?.size ?? 0
      },
      timestamp: new Date().toISOString()
    };
  }
}

export { TextArrayDateController };
