/**
 * 향상된 로깅 시스템
 * @module utils/enhancedLogger
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fs = require('fs');
const path = require('path');

// Handle CommonJS environment
// In CommonJS, __filename and __dirname are already available

/**
 * 로거 설정
 */
const config = {
  enableTimestamp: true,
  enableLogLevel: true,
  enableColors: true,
  logToFile: true,
  logFilePath: path.join(__dirname, '../../logs'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  enableStackTrace: true,
  enablePerformanceLogging: true
};

/**
 * 로그 디렉토리 생성
 */
const ensureLogDirectory = () => {
  if (!fs.existsSync(config.logFilePath)) {
    fs.mkdirSync(config.logFilePath, { recursive: true });
  }
};

/**
 * 색상 코드
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * 로그 레벨별 색상
 */
const levelColors = {
  ERROR: colors.red,
  WARN: colors.yellow,
  INFO: colors.green,
  DEBUG: colors.blue,
  TRACE: colors.magenta
};

/**
 * 타임스탬프 생성
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

/**
 * 로그 메시지 포맷팅
 */
const formatMessage = (level, service, message, data = null, error = null) => {
  const timestamp = getTimestamp();
  const color = config.enableColors ? levelColors[level] || colors.white : '';
  const reset = config.enableColors ? colors.reset : '';
  
  let logEntry = {
    timestamp,
    level,
    service,
    message,
    pid: process.pid,
    memory: process.memoryUsage(),
    ...(data && { data }),
    ...(error && { 
      error: {
        name: error.name,
        message: error.message,
        stack: config.enableStackTrace ? error.stack : undefined
      }
    })
  };
  
  // 콘솔 출력용 포맷
  const consoleMessage = `${color}[${timestamp}] [${level}] [${service}] ${message}${reset}`;
  
  return { logEntry, consoleMessage };
};

/**
 * 파일에 로그 쓰기
 */
const writeToFile = (logEntry, level) => {
  if (!config.logToFile) return;
  
  ensureLogDirectory();
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${level.toLowerCase()}.log`;
  const filepath = path.join(config.logFilePath, filename);
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    fs.appendFileSync(filepath, logLine);
    
    // 파일 크기 체크 및 로테이션
    const stats = fs.statSync(filepath);
    if (stats.size > config.maxFileSize) {
      rotateLogFile(filepath);
    }
  } catch (error) {
    console.error('로그 파일 쓰기 실패:', error.message);
  }
};

/**
 * 로그 파일 로테이션
 */
const rotateLogFile = (filepath) => {
  try {
    const dir = path.dirname(filepath);
    const basename = path.basename(filepath, '.log');
    
    // 기존 백업 파일들 이동
    for (let i = config.maxFiles - 1; i > 0; i--) {
      const oldFile = path.join(dir, `${basename}.${i}.log`);
      const newFile = path.join(dir, `${basename}.${i + 1}.log`);
      
      if (fs.existsSync(oldFile)) {
        if (i === config.maxFiles - 1) {
          fs.unlinkSync(oldFile); // 가장 오래된 파일 삭제
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }
    
    // 현재 파일을 .1로 이동
    const backupFile = path.join(dir, `${basename}.1.log`);
    fs.renameSync(filepath, backupFile);
    
  } catch (error) {
    console.error('로그 파일 로테이션 실패:', error.message);
  }
};

/**
 * 향상된 로거 클래스
 */
class EnhancedLogger {
  constructor(service) {
    this.service = service;
    this.performanceMarks = new Map();
  }
  
  /**
   * 정보 로그
   */
  info(message, data = null) {
    const { logEntry, consoleMessage } = formatMessage('INFO', this.service, message, data);
    console.log(consoleMessage);
    writeToFile(logEntry, 'INFO');
  }
  
  /**
   * 경고 로그
   */
  warn(message, data = null) {
    const { logEntry, consoleMessage } = formatMessage('WARN', this.service, message, data);
    console.warn(consoleMessage);
    writeToFile(logEntry, 'WARN');
  }
  
  /**
   * 에러 로그
   */
  error(message, error = null, data = null) {
    const { logEntry, consoleMessage } = formatMessage('ERROR', this.service, message, data, error);
    console.error(consoleMessage);
    if (error && config.enableStackTrace) {
      console.error(error.stack);
    }
    writeToFile(logEntry, 'ERROR');
  }
  
  /**
   * 디버그 로그
   */
  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      const { logEntry, consoleMessage } = formatMessage('DEBUG', this.service, message, data);
      console.log(consoleMessage);
      writeToFile(logEntry, 'DEBUG');
    }
  }
  
  /**
   * 성능 측정 시작
   */
  startPerformance(label) {
    if (!config.enablePerformanceLogging) return;
    
    this.performanceMarks.set(label, {
      startTime: process.hrtime.bigint(),
      startMemory: process.memoryUsage()
    });
    
    this.debug(`성능 측정 시작: ${label}`);
  }
  
  /**
   * 성능 측정 종료
   */
  endPerformance(label, data = null) {
    if (!config.enablePerformanceLogging) return;
    
    const mark = this.performanceMarks.get(label);
    if (!mark) {
      this.warn(`성능 측정 마크를 찾을 수 없음: ${label}`);
      return;
    }
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - mark.startTime) / 1000000; // 나노초를 밀리초로
    const memoryDiff = {
      rss: endMemory.rss - mark.startMemory.rss,
      heapUsed: endMemory.heapUsed - mark.startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - mark.startMemory.heapTotal
    };
    
    const performanceData = {
      duration: `${duration.toFixed(2)}ms`,
      memoryDiff,
      ...data
    };
    
    this.info(`성능 측정 완료: ${label}`, performanceData);
    this.performanceMarks.delete(label);
    
    return performanceData;
  }
  
  /**
   * 코어 엔진 특화 로깅
   */
  coreEngine(operation, status, data = null, error = null) {
    const message = `코어 엔진 ${operation}: ${status}`;
    
    if (error) {
      this.error(message, error, data);
    } else if (status === 'success') {
      this.info(message, data);
    } else if (status === 'warning') {
      this.warn(message, data);
    } else {
      this.debug(message, data);
    }
  }
  
  /**
   * API 요청 로깅
   */
  apiRequest(method, path, statusCode, duration, data = null) {
    const message = `${method} ${path} - ${statusCode} (${duration}ms)`;
    
    if (statusCode >= 500) {
      this.error(message, null, data);
    } else if (statusCode >= 400) {
      this.warn(message, data);
    } else {
      this.info(message, data);
    }
  }
  
  /**
   * 사용자 액션 로깅
   */
  userAction(action, userId = null, data = null) {
    const message = `사용자 액션: ${action}`;
    this.info(message, { userId, ...data });
  }
}

/**
 * 로거 팩토리
 */
const createLogger = (service) => {
  return new EnhancedLogger(service);
};

/**
 * 전역 에러 핸들러
 */
const setupGlobalErrorHandlers = () => {
  const globalLogger = createLogger('GLOBAL');
  
  process.on('uncaughtException', (error) => {
    globalLogger.error('처리되지 않은 예외', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    globalLogger.error('처리되지 않은 Promise 거부', new Error(reason), { promise });
  });
  
  process.on('warning', (warning) => {
    globalLogger.warn('Node.js 경고', null, {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });
};

// 전역 에러 핸들러 설정
setupGlobalErrorHandlers();

export { EnhancedLogger, createLogger, config };
export default createLogger;