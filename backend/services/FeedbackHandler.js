/**
 * 피드백 핸들러 서비스
 * 사용자 피드백 데이터를 처리하고 저장하는 모듈
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

// 피드백 데이터 저장 경로
const FEEDBACK_DIR = path.join(process.cwd(), 'data', 'feedback');
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, 'feedback.json');

/**
 * 피드백 핸들러 클래스
 */
class FeedbackHandler {
  constructor() {
    this.initialize();
  }

  /**
   * 초기화 - 필요한 디렉토리와 파일 생성
   */
  async initialize() {
    try {
      await fs.mkdir(FEEDBACK_DIR, { recursive: true });
      
      try {
        await fs.access(FEEDBACK_FILE);
      } catch (error) {
        // 피드백 파일이 없으면 빈 배열로 초기화
        await fs.writeFile(FEEDBACK_FILE, JSON.stringify([], null, 2));
        logger.logService('FeedbackHandler', '피드백 데이터 파일 생성 완료', 'info');
      }
    } catch (error) {
      logger.logService('FeedbackHandler', '피드백 핸들러 초기화 오류: ' + error.message, 'error', error);
    }
  }

  /**
   * 피드백 저장
   * @param {Object} feedbackData - 피드백 데이터
   * @returns {Promise<Object>} 저장된 피드백 객체
   */
  async saveFeedback(feedbackData) {
    try {
      // 기존 피드백 데이터 로드
      const feedbacks = await this.loadFeedbacks();
      
      // 새 피드백 생성
      const newFeedback = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        score: feedbackData.score,
        userComment: feedbackData.userComment,
        documentId: feedbackData.documentId || null,
        reportText: feedbackData.reportText || null,
        templateName: feedbackData.templateName || null,
        improvementSuggestions: [],
        status: 'submitted'
      };
      
      // 피드백 추가 및 저장
      feedbacks.push(newFeedback);
      await fs.writeFile(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2));
      
