/**
 * 의료 보고서 생성 API 테스트 서버
 * 
 * OpenAI GPT-4 Turbo API를 테스트하기 위한 간단한 Express 서버
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import aiReportGenerator from './modules/ai-report-generator/index.js';
import { MedicalTimelineGenerator } from './timeline/MedicalTimelineGenerator.js';
import openaiService from './services/openaiService.js';
import bodyParser from 'body-parser';
import fs from 'fs';
import axios from 'axios';

// 새로운 구조화된 라우트 import (CommonJS 모듈을 동적으로 import)
let advancedDateRoutes;
let middlewares;

// 동적 import를 사용하여 CommonJS 모듈 로드
async function loadModules() {
  const advancedDateModule = await import('./modules/medical-analysis/routes/advancedDateRoutes.js');
  advancedDateRoutes = advancedDateModule.default || advancedDateModule;
  
  const middlewareModule = await import('./shared/middleware/index.js');
  middlewares = middlewareModule;
}

// 환경 변수 로드
dotenv.config();
console.log('OpenAI API 키 설정 상태:', process.env.OPENAI_API_KEY ? '설정됨' : '설정되지 않음');

// __dirname 설정 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3030;

// 서버 시작 함수
async function startServer() {
  // 모듈 로드
  await loadModules();
  
  // 미들웨어
  app.use(middlewares.securityHeadersMiddleware);
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.static(path.join(__dirname, '../public')));
  app.use(middlewares.requestLoggingMiddleware);

  // 새로운 구조화된 API 라우트
  app.use('/api/v2/medical-analysis', advancedDateRoutes);

// 디버깅을 위한 에러 핸들러 미들웨어
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({
    success: false,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 루트 경로
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 테스트 페이지 경로 - 실제 애플리케이션 통합용
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API 엔드포인트: 메인 보고서 생성
app.post('/api/generate-report', async (req, res) => {
  try {
    const { text, patientInfo } = req.body;
    
    console.log(`💬 요청 받음: ${text.length}자 텍스트 처리 중...`);
    console.log('📋 환자 정보:', JSON.stringify(patientInfo));
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '텍스트가 없습니다. 의료 텍스트를 입력해주세요.'
      });
    }
    
    let report;
    let events = [];
    
    // 타임라인 생성
    const generator = new MedicalTimelineGenerator();
    
    console.log('🔍 이벤트 추출 시작...');
    events = generator.extractEvents(text);
    
    console.log(`✅ 이벤트 추출 완료: ${events.length}개 이벤트`);
    if (events.length > 0) {
      console.log('📊 이벤트 샘플:', JSON.stringify(events[0]));
    }
    
    try {
      // OpenAI GPT-4 Turbo API 호출하여 보고서 생성
      console.log('🤖 OpenAI GPT-4 Turbo API를 통한 보고서 생성 시작...');
      
      const structuredData = {
        basic_info: {
          ...patientInfo,
          insurance: [
            {
              company: patientInfo.insurance || '테스트보험',
              product: patientInfo.product || '테스트상품',
              start_date: patientInfo.enrollmentDate || new Date().toISOString().split('T')[0]
            }
          ]
        },
        events: events
      };
      
      console.log('📤 구조화된 데이터:', JSON.stringify(structuredData).substring(0, 500) + '...');
      
      // OpenAI API 호출
      report = await openaiService.generateMedicalReport(structuredData);
      console.log('📄 보고서 생성 완료');
    } catch (apiError) {
      console.error('⚠️ OpenAI API 호출 오류 상세 내용:', apiError);
      if (apiError.response) {
        console.error('📊 API 응답 상태:', apiError.response.status);
        console.error('📄 API 응답 데이터:', JSON.stringify(apiError.response.data));
      }
      
      console.log('⚙️ 대체 보고서 생성 중...');
      report = generateDummyReport(patientInfo, events);
      console.log('📄 대체 보고서 생성 완료');
    }
    
    // 세션 저장 (대화 연속성을 위해)
    const sessionId = Date.now().toString();
    const sessionDir = path.join(__dirname, '../temp/sessions');
    const sessionPath = path.join(sessionDir, `${sessionId}.json`);
    
    // 디렉토리 생성
    fs.mkdirSync(sessionDir, { recursive: true });
    
    // 세션 데이터 저장
    fs.writeFileSync(sessionPath, JSON.stringify({
      sessionId,
      messages: [
        { role: 'user', content: `의료 보고서를 생성해주세요. 환자 정보: ${JSON.stringify(patientInfo)}` },
        { role: 'assistant', content: report }
      ],
      patientInfo,
      events,
      timestamp: new Date().toISOString()
    }));
    
    res.json({ 
      success: true, 
      report, 
      sessionId,
      eventCount: events.length
    });
  } catch (error) {
    console.error('보고서 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API 엔드포인트: 대화 이어가기
app.post('/api/continue-chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const sessionPath = path.join(__dirname, '../temp/sessions', `${sessionId}.json`);
    
    // 세션 데이터 로드
    if (!fs.existsSync(sessionPath)) {
      return res.status(404).json({ success: false, error: '세션을 찾을 수 없습니다' });
    }
    
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    const messages = sessionData.messages;
    
    // 새 메시지 추가
    messages.push({ role: 'user', content: message });
    
    try {
      // OpenAI API 호출하여 응답 생성
      console.log('🤖 OpenAI API를 통한 대화 응답 생성 중...');
      const aiResponse = await openaiService.generateChatResponse(messages, {
        patientInfo: sessionData.patientInfo
      });
      
      // 응답 저장
      messages.push({ role: 'assistant', content: aiResponse });
      fs.writeFileSync(sessionPath, JSON.stringify({
        ...sessionData,
        messages,
        lastUpdated: new Date().toISOString()
      }));
      
      res.json({ success: true, response: aiResponse, messages });
    } catch (apiError) {
      console.error('⚠️ OpenAI API 호출 오류:', apiError);
      
      // 간단한 응답 생성
      const responses = [
        '의료 보고서에 대해 궁금한 점이 있으신가요?',
        '의학 용어에 대해 설명해 드릴까요?',
        '보고서에 있는 병력 사항에 대해 더 자세히 알고 싶으신가요?',
        '보험 청구와 관련된 질문이 있으신가요?',
        '다른 정보가 필요하신가요?'
      ];
      
      // 단순한 키워드 기반 응답
      let aiResponse = '⚠️ API 응답 오류로 인해 간단 응답으로 대체합니다. ';
      
      // 간단한 키워드 매칭
      if (message.includes('의료') || message.includes('병력') || message.includes('진단')) {
        aiResponse += '의료 기록은 환자의 진단, 처방, 처치 등의 정보를 포함합니다.';
      } else if (message.includes('보험') || message.includes('청구') || message.includes('가입')) {
        aiResponse += '보험 청구 시 이 보고서를 참고하시면 도움이 됩니다.';
      } else if (message.includes('날짜') || message.includes('기간') || message.includes('언제')) {
        aiResponse += '날짜별로 정렬된 의료 기록을 통해 시간 순서를 확인할 수 있습니다.';
      } else {
        // 랜덤 응답
        aiResponse += responses[Math.floor(Math.random() * responses.length)];
      }
      
      // 응답 저장
      messages.push({ role: 'assistant', content: aiResponse });
      fs.writeFileSync(sessionPath, JSON.stringify({
        ...sessionData,
        messages,
        lastUpdated: new Date().toISOString()
      }));
      
      res.json({ success: true, response: aiResponse, messages });
    }
  } catch (error) {
    console.error('채팅 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 샘플 보고서 생성 함수 (API 호출 실패 시 대체용)
function generateDummyReport(patientInfo, events) {
  // 가입일과 생년월일 포맷팅
  const enrollmentDate = patientInfo.enrollmentDate || new Date().toISOString().split('T')[0];
  const dob = patientInfo.dob || '1990-01-01';
  
  // 환자 정보 구조화
  const patientName = patientInfo.name || '홍길동';
  const insuranceName = patientInfo.insurance || '테스트보험';
  const productName = patientInfo.product || '테스트상품';
  
  // 3개월/5년 내 이벤트 카운트
  const enrollmentDateObj = new Date(enrollmentDate);
  const threeMonthsAgo = new Date(enrollmentDateObj);
  threeMonthsAgo.setMonth(enrollmentDateObj.getMonth() - 3);
  
  const fiveYearsAgo = new Date(enrollmentDateObj);
  fiveYearsAgo.setFullYear(enrollmentDateObj.getFullYear() - 5);
  
  let within3Months = 0;
  let within5Years = 0;
  
  events.forEach(event => {
    try {
      const eventDate = new Date(event.date);
      if (eventDate >= threeMonthsAgo && eventDate <= enrollmentDateObj) {
        within3Months++;
      }
      if (eventDate >= fiveYearsAgo && eventDate <= enrollmentDateObj) {
        within5Years++;
      }
    } catch (e) {
      console.error('날짜 변환 오류:', e);
    }
  });
  
  // 이벤트 정렬 (최신순)
  events.sort((a, b) => {
    try {
      return new Date(b.date) - new Date(a.date);
    } catch (e) {
      return 0;
    }
  });
  
  // 마크다운 보고서 생성
  let report = `# 피보험자 병력사항 요약 경과표

## 기본 정보
- **피보험자명**: ${patientName}
- **생년월일**: ${dob}
- **가입일**: ${enrollmentDate}
- **보험사**: ${insuranceName}
- **상품명**: ${productName}

## 요약 통계
- **총 의료 이벤트**: ${events.length}건
- **3개월 이내**: ${within3Months}건
- **5년 이내**: ${within5Years}건

## 병력 사항 상세

| 날짜 | 병원 | 내용 요약 | 키워드 |
|------|------|-----------|--------|
`;

  // 이벤트 목록 추가
  events.forEach(event => {
    try {
      const eventDate = new Date(event.date);
      const tag = eventDate >= threeMonthsAgo && eventDate <= enrollmentDateObj ? '[3M] ' : 
                 eventDate >= fiveYearsAgo && eventDate <= enrollmentDateObj ? '[5Y] ' : '';
      
      report += `| ${tag}${event.date} | ${event.institution || '미상'} | ${event.description} | ${event.keywords || '-'} |\n`;
    } catch (e) {
      console.error('보고서 생성 오류:', e);
    }
  });
  
  // 주의사항 추가
  report += `
## 참고사항
- 3개월 이내 의료 이벤트는 [3M] 태그로 표시됩니다.
- 5년 이내 의료 이벤트는 [5Y] 태그로 표시됩니다.
- 이 보고서는 자동 생성되었으며, 의료 전문가의 검토가 필요할 수 있습니다.
`;
  
  return report;
}

// 테스트 문서 로드 API
app.get('/api/load-test-document', (req, res) => {
  try {
    const testFilePath = path.join(__dirname, '../documents/uploads/codebooks/report_test_text.txt');
    if (fs.existsSync(testFilePath)) {
      // 다양한 인코딩 시도 (CP949, EUC-KR)
      const content = fs.readFileSync(testFilePath);
      const iconv = require('iconv-lite');
      let decodedContent;
      
      try {
        // CP949 인코딩 시도 (마이크로소프트 확장 한글 인코딩)
        decodedContent = iconv.decode(content, 'cp949');
      } catch (encError) {
        console.log('CP949 디코딩 실패, EUC-KR 시도 중...');
        try {
          // EUC-KR 인코딩 시도
          decodedContent = iconv.decode(content, 'euc-kr');
        } catch (encError2) {
          // 마지막 대안으로 UTF-8 시도
          decodedContent = content.toString('utf-8');
        }
      }
      
      res.json({ success: true, content: decodedContent });
    } else {
      res.status(404).json({ success: false, error: '테스트 파일을 찾을 수 없습니다' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 기존 앱 프록시 (실제 앱이 작동 중일 때)
app.use((req, res, next) => {
  // /api/로 시작하는 경로와 테스트 관련 경로가 아닌 경우에만 프록시
  if (!req.path.startsWith('/api/') && req.path !== '/' && req.path !== '/test') {
    // 프록시 대신 메인 앱으로 리다이렉트
    console.log(`↪️ 메인 앱으로 리다이렉트: ${req.path}`);
    res.redirect(`http://localhost:${process.env.MAIN_PORT || 8888}${req.path}`);
  } else {
    next();
  }
});

  // 404 및 에러 핸들링 미들웨어 (모든 라우트 뒤에 배치)
  app.use(middlewares.notFoundMiddleware);
  app.use(middlewares.errorHandlingMiddleware);

  // 서버 시작
  app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📊 테스트 페이지: http://localhost:${PORT}/test`);
    console.log(`🏥 새로운 고급 날짜 분석 API: http://localhost:${PORT}/api/v2/medical-analysis/advanced-date`);
  });
}

// 서버 시작 실행
startServer().catch(console.error);