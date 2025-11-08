/**
 * Developer Studio 통합 라우트
 * 
 * Developer Studio와 Advanced Date Classifier의 통합 API 엔드포인트
 * 
 * 라우트 구조:
 * /api/dev/studio/*
 * ├── /prompts (GET) - 통합 프롬프트 조회
 * ├── /case-samples (GET) - 케이스 샘플 목록
 * ├── /case-samples/:filename (GET) - 특정 케이스 샘플 내용
 * ├── /preprocess-text (POST) - 통합 전처리 파이프라인
 * ├── /test-prompt (POST) - 통합 AI 테스트
 * ├── /performance (GET) - 통합 성능 메트릭
 * └── /date-analysis/*
 *     ├── /analyze (POST) - 날짜 분석
 *     ├── /timeline/:requestId (GET) - 타임라인 생성
 *     ├── /validate (POST) - 결과 검증
 *     ├── /batch-analyze (POST) - 배치 분석
 *     ├── /cache (DELETE) - 캐시 정리
 *     ├── /queue (GET) - 대기열 상태
 *     └── /health (GET) - 시스템 상태
 */

import express from 'express';
import { DevStudioController } from '../controllers/devStudioController.js';
import { logger } from '../../src/shared/logging/logger.js';

const router = express.Router();
const devStudioController = new DevStudioController();

// 요청 로깅 미들웨어(구조화 로깅)
router.use((req, res, next) => {
  try {
    logger.logApiRequest(req, { event: 'dev_studio_route_request' });
  } catch (_) {
    // 로깅 실패는 라우팅을 방해하지 않음
  }
  next();
});

// 요청 크기 제한 미들웨어
router.use(express.json({ limit: '100mb' }));
router.use(express.urlencoded({ extended: true, limit: '100mb' }));

// === 기본 Developer Studio 엔드포인트 ===

/**
 * 통합 프롬프트 조회
 * GET /api/dev/studio/prompts
 * 
 * 응답:
 * {
 *   "success": true,
 *   "prompts": {
 *     "system": "시스템 프롬프트 (DNA 분석 포함)",
 *     "user": "사용자 프롬프트 (DNA 분석 포함)"
 *   },
 *   "version": "2.0.0",
 *   "features": {
 *     "dnaAnalysis": true,
 *     "advancedDateClassification": true,
 *     "integratedWorkflow": true
 *   }
 * }
 */
router.get('/prompts', async (req, res) => {
  try {
    await devStudioController.getPrompts(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_prompts_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '통합 프롬프트 조회 실패: ' + error.message
    });
  }
});

/**
 * 케이스 샘플 목록 조회
 * GET /api/dev/studio/case-samples
 * 
 * 응답:
 * {
 *   "success": true,
 *   "samples": [
 *     {
 *       "filename": "case1.txt",
 *       "patientName": "홍길동",
 *       "diagnosis": "고혈압",
 *       "displayName": "홍길동 - 고혈압",
 *       "description": "150줄, 12KB",
 *       "size": 12345,
 *       "lines": 150,
 *       "dnaAnalysisReady": true
 *     }
 *   ],
 *   "totalSamples": 10,
 *   "version": "2.0.0"
 * }
 */