      logger.logService('FeedbackHandler', `새 피드백 저장 완료: ${newFeedback.id}`, 'info');
      return newFeedback;
    } catch (error) {
      logger.logService('FeedbackHandler', '피드백 저장 오류: ' + error.message, 'error', error);
      throw new Error('피드백 저장 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 모든 피드백 조회
   * @param {Object} filters - 필터 옵션
   * @returns {Promise<Array>} 피드백 목록
   */
  async getFeedbacks(filters = {}) {
    try {
      let feedbacks = await this.loadFeedbacks();
      
      // 필터 적용
      if (filters) {
        // 시작 날짜 필터
        if (filters.startDate) {
          const startDate = new Date(filters.startDate);
          feedbacks = feedbacks.filter(f => new Date(f.timestamp) >= startDate);
        }
        
        // 종료 날짜 필터
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          feedbacks = feedbacks.filter(f => new Date(f.timestamp) <= endDate);
        }
        
        // 최소 점수 필터
        if (filters.minScore) {
          feedbacks = feedbacks.filter(f => f.score >= Number(filters.minScore));
        }
        
        // 최대 점수 필터
        if (filters.maxScore) {
          feedbacks = feedbacks.filter(f => f.score <= Number(filters.maxScore));
        }
        
        // 템플릿 이름 필터
        if (filters.templateName) {
          feedbacks = feedbacks.filter(f => f.templateName === filters.templateName);
        }
        
        // 상태 필터
        if (filters.status) {
          feedbacks = feedbacks.filter(f => f.status === filters.status);
        }
      }
      
      return feedbacks;
    } catch (error) {
      logger.logService('FeedbackHandler', '피드백 조회 오류: ' + error.message, 'error', error);
      throw new Error('피드백 조회 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 특정 피드백 조회
   * @param {string} feedbackId - 피드백 ID
   * @returns {Promise<Object>} 피드백 객체
   */
  async getFeedbackById(feedbackId) {
    try {
      const feedbacks = await this.loadFeedbacks();
      const feedback = feedbacks.find(f => f.id === feedbackId);
      
      if (!feedback) {
        throw new Error('해당 ID의 피드백을 찾을 수 없습니다.');
      }
      
      return feedback;
    } catch (error) {
      logger.logService('FeedbackHandler', `피드백 ID 조회 오류 (${feedbackId}): ` + error.message, 'error', error);
      throw error;
    }
  }
  
  /**
   * 피드백 상태 업데이트
   * @param {string} feedbackId - 피드백 ID
   * @param {string} status - 새 상태
   * @returns {Promise<Object>} 업데이트된 피드백 객체
   */
  async updateFeedbackStatus(feedbackId, status) {
    try {
      const feedbacks = await this.loadFeedbacks();
      const feedbackIndex = feedbacks.findIndex(f => f.id === feedbackId);
      
      if (feedbackIndex === -1) {
        throw new Error('해당 ID의 피드백을 찾을 수 없습니다.');
      }
      
      feedbacks[feedbackIndex].status = status;
      await fs.writeFile(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2));
      
      logger.logService('FeedbackHandler', `피드백 상태 업데이트: ${feedbackId} -> ${status}`, 'info');
      return feedbacks[feedbackIndex];
    } catch (error) {
      logger.logService('FeedbackHandler', `피드백 상태 업데이트 오류 (${feedbackId}): ` + error.message, 'error', error);
      throw error;
    }
  }
  
  /**
   * 개선 제안 추가
   * @param {string} feedbackId - 피드백 ID
   * @param {Object} suggestion - 개선 제안 객체
   * @returns {Promise<Object>} 업데이트된 피드백 객체
   */
  async addImprovementSuggestion(feedbackId, suggestion) {
    try {
      const feedbacks = await this.loadFeedbacks();
      const feedbackIndex = feedbacks.findIndex(f => f.id === feedbackId);
      
      if (feedbackIndex === -1) {
        throw new Error('해당 ID의 피드백을 찾을 수 없습니다.');
      }
      
      const improvementId = uuidv4();
      const newSuggestion = {
        id: improvementId,
        timestamp: new Date().toISOString(),
        templateName: suggestion.templateName,
        originalPrompt: suggestion.originalPrompt,
        improvedPrompt: suggestion.improvedPrompt,
        reasoning: suggestion.reasoning || null,
        status: 'suggested'
      };
      
      feedbacks[feedbackIndex].improvementSuggestions.push(newSuggestion);
      await fs.writeFile(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2));
      
      logger.logService('FeedbackHandler', `피드백 개선 제안 추가: ${feedbackId} -> ${improvementId}`, 'info');
      return { feedback: feedbacks[feedbackIndex], suggestion: newSuggestion };
    } catch (error) {
      logger.logService('FeedbackHandler', `피드백 개선 제안 추가 오류 (${feedbackId}): ` + error.message, 'error', error);
      throw error;
    }
  }
  
  /**
   * 피드백 통계 조회
   * @returns {Promise<Object>} 피드백 통계
   */
  async getFeedbackStats() {
    try {
      const feedbacks = await this.loadFeedbacks();
      
      // 기본 통계 계산
      const totalCount = feedbacks.length;
      
      let totalScore = 0;
      feedbacks.forEach(f => {
        totalScore += f.score;
      });
      
      const avgScore = totalCount > 0 ? totalScore / totalCount : 0;
      
      // 점수별 분포
      const scoreDistribution = {};
      for (let i = 1; i <= 10; i++) {
        scoreDistribution[i] = feedbacks.filter(f => f.score === i).length;
      }
      
      // 템플릿별 평균 점수
      const templateScores = {};
      const templateCounts = {};
      
      feedbacks.forEach(f => {
        if (f.templateName) {
          if (!templateScores[f.templateName]) {
            templateScores[f.templateName] = 0;
            templateCounts[f.templateName] = 0;
          }
          
          templateScores[f.templateName] += f.score;
          templateCounts[f.templateName]++;
        }
      });
      
      const templateAvgScores = {};
      Object.keys(templateScores).forEach(template => {
        templateAvgScores[template] = templateScores[template] / templateCounts[template];
      });
      
      // 날짜별 피드백 수
      const feedbacksByDate = {};
      feedbacks.forEach(f => {
        const date = f.timestamp.split('T')[0];
        if (!feedbacksByDate[date]) {
          feedbacksByDate[date] = 0;
        }
        feedbacksByDate[date]++;
      });
      
      return {
        totalCount,
        avgScore,
        scoreDistribution,
        templateAvgScores,
        feedbacksByDate,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.logService('FeedbackHandler', '피드백 통계 계산 오류: ' + error.message, 'error', error);
      throw new Error('피드백 통계 계산 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 피드백 데이터 로드
   * @returns {Promise<Array>} 피드백 데이터 배열
   * @private
   */
  async loadFeedbacks() {
    try {
      const data = await fs.readFile(FEEDBACK_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.logService('FeedbackHandler', '피드백 데이터 로드 오류: ' + error.message, 'error', error);
      return [];
    }
  }
}

export default FeedbackHandler;