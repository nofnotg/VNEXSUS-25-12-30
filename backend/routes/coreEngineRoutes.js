// coreEngineRoutes.js - 코어엔진 통합 API 라우트
import express from 'express';
const router = express.Router();

// 서비스 및 유틸리티 import
import coreEngineService from '../services/coreEngineService.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * POST /api/core-engine/analyze
 * 코어엔진 통합 분석 엔드포인트
 * 
 * 요청 본문:
 * - extractedText: string | string[] - 추출된 텍스트
 * - patientInfo?: { name?, id?, sex?, birth? } - 환자 정보
 * - contractDate?: string - 계약일 (YYYY-MM-DD)
 * - claimDiagnosis?: string - 원문 진단명
 * - qualityLevel?: 'draft'|'standard'|'rigorous' - 품질 수준
 * - options?: { allowModel?, temperature?, locale? } - 옵션
 */
router.post('/analyze', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 요청 검증
    const { 
      extractedText, 
      patientInfo, 
      contractDate, 
      claimDiagnosis, 
      qualityLevel = 'standard',
      options = {}
    } = req.body;

    if (!extractedText) {
      return res.status(400).json({
        error: 'CE-INGEST-001',
        message: 'extractedText is required'
      });
    }

    // 코어엔진 서비스 호출
    const result = await coreEngineService.analyze({
      extractedText,
      patientInfo,
      contractDate,
      claimDiagnosis,
      qualityLevel,
      options
    });

    const elapsedMs = Date.now() - startTime;
    
    // 응답 구조
    const response = {
      sections: result.sections,
      entities: result.entities,
      anchors: result.anchors,
      events: result.events,
      evidence: result.evidence,
      metrics: {
        ...result.metrics,
        elapsedMs
      },
      warnings: result.warnings || []
    };

    res.json(response);

  } catch (error) {
    console.error('Core Engine Analysis Error:', error);
    
    // 에러 코드 매핑
    let errorCode = 'CE-SYN-008'; // 기본 합성 에러
    if (error.code && error.code.startsWith('CE-')) {
      errorCode = error.code;
    }

    res.status(500).json({
      error: errorCode,
      message: error.message || 'Core engine analysis failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/core-engine/health
 * 코어엔진 상태 확인
 */
router.get('/health', async (req, res) => {
  try {
    const health = await coreEngineService.getHealthStatus();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/core-engine/config
 * 코어엔진 설정 조회
 */
router.get('/config', async (req, res) => {
  try {
    const config = await coreEngineService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: 'CE-CONFIG-001',
      message: error.message
    });
  }
});

export default router;