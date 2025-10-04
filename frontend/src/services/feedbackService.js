/**
 * 피드백 서비스
 * 사용자 피드백을 서버에 전송하고 관리하는 클라이언트 모듈
 */

import axios from 'axios';

// API 기본 URL 설정
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api/feedback'
  : 'http://localhost:3030/api/feedback';

/**
 * 피드백 서비스 클래스
 */
class FeedbackService {
  /**
   * 새 피드백 제출
   * @param {Object} feedbackData - 피드백 데이터
   * @param {number} feedbackData.score - 만족도 점수 (1-10)
   * @param {string} feedbackData.userComment - 사용자 코멘트
   * @param {string} [feedbackData.documentId] - 문서 ID
   * @param {string} [feedbackData.reportText] - 보고서 텍스트
   * @returns {Promise<Object>} 서버 응답
   */
  async submitFeedback(feedbackData) {
    try {
      const response = await axios.post(API_URL, feedbackData);
      return response.data;
    } catch (error) {
      console.error('피드백 제출 오류:', error);
      throw new Error(error.response?.data?.error || '피드백 제출 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 피드백 목록 조회 (관리자용)
   * @param {Object} filters - 필터 옵션
   * @returns {Promise<Array>} 피드백 목록
   */
  async getFeedbacks(filters = {}) {
    try {
      // 필터 쿼리 파라미터 구성
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
      
      const response = await axios.get(`${API_URL}?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('피드백 조회 오류:', error);
      throw new Error(error.response?.data?.error || '피드백 조회 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 피드백 통계 조회 (관리자용)
   * @returns {Promise<Object>} 피드백 통계
   */
  async getFeedbackStats() {
    try {
      const response = await axios.get(`${API_URL}/stats`);
      return response.data;
    } catch (error) {
      console.error('피드백 통계 조회 오류:', error);
      throw new Error(error.response?.data?.error || '피드백 통계 조회 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 특정 피드백 상세 조회 (관리자용)
   * @param {string} feedbackId - 피드백 ID
   * @returns {Promise<Object>} 피드백 상세 정보
   */
  async getFeedbackById(feedbackId) {
    try {
      const response = await axios.get(`${API_URL}/${feedbackId}`);
      return response.data;
    } catch (error) {
      console.error('피드백 상세 조회 오류:', error);
      throw new Error(error.response?.data?.error || '피드백 상세 조회 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 프롬프트 개선 제안 생성 (관리자용)
   * @param {string} feedbackId - 피드백 ID
   * @param {string} templateName - 템플릿 이름
   * @returns {Promise<Object>} 개선 제안 결과
   */
  async generateImprovement(feedbackId, templateName) {
    try {
      const response = await axios.post(`${API_URL}/${feedbackId}/improve`, { templateName });
      return response.data;
    } catch (error) {
      console.error('프롬프트 개선 제안 생성 오류:', error);
      throw new Error(error.response?.data?.error || '프롬프트 개선 제안 생성 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 개선된 프롬프트로 재테스트 (개발 단계에서만 사용)
   * @param {string} feedbackId - 피드백 ID
   * @param {string} templateName - 템플릿 이름
   * @param {string} [testText] - 테스트 텍스트
   * @returns {Promise<Object>} 재테스트 결과
   */
  async retestWithImprovement(feedbackId, templateName, testText) {
    try {
      const response = await axios.post(`${API_URL}/${feedbackId}/retest`, {
        templateName,
        testText
      });
      return response.data;
    } catch (error) {
      console.error('재테스트 오류:', error);
      throw new Error(error.response?.data?.error || '재테스트 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 개선된 프롬프트 적용 (관리자용)
   * @param {string} feedbackId - 피드백 ID
   * @param {string} templateName - 템플릿 이름
   * @param {boolean} [createBackup=true] - 백업 생성 여부
   * @returns {Promise<Object>} 적용 결과
   */
  async applyImprovement(feedbackId, templateName, createBackup = true) {
    try {
      const response = await axios.post(`${API_URL}/${feedbackId}/apply`, {
        templateName,
        createBackup
      });
      return response.data;
    } catch (error) {
      console.error('프롬프트 적용 오류:', error);
      throw new Error(error.response?.data?.error || '프롬프트 적용 중 오류가 발생했습니다.');
    }
  }
}

// 싱글톤 인스턴스 생성
const feedbackService = new FeedbackService();

export default feedbackService;