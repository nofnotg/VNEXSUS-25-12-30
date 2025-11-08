/**
 * 통합 파이프라인 하이브리드 처리 라우트
 * 모든 처리 모드를 하나의 파이프라인으로 통합
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import HybridController from '../controllers/hybridController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const hybridController = new HybridController();

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
    files: 10 // 최대 10개 파일
  },
  fileFilter: (req, file, cb) => {
    // 허용된 파일 타입 (텍스트, 이미지, PDF 등)
    const allowedTypes = /jpeg|jpg|png|gif|pdf|txt|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('지원되지 않는 파일 형식입니다.'));
    }
  }
});

/**
 * 통합 파이프라인 문서 처리 API
 * POST /api/hybrid/process
 * 
 * 모든 처리 엔진을 순차적으로 실행하고 최적의 결과를 선택하는 통합 파이프라인
 */
router.post('/process', async (req, res) => {
  try {
    console.log('🔄 통합 파이프라인 처리 요청 수신');
    
    // hybridController의 processDocument 메서드로 직접 위임
    await hybridController.processDocument(req, res);
    
  } catch (error) {
    console.error('❌ 통합 파이프라인 처리 실패:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

/**
 * 파일 업로드를 통한 통합 파이프라인 처리
 * POST /api/hybrid/upload
 */
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    console.log('📁 파일 업로드 및 통합 파이프라인 처리 요청');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '업로드된 파일이 없습니다'
      });
    }
    
    // 업로드된 파일 정보 준비
    const fileInfos = req.files.map(file => ({
      filename: file.originalname,
      content: fs.readFileSync(file.path, 'utf8'), // 실제로는 OCR 등을 통해 텍스트 추출
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    }));
    
    // 처리 설정
    const processConfig = {
      enableDetailedAnalysis: req.body.enableDetailedAnalysis !== 'false',
      enablePerformanceMetrics: req.body.enablePerformanceMetrics !== 'false',
      qualityThreshold: parseFloat(req.body.qualityThreshold) || 0.8,
      enableFallback: req.body.enableFallback !== 'false'
    };
    
    // 통합 파이프라인 실행
    const result = await hybridController.processDocuments(fileInfos, 'unified', processConfig);
    
    // 임시 파일 정리
    req.files.forEach(file => {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.warn(`임시 파일 삭제 실패: ${file.path}`, err);
      }
    });
    
    console.log('✅ 파일 업로드 및 통합 파이프라인 처리 완료');
    res.json(result);
    
  } catch (error) {
    console.error('❌ 파일 업로드 및 통합 파이프라인 처리 실패:', error);
    
    // 에러 발생 시 임시 파일 정리
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.warn(`임시 파일 삭제 실패: ${file.path}`, err);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 통합 파이프라인 상태 조회
 * GET /api/hybrid/status
 */
router.get('/status', async (req, res) => {
  try {
    console.log('📊 상태 엔드포인트 호출됨');
    
    // 기본 시스템 상태 정보
    const systemStatus = {
      version: '2.0.0',
      status: 'active',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageProcessingTime: 0,
        successRate: 0,
        errorRate: 0,
        throughput: 0,
        lastUpdated: new Date()
      },
      processors: {
        dateProcessor: {
          status: 'inactive',
          metrics: {}
        },
        medicalNormalizer: {
          status: 'inactive',
          metrics: {}
        }
      },
      lastHealthCheck: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: systemStatus
    });
    
  } catch (error) {
    console.error('❌ 시스템 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 통합 파이프라인 성능 메트릭 조회
 * GET /api/hybrid/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await hybridController.getMetrics();
    res.json({
      success: true,
      metrics: {
        ...metrics,
        processingMode: 'unified'
      }
    });
  } catch (error) {
    console.error('❌ 성능 메트릭 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/hybrid/metrics/comparison
 * @desc 성능 비교 데이터 조회
 * @access Public
 */
router.get('/metrics/comparison', async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    const comparison = await hybridController.getPerformanceComparison(timeRange);
    res.json(comparison);
  } catch (error) {
    console.error('성능 비교 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '성능 비교 데이터 조회 실패'
    });
  }
});

/**
 * @route GET /api/hybrid/alerts
 * @desc 시스템 알림 조회
 * @access Public
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await hybridController.getAlerts();
    res.json({ alerts });
  } catch (error) {
    console.error('알림 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '알림 조회 실패'
    });
  }
});

/**
 * @route PUT /api/hybrid/config
 * @desc 시스템 설정 업데이트
 * @access Public
 */
router.put('/config', async (req, res) => {
  try {
    const newConfig = req.body;
    const result = await hybridController.updateConfig(newConfig);
    res.json(result);
  } catch (error) {
    console.error('설정 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      error: '설정 업데이트 실패'
    });
  }
});

