/**
 * 고급 날짜 분석 서비스
 * 프로젝트 규칙: 도메인 로직(순수 함수 지향), 입력검증(zod), 구조화 로깅
 */

import { z } from 'zod';
import { 
  AdvancedDateRequest, 
  AdvancedDateResponse, 
  DateExtraction,
  ERROR_CODES 
} from '../types/index';
import { QUALITY_THRESHOLDS, SYSTEM_CONFIG } from '../../../shared/constants/medical';
import { logger, logProcessingStart, logProcessingSuccess, logProcessingError } from '../../../shared/logging/logger';
import { mask } from '../../../shared/security/mask';

interface DatePattern {
  pattern: RegExp;
  type: 'absolute' | 'relative';
  confidence: number;
  processor: (match: RegExpMatchArray, text: string) => DateExtraction | null;
}

export class AdvancedDateService {
  private readonly datePatterns: DatePattern[];
  private readonly relativePatterns: DatePattern[];

  constructor() {
    this.datePatterns = this.initializeDatePatterns();
    this.relativePatterns = this.initializeRelativePatterns();
  }

  /**
   * 텍스트에서 날짜 추출 (메인 메서드)
   */
  async extractDates(request: AdvancedDateRequest, traceId: string): Promise<AdvancedDateResponse> {
    const startTime = Date.now();
    
    try {
      // 입력 검증
      const validatedRequest = AdvancedDateRequest.parse(request);
      
      logProcessingStart(traceId, 'date_extraction', validatedRequest.text.length);

      // 날짜 추출 실행
      const extractedDates = await this.performDateExtraction(validatedRequest, traceId);
      
      // 결과 후처리
      const processedDates = this.postProcessDates(extractedDates, validatedRequest.options);
      
      const processingTime = Date.now() - startTime;
      
      logProcessingSuccess(traceId, 'date_extraction', processingTime, processedDates.length);

      return {
        success: true,
        data: {
          extractedDates: processedDates,
          totalCount: processedDates.length,
          processingTime
        },
        metadata: {
          processingTime,
          version: '2.0.0',
          traceId
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logProcessingError(traceId, 'date_extraction', error as Error, processingTime);

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: '입력 데이터 검증 실패',
            details: error.errors
          },
          metadata: {
            processingTime,
            version: '2.0.0',
            traceId
          }
        };
      }

      return {
        success: false,
        error: {
          code: ERROR_CODES.PROCESSING_ERROR,
          message: '날짜 추출 처리 중 오류 발생',
          details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
        },
        metadata: {
          processingTime,
          version: '2.0.0',
          traceId
        }
      };
    }
  }

  /**
   * 날짜 추출 실행
   */
  private async performDateExtraction(request: AdvancedDateRequest, traceId: string): Promise<DateExtraction[]> {
    const { text, options = {} } = request;
    const results: DateExtraction[] = [];

    // 절대 날짜 추출
    if (options.includeAbsolute !== false) {
      const absoluteDates = this.extractAbsoluteDates(text);
      results.push(...absoluteDates);
    }

    // 상대 날짜 추출
    if (options.includeRelative !== false) {
      const relativeDates = this.extractRelativeDates(text);
      results.push(...relativeDates);
    }

    // 중복 제거 및 정렬
    const uniqueDates = this.removeDuplicates(results);
    const sortedDates = this.sortByPosition(uniqueDates);

    logger.info({
      event: 'date_extraction_details',
      traceId,
      metadata: {
        inputLength: text.length,
        absoluteCount: results.filter(d => d.type === 'absolute').length,
        relativeCount: results.filter(d => d.type === 'relative').length,
        finalCount: sortedDates.length
      }
    });

    return sortedDates;
  }

  /**
   * 절대 날짜 추출
   */
  private extractAbsoluteDates(text: string): DateExtraction[] {
    const results: DateExtraction[] = [];

    for (const pattern of this.datePatterns) {
      const matches = Array.from(text.matchAll(pattern.pattern));
      
      for (const match of matches) {
        try {
          const extraction = pattern.processor(match, text);
          if (extraction && this.isValidDate(extraction)) {
            results.push(extraction);
          }
        } catch (error) {
          logger.warn({
            event: 'date_pattern_error',
            message: `날짜 패턴 처리 중 오류: ${pattern.pattern}`,
            metadata: { 
              pattern: pattern.pattern.toString(),
              match: mask(match[0]),
              error: (error as Error).message
            }
          });
        }
      }
    }

    return results;
  }

  /**
   * 상대 날짜 추출
   */
  private extractRelativeDates(text: string): DateExtraction[] {
    const results: DateExtraction[] = [];

    for (const pattern of this.relativePatterns) {
      const matches = Array.from(text.matchAll(pattern.pattern));
      
      for (const match of matches) {
        try {
          const extraction = pattern.processor(match, text);
          if (extraction && this.isValidDate(extraction)) {
            results.push(extraction);
          }
        } catch (error) {
          logger.warn({
            event: 'relative_date_error',
            message: `상대 날짜 처리 중 오류: ${pattern.pattern}`,
            metadata: { 
              pattern: pattern.pattern.toString(),
              match: mask(match[0]),
              error: (error as Error).message
            }
          });
        }
      }
    }

    return results;
  }

  /**
   * 날짜 패턴 초기화
   */
  private initializeDatePatterns(): DatePattern[] {
    return [
      // YYYY-MM-DD 형식
      {
        pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/g,
        type: 'absolute',
        confidence: 0.95,
        processor: (match, text) => this.processYYYYMMDD(match, text)
      },
      // YYYY.MM.DD 형식
      {
        pattern: /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
        type: 'absolute',
        confidence: 0.9,
        processor: (match, text) => this.processYYYYMMDD(match, text, '.')
      },
      // YYYY/MM/DD 형식
      {
        pattern: /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
        type: 'absolute',
        confidence: 0.9,
        processor: (match, text) => this.processYYYYMMDD(match, text, '/')
      },
      // MM/DD/YYYY 형식
      {
        pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
        type: 'absolute',
        confidence: 0.85,
        processor: (match, text) => this.processMMDDYYYY(match, text)
      },
      // 한국어 날짜 (YYYY년 MM월 DD일)
      {
        pattern: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
        type: 'absolute',
        confidence: 0.95,
        processor: (match, text) => this.processKoreanDate(match, text)
      },
      // 의료문서 특화 날짜 (진료일: YYYY-MM-DD)
      {
        pattern: /(진료일|수술일|입원일|퇴원일|검사일)[\s:]*(\d{4})-(\d{1,2})-(\d{1,2})/g,
        type: 'absolute',
        confidence: 0.98,
        processor: (match, text) => this.processMedicalDate(match, text)
      }
    ];
  }

  /**
   * 상대 날짜 패턴 초기화
   */
  private initializeRelativePatterns(): DatePattern[] {
    return [
      // N일 전/후
      {
        pattern: /(\d+)일\s*(전|후|뒤)/g,
        type: 'relative',
        confidence: 0.8,
        processor: (match, text) => this.processDaysRelative(match, text)
      },
      // N주 전/후
      {
        pattern: /(\d+)주\s*(전|후|뒤)/g,
        type: 'relative',
        confidence: 0.8,
        processor: (match, text) => this.processWeeksRelative(match, text)
      },
      // N개월 전/후
      {
        pattern: /(\d+)개월\s*(전|후|뒤)/g,
        type: 'relative',
        confidence: 0.8,
        processor: (match, text) => this.processMonthsRelative(match, text)
      },
      // 어제, 오늘, 내일
      {
        pattern: /(어제|오늘|내일|그제|모레)/g,
        type: 'relative',
        confidence: 0.9,
        processor: (match, text) => this.processSimpleRelative(match, text)
      },
      // 지난주, 다음주
      {
        pattern: /(지난주|다음주|이번주)/g,
        type: 'relative',
        confidence: 0.85,
        processor: (match, text) => this.processWeekRelative(match, text)
      }
    ];
  }

  /**
   * YYYY-MM-DD 형식 처리
   */
  private processYYYYMMDD(match: RegExpMatchArray, text: string, separator: string = '-'): DateExtraction | null {
    const [fullMatch, year, month, day] = match;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    // 유효성 검사
    if (!this.isValidDateComponents(yearNum, monthNum, dayNum)) {
      return null;
    }

    const normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    return {
      type: 'absolute',
      originalText: fullMatch,
      normalizedDate,
      confidence: this.calculateDateConfidence(yearNum, monthNum, dayNum),
      position: {
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length
      }
    };
  }

  /**
   * MM/DD/YYYY 형식 처리
   */
  private processMMDDYYYY(match: RegExpMatchArray, text: string): DateExtraction | null {
    const [fullMatch, month, day, year] = match;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    if (!this.isValidDateComponents(yearNum, monthNum, dayNum)) {
      return null;
    }

    const normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    return {
      type: 'absolute',
      originalText: fullMatch,
      normalizedDate,
      confidence: this.calculateDateConfidence(yearNum, monthNum, dayNum) * 0.9, // 미국식 형식은 신뢰도 약간 낮춤
      position: {
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length
      }
    };
  }

  /**
   * 한국어 날짜 처리
   */
  private processKoreanDate(match: RegExpMatchArray, text: string): DateExtraction | null {
    const [fullMatch, year, month, day] = match;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    if (!this.isValidDateComponents(yearNum, monthNum, dayNum)) {
      return null;
    }

    const normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    return {
      type: 'absolute',
      originalText: fullMatch,
      normalizedDate,
      confidence: 0.95, // 한국어 형식은 높은 신뢰도
      position: {
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length
      }
    };
  }

  /**
   * 의료문서 특화 날짜 처리
   */
  private processMedicalDate(match: RegExpMatchArray, text: string): DateExtraction | null {
    const [fullMatch, label, year, month, day] = match;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    if (!this.isValidDateComponents(yearNum, monthNum, dayNum)) {
      return null;
    }

    const normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    return {
      type: 'absolute',
      originalText: fullMatch,
      normalizedDate,
      confidence: 0.98, // 의료 라벨이 있는 날짜는 최고 신뢰도
      position: {
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length
      }
    };
  }

  /**
   * N일 전/후 처리
   */
  private processDaysRelative(match: RegExpMatchArray, text: string): DateExtraction | null {
    const [fullMatch, days, direction] = match;
    const daysNum = parseInt(days);

    if (daysNum > 365) return null; // 1년 이상은 제외

    return {
      type: 'relative',
      originalText: fullMatch,
      confidence: 0.8,
      position: {
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length
      }
    };
  }

  /**
   * N주 전/후 처리
   */
  private processWeeksRelative(match: RegExpMatchArray, text: string): DateExtraction | null {
    const [fullMatch, weeks, direction] = match;
    const weeksNum = parseInt(weeks);

    if (weeksNum > 52) return null; // 1년 이상은 제외

    return {
      type: 'relative',
      originalText: fullMatch,
      confidence: 0.8,
      position: {
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length
      }
    };
  }

  /**
   * N개월 전/후 처리
   */
  private processMonthsRelative(match: RegExpMatchArray, text: string): DateExtraction | null {
    const [fullMatch, months, direction] = match;
    const monthsNum = parseInt(months);

    if (monthsNum > 60) return null; // 5년 이상은 제외

    return {
      type: 'relative',
      originalText: fullMatch,
      confidence: 0.8,
      position: {
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length
      }
    };
  }

  /**
   * 단순 상대 날짜 처리 (어제, 오늘, 내일)
   */
  private processSimpleRelative(match: RegExpMatchArray, text: string): DateExtraction | null {
    const [fullMatch] = match;

    return {
      type: 'relative',
      originalText: fullMatch,
      confidence: 0.9,
      position: {
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length
      }
    };
  }

  /**
   * 주 단위 상대 날짜 처리
   */
  private processWeekRelative(match: RegExpMatchArray, text: string): DateExtraction | null {
    const [fullMatch] = match;

    return {
      type: 'relative',
      originalText: fullMatch,
      confidence: 0.85,
      position: {
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length
      }
    };
  }

  /**
   * 날짜 구성요소 유효성 검사
   */
  private isValidDateComponents(year: number, month: number, day: number): boolean {
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // 월별 일수 검사
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    // 윤년 검사
    if (month === 2 && this.isLeapYear(year)) {
      return day <= 29;
    }
    
    return day <= daysInMonth[month - 1];
  }

  /**
   * 윤년 검사
   */
  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * 날짜 신뢰도 계산
   */
  private calculateDateConfidence(year: number, month: number, day: number): number {
    let confidence = 0.8;

    // 현재 연도 기준 합리적 범위 내 날짜
    const currentYear = new Date().getFullYear();
    if (year >= currentYear - 10 && year <= currentYear + 1) {
      confidence += 0.1;
    }

    // 유효한 날짜 구성
    if (this.isValidDateComponents(year, month, day)) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 날짜 유효성 검사
   */
  private isValidDate(extraction: DateExtraction): boolean {
    if (extraction.confidence < QUALITY_THRESHOLDS.DATE_EXTRACTION.LOW_CONFIDENCE) {
      return false;
    }

    if (extraction.type === 'absolute' && extraction.normalizedDate) {
      const date = new Date(extraction.normalizedDate);
      return !isNaN(date.getTime());
    }

    return true;
  }

  /**
   * 중복 제거
   */
  private removeDuplicates(dates: DateExtraction[]): DateExtraction[] {
    const seen = new Set<string>();
    return dates.filter(date => {
      const key = `${date.position.start}-${date.position.end}-${date.originalText}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 위치별 정렬
   */
  private sortByPosition(dates: DateExtraction[]): DateExtraction[] {
    return dates.sort((a, b) => a.position.start - b.position.start);
  }

  /**
   * 결과 후처리
   */
  private postProcessDates(dates: DateExtraction[], options: any): DateExtraction[] {
    let processed = [...dates];

    // 신뢰도 필터링
    if (options?.minimumConfidence) {
      processed = processed.filter(date => date.confidence >= options.minimumConfidence);
    }

    // 최대 개수 제한
    if (options?.maxResults) {
      processed = processed
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, options.maxResults);
    }

    return processed;
  }
}