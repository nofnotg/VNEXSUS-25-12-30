/**
 * Advanced Date Routes
 * 
 * 비정형 의료문서의 텍스트 배열별 정확한 날짜 구분을 위한 API 라우트
 * 
 * 엔드포인트:
 * - POST /api/advanced-date/analyze - 텍스트 배열 날짜 분석
 * - GET /api/advanced-date/performance - 성능 메트릭 조회
 * - POST /api/advanced-date/validate - 결과 검증
 * - GET /api/advanced-date/timeline/:requestId - 날짜 타임라인 생성
 * - POST /api/advanced-date/batch-analyze - 배치 분석
 * - DELETE /api/advanced-date/cache - 캐시 정리
 * - GET /api/advanced-date/queue - 처리 대기열 상태
 */

import express from 'express';
import { AdvancedDateController } from '../controllers/advancedDateController.js';

const router = express.Router();
const controller = new AdvancedDateController();

// 미들웨어: 요청 로깅
router.use((req, res, next) => {
  console.log(`🔗 Advanced Date API: ${req.method} ${req.path}`);
  next();
});

// 미들웨어: 요청 크기 제한
router.use(express.json({ limit: '10mb' }));

/**
 * 텍스트 배열 날짜 분석
 * POST /api/advanced-date/analyze
 * 
 * Body:
 * {
 *   "documentText": "분석할 의료문서 텍스트",
 *   "options": {
 *     "minimumConfidence": 0.7,
 *     "groupByRole": true,
 *     "enableAI": true,
 *     "aiProvider": "claude"
 *   }
 * }
 */
router.post('/analyze', async (req, res) => {
  await controller.analyzeTextArrayDates(req, res);
});

/**
 * 성능 메트릭 조회
 * GET /api/advanced-date/performance
 * 
 * Query Parameters:
 * - detailed: boolean (상세 정보 포함 여부)
 */
router.get('/performance', async (req, res) => {
  await controller.getPerformanceMetrics(req, res);
});

/**
 * 결과 검증
 * POST /api/advanced-date/validate
 * 
 * Body:
 * {
 *   "analysisResult": { ... },
 *   "validationCriteria": {
 *     "minimumConfidence": 0.8,
 *     "minimumCompleteness": 0.9,
 *     "minimumConsistency": 0.95,
 *     "minimumAccuracy": 0.85
 *   }
 * }
 */
router.post('/validate', async (req, res) => {
  await controller.validateResults(req, res);
});

/**
 * 날짜 타임라인 생성
 * GET /api/advanced-date/timeline/:requestId
 * 
 * Path Parameters:
 * - requestId: string (분석 요청 ID)
 * 
 * Query Parameters:
 * - format: 'detailed' | 'simple' (타임라인 형식)
 * - sortBy: 'date' | 'confidence' | 'role' (정렬 기준)
 */
router.get('/timeline/:requestId', async (req, res) => {
  await controller.generateDateTimeline(req, res);
});

/**
 * 배치 분석
 * POST /api/advanced-date/batch-analyze
 * 
 * Body:
 * {
 *   "documents": [
 *     {
 *       "id": "doc1",
 *       "text": "문서 텍스트 1"
 *     },
 *     {
 *       "id": "doc2",
 *       "text": "문서 텍스트 2"
 *     }
 *   ],
 *   "options": { ... }
 * }
 */
router.post('/batch-analyze', async (req, res) => {
  await controller.batchAnalyze(req, res);
});

/**
 * 캐시 정리
 * DELETE /api/advanced-date/cache
 */
router.delete('/cache', (req, res) => {
  try {
    controller.clearCache();
    
    res.json({
      success: true,
      message: '캐시가 성공적으로 정리되었습니다.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 캐시 정리 실패:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'CACHE_CLEAR_FAILED'
    });
  }
});

/**
 * 처리 대기열 상태 조회
 * GET /api/advanced-date/queue
 */
router.get('/queue', (req, res) => {
  try {
    const queueStatus = controller.getQueueStatus();
    
    res.json({
      success: true,
      queue: queueStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 대기열 상태 조회 실패:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'QUEUE_STATUS_FAILED'
    });
  }
});

/**
 * 헬스 체크
 * GET /api/advanced-date/health
 */
router.get('/health', (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      controller: {
        cacheSize: controller.resultCache?.size || 0,
        queueSize: controller.processingQueue?.size || 0
      }
    };
    
    res.json({
      success: true,
      health
    });
    
  } catch (error) {
    console.error('❌ 헬스 체크 실패:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'HEALTH_CHECK_FAILED'
    });
  }
});

/**
 * 에러 핸들링 미들웨어
 */
router.use((error, req, res, next) => {
  console.error('❌ Advanced Date API 에러:', error);
  
  // 이미 응답이 전송된 경우
  if (res.headersSent) {
    return next(error);
  }
  
  // 에러 타입별 처리
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
  } else if (error.code === 'ENOENT') {
    statusCode = 404;
    errorCode = 'FILE_NOT_FOUND';
  }
  
  res.status(statusCode).json({
    success: false,
    error: error.message,
    code: errorCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

export default router;

/**
 * API 사용 예시:
 * 
 * 1. 기본 분석:
 * POST /api/advanced-date/analyze
 * {
 *   "documentText": "환자는 2024년 1월 15일 내원하여 검사를 받았습니다. 진단일은 2024년 1월 20일이며...",
 *   "options": {
 *     "minimumConfidence": 0.7,
 *     "enableAI": true
 *   }
 * }
 * 
 * 2. 성능 모니터링:
 * GET /api/advanced-date/performance
 * 
 * 3. 결과 검증:
 * POST /api/advanced-date/validate
 * {
 *   "analysisResult": { ... },
 *   "validationCriteria": {
 *     "minimumConfidence": 0.8
 *   }
 * }
 * 
 * 4. 타임라인 생성:
 * GET /api/advanced-date/timeline/req_1234567890_abc123def?format=detailed&sortBy=date
 * 
 * 5. 배치 처리:
 * POST /api/advanced-date/batch-analyze
 * {
 *   "documents": [
 *     { "id": "doc1", "text": "문서1 내용..." },
 *     { "id": "doc2", "text": "문서2 내용..." }
 *   ]
 * }
 * 
 * 6. 시스템 관리:
 * DELETE /api/advanced-date/cache  // 캐시 정리
 * GET /api/advanced-date/queue     // 대기열 상태
 * GET /api/advanced-date/health    // 헬스 체크
 */