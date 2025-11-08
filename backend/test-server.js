import express from 'express';
import cors from 'cors';
import path from 'path';

// 날짜 추출 서비스 import
import { advancedDateService } from '../src/modules/medical-analysis/service/advancedDateService.js';

const app = express();
const PORT = process.env.PORT || 3030;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: 'Advanced Date Extraction Test Server',
    status: 'running',
    endpoints: [
      'POST /api/v2/medical-analysis/advanced-date/extract',
      'POST /api/v2/medical-analysis/advanced-date/extract/batch',
      'GET /api/v2/medical-analysis/advanced-date/health'
    ]
  });
});

// 단일 텍스트 날짜 추출
app.post('/api/v2/medical-analysis/advanced-date/extract', async (req, res) => {
  try {
    const { text, options } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '텍스트가 필요합니다.'
      });
    }

    console.log(`[${new Date().toISOString()}] 단일 텍스트 날짜 추출 요청:`, {
      textLength: text.length,
      options
    });
    
    const result = await advancedDateService.extractDates(text, options);
    
    console.log(`[${new Date().toISOString()}] 추출 완료:`, {
      datesFound: result.dates?.length || 0,
      confidence: result.confidence,
      processingTime: result.processingTime
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 날짜 추출 오류:`, error);
    res.status(500).json({
      success: false,
      error: `날짜 추출 중 오류 발생: ${error.message}`
    });
  }
});

// 배치 날짜 추출 엔드포인트
app.post('/api/v2/medical-analysis/advanced-date/extract/batch', async (req, res) => {
  try {
    const { texts, options } = req.body;
    
    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({
        success: false,
        error: '텍스트 배열이 필요합니다.'
      });
    }

    console.log(`[${new Date().toISOString()}] 배치 날짜 추출 요청:`, {
      textsCount: texts.length,
      options
    });
    
    const result = await advancedDateService.extractDatesBatch(texts, options);
    
    console.log(`[${new Date().toISOString()}] 배치 추출 완료:`, {
      processedCount: result?.length || 0
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 배치 날짜 추출 오류:`, error);
    res.status(500).json({
      success: false,
      error: `배치 날짜 추출 중 오류 발생: ${error.message}`
    });
  }
});

// 헬스 체크 엔드포인트
app.get('/api/v2/medical-analysis/advanced-date/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Advanced Date Extraction Test Server'
  });
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
  console.error('서버 오류:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`======================================`);
  console.log(`Advanced Date Extraction Test Server`);
  console.log(`포트 ${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT}`);
  console.log(`======================================`);
});

export default app;