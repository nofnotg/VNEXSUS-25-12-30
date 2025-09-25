/**
 * AI 검증 시스템 유틸리티 함수들
 * 
 * 역할:
 * 1. 파일 I/O 및 데이터 처리 유틸리티
 * 2. 성능 측정 및 모니터링 도구
 * 3. 오류 처리 및 재시도 로직
 * 4. 데이터 검증 및 정제 함수
 * 5. 로깅 및 디버깅 헬퍼
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import config from './config.js';

/**
 * 파일 시스템 유틸리티
 */
export class FileUtils {
  /**
   * 디렉토리 생성 (재귀적)
   * @param {string} dirPath 디렉토리 경로
   */
  static async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * JSON 파일 안전하게 읽기
   * @param {string} filePath 파일 경로
   * @param {*} defaultValue 기본값
   * @returns {Promise<*>} 파싱된 JSON 데이터
   */
  static async readJsonSafe(filePath, defaultValue = null) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return defaultValue;
      }
      throw new Error(`JSON 파일 읽기 실패 (${filePath}): ${error.message}`);
    }
  }

  /**
   * JSON 파일 안전하게 쓰기
   * @param {string} filePath 파일 경로
   * @param {*} data 저장할 데이터
   * @param {Object} options 옵션
   */
  static async writeJsonSafe(filePath, data, options = {}) {
    const { indent = 2, backup = false } = options;
    
    try {
      // 디렉토리 확인 및 생성
      await this.ensureDirectory(path.dirname(filePath));
      
      // 백업 생성
      if (backup) {
        try {
          await fs.access(filePath);
          const backupPath = `${filePath}.backup.${Date.now()}`;
          await fs.copyFile(filePath, backupPath);
        } catch {
          // 원본 파일이 없으면 백업 생략
        }
      }
      
      // JSON 문자열 생성
      const jsonString = JSON.stringify(data, null, indent);
      
      // 임시 파일에 쓰기 후 원자적 이동
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      await fs.writeFile(tempPath, jsonString, 'utf-8');
      await fs.rename(tempPath, filePath);
      
    } catch (error) {
      throw new Error(`JSON 파일 쓰기 실패 (${filePath}): ${error.message}`);
    }
  }

  /**
   * 파일 크기 확인
   * @param {string} filePath 파일 경로
   * @returns {Promise<number>} 파일 크기 (바이트)
   */
  static async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * 파일 목록 가져오기 (패턴 매칭)
   * @param {string} dirPath 디렉토리 경로
   * @param {RegExp} pattern 파일명 패턴
   * @returns {Promise<Array>} 매칭된 파일 목록
   */
  static async getFileList(dirPath, pattern = null) {
    try {
      const files = await fs.readdir(dirPath);
      
      if (pattern) {
        return files.filter(file => pattern.test(file));
      }
      
      return files;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 오래된 파일 정리
   * @param {string} dirPath 디렉토리 경로
   * @param {number} maxAge 최대 나이 (밀리초)
   * @param {RegExp} pattern 파일명 패턴
   */
  static async cleanupOldFiles(dirPath, maxAge, pattern = null) {
    try {
      const files = await this.getFileList(dirPath, pattern);
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }
      
      return cleanedCount;
    } catch (error) {
      console.warn(`파일 정리 실패 (${dirPath}):`, error.message);
      return 0;
    }
  }
}

/**
 * 성능 측정 유틸리티
 */
export class PerformanceUtils {
  /**
   * 실행 시간 측정
   * @param {Function} fn 실행할 함수
   * @param {...*} args 함수 인자들
   * @returns {Promise<Object>} 결과와 실행 시간
   */
  static async measureTime(fn, ...args) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await fn(...args);
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const executionTime = Number(endTime - startTime) / 1000000; // 나노초를 밀리초로
      const memoryDelta = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal
      };
      
      return {
        result,
        performance: {
          executionTime,
          memoryDelta,
          startMemory,
          endMemory
        }
      };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;
      
      throw new Error(`함수 실행 실패 (${executionTime.toFixed(2)}ms): ${error.message}`);
    }
  }

  /**
   * 메모리 사용량 모니터링
   * @returns {Object} 메모리 사용량 정보
   */
  static getMemoryUsage() {
    const usage = process.memoryUsage();
    
    return {
      rss: this.formatBytes(usage.rss),
      heapUsed: this.formatBytes(usage.heapUsed),
      heapTotal: this.formatBytes(usage.heapTotal),
      external: this.formatBytes(usage.external),
      arrayBuffers: this.formatBytes(usage.arrayBuffers || 0),
      raw: usage
    };
  }

  /**
   * 바이트를 읽기 쉬운 형식으로 변환
   * @param {number} bytes 바이트 수
   * @returns {string} 포맷된 문자열
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 시스템 리소스 사용량 확인
   * @returns {Object} 시스템 리소스 정보
   */
  static getSystemResources() {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = this.getMemoryUsage();
    
    return {
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      memory: memoryUsage,
      uptime: process.uptime(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    };
  }
}

