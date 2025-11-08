/**
 * 향상된 코어 엔진 라우트
 * 기존 API와 병렬로 운영되는 새로운 엔드포인트
 * @module routes/enhancedCoreRoutes
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// 서비스 및 유틸리티 import
import { uploadPdfsEnhanced, getEnhancedJobStatus, getEnhancedJobResult } from '../controllers/enhancedOcrController.js';
import coreEngineService from '../services/coreEngineService.js';
const { createLogger } = require('../utils/enhancedLogger.js');

const { globalMemoryOptimizer } = require('../utils/memoryOptimizer.js');
import { cacheResponse, cacheAnalysisResponse } from '../middleware/cacheMiddleware.js';
import { AppError, CoreEngineError, ValidationError, handleCoreEngineError } from '../middleware/errorHandler.js';

const router = express.Router();
const logger = createLogger('ENHANCED_CORE_ROUTES');

// 업로드 디렉토리 설정
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  logger.info('업로드 디렉토리 생성됨', { uploadDir });
}

// Multer 설정 (향상된 버전)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `enhanced-${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: parseInt(process.env.MAX_FILES_PER_REQUEST) || 5
  },
  fileFilter: (req, file, cb) => {
    try {
      const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['.pdf', '.jpg', '.jpeg', '.png'];
      const fileExt = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(fileExt)) {
        cb(null, true);
      } else {
        const error = new ValidationError(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedTypes.join(', ')}`);
        logger.warn('파일 형식 검증 실패', { 
          filename: file.originalname, 
          fileExt, 
          allowedTypes 
        });
        cb(error);
      }
    } catch (error) {
      logger.error('파일 필터 처리 중 오류', { filename: file.originalname }, error);
      cb(new AppError('파일 처리 중 오류가 발생했습니다', 500));
    }
  }
});

// 에러 핸들링 미들웨어
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 코어 엔진 상태 확인
 * GET /api/enhanced/status
 */
router.get('/status', 
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    logger.info('GET /api/enhanced/status 요청 시작');
    
    const status = coreEngineService.getHealthStatus();
    
    const response = {
      message: '코어 엔진 상태 확인',
      ...status,
      endpoints: {
        upload: '/api/enhanced/upload',
        status: '/api/enhanced/job/:jobId/status',
        result: '/api/enhanced/job/:jobId/result',
        health: '/api/enhanced/status'
      }
    };

    const duration = Date.now() - startTime;
    logger.info(`GET /api/enhanced/status 완료 - 200 (${duration}ms)`, { enabled: status.enabled });
    res.json(response);
  })
);

/**
 * 향상된 파일 업로드 및 처리
 * POST /api/enhanced/upload
 */
router.post('/upload', upload.array('files'), asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  logger.info('POST /api/enhanced/upload 요청 시작', { 
    fileCount: req.files?.length || 0,
    hasFiles: !!req.files?.length
  });
  
  try {
    await uploadPdfsEnhanced(req, res);
    logger.info('POST /api/enhanced/upload 요청 완료', { 
      duration: Date.now() - startTime 
    });
  } catch (error) {
    logger.error('파일 업로드 처리 중 오류', { 
      fileCount: req.files?.length || 0,
      duration: Date.now() - startTime
    }, error);
    throw error;
  }
}));

/**
 * 작업 상태 확인
 * GET /api/enhanced/job/:jobId/status
 */
router.get('/job/:jobId/status', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  logger.info('GET /api/enhanced/job/:jobId/status 요청', { jobId });
  
  await getEnhancedJobStatus(req, res);
}));

/**
 * 작업 결과 조회
 * GET /api/enhanced/job/:jobId/result
 */
router.get('/job/:jobId/result', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  logger.info('GET /api/enhanced/job/:jobId/result 요청', { jobId });
  
  await getEnhancedJobResult(req, res);
}));

/**
 * 코어 엔진 토글 (개발/테스트용)
 * POST /api/enhanced/toggle
 */