/**
 * @route GET /api/hybrid/config
 * @desc 현재 설정 조회
 * @access Public
 */
router.get('/config', async (req, res) => {
  try {
    const config = await hybridController.getConfig();
    res.json(config);
  } catch (error) {
    console.error('설정 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '설정 조회 실패'
    });
  }
});

/**
 * @route POST /api/hybrid/test
 * @desc A/B 테스트 데이터 수집
 * @access Public
 */
router.post('/test', upload.array('files', 10), async (req, res) => {
  try {
    const { testId, modes } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '테스트할 파일이 없습니다.'
      });
    }

    if (!modes || !Array.isArray(JSON.parse(modes))) {
      return res.status(400).json({
        success: false,
        error: '테스트 모드가 지정되지 않았습니다.'
      });
    }

    const fileInfos = files.map(file => ({
      filename: file.originalname,
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size
    }));

    const testModes = JSON.parse(modes);
    const result = await hybridController.collectABTestData(fileInfos, testModes, testId);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('A/B 테스트 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'A/B 테스트 실행 실패'
    });
  }
});

/**
 * @route GET /api/hybrid/test/results/:testId
 * @desc A/B 테스트 결과 조회
 * @access Public
 */
router.get('/test/results/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    const results = await hybridController.getABTestResults(testId);
    res.json(results);
  } catch (error) {
    console.error('A/B 테스트 결과 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'A/B 테스트 결과 조회 실패'
    });
  }
});

/**
 * @route GET /api/hybrid/health
 * @desc 헬스 체크
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      components: {
        hybridDateProcessor: 'healthy',
        hybridMedicalNormalizer: 'healthy',
        resultMerger: 'healthy',
        performanceMonitor: 'healthy'
      }
    };

    res.json(health);
  } catch (error) {
    console.error('헬스 체크 오류:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * @route POST /api/hybrid/validate
 * @desc 파일 유효성 검사
 * @access Public
 */
router.post('/validate', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '검사할 파일이 없습니다.'
      });
    }

    const validationResults = files.map(file => {
      const isValidType = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/tiff',
        'text/plain'
      ].includes(file.mimetype);

      const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB

      return {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        isValid: isValidType && isValidSize,
        errors: [
          ...(!isValidType ? ['지원하지 않는 파일 형식'] : []),
          ...(!isValidSize ? ['파일 크기가 너무 큼 (최대 50MB)'] : [])
        ]
      };
    });

    const allValid = validationResults.every(result => result.isValid);

    res.json({
      success: true,
      allValid,
      results: validationResults
    });

  } catch (error) {
    console.error('파일 유효성 검사 오류:', error);
    res.status(500).json({
      success: false,
      error: '파일 유효성 검사 실패'
    });
  }
});

// 에러 핸들링 미들웨어
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '파일 크기가 너무 큽니다. (최대 50MB)'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: '파일 개수가 너무 많습니다. (최대 10개)'
      });
    }
  }

  console.error('하이브리드 라우터 오류:', error);
  res.status(500).json({
    success: false,
    error: error.message || '서버 오류가 발생했습니다.'
  });
});

export default router;