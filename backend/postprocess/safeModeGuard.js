/**
 * Safe Mode Guard (T09)
 * 
 * 목적:
 * - 불확실한 데이터에 대한 경고 및 fallback 처리
 * - A-B-C 계획의 "C. Precision 100% 보장" 지원
 * - 추정/가정 금지, 확실한 데이터만 출력
 * 
 * 기능:
 * - 신뢰도 임계값 미달 시 경고
 * - 필수 필드 누락 시 안전 fallback
 * - 데이터 충돌 감지 및 알림
 * - 불확실성 라벨링
 * 
 * @module postprocess/safeModeGuard
 */

import { logService } from '../utils/logger.js';

// 기본 설정
const DEFAULT_CONFIG = {
  // 신뢰도 임계값
  confidenceThreshold: {
    date: 0.8,
    diagnosis: 0.7,
    hospital: 0.6,
    eventType: 0.7,
    overall: 0.6,
  },
  
  // 필수 필드
  requiredFields: {
    event: ['id', 'date'],
    diagnosis: ['name'],
    hospital: [],
  },
  
  // 안전모드 활성화 조건
  safeModeTriggers: {
    lowConfidenceRatio: 0.7, // 70% 이상 저신뢰도 → 안전모드 (requireKeywords=false 기준 완화)
    missingFieldRatio: 0.2, // 20% 이상 필드 누락 → 안전모드
    conflictCount: 3, // 3개 이상 충돌 → 안전모드
  },
  
  // Fallback 값
  fallbackValues: {
    date: null,
    hospital: '병원명 미상',
    diagnosis: '진단명 미상',
    eventType: '의료이벤트',
  },
};

// 경고 메시지 템플릿
const WARNING_MESSAGES = {
  lowConfidence: '⚠️ 신뢰도 부족: {field} 값의 신뢰도가 {confidence}%로 임계값({threshold}%) 미달',
  missingField: '⚠️ 필수 필드 누락: {field}',
  dateConflict: '⚠️ 날짜 충돌: {date1} vs {date2}',
  diagnosisConflict: '⚠️ 진단 충돌: {diag1} vs {diag2}',
  safeModeActivated: '🛡️ 안전모드 활성화: {reason}',
  dataIntegrityIssue: '⚠️ 데이터 무결성 문제: {issue}',
};

// 불확실성 라벨
const UNCERTAINTY_LABELS = {
  high: { label: 'UNCERTAIN', color: 'red', action: 'REVIEW_REQUIRED' },
  medium: { label: 'UNVERIFIED', color: 'orange', action: 'MANUAL_CHECK' },
  low: { label: 'VERIFIED', color: 'green', action: 'NONE' },
};

