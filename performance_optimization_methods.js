/**
 * Performance Optimization Methods for Text Array Date Controller
 * Phase 2 Performance Optimization
 */

// 최적화된 텍스트 전처리 메서드
export const optimizedPreprocessMethods = {
  
  /**
   * 텍스트 캐시 키 생성
   */
  generateTextCacheKey(text) {
    // 성능 최적화: 간단한 해시 생성
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 100); i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return hash.toString(36) + text.length;
  },

  /**
   * 최적화된 의료 문서 전처리
   */
  preprocessMedicalTextOptimized(text, regexCache) {
    return text
      .replace(regexCache.medicalNumber, '$1: $2')
      .replace(regexCache.doctorName, '$1: $2')
      .replace(regexCache.department, '$1: $2')
      .replace(regexCache.examination, '$1:');
  },

  /**
   * 최적화된 날짜 패턴 확인
   */
  hasDatePatternOptimized(text, cache) {
    const cacheKey = this.generateTextCacheKey(text);
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    const datePatterns = [
      /\d{4}[-.]/\d{1,2}[-.]/\d{1,2}/,
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/,
      /\d{1,2}[-.]/\d{1,2}[-.]/\d{4}/,
      /\d{1,2}월\s*\d{1,2}일/
    ];
    
    const result = datePatterns.some(pattern => pattern.test(text));
    cache.set(cacheKey, result);
    return result;
  },

  /**
   * 최적화된 의료 키워드 카운트
   */
  countMedicalKeywordsOptimized(text, cache) {
    const cacheKey = this.generateTextCacheKey(text);
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    const medicalKeywords = [
      '진료', '검사', '치료', '진단', '처방', '수술', '입원', '퇴원',
      '내원', '외래', '응급', '수술', '시술', '투약', '복용', '증상',
      '소견', '판정', '결과', '촬영', '측정', '검진', '상담'
    ];
    
    const result = medicalKeywords.reduce((count, keyword) => {
      return count + (text.match(new RegExp(keyword, 'g')) || []).length;
    }, 0);
    
    cache.set(cacheKey, result);
    return result;
  },

  /**
   * 캐시 히트율 계산
   */
  calculateCacheHitRate(cacheStats) {
    const total = cacheStats.hits + cacheStats.misses;
    return total > 0 ? cacheStats.hits / total : 0;
  },

  /**
   * 최적화된 성능 메트릭 업데이트
   */
  updatePerformanceMetricsOptimized(metrics, result, processingTime, memoryInfo) {
    metrics.totalProcessed++;
    metrics.averageProcessingTime = 
      (metrics.averageProcessingTime + processingTime) / 2;
    
    // 메모리 사용량 업데이트
    metrics.memoryUsage = {
      heapUsed: memoryInfo.memoryAfter.heapUsed,
      heapTotal: memoryInfo.memoryAfter.heapTotal,
      external: memoryInfo.memoryAfter.external
    };
    
    // 처리 속도 계산 (문자/초)
    metrics.processingSpeed = Math.round(memoryInfo.textLength / (processingTime / 1000));
    
    metrics.lastUpdated = new Date().toISOString();
  },

  /**
   * 메모리 정리
   */
  cleanupMemory(caches, maxCacheSize = 1000) {
    // 캐시 크기 제한
    Object.values(caches).forEach(cache => {
      if (cache instanceof Map && cache.size > maxCacheSize) {
        // LRU 방식으로 오래된 항목 제거
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
};

/**
 * 최적화된 구조적 분할 메서드
 */
export const optimizedSegmentationMethods = {
  
  /**
   * 스트림 기반 구조적 분할
   */
  performStructuralSegmentationOptimized(text) {
    const segments = [];
    const lines = text.split('\n');
    let currentSegment = { text: '', type: 'content', start: 0, end: 0 };
    
    // 정규식 미리 컴파일
    const sectionRegex = /^\s*[\[【].*[\]】]/;
    const listRegex = /^\s*[-*•]\s*/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 섹션 헤더 감지
      if (sectionRegex.test(line)) {
        if (currentSegment.text.trim()) {
          currentSegment.end = i;
          segments.push({ ...currentSegment });
        }
        currentSegment = { text: line, type: 'section', start: i, end: i };
      }
      // 리스트 항목 감지
      else if (listRegex.test(line)) {
        if (currentSegment.type !== 'list') {
          if (currentSegment.text.trim()) {
            currentSegment.end = i;
            segments.push({ ...currentSegment });
          }
          currentSegment = { text: line, type: 'list', start: i, end: i };
        } else {
          currentSegment.text += '\n' + line;
        }
      }
      // 일반 내용
      else {
        if (currentSegment.text) {
          currentSegment.text += '\n' + line;
        } else {
          currentSegment.text = line;
          currentSegment.start = i;
        }
      }
    }
    
    // 마지막 세그먼트 추가
    if (currentSegment.text.trim()) {
      currentSegment.end = lines.length - 1;
      segments.push(currentSegment);
    }
    
    return segments;
  },

  /**
   * 병렬 처리 기반 의료적 분할
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
      
      // 의료적 카테고리 결정
      for (const [type, pattern] of Object.entries(medicalPatterns)) {
        if (pattern.test(text)) {
          medicalType = type;
          break;
        }
      }
      
      return {
        ...segment,
        medicalType
      };
    });
  },

  /**
   * 메모리 효율적인 크기 조정
   */
  adjustSegmentSizesOptimized(segments, config = { minSize: 10, maxSize: 1000, overlapSize: 20 }) {
    const adjustedSegments = [];
    
    for (const segment of segments) {
      const text = segment.text;
      
      // 너무 작은 세그먼트는 다음 세그먼트와 병합
      if (text.length < config.minSize) {
        if (adjustedSegments.length > 0) {
          const lastSegment = adjustedSegments[adjustedSegments.length - 1];
          lastSegment.text += '\n' + text;
          lastSegment.end = segment.end;
        } else {
          adjustedSegments.push(segment);
        }
      }
      // 너무 큰 세그먼트는 분할
      else if (text.length > config.maxSize) {
        const subSegments = this.splitLargeSegmentOptimized(segment, config);
        adjustedSegments.push(...subSegments);
      }
      // 적절한 크기
      else {
        adjustedSegments.push(segment);
      }
    }
    
    return adjustedSegments;
  },

  /**
   * 최적화된 큰 세그먼트 분할
   */
  splitLargeSegmentOptimized(segment, config) {
    const subSegments = [];
    const text = segment.text;
    const { maxSize, overlapSize } = config;
    
    let start = 0;
    let segmentIndex = 0;
    
    while (start < text.length) {
      let end = Math.min(start + maxSize, text.length);
      
      // 단어 경계에서 자르기
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start + maxSize * 0.8) {
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
};