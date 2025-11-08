/**
 * 고급 날짜 분석 서비스
 * 
 * 의료 문서에서 날짜 정보를 추출하고 분석하는 핵심 로직
 */

import { logger } from '../../../shared/logging/logger.js';
import { MEDICAL_KEYWORDS, DATE_PATTERNS, QUALITY_THRESHOLDS } from '../../../shared/constants/medical.js';
import { mask } from '../../../shared/security/mask.js';

/**
 * 날짜 추출 서비스 클래스
 */
class AdvancedDateService {
  /**
   * 텍스트에서 날짜 정보 추출
   */
  async extractDates(text, options = {}) {
    const startTime = Date.now();
    
    try {
      // 옵션 기본값 설정
      const config = {
        includeRelativeDates: options?.includeRelativeDates ?? true,
        confidenceThreshold: options?.confidenceThreshold ?? QUALITY_THRESHOLDS.DATE_CONFIDENCE_MIN,
        maxResults: options?.maxResults ?? 50,
        ...options
      };

      logger.info({
        event: 'DATE_EXTRACTION_START',
        textLength: text.length,
        config: mask(JSON.stringify(config))
      });

      // 1. 절대 날짜 추출
      const absoluteDates = this.extractAbsoluteDates(text);
      
      // 2. 상대 날짜 추출 (옵션에 따라)
      const relativeDates = config.includeRelativeDates 
        ? this.extractRelativeDates(text) 
        : [];

      // 3. 모든 날짜 결합 및 정규화
      const allDates = [...absoluteDates, ...relativeDates];
      
      // 4. 중복 제거 및 신뢰도 계산
      const processedDates = this.processAndScoreDates(allDates, text);
      
      // 5. 신뢰도 필터링
      const filteredDates = processedDates.filter(
        date => date.confidence >= config.confidenceThreshold
      );
      
      // 6. 결과 제한
      const finalDates = filteredDates
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, config.maxResults);

      const processingTime = Date.now() - startTime;
      
      const result = {
        dates: finalDates,
        metadata: {
          totalFound: allDates.length,
          afterFiltering: filteredDates.length,
          finalCount: finalDates.length,
          processingTime,
          averageConfidence: finalDates.length > 0 
            ? finalDates.reduce((sum, d) => sum + d.confidence, 0) / finalDates.length 
            : 0
        },
        confidence: this.calculateOverallConfidence(finalDates),
        processingTime
      };

      logger.info({
        event: 'DATE_EXTRACTION_SUCCESS',
        extractedCount: finalDates.length,
        processingTime,
        averageConfidence: result.metadata.averageConfidence
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error({
        event: 'DATE_EXTRACTION_ERROR',
        error: error.message,
        processingTime,
        stack: mask(error.stack || '')
      });

      throw new Error(`날짜 추출 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 절대 날짜 추출
   */
  extractAbsoluteDates(text) {
    const dates = [];
    
    DATE_PATTERNS.ABSOLUTE.forEach((pattern, patternIndex) => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(text)) !== null) {
        const dateInfo = this.parseAbsoluteDate(match, patternIndex);
        if (dateInfo) {
          dates.push({
            ...dateInfo,
            type: 'absolute',
            originalText: match[0],
            position: match.index,
            patternIndex
          });
        }
      }
    });
    
    return dates;
  }

  /**
   * 상대 날짜 추출
   */
  extractRelativeDates(text) {
    const dates = [];
    
    DATE_PATTERNS.RELATIVE.forEach((pattern, patternIndex) => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(text)) !== null) {
        const dateInfo = this.parseRelativeDate(match, patternIndex);
        if (dateInfo) {
          dates.push({
            ...dateInfo,
            type: 'relative',
            originalText: match[0],
            position: match.index,
            patternIndex
          });
        }
      }
    });
    
    return dates;
  }

  /**
   * 절대 날짜 파싱
   */
  parseAbsoluteDate(match, patternIndex) {
    try {
      let year, month, day;
      
      switch (patternIndex) {
        case 0: // YYYY-MM-DD
          [, year, month, day] = match;
          break;
        case 1: // MM-DD-YYYY
          [, month, day, year] = match;
          break;
        case 2: // DD-MM-YYYY
          [, day, month, year] = match;
          break;
        case 3: // 한국어: YYYY년 MM월 DD일
          [, year, month, day] = match;
          break;
        case 4: // 한국어: YYYY년 MM월
          [, year, month] = match;
          day = null;
          break;
        case 5: // 영어: Month YYYY
          [, monthName, year] = match;
          month = this.getMonthNumber(monthName);
          day = null;
          break;
        default:
          return null;
      }

      // 날짜 유효성 검증
      const parsedDate = this.validateAndCreateDate(year, month, day);
      if (!parsedDate) return null;

      return {
        date: parsedDate,
        year: parseInt(year),
        month: month ? parseInt(month) : null,
        day: day ? parseInt(day) : null,
        precision: day ? 'day' : month ? 'month' : 'year'
      };

    } catch (error) {
      logger.warn({
        event: 'DATE_PARSING_ERROR',
        match: match[0],
        error: error.message
      });
      return null;
    }
  }

  /**
   * 상대 날짜 파싱
   */
  parseRelativeDate(match, patternIndex) {
    try {
      const now = new Date();
      const matchText = match[0].toLowerCase();
      
      // 기본 상대 날짜
      if (matchText.includes('오늘') || matchText.includes('today')) {
        return {
          date: new Date(now),
          relativeType: 'today',
          precision: 'day'
        };
      }
      
      if (matchText.includes('어제') || matchText.includes('yesterday')) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          date: yesterday,
          relativeType: 'yesterday',
          precision: 'day'
        };
      }
      
      if (matchText.includes('내일') || matchText.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return {
          date: tomorrow,
          relativeType: 'tomorrow',
          precision: 'day'
        };
      }

      // 숫자가 포함된 상대 날짜 (N일 전/후 등)
      const numberMatch = match[0].match(/(\d+)/);
      if (numberMatch) {
        const number = parseInt(numberMatch[1]);
        const isAgo = /전|ago|before/.test(matchText);
        const multiplier = isAgo ? -1 : 1;
        
        let targetDate = new Date(now);
        let precision = 'day';
        
        if (/일|day/.test(matchText)) {
          targetDate.setDate(targetDate.getDate() + (number * multiplier));
          precision = 'day';
        } else if (/주|week/.test(matchText)) {
          targetDate.setDate(targetDate.getDate() + (number * 7 * multiplier));
          precision = 'week';
        } else if (/개월|달|month/.test(matchText)) {
          targetDate.setMonth(targetDate.getMonth() + (number * multiplier));
          precision = 'month';
        } else if (/년|year/.test(matchText)) {
          targetDate.setFullYear(targetDate.getFullYear() + (number * multiplier));
          precision = 'year';
        }
        
        return {
          date: targetDate,
          relativeType: isAgo ? 'ago' : 'future',
          relativeAmount: number,
          relativeUnit: this.extractTimeUnit(matchText),
          precision
        };
      }

      return null;

    } catch (error) {
      logger.warn({
        event: 'RELATIVE_DATE_PARSING_ERROR',
        match: match[0],
        error: error.message
      });
      return null;
    }
  }

  /**
   * 날짜 처리 및 신뢰도 계산
   */
  processAndScoreDates(dates, originalText) {
    const processedDates = [];
    const seenDates = new Set();

    dates.forEach(dateInfo => {
      // 중복 제거 (같은 날짜)
      const dateKey = dateInfo.date.toISOString().split('T')[0];
      if (seenDates.has(dateKey)) return;
      seenDates.add(dateKey);

      // 신뢰도 계산
      const confidence = this.calculateDateConfidence(dateInfo, originalText);
      
      processedDates.push({
        ...dateInfo,
        confidence,
        formattedDate: this.formatDate(dateInfo.date, dateInfo.precision),
        isoDate: dateInfo.date.toISOString()
      });
    });

    return processedDates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 날짜 신뢰도 계산
   */
  calculateDateConfidence(dateInfo, originalText) {
    let confidence = 0.5; // 기본 신뢰도

    // 1. 날짜 타입별 기본 신뢰도
    if (dateInfo.type === 'absolute') {
      confidence += 0.3;
    } else {
      confidence += 0.1;
    }

    // 2. 정밀도별 가중치
    switch (dateInfo.precision) {
      case 'day':
        confidence += 0.2;
        break;
      case 'month':
        confidence += 0.1;
        break;
      case 'year':
        confidence += 0.05;
        break;
    }

    // 3. 의료 키워드 근접성 검사
    const contextWindow = this.getContextWindow(originalText, dateInfo.position, 50);
    const medicalKeywordCount = this.countMedicalKeywords(contextWindow);
    confidence += Math.min(medicalKeywordCount * 0.1, 0.2);

    // 4. 날짜 합리성 검사
    const now = new Date();
    const dateAge = Math.abs(now.getTime() - dateInfo.date.getTime()) / (1000 * 60 * 60 * 24 * 365);
    
    if (dateAge > 100) { // 100년 이상 차이
      confidence -= 0.3;
    } else if (dateAge > 50) { // 50년 이상 차이
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 전체 신뢰도 계산
   */
  calculateOverallConfidence(dates) {
    if (dates.length === 0) return 0;
    
    const avgConfidence = dates.reduce((sum, d) => sum + d.confidence, 0) / dates.length;
    const countBonus = Math.min(dates.length * 0.05, 0.2);
    
    return Math.min(1, avgConfidence + countBonus);
  }

  /**
   * 유틸리티 메서드들
   */
  getMonthNumber(monthName) {
    const months = {
      'january': 1, 'february': 2, 'march': 3, 'april': 4,
      'may': 5, 'june': 6, 'july': 7, 'august': 8,
      'september': 9, 'october': 10, 'november': 11, 'december': 12
    };
    return months[monthName.toLowerCase()] || null;
  }

  validateAndCreateDate(year, month, day) {
    try {
      const y = parseInt(year);
      const m = month ? parseInt(month) : 1;
      const d = day ? parseInt(day) : 1;
      
      if (y < 1900 || y > 2100) return null;
      if (m < 1 || m > 12) return null;
      if (d < 1 || d > 31) return null;
      
      const date = new Date(y, m - 1, d);
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        return null;
      }
      
      return date;
    } catch {
      return null;
    }
  }

  extractTimeUnit(text) {
    if (/일|day/.test(text)) return 'day';
    if (/주|week/.test(text)) return 'week';
    if (/개월|달|month/.test(text)) return 'month';
    if (/년|year/.test(text)) return 'year';
    return 'unknown';
  }

  getContextWindow(text, position, windowSize) {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.substring(start, end);
  }

  countMedicalKeywords(text) {
    let count = 0;
    const lowerText = text.toLowerCase();
    
    // 의료 키워드 검사
    Object.values(MEDICAL_KEYWORDS).forEach(keywords => {
      keywords.forEach(keyword => {
        if (lowerText.includes(keyword.toLowerCase())) {
          count++;
        }
      });
    });
    
    return count;
  }

  /**
   * 배치 텍스트에서 날짜 추출
   * @param {string[]} texts - 분석할 텍스트 배열
   * @param {Object} options - 추출 옵션
   * @returns {Promise<Array>} 각 텍스트별 추출 결과 배열
   */
  async extractDatesBatch(texts, options = {}) {
    try {
      const results = [];
      
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        const result = await this.extractDates(text, options);
        results.push({
          index: i,
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), // 로깅용 축약
          ...result
        });
      }
      
      return results;
    } catch (error) {
      logger.error({
        event: 'batch_extraction_error',
        error: error.message,
        batchSize: texts.length
      });
      throw error;
    }
  }

  formatDate(date, precision) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    switch (precision) {
      case 'day':
        return `${year}-${month}-${day}`;
      case 'month':
        return `${year}-${month}`;
      case 'year':
        return `${year}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const advancedDateService = new AdvancedDateService();