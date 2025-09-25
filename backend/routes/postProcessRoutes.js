/**
 * Post-Processing Routes
 * 
 * 역할:
 * 1. 후처리 API 엔드포인트 제공
 * 2. 메인 앱과 개발자 스튜디오 연동
 * 3. 거대 날짜 블록 처리 API
 * 4. 엔드-투-엔드 파이프라인 API
 */

import express from 'express';
import PostProcessingManager from '../postprocess/index.js';

const router = express.Router();

/**
 * POST /api/postprocess/process
 * 메인 후처리 파이프라인 실행
 */
router.post('/process', async (req, res) => {
  try {
    const { ocrText, options = {} } = req.body;
    
    if (!ocrText) {
      return res.status(400).json({
        success: false,
        error: 'OCR 텍스트가 필요합니다.',
        code: 'MISSING_OCR_TEXT'
      });
    }
    
    console.log('📝 후처리 요청 수신:', {
      textLength: ocrText.length,
      options: Object.keys(options)
    });
    
    const result = await PostProcessingManager.processOCRResult(ocrText, options);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 후처리 API 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'POSTPROCESS_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/postprocess/main-app
 * 메인 앱용 간소화된 후처리
 */
router.post('/main-app', async (req, res) => {
  try {
    const { ocrText, options = {} } = req.body;
    
    if (!ocrText) {
      return res.status(400).json({
        success: false,
        error: 'OCR 텍스트가 필요합니다.',
        code: 'MISSING_OCR_TEXT'
      });
    }
    
    console.log('📱 메인 앱 후처리 요청:', {
      textLength: ocrText.length,
      options: Object.keys(options)
    });
    
    const result = await PostProcessingManager.processForMainApp(ocrText, options);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 메인 앱 후처리 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'MAIN_APP_POSTPROCESS_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/postprocess/debug
 * 개발자 스튜디오용 디버깅 정보
 */
router.post('/debug', async (req, res) => {
  try {
    const { ocrText, options = {} } = req.body;
    
    if (!ocrText) {
      return res.status(400).json({
        success: false,
        error: 'OCR 텍스트가 필요합니다.',
        code: 'MISSING_OCR_TEXT'
      });
    }
    
    console.log('🔧 디버깅 정보 요청:', {
      textLength: ocrText.length,
      options: Object.keys(options)
    });
    
    const result = await PostProcessingManager.getDebugInfo(ocrText, options);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 디버깅 정보 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'DEBUG_INFO_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/postprocess/massive-date-blocks
 * 거대 날짜 블록 처리 전용 API
 */
router.post('/massive-date-blocks', async (req, res) => {
  try {
    const { ocrText, options = {} } = req.body;
    
    if (!ocrText) {
      return res.status(400).json({
        success: false,
        error: 'OCR 텍스트가 필요합니다.',
        code: 'MISSING_OCR_TEXT'
      });
    }
    
    console.log('📅 거대 날짜 블록 처리 요청:', {
      textLength: ocrText.length,
      options: Object.keys(options)
    });
    
    // 거대 날짜 블록 처리만 실행
    const result = await PostProcessingManager.massiveDateProcessor.processMassiveDateBlocks(ocrText, options);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 거대 날짜 블록 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'MASSIVE_DATE_BLOCK_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/postprocess/stats
 * 후처리 통계 조회
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = PostProcessingManager.getProcessingStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'STATS_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/postprocess/reset-stats
 * 후처리 통계 초기화
 */
router.post('/reset-stats', async (req, res) => {
  try {
    PostProcessingManager.resetStats();
    
    res.json({
      success: true,
      message: '통계가 초기화되었습니다.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 통계 초기화 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'RESET_STATS_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/postprocess/end-to-end
 * 엔드-투-엔드 파이프라인 (파일 업로드부터 AI 보고서까지)
 */
router.post('/end-to-end', async (req, res) => {
  try {
    const { fileData, fileName, options = {} } = req.body;
    
    if (!fileData) {
      return res.status(400).json({
        success: false,
        error: '파일 데이터가 필요합니다.',
        code: 'MISSING_FILE_DATA'
      });
    }
    
    console.log('🔄 엔드-투-엔드 파이프라인 시작:', {
      fileName,
      fileSize: fileData.length,
      options: Object.keys(options)
    });
    
    // TODO: 실제 구현에서는 다음 단계들이 포함되어야 함:
    // 1. 파일 업로드 처리
    // 2. OCR 호출
    // 3. 후처리 실행
    // 4. AI 보고서 생성
    
    // 현재는 OCR 텍스트가 이미 있다고 가정하고 후처리만 실행
    const ocrText = fileData; // 임시로 fileData를 OCR 텍스트로 사용
    
    const result = await PostProcessingManager.processOCRResult(ocrText, {
      ...options,
      useAIExtraction: true, // 엔드-투-엔드에서는 AI 추출 사용
      fileName
    });
    
    res.json({
      success: true,
      data: {
        ...result,
        pipeline: 'end-to-end',
        fileName
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 엔드-투-엔드 파이프라인 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'END_TO_END_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/postprocess/health
 * 후처리 시스템 상태 확인
 */
router.get('/health', async (req, res) => {
  try {
    const stats = PostProcessingManager.getProcessingStats();
    
    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      processingStats: stats,
      components: {
        massiveDateProcessor: 'active',
        dateOrganizer: 'active',
        preprocessor: 'active',
        reportBuilder: 'active',
        aiEntityExtractor: 'active'
      }
    };
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 헬스체크 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'HEALTH_CHECK_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;