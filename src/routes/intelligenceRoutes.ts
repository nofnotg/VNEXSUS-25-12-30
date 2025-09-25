/**
 * Intelligence Routes - 새로운 지능형 의료문서 처리 API 라우트
 * 
 * 혁신적 특징:
 * 1. RESTful API 설계
 * 2. 실시간 처리 상태 모니터링
 * 3. 멀티 패널 UI 지원
 * 4. 성능 최적화 및 비용 관리
 */

import express from 'express';
import { documentHandler, statusHandler, statsHandler, configHandler } from '../controllers/intelligenceController';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// 파일 업로드 설정
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // 텍스트 파일만 허용
    const allowedTypes = ['.txt', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('지원되지 않는 파일 형식입니다.'));
    }
  }
});

/**
 * @route POST /api/intelligence/process
 * @desc 의료문서 지능형 처리
 * @access Public
 * 
 * Body Parameters:
 * - text: string (required) - 처리할 원본 텍스트
 * - mode: 'FAST' | 'BALANCED' | 'THOROUGH' (optional) - 처리 모드
 * - strategy: 'LEGACY' | 'INTELLIGENCE' | 'HYBRID' (optional) - 강제 전략
 * - realTime: boolean (optional) - 실시간 모드 활성화
 * - costLimit: number (optional) - 비용 제한
 * - accuracyThreshold: number (optional) - 정확도 임계값
 * - outputFormat: 'STANDARD' | 'ENHANCED' | 'MULTI_PANEL' (optional) - 출력 형식
 * - patientInfo: object (optional) - 환자 정보
 * - insuranceInfo: object (optional) - 보험 정보
 */
