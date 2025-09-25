/**
 * 토큰 카운터 모듈
 * AI 요청의 토큰 사용량을 추적하고 로깅
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 가져오기 (ESM 모듈에서는 __dirname이 기본적으로 정의되어 있지 않음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TokenCounter {
  constructor(options = {}) {
    this.options = {
      logDirectory: options.logDirectory || path.join(__dirname, '../../logs/ai'),
      logFileName: options.logFileName || 'token_usage.json',
      logThreshold: options.logThreshold || 20, // 로그 파일에 기록하기 전 메모리에 저장할 최대 항목 수
      ...options
    };
    
    // 메모리에 저장된 로그 항목
    this.usageLog = [];
    
    // 로그 디렉토리가 없으면 생성
    if (!fs.existsSync(this.options.logDirectory)) {
      fs.mkdirSync(this.options.logDirectory, { recursive: true });
    }
    
    // 로그 파일 경로
    this.logFilePath = path.join(this.options.logDirectory, this.options.logFileName);
    
    // 로그 파일이 없으면 생성
    if (!fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, JSON.stringify([], null, 2));
    }
    
    // 토큰 추정 관련 상수
    this.AVG_TOKENS_PER_CHAR = {
      en: 0.25, // 영어: 문자당 약 0.25 토큰
      ko: 0.5,  // 한국어: 문자당 약 0.5 토큰
      ja: 0.5,  // 일본어: 문자당 약 0.5 토큰
      zh: 0.4,  // 중국어: 문자당 약 0.4 토큰
      default: 0.3 // 기본값
    };
  }
  
  /**
   * 텍스트에 사용된 토큰 수 추정
   * @param {string} text - 추정할 텍스트
   * @returns {number} 추정된 토큰 수
   */
  estimate(text) {
    if (!text) return 0;
    
    // 언어 감지 (간단한 휴리스틱)
    const hasKorean = /[\uAC00-\uD7AF]/.test(text);
    const hasJapanese = /[\u3040-\u30FF]/.test(text);
    const hasChinese = /[\u4E00-\u9FFF]/.test(text);
    
    let tokensPerChar;
    
    if (hasKorean) {
      tokensPerChar = this.AVG_TOKENS_PER_CHAR.ko;
    } else if (hasJapanese) {
      tokensPerChar = this.AVG_TOKENS_PER_CHAR.ja;
    } else if (hasChinese) {
      tokensPerChar = this.AVG_TOKENS_PER_CHAR.zh;
    } else {
      tokensPerChar = this.AVG_TOKENS_PER_CHAR.en;
    }
    
    // 텍스트 길이 × 문자당 평균 토큰
    return Math.ceil(text.length * tokensPerChar);
  }
  
  /**
   * 토큰 사용량 기록
   * @param {Object} usageData - 사용량 데이터
   * @returns {Promise<void>}
   */
  async logUsage(usageData) {
    try {
      // 사용량 데이터 유효성 검사
      if (!usageData.timestamp) {
        usageData.timestamp = new Date().toISOString();
      }
      
      // 메모리에 로그 항목 추가
      this.usageLog.push(usageData);
      
      // 로그 항목이 임계값에 도달하면 파일에 기록
      if (this.usageLog.length >= this.options.logThreshold) {
        await this._flushLogToFile();
      }
      
      return true;
    } catch (error) {
      console.error('토큰 사용량 로깅 오류:', error);
      return false;
    }
  }
  
  /**
   * 메모리에 있는 로그 항목들을 파일에 기록
   * @private
   * @returns {Promise<void>}
   */
  async _flushLogToFile() {
    try {
      // 현재 로그 파일 읽기
      let existingLogs = [];
      if (fs.existsSync(this.logFilePath)) {
        const fileContent = fs.readFileSync(this.logFilePath, 'utf8');
        existingLogs = JSON.parse(fileContent);
      }
      
      // 새 로그 항목 추가
      const updatedLogs = [...existingLogs, ...this.usageLog];
      
      // 파일에 기록
      await fs.promises.writeFile(
        this.logFilePath,
        JSON.stringify(updatedLogs, null, 2)
      );
      
      // 메모리 로그 초기화
      this.usageLog = [];
      
      return true;
    } catch (error) {
      console.error('로그 파일 기록 오류:', error);
      return false;
    }
  }
  
  /**
   * 사용량 통계 가져오기
   * @param {Object} filters - 필터 옵션
   * @returns {Promise<Object>} 사용량 통계
   */
  async getUsageStats(filters = {}) {
    try {
      // 먼저 메모리에 있는 로그를 파일에 기록
      await this._flushLogToFile();
      
      // 로그 파일 읽기
      const fileContent = fs.readFileSync(this.logFilePath, 'utf8');
      let logs = JSON.parse(fileContent);
      
      // 필터 적용
      if (filters.startDate) {
        logs = logs.filter(log => new Date(log.timestamp) >= new Date(filters.startDate));
      }
      
      if (filters.endDate) {
        logs = logs.filter(log => new Date(log.timestamp) <= new Date(filters.endDate));
      }
      
      if (filters.provider) {
        logs = logs.filter(log => log.provider === filters.provider);
      }
      
      if (filters.model) {
        logs = logs.filter(log => log.model === filters.model);
      }
      
      if (filters.success !== undefined) {
        logs = logs.filter(log => log.success === filters.success);
      }
      
      // 통계 계산
      const stats = {
        totalRequests: logs.length,
        totalTokens: logs.reduce((sum, log) => sum + (log.totalTokens || 0), 0),
        promptTokens: logs.reduce((sum, log) => sum + (log.promptTokens || 0), 0),
        completionTokens: logs.reduce((sum, log) => sum + (log.completionTokens || 0), 0),
        successfulRequests: logs.filter(log => log.success).length,
        failedRequests: logs.filter(log => !log.success).length,
        requestsByProvider: {},
        requestsByModel: {},
        requestsByDay: {}
      };
      
      // 제공자별 통계
      logs.forEach(log => {
        const provider = log.provider || 'unknown';
        if (!stats.requestsByProvider[provider]) {
          stats.requestsByProvider[provider] = {
            count: 0,
            totalTokens: 0
          };
        }
        stats.requestsByProvider[provider].count++;
        stats.requestsByProvider[provider].totalTokens += (log.totalTokens || 0);
      });
      
      // 모델별 통계
      logs.forEach(log => {
        const model = log.model || 'unknown';
        if (!stats.requestsByModel[model]) {
          stats.requestsByModel[model] = {
            count: 0,
            totalTokens: 0
          };
        }
        stats.requestsByModel[model].count++;
        stats.requestsByModel[model].totalTokens += (log.totalTokens || 0);
      });
      
      // 일별 통계
      logs.forEach(log => {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        if (!stats.requestsByDay[date]) {
          stats.requestsByDay[date] = {
            count: 0,
            totalTokens: 0
          };
        }
        stats.requestsByDay[date].count++;
        stats.requestsByDay[date].totalTokens += (log.totalTokens || 0);
      });
      
      return stats;
    } catch (error) {
      console.error('사용량 통계 조회 오류:', error);
      return {
        error: error.message,
        totalRequests: 0,
        totalTokens: 0
      };
    }
  }
  
  /**
   * 특정 기간의 사용량 통계 가져오기
   * @param {string} period - 기간 (day, week, month, year)
   * @returns {Promise<Object>} 기간별 사용량 통계
   */
  async getPeriodStats(period = 'day') {
    try {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - now.getDay()));
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.setHours(0, 0, 0, 0)); // 기본값은 오늘
      }
      
      return this.getUsageStats({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      });
    } catch (error) {
      console.error('기간별 통계 조회 오류:', error);
      return {
        error: error.message,
        totalRequests: 0,
        totalTokens: 0
      };
    }
  }
}

export default TokenCounter; 