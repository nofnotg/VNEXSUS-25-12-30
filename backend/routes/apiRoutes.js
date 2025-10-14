import express from 'express';
import { reportHandler } from '../../dist/controllers/reportController.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// import openaiService from '../../src/services/openaiService.js'; // 비활성화됨
import { GPT4oMiniEnhancedService } from '../../src/services/gpt4oMiniEnhancedService.js';
import { MedicalTimelineGenerator } from '../../src/timeline/MedicalTimelineGenerator.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// GPT-4o-mini 서비스 인스턴스 생성
const gpt4oMiniService = new GPT4oMiniEnhancedService();

// generateSimplifiedReport 함수는 파일 하단에 정의됨

router.get('/report', reportHandler);

/**
 * 🧬 DNA 시퀀싱 기반 의료 보고서 생성 (리다이렉트)
 * POST /api/generate-report
 * 
 * 이제 이 엔드포인트는 DNA 시퀀싱 파이프라인으로 요청을 전달합니다.
 */
router.post('/generate-report', async (req, res) => {
    try {
        console.log('📊 보고서 생성 요청 수신');
        console.log('요청 본문:', req.body);
        
        // DNA 시퀀싱 파이프라인으로 리다이렉트 (메인 서버의 라우트 사용)
        const dnaResponse = await fetch(`http://localhost:${process.env.PORT || 3030}/api/dna-report/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                extractedText: req.body.text || req.body.extractedText,
                sessionId: req.body.sessionId,
                patientInfo: {
                    insuranceJoinDate: req.body.insuranceJoinDate || req.body.patientInfo?.insuranceJoinDate
                }
            })
        });

        const dnaResult = await dnaResponse.json();
        
        if (dnaResult.success) {
            console.log('✅ DNA 시퀀싱 파이프라인 성공');
            res.json(dnaResult);
        } else {
            console.log('❌ DNA 시퀀싱 파이프라인 실패, 폴백 처리');
            throw new Error(dnaResult.message || 'DNA 파이프라인 실패');
        }
        
    } catch (error) {
        console.error('❌ 보고서 생성 오류:', {
            message: error.message,
            code: error.code,
            stack: error.stack?.substring(0, 500)
        });
        
        // 폴백: 단순화된 보고서 생성
        try {
            console.log('🔄 단순화된 요약표 생성 요청 - 의료지식 처리 비활성화');
            console.log('📝 입력 텍스트 길이:', (req.body.text || req.body.extractedText || '').length);
            
            const fallbackReport = generateSimplifiedReport(req.body.text || req.body.extractedText);
            
            res.json({
                success: true,
                report: fallbackReport,
                message: '단순화된 보고서가 생성되었습니다.',
                fallback: true,
                timestamp: new Date().toISOString(),
                sessionId: req.body.sessionId || `fallback_${Date.now()}`
            });
        } catch (fallbackError) {
            console.error('❌ 폴백 보고서 생성도 실패:', fallbackError);
            res.status(500).json({
                success: false,
                error: '보고서 생성 중 오류가 발생했습니다.',
                details: fallbackError.message
            });
        }
    }
});

/**
 * 의료 보고서에 대한 대화 계속하기
 * POST /api/continue-chat
 * 
 * Request Body:
 * {
 *   sessionId: string,      // 세션 ID
 *   message: string         // 사용자 메시지
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   response: string,       // AI 응답
 *   messages: Array         // 전체 대화 내역
 * }
 */
router.post('/continue-chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const sessionDir = path.join(__dirname, '../../temp/sessions');
    const sessionPath = path.join(sessionDir, `${sessionId}.json`);
    
    // 세션 데이터 로드
    if (!fs.existsSync(sessionPath)) {
      return res.status(404).json({ success: false, error: '세션을 찾을 수 없습니다' });
    }
    
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    const messages = sessionData.messages;
    
    // 새 메시지 추가
    messages.push({ role: 'user', content: message });
    
    try {
      // GPT-4o-mini API 호출하여 응답 생성
      console.log('🤖 GPT-4o-mini API를 통한 대화 응답 생성 중...');
      
      // GPT-4o-mini 서비스를 사용하여 채팅 응답 생성
      const chatInput = {
        ocrText: message,
        patientInfo: sessionData.patientInfo,
        messages: messages
      };
      
      const aiResult = await gpt4oMiniService.generateMedicalReport(chatInput, {
        mode: 'chat',
        temperature: 0.7
      });
      
      const aiResponse = aiResult.report || aiResult.response || '응답을 생성할 수 없습니다.';
      
      // 응답 저장
      messages.push({ role: 'assistant', content: aiResponse });
      fs.writeFileSync(sessionPath, JSON.stringify({
        ...sessionData,
        messages,
        lastUpdated: new Date().toISOString()
      }));
      
      res.json({ success: true, response: aiResponse, messages });
    } catch (apiError) {
      console.error('⚠️ GPT-4o-mini API 호출 오류:', apiError);
      
      if (apiError.response) {
        console.error('📊 응답 상태:', apiError.response.status);
        console.error('📄 응답 데이터:', JSON.stringify(apiError.response.data));
      }
      
      return res.status(500).json({
        success: false,
        error: '채팅 응답 생성 중 API 오류: ' + apiError.message
      });
    }
  } catch (error) {
    console.error('채팅 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 테스트 문서 로드 API
 * GET /api/load-test-document
 * 
 * Response:
 * {
 *   success: boolean,
 *   content: string         // 테스트 문서 내용
 * }
 */
router.get('/load-test-document', (req, res) => {
  try {
    const testFilePath = path.join(__dirname, '../../documents/uploads/codebooks/report_test_text.txt');
    if (fs.existsSync(testFilePath)) {
      // UTF-8로 읽기 시도
      const content = fs.readFileSync(testFilePath, 'utf-8');
      res.json({ success: true, content });
    } else {
      res.status(404).json({ success: false, error: '테스트 파일을 찾을 수 없습니다' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 텍스트 필터링 결과 API
 * GET /api/postprocess/filter
 * 
 * Query Parameters:
 * - jobId: 작업 ID
 * - type: 필터 유형 ('exclude' 또는 'retain')
 * 
 * Response:
 * {
 *   success: boolean,
 *   text: string         // 필터링된 텍스트
 * }
 */
router.get('/postprocess/filter', async (req, res) => {
  try {
    const { jobId, type } = req.query;
    
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId가 필요합니다.' });
    }
    
    // 작업 디렉터리 경로
    const jobDir = path.join(__dirname, '../../outputs', jobId);
    
    // 원본 텍스트 파일
    const sourceTextPath = path.join(jobDir, 'extracted_text.txt');
    let sourceText = '';
    
    if (fs.existsSync(sourceTextPath)) {
      sourceText = fs.readFileSync(sourceTextPath, 'utf-8');
    } else {
      // 원본 텍스트가 없으면 결과 파일에서 찾아봄
      const resultJsonPath = path.join(jobDir, 'results.json');
      if (fs.existsSync(resultJsonPath)) {
        const results = JSON.parse(fs.readFileSync(resultJsonPath, 'utf-8'));
        // 모든 파일의 텍스트 합치기
        sourceText = Object.values(results.results || {})
          .map(fileData => fileData.mergedText || '')
          .join('\n\n');
      }
    }
    
    if (!sourceText) {
      return res.status(404).json({ success: false, error: '원본 텍스트를 찾을 수 없습니다.' });
    }
    
    // 필터링 유형에 따라 다른 처리
    let filteredText = '';
    const dictionaryPath = path.join(__dirname, '../../backend/postprocess/dictionary.json');
    const removalCategoriesPath = path.join(__dirname, '../../documents/uploads/codebooks/removal_categories_total.json');
    const retainKeywordsPath = path.join(__dirname, '../../documents/uploads/codebooks/conditional_removal_total.txt');
    
    // 딕셔너리 로드
    let dictionary = {};
    if (fs.existsSync(dictionaryPath)) {
      dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf-8'));
    }
    
    // 소거 카테고리 로드
    let removalCategories = [];
    if (fs.existsSync(removalCategoriesPath)) {
      removalCategories = JSON.parse(fs.readFileSync(removalCategoriesPath, 'utf-8'));
    }
    
    // 유지 키워드 로드
    let retainKeywords = [];
    if (fs.existsSync(retainKeywordsPath)) {
      retainKeywords = fs.readFileSync(retainKeywordsPath, 'utf-8')
        .split('\n')
        .filter(line => line.trim() !== '');
    }
    
    if (type === 'exclude') {
      // 소거키워드 필터링 적용 (제외 키워드만 적용)
      filteredText = applyExcludeFiltering(sourceText, removalCategories);
    } else if (type === 'retain') {
      // Retain 키워드 필터링 적용 (유지 키워드 적용)
      filteredText = applyRetainFiltering(sourceText, retainKeywords);
    } else {
      filteredText = sourceText; // 기본값
    }
    
    res.json({
      success: true,
      text: filteredText
    });
  } catch (error) {
    console.error('필터링 API 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '필터링 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 소거키워드 필터링 적용 함수
 * @param {string} text 원본 텍스트
 * @param {Array} categories 소거 카테고리 목록
 * @returns {string} 필터링된 텍스트
 */
function applyExcludeFiltering(text, categories) {
  let filteredText = text;
  
  // 각 카테고리별 키워드 처리
  categories.forEach(category => {
    if (category.keywords && Array.isArray(category.keywords)) {
      category.keywords.forEach(keyword => {
        // 정규식으로 키워드 교체
        const regex = new RegExp(keyword, 'gi');
        filteredText = filteredText.replace(regex, '[필터링됨]');
      });
    }
  });
  
  return filteredText;
}

/**
 * Retain 키워드 필터링 적용 함수
 * @param {string} text 원본 텍스트
 * @param {Array} retainKeywords 유지할 키워드 목록
 * @returns {string} 필터링된 텍스트
 */
function applyRetainFiltering(text, retainKeywords) {
  // 우선 소거키워드 필터링 된 텍스트 준비
  const excludeFiltered = applyExcludeFiltering(text, []);
  
  // 유지 키워드가 포함된 줄만 보존
  const lines = excludeFiltered.split('\n');
  const filteredLines = lines.filter(line => {
    // 빈 줄은 유지
    if (line.trim() === '') return true;
    
    // 유지 키워드가 하나라도 포함되어 있으면 유지
    return retainKeywords.some(keyword => line.includes(keyword));
  });
  
  return filteredLines.join('\n');
}

/**
 * 단순화된 보고서 생성 함수 (폴백용)
 * @param {string} text 입력 텍스트
 * @returns {string} 프론트엔드 호환 보고서 텍스트
 */
function generateSimplifiedReport(text) {
  if (!text || typeof text !== 'string') {
    return `=== 의료 보고서 (단순화 버전) ===

[시스템 알림] 입력 텍스트가 없어 보고서를 생성할 수 없습니다.

생성 시간: ${new Date().toLocaleString('ko-KR')}
처리 방식: 단순화된 폴백 처리`;
  }

  const lines = text.split('\n').filter(line => line.trim() !== '');
  const wordCount = text.split(/\s+/).filter(word => word.trim() !== '').length;
  
  // 간단한 키워드 추출 및 분석
  const medicalKeywords = [
    '진단', '치료', '검사', '수술', '처방', '증상', '질병', '환자',
    '의료', '병원', '클리닉', '약물', '투약', '처치', '소견', '판독',
    '입원', '외래', '응급', '수술', '재활', '통증', '발열', '혈압'
  ];
  
  const keyPoints = [];
  const medicalContent = [];
  
  lines.forEach((line, index) => {
    const hasKeyword = medicalKeywords.some(keyword => line.includes(keyword));
    if (hasKeyword) {
      if (keyPoints.length < 5) {
        keyPoints.push({
          line: index + 1,
          content: line.trim(),
          type: 'medical_content'
        });
      }
      medicalContent.push(line.trim());
    }
  });
  
  // 프론트엔드 호환 보고서 형식으로 생성
  const reportText = `=== 의료 보고서 (단순화 버전) ===

[시스템 알림] AI 서비스 연결 실패로 인해 단순화된 보고서를 제공합니다.

■ 문서 기본 정보
- 총 라인 수: ${lines.length}줄
- 총 단어 수: ${wordCount}단어
- 의료 관련 내용: ${medicalContent.length}개 항목 식별

■ 주요 의료 내용 (최대 5개)
${keyPoints.length > 0 ? 
  keyPoints.map((point, idx) => `${idx + 1}. ${point.content}`).join('\n') :
  '의료 관련 키워드가 식별되지 않았습니다.'
}

■ 전체 문서 내용 요약
${medicalContent.length > 0 ? 
  `의료 문서로 판단되며, ${medicalContent.length}개의 의료 관련 내용이 포함되어 있습니다.` :
  '일반 문서로 판단되며, 특별한 의료 내용이 식별되지 않았습니다.'
}

■ 처리 정보
- 생성 시간: ${new Date().toLocaleString('ko-KR')}
- 처리 방식: 단순화된 폴백 처리 (AI 서비스 미사용)
- 상태: 기본 텍스트 분석 완료

[참고] 정확한 의료 분석을 위해서는 AI 서비스 연결이 필요합니다.`;

  return reportText;
}

export default router;