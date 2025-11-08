/**
 * Validation Engine - Phase 2 Enhancement
 * 
 * 날짜 추출 정확도 향상을 위한 고급 검증 시스템
 * 
 * 핵심 기능:
 * 1. Multi-Layer Validation: 다층 검증 시스템
 * 2. Accuracy Scoring: 정확도 점수 계산
 * 3. Confidence Assessment: 신뢰도 평가
 * 4. Quality Metrics: 품질 지표 측정
 * 5. Error Detection: 오류 탐지 및 수정
 */

import { globalErrorHandler, safeExecute, safeExecuteWithRetry } from './errorHandler.js';

class ValidationEngine {
  constructor() {
    this.version = '1.0.0';
    
    // 검증 기준
    this.validationCriteria = {
      dateFormat: {
        patterns: [
          /^\d{4}-\d{2}-\d{2}$/,
          /^\d{4}\/\d{2}\/\d{2}$/,
          /^\d{4}\.\d{2}\.\d{2}$/,
          /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/
        ],
        weight: 0.3
      },
      dateRange: {
        minYear: 1900,
        maxYear: 2030,
        weight: 0.2
      },
      contextRelevance: {
        medicalKeywords: [
          '진료', '치료', '검사', '수술', '입원', '퇴원',
          '처방', '투약', '진단', '소견', '촬영', '측정'
        ],
        weight: 0.25
      },
      consistency: {
        chronologicalOrder: true,
        duplicateDetection: true,
        weight: 0.25
      }
    };
    
    // 품질 임계값
    this.qualityThresholds = {
      excellent: 0.9,
      good: 0.8,
      acceptable: 0.7,
      poor: 0.6
    };
    
    // 검증 통계
    this.validationStats = {
      totalValidated: 0,
      passedValidation: 0,
      failedValidation: 0,
      averageAccuracy: 0,
      averageConfidence: 0,
      lastUpdated: null
    };
  }