/**
 * 재시도 및 오류 처리 유틸리티
 */
export class RetryUtils {
  /**
   * 지수 백오프로 재시도
   * @param {Function} fn 실행할 함수
   * @param {Object} options 재시도 옵션
   * @returns {Promise<*>} 함수 실행 결과
   */
  static async withRetry(fn, options = {}) {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffFactor = 2,
      retryCondition = () => true
    } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts || !retryCondition(error)) {
          throw error;
        }
        
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt - 1),
          maxDelay
        );
        
        console.warn(`재시도 ${attempt}/${maxAttempts} (${delay}ms 후): ${error.message}`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * 지연 실행
   * @param {number} ms 지연 시간 (밀리초)
   * @returns {Promise<void>}
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 타임아웃과 함께 함수 실행
   * @param {Function} fn 실행할 함수
   * @param {number} timeout 타임아웃 (밀리초)
   * @returns {Promise<*>} 함수 실행 결과
   */
  static async withTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`타임아웃 (${timeout}ms)`));
        }, timeout);
      })
    ]);
  }
}

/**
 * 데이터 검증 및 정제 유틸리티
 */
export class DataUtils {
  /**
   * 객체 깊은 복사
   * @param {*} obj 복사할 객체
   * @returns {*} 복사된 객체
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }
    
    if (typeof obj === 'object') {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    
    return obj;
  }

  /**
   * 객체 병합 (깊은 병합)
   * @param {Object} target 대상 객체
   * @param {...Object} sources 소스 객체들
   * @returns {Object} 병합된 객체
   */
  static deepMerge(target, ...sources) {
    if (!sources.length) return target;
    
    const source = sources.shift();
    
    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
    
    return this.deepMerge(target, ...sources);
  }

  /**
   * 객체인지 확인
   * @param {*} item 확인할 항목
   * @returns {boolean} 객체 여부
   */
  static isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * 문자열 정제 (의료 데이터용)
   * @param {string} text 정제할 텍스트
   * @returns {string} 정제된 텍스트
   */
  static sanitizeText(text) {
    if (typeof text !== 'string') {
      return String(text || '');
    }
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // 연속된 공백을 하나로
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 제어 문자 제거
      .replace(/[\u200B-\u200D\uFEFF]/g, ''); // 보이지 않는 문자 제거
  }

  /**
   * 숫자 검증 및 변환
   * @param {*} value 검증할 값
   * @param {Object} options 옵션
   * @returns {number|null} 변환된 숫자 또는 null
   */
  static validateNumber(value, options = {}) {
    const { min = -Infinity, max = Infinity, integer = false } = options;
    
    const num = Number(value);
    
    if (isNaN(num) || !isFinite(num)) {
      return null;
    }
    
    if (num < min || num > max) {
      return null;
    }
    
    return integer ? Math.round(num) : num;
  }

