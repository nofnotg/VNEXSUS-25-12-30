/**
 * 구조화된 로깅 시스템
 * 
 * PII/PHI 마스킹과 함께 구조화된 로그를 제공
 */

import { mask, maskObject } from '../security/mask.js';
import { LOG_EVENTS } from '../constants/logging.js';

/**
 * 로그 레벨 우선순위
 */
const LOG_LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * 로거 클래스
 */
class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || 'info';
    this.enableConsole = process.env.NODE_ENV !== 'test';
  }

  /**
   * 로그 출력 여부 확인
   */
  shouldLog(level) {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  /**
   * 기본 로그 포맷팅
   */
  formatLog(level, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      ...data
    };

    // PII/PHI 마스킹 적용
    return maskObject(logEntry);
  }

  /**
   * 콘솔 출력
   */
  writeToConsole(level, formattedLog) {
    if (!this.enableConsole) return;

    const logString = JSON.stringify(formattedLog, null, 2);
    
    switch (level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'debug':
        console.debug(logString);
        break;
      default:
        console.log(logString);
    }
  }

  /**
   * 정보 로그
   */
  info(data) {
    if (!this.shouldLog('info')) return;
    
    const formattedLog = this.formatLog('info', data);
    this.writeToConsole('info', formattedLog);
    
    // 여기에 외부 로그 시스템 연동 가능 (예: Winston, Bunyan 등)
    return formattedLog;
  }

  /**
   * 경고 로그
   */
  warn(data) {
    if (!this.shouldLog('warn')) return;
    
    const formattedLog = this.formatLog('warn', data);
    this.writeToConsole('warn', formattedLog);
    
    return formattedLog;
  }

  /**
   * 에러 로그
   */
  error(data) {
    if (!this.shouldLog('error')) return;
    
    const formattedLog = this.formatLog('error', data);
    this.writeToConsole('error', formattedLog);
    
    return formattedLog;
  }

  /**
   * 디버그 로그
   */
  debug(data) {
    if (!this.shouldLog('debug')) return;
    
    const formattedLog = this.formatLog('debug', data);
    this.writeToConsole('debug', formattedLog);
    
    return formattedLog;
  }

  /**
   * API 요청 로그 유틸리티
   */
  logApiRequest(req, additionalData = {}) {
    return this.info({
      event: LOG_EVENTS.API_REQUEST,
      method: req.method,
      url: req.url,
      userAgent: mask(req.get('User-Agent') || ''),
      ip: req.ip,
      traceId: req.traceId,
      ...additionalData
    });
  }

  /**
   * API 응답 로그 유틸리티
   */
  logApiResponse(req, res, duration, additionalData = {}) {
    return this.info({
      event: LOG_EVENTS.API_RESPONSE,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      traceId: req.traceId,
      ...additionalData
    });
  }

  /**
   * 처리 시작 로그 유틸리티
   */
  logProcessingStart(processType, data = {}) {
    return this.info({
      event: LOG_EVENTS.PROCESSING_START,
      processType,
      startTime: new Date().toISOString(),
      ...maskObject(data)
    });
  }

  /**
   * 처리 완료 로그 유틸리티
   */
  logProcessingComplete(processType, duration, result = {}) {
    return this.info({
      event: LOG_EVENTS.PROCESSING_COMPLETE,
      processType,
      duration,
      endTime: new Date().toISOString(),
      ...maskObject(result)
    });
  }

  /**
   * 처리 에러 로그 유틸리티
   */
  logProcessingError(processType, error, context = {}) {
    return this.error({
      event: LOG_EVENTS.PROCESSING_ERROR,
      processType,
      error: error.message,
      stack: mask(error.stack || ''),
      ...maskObject(context)
    });
  }

  /**
   * 성능 메트릭 로그 유틸리티
   */
  logPerformanceMetric(metricName, value, unit = 'ms', tags = {}) {
    return this.info({
      event: LOG_EVENTS.PERFORMANCE_METRIC,
      metric: metricName,
      value,
      unit,
      tags: maskObject(tags)
    });
  }

  /**
   * 보안 이벤트 로그 유틸리티
   */
  logSecurityEvent(eventType, details = {}) {
    return this.warn({
      event: LOG_EVENTS.SECURITY_EVENT,
      securityEventType: eventType,
      ...maskObject(details)
    });
  }

  /**
   * 비즈니스 로직 로그 유틸리티
   */
  logBusinessEvent(eventType, data = {}) {
    return this.info({
      event: LOG_EVENTS.BUSINESS_EVENT,
      businessEventType: eventType,
      ...maskObject(data)
    });
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const logger = new Logger();

// 편의 함수들
export const logApiRequest = (req, additionalData) => logger.logApiRequest(req, additionalData);
export const logApiResponse = (req, res, duration, additionalData) => logger.logApiResponse(req, res, duration, additionalData);
export const logProcessingStart = (processType, data) => logger.logProcessingStart(processType, data);
export const logProcessingComplete = (processType, duration, result) => logger.logProcessingComplete(processType, duration, result);
export const logProcessingError = (processType, error, context) => logger.logProcessingError(processType, error, context);
export const logPerformanceMetric = (metricName, value, unit, tags) => logger.logPerformanceMetric(metricName, value, unit, tags);
export const logSecurityEvent = (eventType, details) => logger.logSecurityEvent(eventType, details);
export const logBusinessEvent = (eventType, data) => logger.logBusinessEvent(eventType, data);