  /**
   * 메인 검증 함수
   */
  async validateDateExtractionResults(results, originalText, options = {}) {
    return await safeExecuteWithRetry(async () => {
      // 입력 검증
      if (!results || typeof results !== 'object') {
        throw new Error('검증할 결과가 유효하지 않습니다.');
      }
      
      if (!originalText || typeof originalText !== 'string') {
        throw new Error('원본 텍스트가 유효하지 않습니다.');
      }
      
      console.log('🔍 날짜 추출 결과 검증 시작...');
      
      // 1. 형식 검증
      const formatValidation = await this.validateDateFormats(results);
      
      // 2. 범위 검증
      const rangeValidation = await this.validateDateRanges(results);
      
      // 3. 맥락 검증
      const contextValidation = await this.validateContextRelevance(results, originalText);
      
      // 4. 일관성 검증
      const consistencyValidation = await this.validateConsistency(results);
      
      // 5. 종합 점수 계산
      const overallScore = this.calculateOverallScore({
        format: formatValidation,
        range: rangeValidation,
        context: contextValidation,
        consistency: consistencyValidation
      });
      
      // 6. 품질 등급 결정
      const qualityGrade = this.determineQualityGrade(overallScore);
      
      // 7. 개선 제안 생성
      const improvements = this.generateImprovementSuggestions({
        format: formatValidation,
        range: rangeValidation,
        context: contextValidation,
        consistency: consistencyValidation
      });
      
      // 8. 통계 업데이트
      this.updateValidationStats(overallScore, qualityGrade);
      
      const validationResult = {
        success: true,
        version: this.version,
        overallScore,
        qualityGrade,
        validations: {
          format: formatValidation,
          range: rangeValidation,
          context: contextValidation,
          consistency: consistencyValidation
        },
        improvements,
        stats: this.validationStats,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ 검증 완료 - 점수: ${overallScore.toFixed(3)}, 등급: ${qualityGrade}`);
      
      return validationResult;
    }, {
      maxRetries: 2,
      retryDelay: 500,
      context: 'validateDateExtractionResults'
    });
  }

  /**
   * 날짜 형식 검증
   */
  async validateDateFormats(results) {
    return await safeExecute(async () => {
      const dates = this.extractDatesFromResults(results);
      let validCount = 0;
      let totalCount = dates.length;
      const invalidDates = [];
      
      for (const dateInfo of dates) {
        const isValid = this.validationCriteria.dateFormat.patterns.some(pattern => 
          pattern.test(dateInfo.formatted || dateInfo.original)
        );
        
        if (isValid) {
          validCount++;
        } else {
          invalidDates.push({
            date: dateInfo.original,
            reason: '형식이 표준과 일치하지 않음'
          });
        }
      }
      
      const score = totalCount > 0 ? validCount / totalCount : 1;
      
      return {
        score,
        weight: this.validationCriteria.dateFormat.weight,
        weightedScore: score * this.validationCriteria.dateFormat.weight,
        details: {
          totalDates: totalCount,
          validDates: validCount,
          invalidDates
        }
      };
    }, '날짜 형식 검증');
  }

  /**
   * 날짜 범위 검증
   */
  async validateDateRanges(results) {
    return await safeExecute(async () => {
      const dates = this.extractDatesFromResults(results);
      let validCount = 0;
      let totalCount = dates.length;
      const outOfRangeDates = [];
      
      for (const dateInfo of dates) {
        const year = this.extractYear(dateInfo);
        
        if (year >= this.validationCriteria.dateRange.minYear && 
            year <= this.validationCriteria.dateRange.maxYear) {
          validCount++;
        } else {
          outOfRangeDates.push({
            date: dateInfo.original,
            year,
            reason: `연도가 범위를 벗어남 (${this.validationCriteria.dateRange.minYear}-${this.validationCriteria.dateRange.maxYear})`
          });
        }
      }
      
      const score = totalCount > 0 ? validCount / totalCount : 1;
      
      return {
        score,
        weight: this.validationCriteria.dateRange.weight,
        weightedScore: score * this.validationCriteria.dateRange.weight,
        details: {
          totalDates: totalCount,
          validDates: validCount,
          outOfRangeDates
        }
      };
    }, '날짜 범위 검증');
  }

  /**
   * 맥락 관련성 검증
   */
  async validateContextRelevance(results, originalText) {
    return await safeExecute(async () => {
      const dates = this.extractDatesFromResults(results);
      let relevantCount = 0;
      let totalCount = dates.length;
      const irrelevantDates = [];
      
      for (const dateInfo of dates) {
        const contextWindow = this.getContextWindow(originalText, dateInfo.position);
        const hasRelevantKeywords = this.validationCriteria.contextRelevance.medicalKeywords.some(keyword => 
          contextWindow.toLowerCase().includes(keyword)
        );
        
        if (hasRelevantKeywords) {
          relevantCount++;
        } else {
          irrelevantDates.push({
            date: dateInfo.original,
            context: contextWindow,
            reason: '의료 관련 키워드가 주변에 없음'
          });
        }
      }
      
      const score = totalCount > 0 ? relevantCount / totalCount : 1;
      
      return {
        score,
        weight: this.validationCriteria.contextRelevance.weight,
        weightedScore: score * this.validationCriteria.contextRelevance.weight,
        details: {
          totalDates: totalCount,
          relevantDates: relevantCount,
          irrelevantDates
        }
      };
    }, '맥락 관련성 검증');
  }

  /**
   * 일관성 검증
   */
  async validateConsistency(results) {
    return await safeExecute(async () => {
      const dates = this.extractDatesFromResults(results);
      let consistencyScore = 1;
      const issues = [];
      
      // 중복 날짜 검사
      const duplicates = this.findDuplicateDates(dates);
      if (duplicates.length > 0) {
        consistencyScore -= 0.2;
        issues.push({
          type: 'duplicates',
          count: duplicates.length,
          dates: duplicates
        });
      }
      
      // 시간순 정렬 검사
      const chronologyIssues = this.checkChronologicalOrder(dates);
      if (chronologyIssues.length > 0) {
        consistencyScore -= 0.3;
        issues.push({
          type: 'chronology',
          count: chronologyIssues.length,
          issues: chronologyIssues
        });
      }
      
      consistencyScore = Math.max(0, consistencyScore);
      
      return {
        score: consistencyScore,
        weight: this.validationCriteria.consistency.weight,
        weightedScore: consistencyScore * this.validationCriteria.consistency.weight,
        details: {
          totalDates: dates.length,
          issues
        }
      };
    }, '일관성 검증');
  }

  /**
   * 종합 점수 계산
   */
  calculateOverallScore(validations) {
    const totalWeightedScore = Object.values(validations)
      .reduce((sum, validation) => sum + validation.weightedScore, 0);
    
    const totalWeight = Object.values(this.validationCriteria)
      .reduce((sum, criteria) => sum + criteria.weight, 0);
    
    return totalWeightedScore / totalWeight;
  }

  /**
   * 품질 등급 결정
   */
  determineQualityGrade(score) {
    if (score >= this.qualityThresholds.excellent) return 'excellent';
    if (score >= this.qualityThresholds.good) return 'good';
    if (score >= this.qualityThresholds.acceptable) return 'acceptable';
    if (score >= this.qualityThresholds.poor) return 'poor';
    return 'unacceptable';
  }

  /**
   * 개선 제안 생성
   */
  generateImprovementSuggestions(validations) {
    const suggestions = [];
    
    if (validations.format.score < 0.8) {
      suggestions.push({
        category: 'format',
        priority: 'high',
        suggestion: '날짜 형식 표준화 개선 필요',
        details: validations.format.details.invalidDates
      });
    }
    
    if (validations.range.score < 0.9) {
      suggestions.push({
        category: 'range',
        priority: 'medium',
        suggestion: '날짜 범위 검증 강화 필요',
        details: validations.range.details.outOfRangeDates
      });
    }
    
    if (validations.context.score < 0.7) {
      suggestions.push({
        category: 'context',
        priority: 'high',
        suggestion: '맥락 분석 알고리즘 개선 필요',
        details: validations.context.details.irrelevantDates
      });
    }
    
    if (validations.consistency.score < 0.8) {
      suggestions.push({
        category: 'consistency',
        priority: 'medium',
        suggestion: '일관성 검증 로직 강화 필요',
        details: validations.consistency.details.issues
      });
    }
    
    return suggestions;
  }

  /**
   * 검증 통계 업데이트
   */
  updateValidationStats(score, grade) {
    this.validationStats.totalValidated++;
    
    if (grade === 'excellent' || grade === 'good' || grade === 'acceptable') {
      this.validationStats.passedValidation++;
    } else {
      this.validationStats.failedValidation++;
    }
    
    // 평균 정확도 업데이트
    const prevAvg = this.validationStats.averageAccuracy;
    const count = this.validationStats.totalValidated;
    this.validationStats.averageAccuracy = (prevAvg * (count - 1) + score) / count;
    
    this.validationStats.lastUpdated = new Date().toISOString();
  }

  /**
   * 결과에서 날짜 추출
   */
  extractDatesFromResults(results) {
    const dates = [];
    
    // results 구조에 따라 날짜 추출 로직 구현
    if (results.result && results.result.primary) {
      results.result.primary.forEach(date => {
        dates.push({
          original: date.original || date.text,
          formatted: date.formatted,
          position: date.position || 0,
          type: 'primary'
        });
      });
    }
    
    if (results.result && results.result.secondary) {
      results.result.secondary.forEach(date => {
        dates.push({
          original: date.original || date.text,
          formatted: date.formatted,
          position: date.position || 0,
          type: 'secondary'
        });
      });
    }
    
    return dates;
  }

  /**
   * 연도 추출
   */
  extractYear(dateInfo) {
    const dateStr = dateInfo.formatted || dateInfo.original;
    const yearMatch = dateStr.match(/\d{4}/);
    return yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  }

  /**
   * 맥락 윈도우 가져오기
   */
  getContextWindow(text, position, windowSize = 100) {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.substring(start, end);
  }

  /**
   * 중복 날짜 찾기
   */
  findDuplicateDates(dates) {
    const seen = new Map();
    const duplicates = [];
    
    dates.forEach(date => {
      const key = date.formatted || date.original;
      if (seen.has(key)) {
        duplicates.push(key);
      } else {
        seen.set(key, true);
      }
    });
    
    return duplicates;
  }

  /**
   * 시간순 정렬 검사
   */
  checkChronologicalOrder(dates) {
    const issues = [];
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i-1].formatted || dates[i-1].original);
      const currDate = new Date(dates[i].formatted || dates[i].original);
      
      if (prevDate > currDate) {
        issues.push({
          index: i,
          prevDate: dates[i-1].original,
          currDate: dates[i].original,
          reason: '시간순 정렬이 맞지 않음'
        });
      }
    }
    
    return issues;
  }

  /**
   * 검증 리포트 생성
   */
  generateValidationReport() {
    return {
      version: this.version,
      stats: this.validationStats,
      criteria: this.validationCriteria,
      thresholds: this.qualityThresholds,
      generatedAt: new Date().toISOString()
    };
  }
}

export { ValidationEngine };