  /**
   * 배열 청크 분할
   * @param {Array} array 분할할 배열
   * @param {number} size 청크 크기
   * @returns {Array} 분할된 배열들의 배열
   */
  static chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 고유 ID 생성
   * @param {string} prefix 접두사
   * @returns {string} 고유 ID
   */
  static generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}${prefix ? '_' : ''}${timestamp}_${random}`;
  }

  /**
   * 해시 생성
   * @param {string} data 해시할 데이터
   * @param {string} algorithm 해시 알고리즘
   * @returns {string} 해시 값
   */
  static generateHash(data, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }
}

/**
 * 로깅 유틸리티
 */
export class LogUtils {
  /**
   * 구조화된 로그 출력
   * @param {string} level 로그 레벨
   * @param {string} message 메시지
   * @param {Object} meta 메타데이터
   */
  static log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };
    
    // 콘솔 출력 (개발 환경)
    if (config.logging.enableConsole) {
      const colorMap = {
        ERROR: '\x1b[31m', // 빨간색
        WARN: '\x1b[33m',  // 노란색
        INFO: '\x1b[36m',  // 청록색
        DEBUG: '\x1b[90m'  // 회색
      };
      
      const color = colorMap[level.toUpperCase()] || '';
      const reset = '\x1b[0m';
      
      console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${reset}`);
      
      if (Object.keys(meta).length > 0) {
        console.log(`${color}${JSON.stringify(meta, null, 2)}${reset}`);
      }
    }
    
    return logEntry;
  }

  /**
   * 에러 로그
   * @param {string} message 메시지
   * @param {Error|Object} error 에러 객체
   * @param {Object} meta 추가 메타데이터
   */
  static error(message, error = null, meta = {}) {
    const errorMeta = {
      ...meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : null
    };
    
    return this.log('error', message, errorMeta);
  }

  /**
   * 경고 로그
   * @param {string} message 메시지
   * @param {Object} meta 메타데이터
   */
  static warn(message, meta = {}) {
    return this.log('warn', message, meta);
  }

  /**
   * 정보 로그
   * @param {string} message 메시지
   * @param {Object} meta 메타데이터
   */
  static info(message, meta = {}) {
    return this.log('info', message, meta);
  }

  /**
   * 디버그 로그
   * @param {string} message 메시지
   * @param {Object} meta 메타데이터
   */
  static debug(message, meta = {}) {
    if (config.development.debug.enabled) {
      return this.log('debug', message, meta);
    }
  }

  /**
   * 성능 로그
   * @param {string} operation 작업명
   * @param {number} duration 소요 시간 (밀리초)
   * @param {Object} meta 추가 메타데이터
   */
  static performance(operation, duration, meta = {}) {
    const performanceMeta = {
      ...meta,
      operation,
      duration: `${duration.toFixed(2)}ms`,
      slow: duration > config.logging.performance.slowRequestThreshold
    };
    
    const level = duration > config.logging.performance.slowRequestThreshold ? 'warn' : 'info';
    return this.log(level, `성능: ${operation}`, performanceMeta);
  }
}

/**
 * 검증 결과 분석 유틸리티
 */
export class AnalysisUtils {
  /**
   * 통계 계산
   * @param {Array} numbers 숫자 배열
   * @returns {Object} 통계 정보
   */
  static calculateStats(numbers) {
    if (!numbers || numbers.length === 0) {
      return {
        count: 0,
        sum: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        variance: 0,
        standardDeviation: 0
      };
    }
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const count = numbers.length;
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    const median = count % 2 === 0 ?
      (sorted[count / 2 - 1] + sorted[count / 2]) / 2 :
      sorted[Math.floor(count / 2)];
    
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      count,
      sum,
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      variance: Number(variance.toFixed(2)),
      standardDeviation: Number(standardDeviation.toFixed(2))
    };
  }

  /**
   * 상관관계 계산
   * @param {Array} x X 값들
   * @param {Array} y Y 값들
   * @returns {number} 상관계수 (-1 ~ 1)
   */
  static calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) {
      return 0;
    }
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * 이상치 탐지 (IQR 방법)
   * @param {Array} numbers 숫자 배열
   * @returns {Object} 이상치 정보
   */
  static detectOutliers(numbers) {
    if (!numbers || numbers.length < 4) {
      return {
        outliers: [],
        lowerBound: 0,
        upperBound: 0,
        q1: 0,
        q3: 0,
        iqr: 0
      };
    }
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const n = sorted.length;
    
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers = numbers.filter(num => num < lowerBound || num > upperBound);
    
    return {
      outliers,
      lowerBound,
      upperBound,
      q1,
      q3,
      iqr
    };
  }
}

// 기본 내보내기
export default {
  FileUtils,
  PerformanceUtils,
  RetryUtils,
  DataUtils,
  LogUtils,
  AnalysisUtils
};