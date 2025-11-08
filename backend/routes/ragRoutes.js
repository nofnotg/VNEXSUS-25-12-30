import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProgressiveRAGManager } from '../../src/rag/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Progressive RAG Manager 인스턴스 생성
const ragManager = new ProgressiveRAGManager({
  dataPath: path.join(__dirname, '../../src/rag/raw'),
  cachePath: path.join(__dirname, '../../src/rag/cache'),
  logLevel: 'info',
  autoSave: {
    enabled: true,
    interval: 300000, // 5분
    maxFiles: 100
  },
  optimization: {
    enabled: true,
    memoryOptimization: true,
    responseTimeOptimization: true
  }
});

// RAG 시스템 초기화
let ragInitialized = false;

async function initializeRAG() {
  if (!ragInitialized) {
    try {
      console.log('Progressive RAG 시스템 초기화 중...');
      await ragManager.initialize();
      ragInitialized = true;
      console.log('✅ Progressive RAG 시스템 초기화 완료');
    } catch (error) {
      console.error('❌ Progressive RAG 시스템 초기화 실패:', error);
      throw error;
    }
  }
}

// 미들웨어: RAG 시스템 초기화 확인
const ensureRAGInitialized = async (req, res, next) => {
  try {
    await initializeRAG();
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Progressive RAG 시스템 초기화 실패',
      details: error.message
    });
  }
};

// RAG 시스템 상태 확인
router.get('/status', ensureRAGInitialized, (req, res) => {
  try {
    const status = ragManager.getSystemStatus();
    res.json({
      success: true,
      status: 'active',
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'RAG 시스템 상태 조회 실패',
      details: error.message
    });
  }
});

// 의료 용어 검색
router.post('/search/medical-terms', ensureRAGInitialized, async (req, res) => {
  try {
    const { query, limit = 10, threshold = 0.7 } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: '검색 쿼리가 필요합니다'
      });
    }

    const results = await ragManager.searchMedicalTerms(query, {
      limit: parseInt(limit),
      threshold: parseFloat(threshold)
    });

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '의료 용어 검색 실패',
      details: error.message
    });
  }
});

// ICD 코드 검색
router.post('/search/icd-codes', ensureRAGInitialized, async (req, res) => {
  try {
    const { query, limit = 10, threshold = 0.7 } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: '검색 쿼리가 필요합니다'
      });
    }

    const results = await ragManager.searchICDCodes(query, {
      limit: parseInt(limit),
      threshold: parseFloat(threshold)
    });

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'ICD 코드 검색 실패',
      details: error.message
    });
  }
});

// 의료 문서 분석
router.post('/analyze', ensureRAGInitialized, async (req, res) => {
  try {
    const { text, analysisType = 'comprehensive', options = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '분석할 텍스트가 필요합니다'
      });
    }

    const analysis = await ragManager.analyzeDocument(text, {
      type: analysisType,
      ...options
    });

    res.json({
      success: true,
      data: {
        analysisType,
        analysis,
        textLength: text.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '의료 문서 분석 실패',
      details: error.message
    });
  }
});

// 분석 결과 저장
router.post('/save-analysis', ensureRAGInitialized, async (req, res) => {
  try {
    const { analysisId, data, metadata = {} } = req.body;
    
    if (!analysisId || !data) {
      return res.status(400).json({
        success: false,
        error: '분석 ID와 데이터가 필요합니다'
      });
    }

    const result = await ragManager.saveAnalysis(analysisId, data, metadata);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '분석 결과 저장 실패',
      details: error.message
    });
  }
});

// 저장된 분석 결과 조회
router.get('/analysis/:analysisId', ensureRAGInitialized, async (req, res) => {
  try {
    const { analysisId } = req.params;
    
    const analysis = await ragManager.getAnalysis(analysisId);
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: '분석 결과를 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '분석 결과 조회 실패',
      details: error.message
    });
  }
});

// 캐시 관리
router.post('/cache/clear', ensureRAGInitialized, async (req, res) => {
  try {
    const { type = 'all' } = req.body;
    
    await ragManager.clearCache(type);

    res.json({
      success: true,
      message: `${type} 캐시가 성공적으로 삭제되었습니다`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '캐시 삭제 실패',
      details: error.message
    });
  }
});

// 캐시 상태 조회
router.get('/cache/status', ensureRAGInitialized, (req, res) => {
  try {
    const cacheStatus = ragManager.getCacheStatus();

    res.json({
      success: true,
      data: cacheStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '캐시 상태 조회 실패',
      details: error.message
    });
  }
});

// 성능 메트릭 조회
router.get('/metrics', ensureRAGInitialized, (req, res) => {
  try {
    const metrics = ragManager.getPerformanceMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '성능 메트릭 조회 실패',
      details: error.message
    });
  }
});

// 시스템 최적화 실행
router.post('/optimize', ensureRAGInitialized, async (req, res) => {
  try {
    const { type = 'full' } = req.body;
    
    const result = await ragManager.optimize(type);

    res.json({
      success: true,
      data: result,
      message: '시스템 최적화가 완료되었습니다',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '시스템 최적화 실패',
      details: error.message
    });
  }
});

export default router;