router.get('/case-samples', async (req, res) => {
  try {
    await devStudioController.getCaseSamples(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_case_samples_list_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
        res.status(500).json({
            success: false,
            error: '케이스 샘플 목록 조회 실패: ' + error.message
        });
  }
});

/**
 * 특정 케이스 샘플 내용 조회
 * GET /api/dev/studio/case-samples/:filename
 * 
 * 쿼리 파라미터:
 * - maxLines: 최대 로드할 줄 수 (기본값: 전체)
 * 
 * 응답:
 * {
 *   "success": true,
 *   "filename": "case1.txt",
 *   "content": "파일 내용...",
 *   "totalLines": 150,
 *   "loadedLines": 150,
 *   "isPartial": false,
 *   "message": "전체 파일이 로드되었습니다.",
 *   "dnaAnalysisReady": true,
 *   "version": "2.0.0"
 * }
 */
router.get('/case-samples/:filename', async (req, res) => {
  try {
    await devStudioController.getCaseSample(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_case_sample_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
        res.status(500).json({
            success: false,
            error: '케이스 샘플 내용 조회 실패: ' + error.message
        });
  }
});

/**
 * 통합 전처리 파이프라인
 * POST /api/dev/studio/preprocess-text
 * 
 * 요청 본문:
 * {
 *   "text": "분석할 의료 텍스트",
 *   "options": {
 *     "enableDNASequencing": true,
 *     "enableAdvancedClassification": true
 *   }
 * }
 * 
 * 응답:
 * {
 *   "success": true,
 *   "results": {
 *     "dateAnalysis": { ... },
 *     "extractedHospitals": [...],
 *     "extractedKeywords": [...],
 *     "translatedTerms": {...},
 *     "processedSections": [...],
 *     "statistics": {
 *       "totalSections": 10,
 *       "processedSections": 10,
 *       "totalDates": 25,
 *       "confidenceScore": 0.95,
 *       "dnaPatterns": 8,
 *       "processingTime": "1250ms"
 *     },
 *     "metadata": {
 *       "version": "2.0.0",
 *       "timestamp": "2024-01-01T00:00:00.000Z",
 *       "analysisType": "integrated_dna_preprocessing",
 *       "features": {...}
 *     }
 *   },
 *   "message": "DNA 기반 통합 전처리가 완료되었습니다."
 * }
 */
router.post('/preprocess-text', async (req, res) => {
  try {
    await devStudioController.preprocessText(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_preprocess_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '통합 전처리 실패: ' + error.message
    });
  }
});

/**
 * 통합 AI 프롬프트 테스트
 * POST /api/dev/studio/test-prompt
 * 
 * 요청 본문:
 * {
 *   "systemPrompt": "시스템 프롬프트",
 *   "userPrompt": "사용자 프롬프트",
 *   "extractedText": "추출된 텍스트",
 *   "patientInfo": {
 *     "insuranceJoinDate": "2023-01-01"
 *   },
 *   "dateAnalysisResults": { ... } // 선택사항
 * }
 * 
 * 응답:
 * {
 *   "success": true,
 *   "result": {
 *     "reportText": "AI 생성 보고서",
 *     "processingTime": "2500ms",
 *     "model": "gpt-4o",
 *     "timestamp": "2024-01-01T00:00:00.000Z",
 *     "tokenUsage": {
 *       "promptTokens": 1500,
 *       "completionTokens": 800,
 *       "totalTokens": 2300
 *     },
 *     "dnaAnalysisIncluded": true,
 *     "version": "2.0.0"
 *   }
 * }
 */
router.post('/test-prompt', async (req, res) => {
  try {
    await devStudioController.testPrompt(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_test_prompt_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '통합 AI 테스트 실패: ' + error.message
    });
  }
});

/**
 * 통합 성능 메트릭 조회
 * GET /api/dev/studio/performance
 * 
 * 응답:
 * {
 *   "success": true,
 *   "metrics": {
 *     "totalAnalyses": 150,
 *     "averageProcessingTime": 1250,
 *     "successRate": 98.5,
 *     "dateAnalysisAccuracy": 95.2,
 *     "aiProcessingTime": 2500,
 *     "lastUpdated": "2024-01-01T00:00:00.000Z",
 *     "advanced": { ... },
 *     "system": {
 *       "queueSize": 0,
 *       "cacheSize": 25,
 *       "uptime": 3600,
 *       "memoryUsage": {...}
 *     },
 *     "version": "2.0.0"
 *   },
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 */
router.get('/performance', async (req, res) => {
  try {
    await devStudioController.getPerformanceMetrics(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_performance_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '성능 메트릭 조회 실패: ' + error.message
    });
  }
});

// === 통합 날짜 분석 엔드포인트 ===

/**
 * 날짜 분석
 * POST /api/dev/studio/date-analysis/analyze
 * 
 * 요청 본문:
 * {
 *   "text": "분석할 의료 텍스트",
 *   "options": {
 *     "enableDNASequencing": true,
 *     "enableAdvancedClassification": true,
 *     "confidenceThreshold": 0.8
 *   }
 * }
 * 
 * 응답:
 * {
 *   "success": true,
 *   "requestId": "req_123456789",
 *   "result": {
 *     "extractedDates": [...],
 *     "documentSummary": {...},
 *     "dnaAnalysis": {...},
 *     "qualityMetrics": {...}
 *   },
 *   "processingTime": "1250ms",
 *   "cached": false
 * }
 */
