/**
 * 피드백 핸들러 모듈
 * 사용자 피드백을 수집하고 저장하는 기능
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// __dirname 가져오기 (ESM 모듈에서는 __dirname이 기본적으로 정의되어 있지 않음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FeedbackHandler {
  constructor(options = {}) {
    // 설정 옵션
    this.options = {
      logDirectory: options.logDirectory || path.join(__dirname, '../../logs/feedback'),
      feedbackFile: options.feedbackFile || 'feedback_logs.json',
      ...options
    };
    
    // 로그 디렉토리 생성
    this._ensureLogDirectory();
  }
  
  /**
   * 로그 디렉토리 존재 확인 및 생성
   * @private
   */
  async _ensureLogDirectory() {
    try {
      await fs.mkdir(this.options.logDirectory, { recursive: true });
    } catch (error) {
      console.error('로그 디렉토리 생성 오류:', error);
    }
  }
  
  /**
   * 피드백 로그 파일 경로 반환
   * @returns {string} 피드백 로그 파일 경로
   * @private
   */
  _getFeedbackFilePath() {
    return path.join(this.options.logDirectory, this.options.feedbackFile);
  }
  
  /**
   * 기존 피드백 로그 로드
   * @returns {Array} 피드백 로그 배열
   * @private
   */
  async _loadFeedbackLogs() {
    try {
      const filePath = this._getFeedbackFilePath();
      
      try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
      } catch (readError) {
        // 파일이 없거나 읽을 수 없는 경우 빈 배열 반환
        if (readError.code === 'ENOENT') {
          await fs.writeFile(filePath, JSON.stringify([], null, 2));
          return [];
        }
        throw readError;
      }
    } catch (error) {
      console.error('피드백 로그 로드 오류:', error);
      return [];
    }
  }
  
  /**
   * 피드백 로그 저장
   * @param {Array} logs - 저장할 피드백 로그 배열
   * @private
   */
  async _saveFeedbackLogs(logs) {
    try {
      const filePath = this._getFeedbackFilePath();
      await fs.writeFile(filePath, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('피드백 로그 저장 오류:', error);
      throw error;
    }
  }
  
  /**
   * 새 피드백 추가
   * @param {Object} feedback - 피드백 데이터
   * @param {number} feedback.score - 만족도 점수 (1-10)
   * @param {string} feedback.userComment - 사용자 코멘트
   * @param {string} feedback.documentId - 문서 ID
   * @param {string} [feedback.userId] - 사용자 ID (선택 사항)
   * @param {string} [feedback.reportText] - 원본 보고서 텍스트 (선택 사항)
   * @returns {Object} 저장된 피드백 데이터
   */
  async addFeedback(feedback) {
    try {
      // 필수 필드 확인
      if (feedback.score === undefined || feedback.userComment === undefined) {
        throw new Error('피드백에는 score와 userComment가 필요합니다');
      }
      
      // 점수 범위 검증
      if (feedback.score < 1 || feedback.score > 10) {
        throw new Error('점수는 1에서 10 사이여야 합니다');
      }
      
      // 기존 로그 로드
      const logs = await this._loadFeedbackLogs();
      
      // 새 피드백 형식화
      const newFeedback = {
        id: uuidv4(),
        score: feedback.score,
        userComment: feedback.userComment,
        documentId: feedback.documentId || 'unknown',
        userId: feedback.userId || 'anonymous',
        reportText: feedback.reportText,
        timestamp: new Date().toISOString(),
        suggestedPromptAddition: null // 프롬프트 개선 모듈에서 설정
      };
      
      // 피드백을 로그에 추가
      logs.push(newFeedback);
      
      // 로그 저장
      await this._saveFeedbackLogs(logs);
      
      // 저장된 피드백 반환
      return newFeedback;
    } catch (error) {
      console.error('피드백 추가 오류:', error);
      throw error;
    }
  }
  
  /**
   * 모든 피드백 로그 가져오기
   * @param {Object} filters - 필터 옵션
   * @param {string} [filters.startDate] - 시작 날짜
   * @param {string} [filters.endDate] - 종료 날짜
   * @param {number} [filters.minScore] - 최소 점수
   * @param {number} [filters.maxScore] - 최대 점수
   * @param {string} [filters.documentId] - 문서 ID
   * @param {string} [filters.userId] - 사용자 ID
   * @returns {Array} 필터링된 피드백 로그 배열
   */
  async getFeedbackLogs(filters = {}) {
    try {
      // 모든 로그 로드
      let logs = await this._loadFeedbackLogs();
      
      // 필터 적용
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        logs = logs.filter(log => new Date(log.timestamp) >= startDate);
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        logs = logs.filter(log => new Date(log.timestamp) <= endDate);
      }
      
      if (filters.minScore) {
        logs = logs.filter(log => log.score >= filters.minScore);
      }
      
      if (filters.maxScore) {
        logs = logs.filter(log => log.score <= filters.maxScore);
      }
      
      if (filters.documentId) {
        logs = logs.filter(log => log.documentId === filters.documentId);
      }
      
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      
      return logs;
    } catch (error) {
      console.error('피드백 로그 가져오기 오류:', error);
      return [];
    }
  }
  
  /**
   * 피드백 통계 가져오기
   * @returns {Object} 피드백 통계
   */
  async getFeedbackStats() {
    try {
      const logs = await this._loadFeedbackLogs();
      
      if (logs.length === 0) {
        return {
          totalFeedbacks: 0,
          averageScore: 0,
          scoreDistribution: {
            '1-3': 0,
            '4-6': 0,
            '7-8': 0,
            '9-10': 0
          }
        };
      }
      
      // 총점 및 평균 계산
      const totalScore = logs.reduce((sum, log) => sum + log.score, 0);
      const averageScore = totalScore / logs.length;
      
      // 점수 분포 계산
      const scoreDistribution = {
        '1-3': logs.filter(log => log.score >= 1 && log.score <= 3).length,
        '4-6': logs.filter(log => log.score >= 4 && log.score <= 6).length,
        '7-8': logs.filter(log => log.score >= 7 && log.score <= 8).length,
        '9-10': logs.filter(log => log.score >= 9 && log.score <= 10).length
      };
      
      // 최근 30일 추세
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      
      const recentLogs = logs.filter(log => new Date(log.timestamp) >= thirtyDaysAgo);
      const recentAverage = recentLogs.length > 0
        ? recentLogs.reduce((sum, log) => sum + log.score, 0) / recentLogs.length
        : 0;
      
      return {
        totalFeedbacks: logs.length,
        averageScore: averageScore.toFixed(2),
        scoreDistribution,
        recentAverage: recentAverage.toFixed(2),
        recentCount: recentLogs.length
      };
    } catch (error) {
      console.error('피드백 통계 계산 오류:', error);
      return {
        error: error.message,
        totalFeedbacks: 0
      };
    }
  }
  
  /**
   * 피드백 항목 가져오기
   * @param {string} feedbackId - 피드백 ID
   * @returns {Object|null} 피드백 항목 또는 null
   */
  async getFeedbackById(feedbackId) {
    try {
      const logs = await this._loadFeedbackLogs();
      return logs.find(log => log.id === feedbackId) || null;
    } catch (error) {
      console.error('피드백 항목 가져오기 오류:', error);
      return null;
    }
  }
  
  /**
   * 피드백 항목 업데이트
   * @param {string} feedbackId - 피드백 ID
   * @param {Object} updateData - 업데이트할 데이터
   * @returns {Object|null} 업데이트된 피드백 항목 또는 null
   */
  async updateFeedback(feedbackId, updateData) {
    try {
      const logs = await this._loadFeedbackLogs();
      const index = logs.findIndex(log => log.id === feedbackId);
      
      if (index === -1) {
        return null;
      }
      
      // 특정 필드만 업데이트
      const allowedFields = ['userComment', 'suggestedPromptAddition'];
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          logs[index][field] = updateData[field];
        }
      }
      
      // 로그 저장
      await this._saveFeedbackLogs(logs);
      
      return logs[index];
    } catch (error) {
      console.error('피드백 업데이트 오류:', error);
      return null;
    }
  }
}

export default FeedbackHandler; 