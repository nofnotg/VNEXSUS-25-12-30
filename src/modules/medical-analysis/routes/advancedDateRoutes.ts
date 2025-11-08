/**
 * 고급 날짜 분석 API 라우트
 * 프로젝트 규칙: Express 라우터, 미들웨어 적용, RESTful API 설계
 */

import { Router } from 'express';
import { advancedDateController } from '../controller/advancedDateController';
import { rateLimitMiddleware, corsMiddleware, requestValidationMiddleware } from '../../../shared/middleware';

const router = Router();

// 미들웨어 적용
router.use(corsMiddleware);
router.use(rateLimitMiddleware);

/**
 * POST /api/v2/medical-analysis/advanced-date-analysis
 * 단일 텍스트에서 날짜 추출
 */
router.post(
  '/advanced-date-analysis',
  requestValidationMiddleware,
  async (req, res) => {
    await advancedDateController.extractDates(req, res);
  }
);

/**
 * POST /api/v2/medical-analysis/advanced-date-analysis/batch
 * 여러 텍스트에서 배치 날짜 추출
 */
router.post(
  '/advanced-date-analysis/batch',
  requestValidationMiddleware,
  async (req, res) => {
    await advancedDateController.extractDatesBatch(req, res);
  }
);

/**
 * GET /api/v2/medical-analysis/advanced-date-analysis/health
 * 서비스 헬스 체크
 */
router.get(
  '/advanced-date-analysis/health',
  async (req, res) => {
    await advancedDateController.healthCheck(req, res);
  }
);

export { router as advancedDateRoutes };