class SafeModeGuard {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.warnings = [];
    this.safeModeActive = false;
    this.safeModeReason = null;
    this.statistics = {
      totalEvents: 0,
      lowConfidenceEvents: 0,
      missingFieldEvents: 0,
      conflictEvents: 0,
      fallbackApplied: 0,
    };
  }

  /**
   * 안전모드 상태 초기화
   */
  reset() {
    this.warnings = [];
    this.safeModeActive = false;
    this.safeModeReason = null;
    this.statistics = {
      totalEvents: 0,
      lowConfidenceEvents: 0,
      missingFieldEvents: 0,
      conflictEvents: 0,
      fallbackApplied: 0,
    };
  }

  /**
   * 이벤트 배열 검증 및 안전 처리
   * @param {Array} events - 의료 이벤트 배열
   * @returns {Object} 검증 결과 및 처리된 이벤트
   */
  validateAndGuard(events) {
    this.reset();
    
    if (!events || !Array.isArray(events)) {
      logService.warn('[SafeModeGuard] 이벤트 배열이 유효하지 않습니다');
      return {
        success: false,
        events: [],
        safeModeActive: true,
        safeModeReason: '유효하지 않은 이벤트 배열',
        warnings: ['이벤트 배열이 null 또는 배열이 아님'],
        statistics: this.statistics,
      };
    }
    
    this.statistics.totalEvents = events.length;
    
    // 1. 개별 이벤트 검증 및 처리
    const processedEvents = events.map(event => this.validateEvent(event));
    
    // 2. 안전모드 활성화 조건 확인
    this.checkSafeModeTriggers();
    
    // 3. 충돌 감지
    this.detectConflicts(processedEvents);
    
    // 4. 최종 결과
    const result = {
      success: true,
      events: processedEvents,
      safeModeActive: this.safeModeActive,
      safeModeReason: this.safeModeReason,
      warnings: this.warnings,
      statistics: this.statistics,
    };
    
    if (this.safeModeActive) {
      logService.warn(`[SafeModeGuard] 안전모드 활성화: ${this.safeModeReason}`);
    }
    
    logService.info(`[SafeModeGuard] 검증 완료: ${events.length}개 이벤트, ` +
      `저신뢰도: ${this.statistics.lowConfidenceEvents}, ` +
      `필드누락: ${this.statistics.missingFieldEvents}, ` +
      `Fallback: ${this.statistics.fallbackApplied}`);
    
    return result;
  }

  /**
   * 개별 이벤트 검증
   */
  validateEvent(event) {
    const validated = { ...event };
    const eventWarnings = [];
    let hasLowConfidence = false;
    let hasMissingField = false;
    
    // 1. 필수 필드 검증
    this.config.requiredFields.event.forEach(field => {
      if (event[field] === undefined || event[field] === null || event[field] === '') {
        // Fallback 적용
        if (this.config.fallbackValues[field] !== undefined) {
          validated[field] = this.config.fallbackValues[field];
          this.statistics.fallbackApplied++;
          eventWarnings.push(this.formatWarning('missingField', { field }));
        }
        hasMissingField = true;
      }
    });
    
    // 2. 날짜 검증
    if (event.date) {
      const dateConfidence = event.dateConfidence || event.confidence || 0.8;
      if (dateConfidence < this.config.confidenceThreshold.date) {
        eventWarnings.push(this.formatWarning('lowConfidence', {
          field: 'date',
          confidence: (dateConfidence * 100).toFixed(0),
          threshold: (this.config.confidenceThreshold.date * 100).toFixed(0),
        }));
        hasLowConfidence = true;
      }
    } else {
      validated.date = this.config.fallbackValues.date;
      eventWarnings.push(this.formatWarning('missingField', { field: 'date' }));
      hasMissingField = true;
    }
    
    // 3. 진단 검증
    if (event.diagnosis) {
      const diagConfidence = event.diagnosis.confidence || event.confidence || 0.8;
      if (diagConfidence < this.config.confidenceThreshold.diagnosis) {
        eventWarnings.push(this.formatWarning('lowConfidence', {
          field: 'diagnosis',
          confidence: (diagConfidence * 100).toFixed(0),
          threshold: (this.config.confidenceThreshold.diagnosis * 100).toFixed(0),
        }));
        hasLowConfidence = true;
      }
    }
    
    // 4. 병원 검증
    if (!event.hospital || event.hospital === '병원명 미상' || event.hospital === '') {
      validated.hospital = this.config.fallbackValues.hospital;
    }
    
    // 5. 전체 신뢰도 검증
    const overallConfidence = event.confidence || 0.8;
    if (overallConfidence < this.config.confidenceThreshold.overall) {
      hasLowConfidence = true;
    }
    
    // 6. 불확실성 라벨링
    if (hasLowConfidence || hasMissingField) {
      validated.uncertainty = this.getUncertaintyLabel(hasLowConfidence, hasMissingField);
    } else {
      validated.uncertainty = UNCERTAINTY_LABELS.low;
    }
    
    // 7. 경고 추가
    validated._warnings = eventWarnings;
    this.warnings.push(...eventWarnings);
    
    // 8. 통계 업데이트
    if (hasLowConfidence) this.statistics.lowConfidenceEvents++;
    if (hasMissingField) this.statistics.missingFieldEvents++;
    
    return validated;
  }

  /**
   * 안전모드 활성화 조건 확인
   */
  checkSafeModeTriggers() {
    const { totalEvents, lowConfidenceEvents, missingFieldEvents } = this.statistics;
    const { safeModeTriggers } = this.config;
    
    if (totalEvents === 0) return;
    
    // 저신뢰도 비율 체크
    const lowConfRatio = lowConfidenceEvents / totalEvents;
    if (lowConfRatio >= safeModeTriggers.lowConfidenceRatio) {
      this.safeModeActive = true;
      this.safeModeReason = `저신뢰도 이벤트 비율 높음: ${(lowConfRatio * 100).toFixed(1)}%`;
      this.warnings.push(this.formatWarning('safeModeActivated', { reason: this.safeModeReason }));
    }
    
    // 필드 누락 비율 체크
    const missingRatio = missingFieldEvents / totalEvents;
    if (missingRatio >= safeModeTriggers.missingFieldRatio) {
      this.safeModeActive = true;
      this.safeModeReason = `필수 필드 누락 비율 높음: ${(missingRatio * 100).toFixed(1)}%`;
      this.warnings.push(this.formatWarning('safeModeActivated', { reason: this.safeModeReason }));
    }
  }

  /**
   * 충돌 감지
   */
  detectConflicts(events) {
    // 날짜 충돌 감지 (같은 이벤트에 다른 날짜)
    const dateMap = new Map();
    
    events.forEach(event => {
      if (event.id && event.date) {
        const baseId = event.id.split('-')[0];
        if (dateMap.has(baseId)) {
          const existingDate = dateMap.get(baseId);
          if (existingDate !== event.date) {
            this.warnings.push(this.formatWarning('dateConflict', {
              date1: existingDate,
              date2: event.date,
            }));
            this.statistics.conflictEvents++;
          }
        } else {
          dateMap.set(baseId, event.date);
        }
      }
    });
    
    // 충돌 횟수 기반 안전모드 활성화
    if (this.statistics.conflictEvents >= this.config.safeModeTriggers.conflictCount) {
      this.safeModeActive = true;
      this.safeModeReason = `데이터 충돌 다수 발생: ${this.statistics.conflictEvents}건`;
      this.warnings.push(this.formatWarning('safeModeActivated', { reason: this.safeModeReason }));
    }
  }

  /**
   * 불확실성 라벨 결정
   */
  getUncertaintyLabel(hasLowConfidence, hasMissingField) {
    if (hasLowConfidence && hasMissingField) {
      return UNCERTAINTY_LABELS.high;
    } else if (hasLowConfidence || hasMissingField) {
      return UNCERTAINTY_LABELS.medium;
    }
    return UNCERTAINTY_LABELS.low;
  }

  /**
   * 경고 메시지 포맷팅
   */
  formatWarning(type, params) {
    let message = WARNING_MESSAGES[type] || type;
    
    Object.entries(params).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, value);
    });
    
    return message;
  }

  /**
   * 안전모드 상태 확인
   */
  isSafeModeActive() {
    return this.safeModeActive;
  }

  /**
   * 모든 경고 반환
   */
  getWarnings() {
    return this.warnings;
  }

  /**
   * 통계 반환
   */
  getStatistics() {
    return this.statistics;
  }

  /**
   * 안전모드 보고서 생성
   */
  generateReport() {
    return {
      safeModeActive: this.safeModeActive,
      safeModeReason: this.safeModeReason,
      statistics: this.statistics,
      warnings: this.warnings,
      summary: this.generateSummary(),
    };
  }

  /**
   * 요약 생성
   */
  generateSummary() {
    const { totalEvents, lowConfidenceEvents, missingFieldEvents, conflictEvents, fallbackApplied } = this.statistics;
    
    const lines = [
      `총 이벤트: ${totalEvents}건`,
      `저신뢰도 이벤트: ${lowConfidenceEvents}건 (${totalEvents > 0 ? ((lowConfidenceEvents / totalEvents) * 100).toFixed(1) : 0}%)`,
      `필드 누락 이벤트: ${missingFieldEvents}건 (${totalEvents > 0 ? ((missingFieldEvents / totalEvents) * 100).toFixed(1) : 0}%)`,
      `데이터 충돌: ${conflictEvents}건`,
      `Fallback 적용: ${fallbackApplied}건`,
    ];
    
    if (this.safeModeActive) {
      lines.unshift(`🛡️ 안전모드 활성화: ${this.safeModeReason}`);
    } else {
      lines.unshift('✅ 정상 모드');
    }
    
    return lines.join('\n');
  }

  /**
   * 이벤트에 안전모드 플래그 추가
   */
  applyFlags(events) {
    return events.map(event => ({
      ...event,
      safeMode: {
        active: this.safeModeActive,
        reason: this.safeModeReason,
        hasWarnings: event._warnings && event._warnings.length > 0,
        warningCount: event._warnings ? event._warnings.length : 0,
      },
    }));
  }
}

// Singleton export
const safeModeGuard = new SafeModeGuard();
export default safeModeGuard;

// Named export
export { SafeModeGuard, DEFAULT_CONFIG, WARNING_MESSAGES, UNCERTAINTY_LABELS };
