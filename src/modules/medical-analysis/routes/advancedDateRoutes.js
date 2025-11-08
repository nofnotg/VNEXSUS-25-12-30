/**
 * 고급 날짜 분석 API 라우트
 * 
 * 의료 텍스트에서 날짜 정보를 추출하고 분석하는 API 엔드포인트
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { 
  extractDates, 
  extractDatesBatch, 
  healthCheck 
} from '../controller/advancedDateController.js';
import { 
  corsMiddleware, 
  rateLimitMiddleware, 
  requestValidationMiddleware 
} from '../../../shared/middleware/index.js';

const router = express.Router();

// 라우트별 레이트 리미팅
const extractRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100회 요청
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

const batchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 20, // 배치는 더 제한적으로
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: '배치 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 미들웨어 적용
router.use(corsMiddleware);
router.use(requestValidationMiddleware);

/**
 * @route POST /extract
 * @desc 단일 텍스트에서 날짜 정보 추출
 * @access Public
 */
router.post('/extract', extractRateLimit, extractDates);

/**
 * @route POST /extract/batch
 * @desc 여러 텍스트에서 날짜 정보 일괄 추출
 * @access Public
 */
router.post('/extract/batch', batchRateLimit, extractDatesBatch);

/**
 * @route GET /health
 * @desc 서비스 상태 확인
 * @access Public
 */
router.get('/health', healthCheck);

export default router;