router.post('/toggle', asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  logger.info('POST /api/enhanced/toggle 요청', { enabled });

  if (typeof enabled !== 'boolean') {
    throw new ValidationError('enabled 값은 boolean 타입이어야 합니다', 'enabled', enabled);
  }
  // 환경변수 업데이트 (런타임에서만 적용)
  process.env.USE_CORE_ENGINE = enabled.toString();
  
  logger.info('코어 엔진 토글 설정 변경', { 
    enabled, 
    previousState: coreEngineService.isActive() 
  });
  
  const response = {
    message: `코어 엔진이 ${enabled ? '활성화' : '비활성화'}되었습니다`,
    enabled,
    timestamp: new Date().toISOString()
  };

  logger.info(`POST /api/enhanced/toggle 완료 - 200`, { enabled });
  res.json(response);
}));

/**
 * 고지의무 분석
 * POST /api/enhanced/analyze
 */
router.post('/analyze', 
  cacheAnalysisResponse({ ttl: 300000, keyPrefix: 'analyze' }), // 5분 캐시
  asyncHandler(async (req, res) => {
    const {
      contractDate,
      records = [],
      claimDiagnosis = '',
      disclosureWindows = ['3m', '2y', '5y'],
      systemPrompt,
      userPrompt
    } = req.body;

    logger.info('POST /api/enhanced/analyze 요청', {
      hasContractDate: !!contractDate,
      recordCount: records.length,
      hasSystemPrompt: !!systemPrompt,
      hasUserPrompt: !!userPrompt
    });

    // 메모리 최적화 - 대용량 데이터 처리 전 메모리 체크
    globalMemoryOptimizer.checkMemoryUsage();
    
    if (!coreEngineService.isActive()) {
      logger.warn('코어 엔진 비활성화 상태에서 분석 요청', {
        endpoint: '/api/enhanced/analyze'
      });

      throw new AppError('코어 엔진이 비활성화되어 있습니다. USE_CORE_ENGINE 환경변수를 true로 설정하거나 /api/enhanced/toggle을 사용하세요.', 503);
    }

    if (!records || records.length === 0) {
      throw new ValidationError('분석할 의료 기록이 필요합니다.');
    }

    logger.info('직접 분석 요청 처리 시작');

    const result = await coreEngineService.runIntegratedPipeline({
      contractDate,
      records,
      claimDiagnosis,
      disclosureWindows,
      systemPrompt,
      userPrompt
    });

    const response = {
      message: '분석이 완료되었습니다.',
      result,
      timestamp: new Date().toISOString()
    };

    logger.info('POST /api/enhanced/analyze 완료 - 200', {
      coreEngineUsed: result.coreEngineUsed,
      hasError: !!result.error
    });

    res.json(response);
  })
);

/**
 * 데이터 검증
 * POST /api/enhanced/validate
 */
router.post('/validate', asyncHandler(async (req, res) => {
  const { data, validationType } = req.body;
  logger.info('POST /api/enhanced/validate 요청', {
    hasData: !!data,
    validationType
  });
  
  if (!data) {
    throw new ValidationError('검증할 데이터가 필요합니다', 'data', data);
  }
  
  if (!validationType) {
    throw new ValidationError('검증 타입이 필요합니다', 'validationType', validationType);
  }
  
  const result = await coreEngineService.validateData(data, validationType);
  
  const response = {
    message: '데이터 검증 완료',
    result,
    timestamp: new Date().toISOString()
  };
  
  logger.info('POST /api/enhanced/validate 완료 - 200', {
    validationType,
    isValid: result?.isValid
  });
  
  res.json(response);
}));

/**
 * 에러 핸들링 미들웨어
 */
router.use((error, req, res, next) => {
  logger.error('Enhanced core routes error', { 
    path: req.path, 
    method: req.method,
    errorMessage: error?.message || 'Unknown error',
    errorStack: error?.stack || 'No stack trace'
  }, error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: '파일 크기가 너무 큽니다.',
        maxSize: `${(parseInt(process.env.MAX_FILE_SIZE) || 10485760) / 1024 / 1024}MB`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: '파일 개수가 너무 많습니다.',
        maxFiles: parseInt(process.env.MAX_FILES_PER_REQUEST) || 5
      });
    }
  }

  // 기존 에러 핸들러로 전달
  handleCoreEngineError(error, req, res, next);
});

export default router;