router.post('/date-analysis/analyze', async (req, res) => {
  try {
    await devStudioController.analyzeDates(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_analyze_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '날짜 분석 실패: ' + error.message
    });
  }
});

/**
 * 타임라인 생성
 * GET /api/dev/studio/date-analysis/timeline/:requestId
 * 
 * 응답:
 * {
 *   "success": true,
 *   "requestId": "req_123456789",
 *   "timeline": {
 *     "events": [...],
 *     "summary": {...},
 *     "visualization": {...}
 *   },
 *   "generatedAt": "2024-01-01T00:00:00.000Z"
 * }
 */
router.get('/date-analysis/timeline/:requestId', async (req, res) => {
  try {
    await devStudioController.generateTimeline(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_timeline_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '타임라인 생성 실패: ' + error.message
    });
  }
});

/**
 * 결과 검증
 * POST /api/dev/studio/date-analysis/validate
 * 
 * 요청 본문:
 * {
 *   "requestId": "req_123456789",
 *   "validationCriteria": {
 *     "minConfidence": 0.8,
 *     "requireDNAValidation": true
 *   }
 * }
 * 
 * 응답:
 * {
 *   "success": true,
 *   "requestId": "req_123456789",
 *   "validation": {
 *     "isValid": true,
 *     "score": 0.95,
 *     "issues": [],
 *     "recommendations": [...]
 *   }
 * }
 */
router.post('/date-analysis/validate', async (req, res) => {
  try {
    // Advanced Date Controller의 검증 기능 활용
    await devStudioController.advancedDateController.validateResults(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_validation_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '결과 검증 실패: ' + error.message
    });
  }
});

/**
 * 배치 분석
 * POST /api/dev/studio/date-analysis/batch-analyze
 * 
 * 요청 본문:
 * {
 *   "documents": [
 *     {
 *       "id": "doc1",
 *       "text": "의료 텍스트 1"
 *     },
 *     {
 *       "id": "doc2",
 *       "text": "의료 텍스트 2"
 *     }
 *   ],
 *   "options": {
 *     "enableDNASequencing": true,
 *     "batchSize": 5
 *   }
 * }
 * 
 * 응답:
 * {
 *   "success": true,
 *   "batchId": "batch_123456789",
 *   "results": [...],
 *   "summary": {
 *     "totalDocuments": 2,
 *     "processedDocuments": 2,
 *     "averageProcessingTime": "1500ms",
 *     "overallAccuracy": 0.94
 *   }
 * }
 */
router.post('/date-analysis/batch-analyze', async (req, res) => {
  try {
    // Advanced Date Controller의 배치 분석 기능 활용
    await devStudioController.advancedDateController.batchAnalyze(req, res);
  } catch (error) {
    logger.error({
      event: 'dev_studio_batch_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '배치 분석 실패: ' + error.message
    });
  }
});

/**
 * 캐시 정리
 * DELETE /api/dev/studio/date-analysis/cache
 * 
 * 응답:
 * {
 *   "success": true,
 *   "message": "통합 캐시가 정리되었습니다.",
 *   "clearedItems": 25
 * }
 */
router.delete('/date-analysis/cache', async (req, res) => {
  try {
    const beforeSize = devStudioController.analysisCache.size;
    devStudioController.clearCache();
    
    res.json({
      success: true,
      message: '통합 캐시가 정리되었습니다.',
      clearedItems: beforeSize
    });
  } catch (error) {
    logger.error({
      event: 'dev_studio_cache_clear_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '캐시 정리 실패: ' + error.message
    });
  }
});

