/**
 * 구조화 로깅 시스템
 * 프로젝트 규칙: console.* 금지, 로거 유틸만 허용
 */

import { LOG_LEVELS, LOG_EVENTS } from '../constants/medical';
import { mask } from '../security/mask';

interface LogEntry {
  timestamp: string;
  level: string;
  event: string;
  message?: string;
  userId?: string;
  traceId?: string;
  processingTime?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
  redactedFields?: string[];
}

interface LoggerConfig {
  enableConsole: boolean;
  enableFile: boolean;
  logLevel: string;
  maskPII: boolean;
  maxLogSize: number;
}

class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enableConsole: true,
      enableFile: false,
      logLevel: 'info',
      maskPII: true,
      maxLogSize: 1000,
      ...config
    };
  }

  /**
   * 정보 로그 기록
   */
  info(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log('info', entry);
  }

  /**
   * 경고 로그 기록
   */
  warn(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log('warn', entry);
  }

  /**
   * 에러 로그 기록
   */
  error(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log('error', entry);
  }

  /**
   * 디버그 로그 기록
   */
  debug(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log('debug', entry);
  }

  /**
   * 로그 기록 메인 메서드
   */
  private log(level: string, entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...entry
    };

    // PII/PHI 마스킹 처리
    if (this.config.maskPII) {
      logEntry.metadata = this.maskSensitiveData(logEntry.metadata);
      if (logEntry.message) {
        logEntry.message = mask(logEntry.message);
      }
    }

    // 로그 출력
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    // 로그 버퍼에 저장
    this.addToBuffer(logEntry);
  }

  /**
   * 로그 레벨 확인
   */
  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const logLevelIndex = levels.indexOf(level);
    
    return logLevelIndex <= currentLevelIndex;
  }

  /**
   * 콘솔 출력
   */
  private outputToConsole(entry: LogEntry): void {
    const output = JSON.stringify(entry, null, 2);
    
    switch (entry.level) {
      case 'error':
        // eslint-disable-next-line no-console
        console.error(output);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(output);
        break;
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(output);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(output);
    }
  }

  /**
   * 로그 버퍼에 추가
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // 버퍼 크기 제한
    if (this.logBuffer.length > this.config.maxLogSize) {
      this.logBuffer = this.logBuffer.slice(-this.config.maxLogSize);
    }
  }

  /**
   * 민감 데이터 마스킹
   */
  private maskSensitiveData(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return metadata;

    const masked = { ...metadata };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'phone', 'email', 'ssn'];

    for (const [key, value] of Object.entries(masked)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        if (typeof value === 'string') {
          masked[key] = mask(value);
        } else {
          masked[key] = '[REDACTED]';
        }
      }
    }

    return masked;
  }

  /**
   * 로그 버퍼 조회
   */
  getLogs(filter?: { level?: string; event?: string; limit?: number }): LogEntry[] {
    let logs = [...this.logBuffer];

    if (filter?.level) {
      logs = logs.filter(log => log.level === filter.level);
    }

    if (filter?.event) {
      logs = logs.filter(log => log.event === filter.event);
    }

    if (filter?.limit) {
      logs = logs.slice(-filter.limit);
    }

    return logs;
  }

  /**
   * 로그 버퍼 초기화
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * 트레이스 ID 생성
   */
  generateTraceId(): string {
    return Math.random().toString(36).substring(2, 18);
  }
}

// 싱글톤 로거 인스턴스
export const logger = new Logger({
  enableConsole: process.env.NODE_ENV !== 'production',
  logLevel: process.env.LOG_LEVEL || 'info',
  maskPII: true
});

// 편의 함수들
export const logApiRequest = (traceId: string, method: string, path: string, userId?: string) => {
  logger.info({
    event: LOG_EVENTS.API_REQUEST_START,
    message: `API request started: ${method} ${path}`,
    traceId,
    userId,
    metadata: { method, path }
  });
};

export const logApiSuccess = (traceId: string, method: string, path: string, processingTime: number) => {
  logger.info({
    event: LOG_EVENTS.API_REQUEST_SUCCESS,
    message: `API request completed: ${method} ${path}`,
    traceId,
    processingTime,
    metadata: { method, path }
  });
};

export const logApiError = (traceId: string, method: string, path: string, error: Error, processingTime: number) => {
  logger.error({
    event: LOG_EVENTS.API_REQUEST_ERROR,
    message: `API request failed: ${method} ${path}`,
    traceId,
    processingTime,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    metadata: { method, path }
  });
};

export const logValidationError = (traceId: string, field: string, value: unknown, reason: string) => {
  logger.warn({
    event: LOG_EVENTS.VALIDATION_ERROR,
    message: `Validation failed for field: ${field}`,
    traceId,
    metadata: { field, value: mask(String(value)), reason }
  });
};

export const logProcessingStart = (traceId: string, operation: string, inputSize?: number) => {
  logger.info({
    event: `${operation}_start`,
    message: `Processing started: ${operation}`,
    traceId,
    metadata: { operation, inputSize }
  });
};

export const logProcessingSuccess = (traceId: string, operation: string, processingTime: number, outputSize?: number) => {
  logger.info({
    event: `${operation}_success`,
    message: `Processing completed: ${operation}`,
    traceId,
    processingTime,
    metadata: { operation, outputSize }
  });
};

export const logProcessingError = (traceId: string, operation: string, error: Error, processingTime: number) => {
  logger.error({
    event: `${operation}_error`,
    message: `Processing failed: ${operation}`,
    traceId,
    processingTime,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    metadata: { operation }
  });
};