router.post('/process', async (req, res) => {
  console.log('🚀 Intelligence API: /process 요청 수신');
  
  try {
    // 요청 로깅
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Text length:', req.body.text?.length || 0);
    console.log('Processing mode:', req.body.mode || 'BALANCED');
    
    await documentHandler(req, res);
    
  } catch (error: any) {
    console.error('❌ Intelligence API: /process 오류', error);
    res.status(500).json({
      success: false,
      error: error.message || '문서 처리 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/intelligence/upload
 * @desc 파일 업로드 및 처리
 * @access Public
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  console.log('📁 Intelligence API: /upload 요청 수신');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }
    
    console.log('Uploaded file:', req.file.originalname, req.file.size, 'bytes');
    
    // 파일 내용 읽기
    const filePath = req.file.path;
    let fileContent: string;
    
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch (readError) {
      // UTF-8로 읽기 실패 시 다른 인코딩 시도
      try {
        const buffer = await fs.readFile(filePath);
        fileContent = buffer.toString('latin1'); // 또는 다른 인코딩
      } catch (fallbackError) {
        throw new Error('파일을 읽을 수 없습니다. 텍스트 파일인지 확인해주세요.');
      }
    }
    
    // 임시 파일 삭제
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.warn('임시 파일 삭제 실패:', unlinkError);
    }
    
    // 파일 내용으로 처리 요청 생성
    const processRequest = {
      ...req.body,
      text: fileContent,
      jobId: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // 새로운 요청 객체 생성
    const newReq = {
      ...req,
      body: processRequest
    };
    
    console.log('File processed, content length:', fileContent.length);
    
    await documentHandler(newReq, res);
    
  } catch (error: any) {
    console.error('❌ Intelligence API: /upload 오류', error);
    
    // 임시 파일 정리
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('임시 파일 삭제 실패:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message || '파일 처리 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/intelligence/status/:jobId
 * @desc 처리 상태 조회
 * @access Public
 */
router.get('/status/:jobId', async (req, res) => {
  console.log(`📊 Intelligence API: /status/${req.params.jobId} 요청 수신`);
  
  try {
    await statusHandler(req, res);
    
  } catch (error: any) {
    console.error('❌ Intelligence API: /status 오류', error);
    res.status(500).json({
      success: false,
      error: error.message || '상태 조회 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/intelligence/stats
 * @desc 성능 통계 조회
 * @access Public
 */
router.get('/stats', async (req, res) => {
  console.log('📈 Intelligence API: /stats 요청 수신');
  
  try {
    await statsHandler(req, res);
    
  } catch (error: any) {
    console.error('❌ Intelligence API: /stats 오류', error);
    res.status(500).json({
      success: false,
      error: error.message || '통계 조회 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route PUT /api/intelligence/config
 * @desc 시스템 설정 업데이트
 * @access Public
 */
router.put('/config', async (req, res) => {
  console.log('⚙️ Intelligence API: /config 요청 수신');
  
  try {
    console.log('Config update:', req.body);
    await configHandler(req, res);
    
  } catch (error: any) {
    console.error('❌ Intelligence API: /config 오류', error);
    res.status(500).json({
      success: false,
      error: error.message || '설정 업데이트 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/intelligence/health
 * @desc 시스템 상태 확인
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      services: {
        intelligenceBridge: 'active',
        adaptiveProcessor: 'active',
        smartChunker: 'active',
        hybridNER: 'active',
        timelineEngine: 'active'
      },
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        total: process.memoryUsage().heapTotal / 1024 / 1024
      },
      uptime: process.uptime()
    };
    
    res.json({
      success: true,
      health: healthStatus
    });
    
  } catch (error: any) {
    console.error('❌ Intelligence API: /health 오류', error);
    res.status(500).json({
      success: false,
      error: error.message || '상태 확인 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/intelligence/batch
 * @desc 배치 처리 (여러 문서 동시 처리)
 * @access Public
 */
router.post('/batch', async (req, res) => {
  console.log('🔄 Intelligence API: /batch 요청 수신');
  
  try {
    const { documents, batchConfig } = req.body;
    
    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        error: 'documents 배열이 필요합니다.'
      });
    }
    
    if (documents.length > 10) {
      return res.status(400).json({
        success: false,
        error: '한 번에 최대 10개의 문서만 처리할 수 있습니다.'
      });
    }
    
    console.log(`배치 처리 시작: ${documents.length}개 문서`);
    
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const results = [];
    
    // 각 문서를 순차적으로 처리
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const jobId = `${batchId}_doc_${i + 1}`;
      
      try {
        const processRequest = {
          ...batchConfig,
          text: doc.text,
          jobId,
          patientInfo: doc.patientInfo,
          insuranceInfo: doc.insuranceInfo
        };
        
        const newReq = {
          body: processRequest
        };
        
        const mockRes = {
          json: (data: any) => data,
          status: (code: number) => ({ json: (data: any) => ({ ...data, statusCode: code }) })
        };
        
        const result = await new Promise((resolve) => {
          const originalJson = mockRes.json;
          mockRes.json = (data) => {
            resolve(data);
            return data;
          };
          
          documentHandler(newReq as any, mockRes as any);
        });
        
        results.push({
          documentIndex: i,
          jobId,
          result
        });
        
      } catch (docError: any) {
        results.push({
          documentIndex: i,
          jobId,
          error: docError.message
        });
      }
    }
    
    console.log(`배치 처리 완료: ${results.length}개 결과`);
    
    res.json({
      success: true,
      batchId,
      totalDocuments: documents.length,
      processedDocuments: results.length,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Intelligence API: /batch 오류', error);
    res.status(500).json({
      success: false,
      error: error.message || '배치 처리 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/intelligence/demo
 * @desc 데모 데이터로 시스템 테스트
 * @access Public
 */
router.get('/demo', async (req, res) => {
  console.log('🎯 Intelligence API: /demo 요청 수신');
  
  try {
    const demoText = `
환자명: 김철수 (남, 45세)
진료일: 2024-01-15
진료기관: 서울대학교병원 내과

주소: 고혈압으로 인한 두통 및 어지러움

현병력:
- 2023년 12월부터 혈압 상승 (160/100 mmHg)
- 간헐적 두통 및 어지러움 호소
- 가족력: 부친 고혈압, 당뇨병

진단:
1. 본태성 고혈압 (I10)
2. 긴장성 두통 (G44.2)

처방:
- 암로디핀 5mg 1일 1회
- 아스피린 100mg 1일 1회

계획:
- 2주 후 외래 추적관찰
- 혈압 모니터링
- 생활습관 개선 교육
    `.trim();
    
    const processRequest = {
      text: demoText,
      mode: 'BALANCED',
      outputFormat: 'MULTI_PANEL',
      jobId: `demo_${Date.now()}`,
      patientInfo: {
        name: '김철수',
        age: 45,
        gender: 'M'
      },
      insuranceInfo: {
        type: '건강보험',
        claimDate: '2024-01-15'
      }
    };
    
    const newReq = {
      body: processRequest
    };
    
    console.log('데모 처리 시작');
    await documentHandler(newReq as any, res);
    
  } catch (error: any) {
    console.error('❌ Intelligence API: /demo 오류', error);
    res.status(500).json({
      success: false,
      error: error.message || '데모 처리 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
});

// 에러 핸들링 미들웨어
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Intelligence Routes Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '파일 크기가 너무 큽니다. (최대 10MB)'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: '한 번에 하나의 파일만 업로드할 수 있습니다.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: error.message || '서버 오류가 발생했습니다.',
    timestamp: new Date().toISOString()
  });
});

export default router;

/**
 * API 사용 예시:
 * 
 * 1. 기본 텍스트 처리:
 * POST /api/intelligence/process
 * {
 *   "text": "의료문서 내용...",
 *   "mode": "BALANCED"
 * }
 * 
 * 2. 파일 업로드 처리:
 * POST /api/intelligence/upload
 * Content-Type: multipart/form-data
 * file: [텍스트 파일]
 * mode: "THOROUGH"
 * 
 * 3. 처리 상태 확인:
 * GET /api/intelligence/status/job_123456
 * 
 * 4. 성능 통계 조회:
 * GET /api/intelligence/stats
 * 
 * 5. 시스템 설정 업데이트:
 * PUT /api/intelligence/config
 * {
 *   "useNewIntelligence": true,
 *   "hybridMode": false,
 *   "costThreshold": 0.8
 * }
 * 
 * 6. 배치 처리:
 * POST /api/intelligence/batch
 * {
 *   "documents": [
 *     { "text": "문서1...", "patientInfo": {...} },
 *     { "text": "문서2...", "patientInfo": {...} }
 *   ],
 *   "batchConfig": { "mode": "FAST" }
 * }
 * 
 * 7. 데모 테스트:
 * GET /api/intelligence/demo
 */