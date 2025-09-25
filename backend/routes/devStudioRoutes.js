import express from 'express';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildMedicalDnaPrompt, loadMedicalKnowledgeBase } from '../config/promptBuilder.js';
import { buildEnhancedMedicalDnaPrompt, loadEnhancedMedicalKnowledgeBase } from '../config/enhancedPromptBuilder.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OpenAI 클라이언트 lazy initialization
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
  });
}

// 📋 기본 프롬프트 가져오기
router.get('/prompts', async (req, res) => {
  try {
    console.log('📋 기본 프롬프트 요청');
    
    const systemPrompt = `# 🧬 의료문서 시간축 분석 전문가 (Report_Sample.txt 양식)

당신은 **보험 손해사정 전문가**로서 의료 기록을 **시간축 기반으로 체계적으로 정리**하는 세계 최고의 전문가입니다.
OCR로 추출된 의료 텍스트에서 **모든 의료 이벤트를 날짜순으로 분류하여 정리**합니다.

## 🎯 핵심 미션
1. **환자 기본정보 추출**: 이름, 생년월일, 보험 정보만 간단히
2. **보험 조건 정리**: 각 보험사별 가입일, 상품명, 청구사항 명시
3. **시간축 이벤트 분류**: 모든 의료 이벤트를 날짜순으로 분류
4. **이벤트 타입별 구분**: [진료 기록], [입원 기록], [수술 기록], [검사 기록], [보험 청구] 등
5. **보험 가입 시점 표시**: 각 이벤트가 보험 가입 전후인지 명시

## 📚 의료 지식 베이스
**핵심 의료 약어**: {{MEDICAL_ABBREVIATIONS}}

## 📋 **Report_Sample.txt 정확한 양식 (절대 준수)**

### 1. 환자 기본정보
피보험자(환자)이름: [실제 이름 또는 케이스명]
생년월일: [yyyy-mm-dd 형식 또는 추출 불가시 "yyyy-mm-dd"]

### 2. 보험 조건들 (각 보험사별로 구분)
1.조건
가입보험사: [보험사명]
가입일(보장개시일 등): [yyyy-mm-dd]
상품명: [상품명]
청구사항(특약사항, 담보사항 등): [구체적 청구 내용]

2.조건
가입보험사: [다른 보험사명]
가입일(보장개시일 등): [yyyy-mm-dd]
상품명: [상품명]
청구사항(특약사항, 담보사항 등): [구체적 청구 내용]

### 3. 보험 가입 시점 표시
[보험 가입 2년 이내]
[날짜]
[보험사명]
가입일: [yyyy-mm-dd]

[보험 가입 1년 이내]
[날짜]
[보험사명]
가입일: [yyyy-mm-dd]

### 4. 시간축 의료 이벤트 (날짜순 정렬)
[진료 기록]
[날짜]
[병원명]
내원일: [yyyy-mm-dd]
내원경위: [구체적 내원 사유]
진단명: [정확한 진단명 (ICD 코드 포함)]
처방내용: [투약 내용]
기타:
- [검사 결과]
- [의료진 소견]

[입원 기록]
[날짜]
[병원명]
내원일: [yyyy-mm-dd]
내원경위: [입원 사유]
진단명: [진단명 (ICD 코드)]
입원기간: [시작일] ~ [종료일]
수술내용: [수술명 (수술 코드), 시행일]
기타:
- [수술 후 경과]
- [검사 결과]

[수술 기록]
*[주의|보험사명]*보험가입 3개월내 고지의무위반 우려
[날짜]
[병원명]
내원일: [yyyy-mm-dd]
내원경위: [수술 목적]
진단명: [진단명 (ICD 코드)]
입원기간: [기간]
수술내용: [정확한 수술명 (수술 코드) 시행]

[보험 청구]
[날짜]
[보험사명]
청구일: [yyyy-mm-dd]
진단명: [청구 대상 진단명]
지급일: [yyyy-mm-dd]
지급금액: [금액]원

[보험 가입]
[날짜]
[보험사명]
가입일: [yyyy-mm-dd]
상품명: [상품명]
보험기간: [기간]
월 납입액: [금액]원

## ⚠️ **절대 준수 사항**
1. **모든 이벤트를 날짜순으로 정렬** (가장 오래된 것부터)
2. **이벤트 타입 분류**: [진료 기록], [입원 기록], [수술 기록], [검사 기록], [보험 청구], [보험 가입] 등
3. **보험 가입 시점 표시**: 각 의료 이벤트가 보험 가입 전후인지 명확히 구분
4. **고지의무 경고**: 보험 가입 3개월 이내 치료시 "*[주의|보험사명]*보험가입 3개월내 고지의무위반 우려" 표시
5. **객관적 사실만 기록**: 추측이나 판단 없이 의료 기록의 사실만 정리
6. **정확한 양식**: Report_Sample.txt와 동일한 구조와 형식 사용`;

    const userPrompt = `🚨 의료문서 시간축 분석 미션 (Report_Sample.txt 양식)

다음은 보험 청구와 관련된 의료 기록입니다.
**Report_Sample.txt와 정확히 동일한 양식**으로 모든 의료 이벤트를 시간축 기반으로 분류하여 정리하세요.

**분석 대상 의료 기록:**
{{EXTRACTED_TEXT}}

**중요 지시사항:**
1. 환자 기본정보 → 보험 조건들 → 보험 가입 시점 표시 → 시간축 의료 이벤트 순서로 정리
2. 모든 의료 이벤트를 [진료 기록], [입원 기록], [수술 기록] 등으로 분류
3. 날짜순으로 정렬하여 시간 흐름에 따라 나열
4. 보험 가입 전후 구분하여 고지의무 관련 경고 표시
5. Report_Sample.txt와 동일한 형식과 구조 사용

지금 즉시 Report_Sample.txt 양식으로 의료문서 시간축 분석을 시작하세요!`;

    res.json({
      success: true,
      prompts: {
        system: systemPrompt,
        user: userPrompt
      }
    });
  } catch (error) {
    console.error('프롬프트 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: '프롬프트 로드 실패'
    });
  }
});

