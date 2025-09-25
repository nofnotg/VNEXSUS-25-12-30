/**
 * 피드백 API 라우터
 * 사용자 피드백 수집 및 관리를 위한 API 엔드포인트
 */

import express from 'express';
import FeedbackHandler from '../services/FeedbackHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();
const feedbackHandler = new FeedbackHandler();

/**
 * @route   POST /api/feedback
 * @desc    새 피드백 제출
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const feedbackData = req.body;
    
    // 필수 필드 검증
    if (!feedbackData.score || feedbackData.score < 1 || feedbackData.score > 10) {
      return res.status(400).json({ message: '유효한 점수(1-10)가 필요합니다.' });
    }
    
    const savedFeedback = await feedbackHandler.saveFeedback(feedbackData);
    res.status(201).json(savedFeedback);
  } catch (error) {
    logger.error('피드백 제출 오류:', error);
    res.status(500).json({ message: '피드백 저장 중 오류가 발생했습니다.' });
  }
});

/**
 * @route   GET /api/feedback
 * @desc    피드백 목록 조회 (필터링 가능)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // 쿼리 파라미터에서 필터 추출
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      minScore: req.query.minScore,
      maxScore: req.query.maxScore,
      templateName: req.query.templateName,
      status: req.query.status
    };
    
    const feedbacks = await feedbackHandler.getFeedbacks(filters);
    res.json(feedbacks);
  } catch (error) {
    logger.error('피드백 목록 조회 오류:', error);
    res.status(500).json({ message: '피드백 목록 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * @route   GET /api/feedback/stats
 * @desc    피드백 통계 조회
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await feedbackHandler.getFeedbackStats();
    res.json(stats);
  } catch (error) {
    logger.error('피드백 통계 조회 오류:', error);
    res.status(500).json({ message: '피드백 통계 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * @route   GET /api/feedback/:id
 * @desc    특정 피드백 조회
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const feedback = await feedbackHandler.getFeedbackById(req.params.id);
    res.json(feedback);
  } catch (error) {
    logger.error(`피드백 조회 오류 (ID: ${req.params.id}):`, error);
    
    if (error.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: '피드백 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * @route   PATCH /api/feedback/:id/status
 * @desc    피드백 상태 업데이트
 * @access  Public
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: '상태 값이 필요합니다.' });
    }
    
    const updatedFeedback = await feedbackHandler.updateFeedbackStatus(req.params.id, status);
    res.json(updatedFeedback);
  } catch (error) {
    logger.error(`피드백 상태 업데이트 오류 (ID: ${req.params.id}):`, error);
    
    if (error.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: '피드백 상태 업데이트 중 오류가 발생했습니다.' });
  }
});

/**
 * @route   POST /api/feedback/:id/improvement
 * @desc    피드백에 개선 제안 추가
 * @access  Public
 */
router.post('/:id/improvement', async (req, res) => {
  try {
    const suggestion = req.body;
    
    // 필수 필드 검증
    if (!suggestion.templateName || !suggestion.originalPrompt || !suggestion.improvedPrompt) {
      return res.status(400).json({ 
        message: '템플릿 이름, 원본 프롬프트, 개선된 프롬프트가 필요합니다.' 
      });
    }
    
    const result = await feedbackHandler.addImprovementSuggestion(req.params.id, suggestion);
    res.status(201).json(result);
  } catch (error) {
    logger.error(`피드백 개선 제안 추가 오류 (ID: ${req.params.id}):`, error);
    
    if (error.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: '피드백 개선 제안 추가 중 오류가 발생했습니다.' });
  }
});

export default router; 