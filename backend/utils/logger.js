/**
 * 공통 로깅 유틸리티
 * @module utils/logger
 */

import fs from 'fs';
import path from 'path';

/**
 * 로거 설정
 * @type {Object}
 */
const config = {
  enableTimestamp: true,    // 시간 표시 여부
  enableLogLevel: true,     // 로그 레벨 표시 여부
  enableColors: true,       // 색상 표시 여부
  logToFile: true,          // 파일 출력 여부
  logFilePath: './logs/app.log' // 로그 파일 경로
};

/**
 * 로그 파일에 메시지 쓰기
 * @param {string} message - 로그 메시지
 */
const writeToFile = (message) => {
  if (!config.logToFile) return;
  
  try {
    const logDir = path.dirname(config.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(config.logFilePath, message + '\n');
  } catch (error) {
    console.error('로그 파일 쓰기 오류:', error);
  }
};

/**
 * 타임스탬프 문자열 생성
 * @returns {string} 타임스탬프 문자열
 */
const getTimestamp = () => {
  if (!config.enableTimestamp) return '';
  return `[${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')}]`;
};

/**
 * 로그 레벨 문자열 생성
 * @param {string} level - 로그 레벨
 * @returns {string} 포맷된 로그 레벨
 */
const formatLogLevel = (level) => {
  if (!config.enableLogLevel) return '';
  return `[${level}]`;
};

/**
 * logService: 함수+메서드 하이브리드 (레거시 및 신규 모두 지원)
 * - 레거시: logService('Context', 'message', 'info'|'warn'|'error'|'debug', data)
 * - 신규:   logService.info('message', data)
 */

const _write = (level, message, data = null) => {
  const timestamp = getTimestamp();
  const levelStr = formatLogLevel(level.toUpperCase());

  let logMessage = `${timestamp} ${levelStr} ${message}`;

  if (data) {
    if (typeof data === 'object') {
      logMessage += `\n${JSON.stringify(data, null, 2)}`;
    } else {
      logMessage += ` ${data}`;
    }
  }

  // 콘솔 출력 (팀 규칙에 따라 실제 배포에서는 구조화 로거로 교체 필요)
  if (level === 'error') {
    console.error(logMessage);
  } else if (level === 'warn') {
    console.warn(logMessage);
  } else if (level === 'debug') {
    console.debug(logMessage);
  } else {
    console.log(logMessage);
  }

  writeToFile(logMessage);
};

function logServiceLegacy(context, message, levelOrData = undefined, maybeData = undefined) {
  let level = 'info';
  let data = undefined;

  // 3번째 인자가 문자열 레벨이면 레벨로, 아니면 데이터로 처리
  if (typeof levelOrData === 'string' && ['info', 'warn', 'error', 'debug'].includes(levelOrData)) {
    level = levelOrData;
    data = maybeData;
  } else if (typeof levelOrData !== 'undefined') {
    // 3번째 인자가 데이터인 경우
    data = levelOrData;
  }

  const finalMessage = context ? `[${context}] ${String(message ?? '')}` : String(message ?? '');
  _write(level, finalMessage, data);
}

const logService = Object.assign(logServiceLegacy, {
  info: (message, data = null) => _write('info', message, data),
  warn: (message, data = null) => _write('warn', message, data),
  error: (message, data = null) => _write('error', message, data),
  debug: (message, data = null) => _write('debug', message, data),
});

/**
 * OCR 처리 시작 로깅
 * @param {string} service - 서비스 이름 (textract/vision)
 * @param {string} filePath - 처리 파일 경로
 * @returns {Object} 성능 측정 객체
 */
const logOcrStart = (service, filePath) => {
  const startTime = new Date();
  logService.info(`${service}: OCR 처리 시작: ${filePath}`);
  return { startTime, service, filePath };
};

/**
 * OCR 처리 완료 로깅
 * @param {Object} perfData - 성능 측정 객체
 * @param {Object} result - 처리 결과
 * @returns {Object} 처리 결과와 성능 정보가 포함된 객체
 */
const logOcrComplete = (perfData, result) => {
  const { startTime, service, filePath } = perfData;
  const endTime = new Date();
  const processingTime = (endTime - startTime) / 1000;
  
  logService.info(
    `${service}: OCR 처리 완료: ${filePath} (${processingTime.toFixed(2)}초)`,
    { 
      processingTimeSeconds: processingTime,
      textLength: result?.text?.length || 0,
      pageCount: result?.pages?.length || 0
    }
  );
  
  return {
    ...result,
    performance: {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      processingTimeSeconds: processingTime
    }
  };
};

/**
 * OCR 처리 오류 로깅
 * @param {Object} perfData - 성능 측정 객체
 * @param {Error} error - 발생한 오류
 * @returns {Object} 오류 정보와 성능 정보가 포함된 객체
 */
const logOcrError = (perfData, error) => {
  const { startTime, service, filePath } = perfData;
  const endTime = new Date();
  const processingTime = (endTime - startTime) / 1000;
  
  logService.error(
    `${service}: OCR 처리 오류: ${filePath} (${processingTime.toFixed(2)}초)`,
    { error: error.message, stack: error.stack }
  );
  
  return {
    error: true,
    message: error.message,
    performance: {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      processingTimeSeconds: processingTime
    }
  };
};

export {
  logService,
  logOcrStart,
  logOcrComplete,
  logOcrError
};