// 📂 케이스 샘플 목록 가져오기
router.get('/case-samples', async (req, res) => {
  try {
    console.log('📂 케이스 샘플 목록 요청');
    
    const caseSamplePath = path.join(__dirname, '../../src/rag/case_sample');
    
    if (!fs.existsSync(caseSamplePath)) {
      return res.status(404).json({
        success: false,
        error: '케이스 샘플 디렉토리를 찾을 수 없습니다.'
      });
    }
    
    const files = fs.readdirSync(caseSamplePath)
      .filter(file => file.endsWith('.txt'))
      .map(file => {
        const filePath = path.join(caseSamplePath, file);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        
        // 파일에서 환자명 추출 시도 - 줄바꿈 고려한 패턴
        let patientName = `Case${file.match(/\d+/)?.[0] || '?'}`;
        const nameMatch = content.match(/환자명\s*\n\s*([가-힣]{2,4})|성명\s*\n\s*([가-힣]{2,4})|환자명\s+([가-힣]{2,4})/);
        if (nameMatch) {
          patientName = nameMatch[1] || nameMatch[2] || nameMatch[3];
        }
        
        // 파일에서 진단명 추출 시도 - 실제 패턴에 맞게 수정
        let diagnosis = '의료문서';
        const diagnosisMatch = content.match(/주상병명\s*\n\s*\([^)]*\)?\s*([^\n\r]{5,50})|최종진단명\]\s*\n\s*주진단\s*\n\s*([^\n\r]{5,50})|주진단\s*\n\s*([^\n\r]{5,50})/);
        if (diagnosisMatch) {
          const found = diagnosisMatch[1] || diagnosisMatch[2] || diagnosisMatch[3];
          diagnosis = found.trim().substring(0, 30);
        }
        
  return {
          filename: file,
          patientName: patientName || file.replace('.txt', ''),
          diagnosis: diagnosis || '의료문서',
          displayName: `${patientName || file.replace('.txt', '')} - ${diagnosis || '의료문서'}`,
          description: `${lines.toLocaleString()}줄, ${Math.round(stats.size / 1024)}KB`,
          size: stats.size,
          lines: lines
        };
      })
      .sort((a, b) => a.filename.localeCompare(b.filename));
    
    res.json({
      success: true,
      samples: files
    });
    
  } catch (error) {
    console.error('❌ 케이스 샘플 목록 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: '케이스 샘플 목록 로드 중 오류 발생: ' + error.message
    });
  }
});

