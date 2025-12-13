/**
 * Text Array Date Controller - Performance Optimized Implementation
 * Phase 2 Performance Optimization
 */

import { AdvancedTextArrayDateClassifier } from './advancedTextArrayDateClassifier.js';
import { EnhancedDateAnchor } from './enhancedDateAnchor.js';

export class TextArrayDateControllerOptimized {
  constructor() {
    this.version = '2.0.0'; // Phase 2 Performance Optimization
    this.classifier = new AdvancedTextArrayDateClassifier();
    this.dateAnchor = new EnhancedDateAnchor();
    
    // Phase 2 Performance Optimization - 캐시 초기화
    this.preprocessCache = new Map();
    this.datePatternCache = new Map();
    this.medicalKeywordCache = new Map();
    this.cacheStats = { hits: 0, misses: 0 };
    
    // 성능 최적화된 정규식 컴파일
    this.initializeOptimizedRegex();
    
    // 성능 메트릭
    this.performanceMetrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      memoryUsage: { heapUsed: 0, heapTotal: 0 },
      cacheHitRate: 0,
      processingSpeed: 0
    };
  }

  /**
   * 최적화된 정규식 초기화
   */
  initializeOptimizedRegex() {
    this.medicalRegexCache = {
      medicalNumber: /(환자번호|차트번호|등록번호)\s*[:：]?\s*(\d+)/gi,
      doctorName: /(담당의|주치의|의사)\s*[:：]?\s*([가-힣]{2,4})/gi,
      department: /(진료과|과)\s*[:：]?\s*([가-힣]+과)/gi,
      examination: /(CT|MRI|X-ray|초음파|혈액검사)\s*[:：]?/gi
    };
    
    this.dateSpacingRegexCache = {
      datePattern: /\s+(\d{4}[년\-\.\s]*\d{1,2}[월\-\.\s]*\d{1,2}[일]?)\s+/g,
      relativeDate: /\s+(오늘|어제|내일|금일|당일)\s+/g,
      medicalDate: /\s+(진료|검사|수술|처방)\s*(당시|시점|일자)\s+/g
    };
    
    this.medicalTermsRegexCache = {
      medication: /(\w+)\s*(mg|g|ml|정|캡슐)/gi,
      diagnosis: /(진단|소견)\s*[:：]?\s*/gi,
      symptoms: /(통증|발열|기침|두통)\s*(있음|없음|심함|경미)/gi,
      testResults: /(정상|이상|양성|음성)\s*(소견|결과)/gi
    };
  }

  /**
   * 최적화된 텍스트 전처리
   */
  preprocessTextOptimized(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // 성능 최적화: 캐시 확인
    const cacheKey = this.generateTextCacheKey(text);
    if (this.preprocessCache.has(cacheKey)) {
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
      .replace(/[''""]/g, '"')
      .replace(/[：]/g, ':')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 의료 문서 특화 전처리
    processed = this.preprocessMedicalTextOptimized(processed);
    
    // 캐시에 저장
    this.preprocessCache.set(cacheKey, processed);
    
    return processed;
  }

  /**
   * 텍스트 캐시 키 생성
   */
  generateTextCacheKey(text) {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 100); i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36) + text.length;
  }

  /**
   * 최적화된 의료 문서 전처리
   */
  preprocessMedicalTextOptimized(text) {
    return text
      .replace(this.medicalRegexCache.medicalNumber, '$1: $2')
      .replace(this.medicalRegexCache.doctorName, '$1: $2')
      .replace(this.medicalRegexCache.department, '$1: $2')
      .replace(this.medicalRegexCache.examination, '$1:');
  }

  /**
   * 최적화된 문서 배열 처리
   */
  async processDocumentDateArraysOptimized(textArrays, options = {}) {
    const startTime = Date.now();
    const memoryBefore = process.memoryUsage();
    
    try {
      // 배열 분할 및 전처리
      const segments = this.segmentTextIntoArraysOptimized(textArrays, options);
      
      // 날짜 분류 처리
      const classificationResults = await this.classifier.classifyDateArrays(segments);
      
      // 날짜 앵커 처리
      const anchorResults = this.dateAnchor.processDateAnchors(classificationResults);
      
      const processingTime = Date.now() - startTime;
      const memoryAfter = process.memoryUsage();
      
      // 성능 메트릭 업데이트
      this.updatePerformanceMetricsOptimized({
        processingTime,
        memoryBefore,
        memoryAfter,
        textLength: textArrays.join('').length
      });
      
      // 메모리 정리
      this.cleanupMemoryOptimized();
      
      return {
        success: true,
        results: anchorResults,
        performance: this.performanceMetrics,
        cacheStats: this.cacheStats
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        performance: this.performanceMetrics
      };
    }
  }

  /**
   * 최적화된 배열 분할
   */
  segmentTextIntoArraysOptimized(textArrays, options = {}) {
    const config = {
      minSegmentSize: options.minSegmentSize || 10,
      maxSegmentSize: options.maxSegmentSize || 1000,
      overlapSize: options.overlapSize || 20,
      ...options
    };
    
    const allSegments = [];
    
    for (let i = 0; i < textArrays.length; i++) {
      const text = textArrays[i];
      const preprocessedText = this.preprocessTextOptimized(text);
      
      // 구조적 분할
      const structuralSegments = this.performStructuralSegmentationOptimized(preprocessedText);
      
      // 의료적 분할
      const medicalSegments = this.performMedicalSegmentationOptimized(structuralSegments);
      
      // 크기 조정
      const adjustedSegments = this.adjustSegmentSizesOptimized(medicalSegments, config);
      
      // 메타데이터 추가
      const segmentsWithMetadata = adjustedSegments.map(segment => ({
        ...segment,
        arrayIndex: i,
        hasDatePattern: this.hasDatePatternOptimized(segment.text),
        medicalKeywordCount: this.countMedicalKeywordsOptimized(segment.text),
        confidence: this.calculateSegmentConfidence(segment)
      }));
      
      allSegments.push(...segmentsWithMetadata);
    }
    
    return allSegments;
  }

  /**
   * 최적화된 구조적 분할
   */
  performStructuralSegmentationOptimized(text) {
    const segments = [];
    const lines = text.split('\n');
    let currentSegment = { text: '', type: 'content', start: 0, end: 0 };
    
    const sectionRegex = /^\s*[\[【].*[\]】]/;
    const listRegex = /^\s*[-*•]\s*/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (sectionRegex.test(line)) {
        if (currentSegment.text.trim()) {
          currentSegment.end = i;
          segments.push({ ...currentSegment });
        }
        currentSegment = { text: line, type: 'section', start: i, end: i };
      } else if (listRegex.test(line)) {
        if (currentSegment.type !== 'list') {
          if (currentSegment.text.trim()) {
            currentSegment.end = i;
            segments.push({ ...currentSegment });
          }
          currentSegment = { text: line, type: 'list', start: i, end: i };
        } else {
          currentSegment.text += '\n' + line;
        }
      } else {
        if (currentSegment.text) {
          currentSegment.text += '\n' + line;
        } else {
          currentSegment.text = line;
          currentSegment.start = i;
        }
      }
    }
    
    if (currentSegment.text.trim()) {
      currentSegment.end = lines.length - 1;
      segments.push(currentSegment);
    }
    
    return segments;
  }

  /**
   * 최적화된 의료적 분할
   */
  performMedicalSegmentationOptimized(structuralSegments) {
    const medicalPatterns = {
      diagnosis: /진단|소견|판정/,
      treatment: /치료|처방|투약/,
      examination: /검사|촬영|측정/,
      visit: /내원|진료|방문/,
      history: /과거력|기왕력|이전/
    };
    
    return structuralSegments.map(segment => {
      const text = segment.text;
      let medicalType = 'general';
      
      for (const [type, pattern] of Object.entries(medicalPatterns)) {
        if (pattern.test(text)) {
          medicalType = type;
          break;
        }
      }
      
      return { ...segment, medicalType };
    });
  }

  /**
   * 최적화된 크기 조정
   */
  adjustSegmentSizesOptimized(segments, config) {
    const adjustedSegments = [];
    
    for (const segment of segments) {
      const text = segment.text;
      
      if (text.length < config.minSegmentSize) {
        if (adjustedSegments.length > 0) {
          const lastSegment = adjustedSegments[adjustedSegments.length - 1];
          lastSegment.text += '\n' + text;
          lastSegment.end = segment.end;
        } else {
          adjustedSegments.push(segment);
        }
      } else if (text.length > config.maxSegmentSize) {
        const subSegments = this.splitLargeSegmentOptimized(segment, config);
        adjustedSegments.push(...subSegments);
      } else {
        adjustedSegments.push(segment);
      }
    }
    
    return adjustedSegments;
  }

  /**
   * 큰 세그먼트 분할
   */
  splitLargeSegmentOptimized(segment, config) {
    const subSegments = [];
    const text = segment.text;
    const { maxSegmentSize, overlapSize } = config;
    
    let start = 0;
    let segmentIndex = 0;
    
    while (start < text.length) {
      let end = Math.min(start + maxSegmentSize, text.length);
      
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start + maxSegmentSize * 0.8) {
          end = lastSpace;
        }
      }
      
      const subText = text.substring(start, end);
      
      subSegments.push({
        ...segment,
        text: subText,
        start: segment.start + segmentIndex,
        end: segment.start + segmentIndex,
        isSubSegment: true,
        parentSegment: segment.start
      });
      
      start = end - overlapSize;
      segmentIndex++;
    }
    
    return subSegments;
  }

  /**
   * 최적화된 날짜 패턴 확인
   */
  hasDatePatternOptimized(text) {
    const cacheKey = this.generateTextCacheKey(text);
    if (this.datePatternCache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.datePatternCache.get(cacheKey);
    }
    
    this.cacheStats.misses++;
    
    const datePatterns = [
      /\d{4}[-.]\d{1,2}[-.]\d{1,2}/,
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/,
      /\d{1,2}[-.]\d{1,2}[-.]\d{4}/,
      /\d{1,2}월\s*\d{1,2}일/
    ];
    
    const result = datePatterns.some(pattern => pattern.test(text));
    this.datePatternCache.set(cacheKey, result);
    return result;
  }

  /**
   * 최적화된 의료 키워드 카운트
   */
  countMedicalKeywordsOptimized(text) {
    const cacheKey = this.generateTextCacheKey(text);
    if (this.medicalKeywordCache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.medicalKeywordCache.get(cacheKey);
    }
    
    this.cacheStats.misses++;
    
    const medicalKeywords = [
      '진료', '검사', '치료', '진단', '처방', '수술', '입원', '퇴원',
      '내원', '외래', '응급', '수술', '시술', '투약', '복용', '증상',
      '소견', '판정', '결과', '촬영', '측정', '검진', '상담'
    ];
    
    const result = medicalKeywords.reduce((count, keyword) => {
      return count + (text.match(new RegExp(keyword, 'g')) || []).length;
    }, 0);
    
    this.medicalKeywordCache.set(cacheKey, result);
    return result;
  }

  /**
   * 세그먼트 신뢰도 계산
   */
  calculateSegmentConfidence(segment) {
    let confidence = 0.5; // 기본 신뢰도
    
    // 의료 키워드 기반 신뢰도 증가
    if (segment.medicalKeywordCount > 0) {
      confidence += Math.min(segment.medicalKeywordCount * 0.1, 0.3);
    }
    
    // 날짜 패턴 존재 시 신뢰도 증가
    if (segment.hasDatePattern) {
      confidence += 0.2;
    }
    
    // 의료적 타입에 따른 신뢰도 조정
    const typeBonus = {
      diagnosis: 0.2,
      treatment: 0.15,
      examination: 0.15,
      visit: 0.1,
      history: 0.05,
      general: 0
    };
    
    confidence += typeBonus[segment.medicalType] || 0;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 성능 메트릭 업데이트
   */
  updatePerformanceMetricsOptimized(info) {
    this.performanceMetrics.totalProcessed++;
    this.performanceMetrics.averageProcessingTime = 
      (this.performanceMetrics.averageProcessingTime + info.processingTime) / 2;
    
    this.performanceMetrics.memoryUsage = {
      heapUsed: info.memoryAfter.heapUsed,
      heapTotal: info.memoryAfter.heapTotal,
      external: info.memoryAfter.external
    };
    
    this.performanceMetrics.processingSpeed = 
      Math.round(info.textLength / (info.processingTime / 1000));
    
    this.performanceMetrics.cacheHitRate = 
      this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses);
    
    this.performanceMetrics.lastUpdated = new Date().toISOString();
  }

  /**
   * 메모리 정리
   */
  cleanupMemoryOptimized() {
    const maxCacheSize = 1000;
    
    // 캐시 크기 제한
    [this.preprocessCache, this.datePatternCache, this.medicalKeywordCache].forEach(cache => {
      if (cache.size > maxCacheSize) {
        const entries = Array.from(cache.entries());
        const toRemove = entries.slice(0, Math.floor(maxCacheSize * 0.2));
        toRemove.forEach(([key]) => cache.delete(key));
      }
    });
    
    // 가비지 컬렉션 힌트
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * 성능 리포트 생성
   */
  generatePerformanceReport() {
    return {
      version: this.version,
      metrics: this.performanceMetrics,
      cacheStats: {
        ...this.cacheStats,
        hitRate: this.performanceMetrics.cacheHitRate
      },
      cacheInfo: {
        preprocessCacheSize: this.preprocessCache.size,
        datePatternCacheSize: this.datePatternCache.size,
        medicalKeywordCacheSize: this.medicalKeywordCache.size
      },
      timestamp: new Date().toISOString()
    };
  }
}
