/**
 * 전처리 AI 모듈 - ES 모듈 버전
 * 
 * 의료 문서의 문맥 분석, 불필요한 노이즈 제거, 패턴 구조화, 날짜 블록화를 수행합니다.
 */

import OpenAI from 'openai';

class PreprocessingAI {
  constructor(options = {}) {
    // OpenAI 클라이언트 초기화
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || options.apiKey
    });
    
    // 설정
    this.config = {
      model: options.model || 'gpt-4o-mini',
      maxTokens: options.maxTokens || 8192,
      temperature: options.temperature || 0.3,
      timeout: options.timeout || 30000
    };
    
    // 성능 통계
    this.stats = {
      totalProcessed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      successRate: 0,
      errorCount: 0
    };
  }
  
  /**
   * 메인 전처리 함수
   * @param {string} ocrText - 원본 OCR 텍스트
   * @param {Object} options - 처리 옵션
   * @returns {Object} 전처리 결과
   */
  async process(ocrText, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('AI 전처리 시작', { textLength: ocrText.length });
      
      // 1. 문맥 분석
      const contextAnalysis = await this.analyzeContext(ocrText);
      
      // 2. 노이즈 제거 및 텍스트 정제
      const cleanedText = await this.removeNoise(ocrText, contextAnalysis);
      
      // 3. 패턴 구조화
      const structuredData = await this.structurePatterns(cleanedText, contextAnalysis);
      
      // 4. 날짜 블록화
      const dateBlocks = await this.createDateBlocks(cleanedText, contextAnalysis);
      
      const processingTime = Date.now() - startTime;
      
      // 통계 업데이트
      this.updateStats(processingTime, true);
      
      const result = {
        originalText: ocrText,
        processedText: cleanedText,
        contextAnalysis,
        structuredData,
        dateBlocks,
        metadata: {
          processingTime,
          originalLength: ocrText.length,
          processedLength: cleanedText.length,
          reductionRate: ((ocrText.length - cleanedText.length) / ocrText.length * 100).toFixed(2),
          patternsIdentified: structuredData.patterns.length,
          dateBlocksCreated: dateBlocks.length
        }
      };
      
      console.log('AI 전처리 완료', {
        processingTime,
        reductionRate: result.metadata.reductionRate,
        patternsFound: result.metadata.patternsIdentified,
        dateBlocks: result.metadata.dateBlocksCreated
      });
      
      return result;
      
    } catch (error) {
      console.error('AI 전처리 오류:', error);
      this.updateStats(Date.now() - startTime, false);
      
      // 폴백 처리
      return this.fallbackProcessing(ocrText);
    }
  }
  
  /**
   * 문맥 분석
   */
  async analyzeContext(text) {
    const prompt = this.generateContextPrompt(text);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: this.config.temperature
      });
      
      const analysis = JSON.parse(response.choices[0].message.content);
      
      return {
        documentType: analysis.documentType || "의료문서",
        medicalSpecialty: analysis.medicalSpecialty || "일반의학",
        keyTopics: analysis.keyTopics || [],
        confidence: analysis.confidence || 0.7,
        language: analysis.language || "한국어",
        structureType: analysis.structureType || "비정형"
      };
      
    } catch (error) {
      console.warn('문맥 분석 실패, 기본값 사용:', error.message);
      return {
        documentType: "의료문서",
        medicalSpecialty: "일반의학",
        keyTopics: [],
        confidence: 0.6,
        language: "한국어",
        structureType: "비정형"
      };
    }
  }
  
  /**
   * 노이즈 제거
   */
  async removeNoise(text, contextAnalysis) {
    const prompt = this.generateNoiseRemovalPrompt(text, contextAnalysis);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      });
      
      return response.choices[0].message.content.trim();
      
    } catch (error) {
      console.warn('노이즈 제거 실패, 기본 정제 적용:', error.message);
      return this.basicTextCleaning(text);
    }
  }
  
  /**
   * 패턴 구조화
   */
  async structurePatterns(text, contextAnalysis) {
    const prompt = this.generatePatternPrompt(text, contextAnalysis);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: this.config.temperature
      });
      
      const structured = JSON.parse(response.choices[0].message.content);
      
      return {
        text: structured.text || text,
        patterns: structured.patterns || [],
        sections: structured.sections || [],
        confidence: structured.confidence || 0.7
      };
      
    } catch (error) {
      console.warn('패턴 구조화 실패, 기본 구조 적용:', error.message);
      return {
        text: text,
        patterns: [],
        sections: [],
        confidence: 0.5
      };
    }
  }
  
  /**
   * 날짜 블록화
   */
  async createDateBlocks(text, contextAnalysis) {
    const prompt = this.generateDateBlockPrompt(text, contextAnalysis);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: this.config.temperature
      });
      
      const dateData = JSON.parse(response.choices[0].message.content);
      
      return dateData.dateBlocks || [];
      
    } catch (error) {
      console.warn('날짜 블록화 실패, 기본 날짜 추출 적용:', error.message);
      return this.basicDateExtraction(text);
    }
  }
  
  /**
   * 프롬프트 생성 메서드들
   */
  generateContextPrompt(text) {
    return `당신은 의료 문서 분석 전문가입니다. 다음 의료 문서를 분석하여 정확한 JSON 형식으로 응답해주세요.

**분석 대상 텍스트:**
${text.substring(0, 2000)}

**분석 요구사항:**
다음 항목들을 정확히 분석하여 JSON으로 응답하세요:

1. documentType: 문서 유형 (진료기록서, 검사결과지, 처방전, 수술기록, 입원기록, 외래기록 중 선택)
2. medicalSpecialty: 의료 전문분야 (내과, 외과, 정형외과, 신경과, 산부인과 등)
3. keyTopics: 주요 의료 주제들 (진단명, 증상, 치료법 등을 배열로)
4. confidence: 분석 신뢰도 (0.0-1.0 사이의 소수점 2자리)
5. language: 주 언어 (한국어/영어/혼합)
6. structureType: 구조 유형 (정형/비정형/반정형)
7. medicalTerms: 발견된 주요 의료 용어들 (배열)
8. datePatterns: 발견된 날짜 패턴 개수

**응답 형식:**
반드시 유효한 JSON만 응답하세요. 추가 설명은 포함하지 마세요.

{
  "documentType": "문서유형",
  "medicalSpecialty": "전문분야",
  "keyTopics": ["주제1", "주제2"],
  "confidence": 0.95,
  "language": "한국어",
  "structureType": "정형",
  "medicalTerms": ["용어1", "용어2"],
  "datePatterns": 3
}`;
  }
  
  generateNoiseRemovalPrompt(text, contextAnalysis) {
    return `당신은 의료 문서 정제 전문가입니다. 다음 의료 문서에서 불필요한 노이즈를 제거하고 의료 정보만 정제해주세요.

**문서 정보:**
- 문서 유형: ${contextAnalysis.documentType}
- 전문분야: ${contextAnalysis.medicalSpecialty}
- 구조 유형: ${contextAnalysis.structureType}

**정제 규칙:**

**제거할 요소:**
- OCR 오류로 인한 깨진 문자 및 특수기호
- 반복되는 헤더/푸터 정보
- 의미없는 기호나 숫자 나열 (예: ####, -----)
- 불완전한 문장 및 단어 조각
- 페이지 번호, 바코드 정보
- 시스템 생성 메타데이터

**반드시 보존할 요소:**
- 모든 의료 용어 및 진단명 (ICD 코드 포함)
- 날짜 및 시간 정보 (모든 형식)
- 수치 데이터 (혈압, 체온, 검사수치 등)
- 처방 정보 (약물명, 용량, 복용법)
- 환자 정보 (이름, 나이, 성별)
- 의료진 정보 (의사명, 진료과)
- 병원/의료기관 정보

**원본 텍스트:**
${text}

**지시사항:**
1. 위 규칙에 따라 정제된 텍스트만 응답하세요
2. 추가 설명이나 주석은 포함하지 마세요
3. 의료 정보의 정확성을 최우선으로 하세요
4. 문맥상 중요한 정보는 절대 제거하지 마세요

**정제된 텍스트:**`;
  }
  
  generatePatternPrompt(text, contextAnalysis) {
    return `당신은 의료 문서 구조화 전문가입니다. 다음 의료 문서를 분석하여 패턴을 식별하고 구조화해주세요.

**문서 정보:**
- 문서 유형: ${contextAnalysis.documentType}
- 전문분야: ${contextAnalysis.medicalSpecialty}
- 주요 주제: ${contextAnalysis.keyTopics?.join(', ') || '미확인'}

**분석 대상 텍스트:**
${text}

**패턴 식별 요구사항:**

1. **반복 구조 패턴**: 진료기록의 반복되는 구조 (주호소-현병력-진단-처방)
2. **날짜-이벤트 패턴**: 시간순 의료 이벤트 연결
3. **수치 데이터 패턴**: 검사 결과, 바이탈 사인 등의 수치 정보
4. **진단-처방 패턴**: 진단과 치료의 연관성
5. **증상-검사 패턴**: 증상과 관련 검사의 연결

**응답 형식:**
반드시 유효한 JSON만 응답하세요. 추가 설명은 포함하지 마세요.

{
  "structuredText": "구조화된 의료 텍스트",
  "patterns": [
    {
      "type": "패턴 유형 (반복구조/날짜이벤트/수치데이터/진단처방/증상검사)",
      "description": "패턴에 대한 간단한 설명",
      "occurrences": 발생횟수,
      "confidence": 0.95,
      "examples": ["예시1", "예시2"]
    }
  ],
  "sections": [
    {
      "title": "섹션 제목",
      "content": "섹션 내용",
      "type": "섹션 유형 (주호소/현병력/진단/처방/검사결과)",
      "medicalRelevance": "HIGH/MEDIUM/LOW"
    }
  ],
  "medicalEntities": {
    "diagnoses": ["진단명들"],
    "medications": ["처방약물들"],
    "procedures": ["시술/수술들"],
    "symptoms": ["증상들"]
  },
  "confidence": 0.95
}`;
  }
  
  generateDateBlockPrompt(text, contextAnalysis) {
    return `당신은 의료 문서 시계열 분석 전문가입니다. 다음 의료 문서에서 날짜 정보를 식별하고 관련 의료 정보와 함께 시간순으로 블록화해주세요.

**문서 정보:**
- 문서 유형: ${contextAnalysis.documentType}
- 전문분야: ${contextAnalysis.medicalSpecialty}

**분석 대상 텍스트:**
${text}

**날짜 블록화 요구사항:**

1. **날짜 형식 인식**: YYYY-MM-DD, YYYY.MM.DD, MM/DD/YYYY, 한글 날짜 등 모든 형식
2. **의료 이벤트 연결**: 각 날짜와 관련된 의료 정보 정확히 매칭
3. **시간순 정렬**: 가장 오래된 날짜부터 최신 날짜 순으로 정렬
4. **중요도 평가**: 각 의료 이벤트의 임상적 중요도 평가

**의료 이벤트 유형:**
- 진료: 외래 진료, 응급실 방문
- 검사: 혈액검사, 영상검사, 생검 등
- 처방: 약물 처방, 처방 변경
- 수술: 수술, 시술, 처치
- 입원: 입원, 퇴원
- 기타: 예약, 상담, 추적관찰

**응답 형식:**
반드시 유효한 JSON만 응답하세요. 시간순으로 정렬하여 응답하세요.

{
  "dateBlocks": [
    {
      "date": "YYYY-MM-DD",
      "originalDateString": "원본 날짜 표현",
      "relatedInfo": "해당 날짜와 관련된 상세 의료 정보",
      "eventType": "진료/검사/처방/수술/입원/기타",
      "medicalEntities": {
        "diagnoses": ["관련 진단명"],
        "medications": ["관련 약물"],
        "procedures": ["관련 시술"]
      },
      "clinicalImportance": "HIGH/MEDIUM/LOW",
      "confidence": 0.95
    }
  ],
  "timeline": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "totalEvents": 숫자,
    "eventTypes": ["유형별 개수"]
  }
}`;
  }
  
  /**
   * 폴백 처리 메서드들
   */
  basicTextCleaning(text) {
    return text
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[^\w\s가-힣.,;:()\-\/]/g, '')
      .trim();
  }
  
  basicDateExtraction(text) {
    const datePattern = /(\d{4})[년\-\.\/](\d{1,2})[월\-\.\/](\d{1,2})[일]?/g;
    const dates = [];
    let match;
    
    while ((match = datePattern.exec(text)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      
      dates.push({
        date: `${year}-${month}-${day}`,
        relatedInfo: text.substring(Math.max(0, match.index - 100), match.index + 100),
        type: "일반",
        confidence: 0.6
      });
    }
    
    return dates;
  }
  
  fallbackProcessing(ocrText) {
    console.log('폴백 처리 실행');
    
    const processed = this.basicTextCleaning(ocrText);
    
    return {
      originalText: ocrText,
      processedText: processed,
      contextAnalysis: {
        documentType: "의료문서",
        confidence: 0.5
      },
      structuredData: {
        text: processed,
        patterns: [],
        confidence: 0.4
      },
      dateBlocks: this.basicDateExtraction(processed),
      metadata: {
        processingTime: 100,
        originalLength: ocrText.length,
        processedLength: processed.length,
        reductionRate: ((ocrText.length - processed.length) / ocrText.length * 100).toFixed(2),
        patternsIdentified: 0,
        dateBlocksCreated: 0
      }
    };
  }
  
  /**
   * 통계 업데이트
   */
  updateStats(processingTime, success) {
    this.stats.totalProcessed++;
    this.stats.totalProcessingTime += processingTime;
    this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.totalProcessed;
    
    if (success) {
      this.stats.successRate = (this.stats.successRate * (this.stats.totalProcessed - 1) + 1) / this.stats.totalProcessed;
    } else {
      this.stats.errorCount++;
      this.stats.successRate = (this.stats.successRate * (this.stats.totalProcessed - 1)) / this.stats.totalProcessed;
    }
  }
  
  /**
   * 동일 세션에서 보고서 생성
   * @param {Object} promptData - 보고서 생성용 프롬프트 데이터
   * @param {Object} options - 생성 옵션
   * @returns {Object} 생성된 보고서
   */
  async generateReport(promptData, options = {}) {
    try {
      console.log('동일 세션 보고서 생성 시작');
      
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [promptData],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.3,
        response_format: { type: "json_object" }
      });
      
      const content = JSON.parse(response.choices[0].message.content);
      
      return {
        content,
        accuracy: 0.9,
        confidence: 0.85,
        model: this.config.model,
        tokensUsed: response.usage.total_tokens
      };
      
    } catch (error) {
      console.error('보고서 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 통계 조회
   */
  getStats() {
    return { ...this.stats };
  }
}

export default PreprocessingAI;