/**
 * 대기열 상태 조회
 * GET /api/dev/studio/date-analysis/queue
 * 
 * 응답:
 * {
 *   "success": true,
 *   "queue": {
 *     "integrated": {
 *       "size": 0,
 *       "items": []
 *     },
 *     "advanced": {
 *       "size": 2,
 *       "items": [...]
 *     }
 *   },
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 */
router.get('/date-analysis/queue', async (req, res) => {
  try {
    const queueStatus = devStudioController.getQueueStatus();
    
    res.json({
      success: true,
      queue: queueStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({
      event: 'dev_studio_queue_status_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      error: '대기열 상태 조회 실패: ' + error.message
    });
  }
});

/**
 * 시스템 상태 확인
 * GET /api/dev/studio/date-analysis/health
 * 
 * 응답:
 * {
 *   "success": true,
 *   "status": "healthy",
 *   "version": "2.0.0",
 *   "uptime": 3600,
 *   "components": {
 *     "devStudio": "healthy",
 *     "advancedDateAnalysis": "healthy",
 *     "dnaEngine": "healthy",
 *     "aiService": "healthy"
 *   },
 *   "metrics": {
 *     "memoryUsage": {...},
 *     "queueSize": 0,
 *     "cacheSize": 25
 *   },
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 */
router.get('/date-analysis/health', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const queueStatus = devStudioController.getQueueStatus();
    
    // 컴포넌트 상태 확인
    const components = {
      devStudio: 'healthy',
      advancedDateAnalysis: 'healthy',
      dnaEngine: 'healthy',
      aiService: process.env.OPENAI_API_KEY ? 'healthy' : 'warning'
    };
    
    const overallStatus = Object.values(components).includes('error') ? 'error' :
                         Object.values(components).includes('warning') ? 'warning' : 'healthy';
    
    res.json({
      success: true,
      status: overallStatus,
      version: devStudioController.version,
      uptime: Math.floor(process.uptime()),
      components: components,
      metrics: {
        memoryUsage: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
        },
        queueSize: queueStatus.integrated.size + queueStatus.advanced.size,
        cacheSize: devStudioController.analysisCache.size
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({
      event: 'dev_studio_health_failed',
      error: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      path: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      status: 'error',
      error: '시스템 상태 확인 실패: ' + error.message
    });
  }
});

// 에러 핸들링 미들웨어
router.use((error, req, res, next) => {
  logger.error({
    event: 'dev_studio_route_error',
    error: error?.message,
    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    path: req.originalUrl,
    method: req.method
  });
  
  res.status(500).json({
    success: false,
    error: '통합 Dev Studio API 오류: ' + error.message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
});

// API 사용 예시 (개발 환경에서만 표시)
if (process.env.NODE_ENV === 'development') {
  router.get('/examples', (req, res) => {
    res.json({
      success: true,
      message: '통합 Developer Studio API 사용 예시',
      version: '2.0.0',
      examples: {
        '프롬프트 조회': {
          method: 'GET',
          url: '/api/dev/studio/prompts',
          description: 'DNA 분석이 포함된 통합 프롬프트 조회'
        },
        '케이스 샘플 목록': {
            method: 'GET',
            endpoint: '/case-samples',
            description: 'DNA 분석 준비된 케이스 샘플 목록 조회'
        },
        '통합 전처리': {
          method: 'POST',
          url: '/api/dev/studio/preprocess-text',
          body: {
            text: '의료 텍스트...',
            options: {
              enableDNASequencing: true,
              enableAdvancedClassification: true
            }
          },
          description: 'DNA 시퀀싱과 고급 날짜 분석이 포함된 통합 전처리'
        },
        '통합 AI 테스트': {
          method: 'POST',
          url: '/api/dev/studio/test-prompt',
          body: {
            systemPrompt: '시스템 프롬프트...',
            userPrompt: '사용자 프롬프트...',
            extractedText: '추출된 텍스트...'
          },
          description: 'DNA 분석 결과가 포함된 AI 프롬프트 테스트'
        },
        '날짜 분석': {
          method: 'POST',
          url: '/api/dev/studio/date-analysis/analyze',
          body: {
            text: '의료 텍스트...',
            options: {
              enableDNASequencing: true,
              confidenceThreshold: 0.8
            }
          },
          description: 'DNA 기반 고급 날짜 분석'
        },
        '성능 메트릭': {
          method: 'GET',
          url: '/api/dev/studio/performance',
          description: '통합 시스템 성능 메트릭 조회'
        },
        '시스템 상태': {
          method: 'GET',
          url: '/api/dev/studio/date-analysis/health',
          description: '통합 시스템 상태 및 컴포넌트 헬스체크'
        }
      }
    });
  });
}

export default router;