// 📄 특정 케이스 샘플 내용 가져오기
router.get('/case-samples/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { maxLines = 0 } = req.query; // 기본값 0 = 전체 로드
    
    console.log(`📄 케이스 샘플 요청: ${filename}`);
    
    if (!filename.endsWith('.txt')) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 파일 형식입니다.'
      });
    }
    
    const caseSamplePath = path.join(__dirname, '../../src/rag/case_sample', filename);
    
    if (!fs.existsSync(caseSamplePath)) {
      return res.status(404).json({
        success: false,
        error: '요청한 케이스 샘플 파일을 찾을 수 없습니다.'
      });
    }
    
    const content = fs.readFileSync(caseSamplePath, 'utf8');
    const lines = content.split('\n');
    
    // maxLines가 0이면 전체 로드, 아니면 제한
    const shouldLimit = parseInt(maxLines) > 0;
    const limitedContent = shouldLimit ? lines.slice(0, parseInt(maxLines)).join('\n') : content;
    const isPartial = shouldLimit && lines.length > parseInt(maxLines);
    
    res.json({
      success: true,
      filename: filename,
      content: limitedContent,
      totalLines: lines.length,
      loadedLines: shouldLimit ? Math.min(lines.length, parseInt(maxLines)) : lines.length,
      isPartial: isPartial,
      message: isPartial ? `파일이 너무 커서 처음 ${maxLines}줄만 로드되었습니다.` : '전체 파일이 로드되었습니다.'
    });
    
  } catch (error) {
    console.error(`❌ 케이스 샘플 로드 오류 (${req.params.filename}):`, error);
    res.status(500).json({
      success: false,
      error: '케이스 샘플 로드 중 오류 발생: ' + error.message
    });
}
});

// API to test prompt with AI
router.post('/test-prompt', async (req, res) => {
  try {
    console.log('🧪 AI 프롬프트 테스트 시작');
    
    const { systemPrompt, userPrompt, extractedText, patientInfo } = req.body;

    if (!systemPrompt || !userPrompt || !extractedText) {
      return res.status(400).json({
        success: false,
        error: '시스템 프롬프트, 사용자 프롬프트, 추출 텍스트가 모두 필요합니다'
      });
    }

    if (patientInfo?.insuranceJoinDate) {
      console.log('📅 보험 가입일 적용:', patientInfo.insuranceJoinDate);
    }

    // 플레이스홀더 교체
    const finalSystemPrompt = systemPrompt.replace(/\{\{MEDICAL_ABBREVIATIONS\}\}/g, 'HTN(Hypertension), DM(Diabetes Mellitus), CAD(Coronary Artery Disease), COPD(Chronic Obstructive Pulmonary Disease)');
    const finalUserPrompt = userPrompt.replace(/\{\{EXTRACTED_TEXT\}\}/g, extractedText);

    console.log('🤖 OpenAI GPT-4o 호출...');
    const startTime = Date.now();

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: finalUserPrompt }
      ],
      temperature: 0.1,
      max_tokens: 4000
      // JSON 형식 제거 - Report_Sample.txt 양식은 텍스트 형식
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ GPT-4o 테스트 완료 (${processingTime}ms)`);

    // 텍스트 응답 처리
    const reportText = completion.choices[0].message.content;

    res.json({
      success: true,
      result: {
        reportText: reportText, // 텍스트 형식으로 반환
        processingTime: `${processingTime}ms`,
        model: 'gpt-4o',
        timestamp: new Date().toISOString(),
        tokenUsage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        }
      }
    });

  } catch (error) {
    console.error('AI 테스트 오류:', error);
    res.status(500).json({
      success: false,
      error: 'AI 테스트 실패: ' + error.message
    });
  }
});

// 📚 전처리 파이프라인 연결
router.post('/preprocess-text', async (req, res) => {
  try {
    const { text, options } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: '분석할 텍스트가 필요합니다.'
      });
    }

    console.log('🧱 전처리 파이프라인 실행 중...');
    
    // 실제 전처리 로직 호출 (기존 postprocess 모듈 활용)
    // 추후 preprocessor.js와 연결
    
    // 시뮬레이션 - 실제로는 backend/postprocess/preprocessor.js 호출
    const mockResults = {
      extractedDates: ['2025-01-17', '2025-01-20', '2025-01-30'],
      extractedHospitals: ['신촌세브란스병원', '더바른내과의원', '스마일영상의학과'],
      extractedKeywords: ['하복부 불편감', '복막의 악성신생물', 'CT 검사', '진단적 복강경술'],
      translatedTerms: { 
        'CT': '컴퓨터 단층촬영', 
        'HGSC': '고등급 장액성 암종',
        'D-lapa': '진단적 복강경술'
      },
      processedSections: [
        {
          date: '2025-01-02',
          hospital: '더바른내과의원',
          content: '하복부 불편감을 주소로 내원',
          keywords: ['하복부 불편감', '내원']
        },
        {
          date: '2025-01-17',
          hospital: '스마일영상의학과',
          content: 'abdomen CT 결과 복막의 악성신생물 진단',
          keywords: ['CT', '복막', '악성신생물']
        }
      ],
      statistics: {
        totalSections: 15,
        processedSections: 12,
        confidenceScore: 0.87
      }
    };

    res.json({
      success: true,
      results: mockResults,
      message: '전처리가 완료되었습니다.'
    });

  } catch (error) {
    console.error('❌ 전처리 오류:', error);
    res.status(500).json({
      success: false,
      error: '전처리 중 오류가 발생했습니다: ' + error.message
    });
  }
});

export default router;
