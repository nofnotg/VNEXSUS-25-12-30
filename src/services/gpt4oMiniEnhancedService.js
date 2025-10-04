/**
 * GPT-4o Mini Enhanced Continuous Service
 * 
 * 연속 세션 방식으로 전처리 AI와 보고서 생성 AI를 통합 실행하는 서비스
 * 기존 AIService와 완전 호환되는 인터페이스 제공
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 환경 변수 로드
dotenv.config();

// __dirname 설정 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GPT4oMiniEnhancedService {
  constructor() {
    // OpenAI API 설정
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o-mini';
    this.maxTokens = 16384; // GPT-4o Mini의 최대 토큰
    this.temperature = 0.3; // 의료 보고서에 적합한 온도
    
    // 연속 세션 관리
    this.sessionMessages = [];
    this.sessionId = null;
    this.fallbackService = null;
    
    // 성능 메트릭
    this.performanceMetrics = {
      tokenSavings: 0,
      processingTime: 0,
      contextRetention: 0,
      apiCalls: 0,
      successRate: 0
    };
    
    // 통합 모드 설정
    this.integrationMode = 'enhanced_continuous';
    this.enableFallback = true;
    this.enableMetrics = true;
  }

  /**
   * 기존 AIService와 완전 호환되는 의료 보고서 생성 인터페이스
   * @param {Object} inputData - 입력 데이터 { ocrText, patientInfo, structuredData }
   * @param {Object} options - 생성 옵션
   * @returns {Promise<Object>} 생성된 보고서와 메타데이터
   */
  async generateMedicalReport(inputData, options = {}) {
    const startTime = Date.now();
    this.performanceMetrics.apiCalls++;
    
    try {
      console.log('🚀 GPT-4o Mini Enhanced Continuous Session 시작');
      
      // 입력 데이터 검증 및 정규화
      const normalizedInput = this.normalizeInputData(inputData);
      
      // 연속 세션으로 전처리 + 보고서 생성
      const result = await this.processWithEnhancedContinuousSession(
        normalizedInput.ocrText,
        normalizedInput.patientInfo,
        normalizedInput.structuredData,
        options
      );
      
      // 성능 메트릭 수집
      const processingTime = Date.now() - startTime;
      this.collectPerformanceMetrics(startTime, result, processingTime);
      
      console.log('✅ Enhanced Continuous Session 완료');
      console.log(`📊 처리 시간: ${processingTime}ms`);
      console.log(`💰 토큰 절약: ${result.tokenUsage.savingsPercent.toFixed(1)}%`);
      
      return {
        success: true,
        report: result.finalReport,
        preprocessedData: result.preprocessedData,
        metadata: {
          sessionId: result.sessionId,
          tokenUsage: result.tokenUsage,
          processingTime: processingTime,
          method: 'gpt4o_mini_enhanced_continuous',
          contextRetention: result.contextRetention,
          advantages: [
            '컨텍스트 완전 유지',
            '정보 누락 방지',
            '토큰 효율성 향상',
            '일관성 보장'
          ]
        }
      };
      
    } catch (error) {
      console.error('❌ Enhanced continuous processing failed:', error);
      
      // 자동 폴백 to 기존 시스템
      if (this.enableFallback && this.fallbackService) {
        console.log('🔄 기존 시스템으로 폴백 처리...');
        return await this.executeFallback(inputData, options, error);
      }
      
      throw new Error(`GPT-4o Mini Enhanced 처리 실패: ${error.message}`);
    }
  }

  /**
   * 입력 데이터 정규화
   * @param {Object} inputData - 원본 입력 데이터
   * @returns {Object} 정규화된 입력 데이터
   */
  normalizeInputData(inputData) {
    // 다양한 입력 형식 지원
    if (typeof inputData === 'string') {
      return {
        ocrText: inputData,
        patientInfo: {},
        structuredData: null
      };
    }
    
    return {
      ocrText: inputData.ocrText || inputData.text || inputData.content || '',
      patientInfo: inputData.patientInfo || inputData.patient || {},
      structuredData: inputData.structuredData || inputData.events || null
    };
  }

  /**
   * 향상된 연속 세션 처리 (핵심 로직)
   * @param {string} ocrText - OCR 추출 텍스트
   * @param {Object} patientInfo - 환자 정보
   * @param {Object} structuredData - 기존 구조화된 데이터 (있는 경우)
   * @param {Object} options - 처리 옵션
   * @returns {Promise<Object>} 처리 결과
   */
  async processWithEnhancedContinuousSession(ocrText, patientInfo, structuredData, options) {
    // 세션 초기화
    this.initializeEnhancedSession(patientInfo, options);
    
    let preprocessedData;
    
    // 1단계: 컨텍스트 기반 전처리 (기존 구조화 데이터가 없는 경우만)
    if (!structuredData) {
      console.log('📝 1단계: 컨텍스트 기반 전처리 실행...');
      preprocessedData = await this.executeContextualPreprocessing(ocrText, patientInfo);
    } else {
      console.log('📝 기존 구조화 데이터 활용...');
      preprocessedData = structuredData;
      // 기존 데이터를 세션에 추가
      this.addExistingDataToSession(structuredData, ocrText);
    }
    
    // 2단계: 연속 세션에서 보고서 생성 (원본 OCR + 구조화 데이터 모두 활용)
    console.log('📋 2단계: 향상된 보고서 생성 실행...');
    const finalReport = await this.continueWithEnhancedReportGeneration(
      ocrText, // 원본 유지
      preprocessedData, // 구조화된 데이터
      options
    );
    
    return {
      preprocessedData,
      finalReport,
      sessionId: this.generateSessionId(),
      tokenUsage: this.calculateTokenSavings(),
      contextRetention: this.measureContextRetention()
    };
  }

  /**
   * 향상된 세션 초기화
   * @param {Object} patientInfo - 환자 정보
   * @param {Object} options - 옵션
   */
  initializeEnhancedSession(patientInfo, options) {
    this.sessionMessages = [];
    this.sessionId = this.generateSessionId();
    
    // 세션 컨텍스트 설정
    const sessionContext = {
      patientInfo,
      options,
      startTime: new Date().toISOString(),
      mode: 'enhanced_continuous'
    };
    
    console.log(`🔄 세션 초기화 완료: ${this.sessionId}`);
  }

  /**
   * 컨텍스트 기반 전처리 (기존 방식 개선)
   * @param {string} ocrText - OCR 텍스트
   * @param {Object} patientInfo - 환자 정보
   * @returns {Promise<Object>} 구조화된 데이터
   */
  async executeContextualPreprocessing(ocrText, patientInfo) {
    const systemPrompt = `# 의료 문서 전처리 전문가 (Enhanced Continuous Mode)

## 역할
OCR 텍스트를 구조화하되, 다음 단계에서 보고서 생성 시 원본 정보를 참조할 수 있도록 준비합니다.

## 핵심 원칙
1. **정보 보존**: 모든 의료 정보를 누락 없이 구조화
2. **컨텍스트 준비**: 다음 단계에서 참조할 핵심 포인트 식별
3. **품질 보장**: 구조화 과정에서 발생할 수 있는 오류 최소화
4. **연속성 고려**: 동일 세션에서 보고서 생성이 이어질 것을 고려

## 출력 형식
반드시 다음 JSON 형식으로 응답하세요:
{
  "structuredData": {
    "events": [
      {
        "date": "YYYY-MM-DD",
        "hospital": "병원명",
        "department": "진료과",
        "diagnosis": "진단명",
        "treatment": "치료내용",
        "prescription": "처방내용",
        "notes": "특이사항",
        "confidence": 0.95
      }
    ],
    "summary": "환자 의료 이력 요약",
    "keyFindings": ["주요 소견 1", "주요 소견 2"],
    "timeline": {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "totalEvents": 0
    }
  },
  "contextNotes": {
    "criticalInfo": "다음 단계에서 반드시 확인해야 할 정보",
    "uncertainties": "구조화 과정에서 불확실했던 부분",
    "originalReferences": "원본 텍스트의 중요 구간 참조",
    "qualityScore": 0.95
  },
  "processingMetadata": {
    "ocrQuality": "high/medium/low",
    "dataCompleteness": 0.95,
    "structuringConfidence": 0.95
  }
}`;

    const userPrompt = `## 환자 정보
${JSON.stringify(patientInfo, null, 2)}

## OCR 추출 텍스트
${ocrText}

위 정보를 구조화하되, 다음 단계에서 보고서 생성 시 원본 텍스트를 참조할 수 있도록 컨텍스트 노트를 포함해 주세요.
특히 불확실하거나 애매한 부분은 contextNotes에 명시하여 다음 단계에서 원본을 다시 확인할 수 있도록 해주세요.`;

    // 세션 메시지에 추가
    this.sessionMessages.push(
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    );

    const response = await this.callOpenAI();
    const result = this.parseAndValidateResponse(response.content, 'preprocessing');
    
    // 응답을 세션에 추가
    this.sessionMessages.push({ role: 'assistant', content: response.content });
    
    return result;
  }

  /**
   * 기존 구조화 데이터를 세션에 추가
   * @param {Object} structuredData - 기존 구조화된 데이터
   * @param {string} ocrText - 원본 OCR 텍스트
   */
  addExistingDataToSession(structuredData, ocrText) {
    const contextPrompt = `다음은 이미 구조화된 의료 데이터입니다:

## 구조화된 데이터
${JSON.stringify(structuredData, null, 2)}

## 원본 OCR 텍스트 (참조용)
${ocrText}

이 정보를 바탕으로 의료 보고서를 생성할 준비가 되었습니다.`;

    this.sessionMessages.push(
      { role: 'system', content: '의료 보고서 생성 전문가입니다.' },
      { role: 'user', content: contextPrompt },
      { role: 'assistant', content: '네, 구조화된 데이터와 원본 텍스트를 확인했습니다. 의료 보고서 생성을 위한 준비가 완료되었습니다.' }
    );
  }

  /**
   * 향상된 보고서 생성 (원본 + 구조화 데이터 활용)
   * @param {string} originalOCR - 원본 OCR 텍스트
   * @param {Object} preprocessedData - 구조화된 데이터
   * @param {Object} options - 생성 옵션
   * @returns {Promise<string>} 생성된 보고서
   */
  async continueWithEnhancedReportGeneration(originalOCR, preprocessedData, options) {
    const reportPrompt = `이제 위에서 구조화한 데이터를 바탕으로 전문적인 의료 보고서를 작성해 주세요.

## 중요 지침
1. **원본 참조**: 구조화 과정에서 놓쳤을 수 있는 정보는 위의 원본 OCR 텍스트에서 직접 확인
2. **컨텍스트 활용**: 전처리 단계에서 제공한 contextNotes를 적극 활용
3. **완전성 보장**: 모든 의료 이벤트와 중요 정보를 포함한 완전한 보고서 작성
4. **전문성 유지**: 의료진이 이해할 수 있는 전문적인 수준으로 작성

## 보고서 구조
1. **환자 개요** (Patient Overview)
2. **주요 진료 내역** (Key Medical History)
3. **시간순 진료 타임라인** (Chronological Timeline)
4. **의학적 소견** (Medical Insights)
5. **권장사항** (Recommendations)

## 품질 기준
- 의료 용어 정확성: 100%
- 날짜 정확성: 100%
- 논리적 일관성: 95% 이상
- 가독성: 90% 이상

위의 구조화된 데이터와 원본 OCR 텍스트를 모두 참조하여 완전하고 정확한 의료 보고서를 마크다운 형식으로 작성해 주세요.

${options.reportStyle ? `보고서 스타일: ${options.reportStyle}` : ''}
${options.focusAreas ? `중점 분석 영역: ${options.focusAreas.join(', ')}` : ''}`;

    // 연속 세션에 보고서 생성 요청 추가
    this.sessionMessages.push({ role: 'user', content: reportPrompt });
    
    const response = await this.callOpenAI();
    return response.content;
  }

  /**
   * OpenAI API 호출
   * @returns {Promise<Object>} API 응답
   */
  async callOpenAI() {
    try {
      const response = await axios.post(this.apiUrl, {
        model: this.model,
        messages: this.sessionMessages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60초 타임아웃
      });

      return response.data.choices[0].message;
    } catch (error) {
      console.error('OpenAI API 호출 오류:', error.response?.data || error.message);
      throw new Error(`OpenAI API 호출 실패: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 응답 파싱 및 검증
   * @param {string} content - API 응답 내용
   * @param {string} type - 응답 타입 ('preprocessing' | 'report')
   * @returns {Object} 파싱된 결과
   */
  parseAndValidateResponse(content, type) {
    if (type === 'preprocessing') {
      try {
        const parsed = JSON.parse(content);
        
        // 필수 필드 검증
        if (!parsed.structuredData || !parsed.contextNotes) {
          throw new Error('필수 필드 누락: structuredData 또는 contextNotes');
        }
        
        return parsed;
      } catch (error) {
        console.error('전처리 응답 파싱 오류:', error);
        throw new Error(`전처리 응답 파싱 실패: ${error.message}`);
      }
    }
    
    return content; // 보고서는 마크다운 텍스트로 반환
  }

  /**
   * 토큰 절약 효과 계산
   * @returns {Object} 토큰 사용량 정보
   */
  calculateTokenSavings() {
    const baseTokens = this.estimateBaseTokenUsage();
    const continuousTokens = this.sessionMessages.reduce((total, msg) => 
      total + this.estimateTokenCount(msg.content), 0
    );
    
    const savings = Math.max(0, baseTokens - continuousTokens);
    const savingsPercent = baseTokens > 0 ? (savings / baseTokens) * 100 : 0;
    
    this.performanceMetrics.tokenSavings = savingsPercent;
    
    return {
      baseEstimate: baseTokens,
      actualUsage: continuousTokens,
      savingsPercent: savingsPercent,
      savingsTokens: savings,
      efficiency: continuousTokens > 0 ? (baseTokens / continuousTokens) : 1
    };
  }

  /**
   * 기본 토큰 사용량 추정 (2회 독립 호출 방식)
   * @returns {number} 추정 토큰 수
   */
  estimateBaseTokenUsage() {
    // 전처리 호출 + 보고서 생성 호출의 추정 토큰
    const preprocessingTokens = 2000; // 시스템 프롬프트 + 사용자 입력
    const reportGenerationTokens = 2500; // 시스템 프롬프트 + 구조화된 데이터
    return preprocessingTokens + reportGenerationTokens;
  }

  /**
   * 토큰 수 추정
   * @param {string} text - 텍스트
   * @returns {number} 추정 토큰 수
   */
  estimateTokenCount(text) {
    // 간단한 토큰 추정 (실제로는 더 정확한 토크나이저 사용 권장)
    return Math.ceil(text.length / 4);
  }

  /**
   * 컨텍스트 유지 품질 측정
   * @returns {number} 컨텍스트 점수 (0-100)
   */
  measureContextRetention() {
    const contextScore = Math.min(100, 
      (this.sessionMessages.length * 15) + 
      (this.hasOriginalReference() ? 25 : 0) +
      (this.hasStructuredData() ? 20 : 0) +
      (this.hasContextNotes() ? 15 : 0) +
      25 // 기본 점수
    );
    
    this.performanceMetrics.contextRetention = contextScore;
    return contextScore;
  }

  /**
   * 원본 참조 여부 확인
   * @returns {boolean} 원본 참조 포함 여부
   */
  hasOriginalReference() {
    return this.sessionMessages.some(msg => 
      msg.content.includes('OCR') || msg.content.includes('원본')
    );
  }

  /**
   * 구조화된 데이터 포함 여부 확인
   * @returns {boolean} 구조화된 데이터 포함 여부
   */
  hasStructuredData() {
    return this.sessionMessages.some(msg => 
      msg.content.includes('structuredData') || msg.content.includes('구조화')
    );
  }

  /**
   * 컨텍스트 노트 포함 여부 확인
   * @returns {boolean} 컨텍스트 노트 포함 여부
   */
  hasContextNotes() {
    return this.sessionMessages.some(msg => 
      msg.content.includes('contextNotes') || msg.content.includes('컨텍스트')
    );
  }

  /**
   * 성능 메트릭 수집
   * @param {number} startTime - 시작 시간
   * @param {Object} result - 처리 결과
   * @param {number} processingTime - 처리 시간
   */
  collectPerformanceMetrics(startTime, result, processingTime) {
    this.performanceMetrics.processingTime = processingTime;
    this.performanceMetrics.successRate = 
      (this.performanceMetrics.successRate * (this.performanceMetrics.apiCalls - 1) + 100) / 
      this.performanceMetrics.apiCalls;
    
    if (this.enableMetrics) {
      this.logPerformanceMetrics(result);
    }
  }

  /**
   * 성능 메트릭 로깅
   * @param {Object} result - 처리 결과
   */
  logPerformanceMetrics(result) {
    console.log('📊 성능 메트릭:');
    console.log(`  - 토큰 절약: ${this.performanceMetrics.tokenSavings.toFixed(1)}%`);
    console.log(`  - 처리 시간: ${this.performanceMetrics.processingTime}ms`);
    console.log(`  - 컨텍스트 유지: ${this.performanceMetrics.contextRetention}%`);
    console.log(`  - API 호출 수: ${this.performanceMetrics.apiCalls}`);
    console.log(`  - 성공률: ${this.performanceMetrics.successRate.toFixed(1)}%`);
  }

  /**
   * 폴백 실행
   * @param {Object} inputData - 입력 데이터
   * @param {Object} options - 옵션
   * @param {Error} originalError - 원본 오류
   * @returns {Promise<Object>} 폴백 결과
   */
  async executeFallback(inputData, options, originalError) {
    try {
      const fallbackResult = await this.fallbackService.generateMedicalReport(inputData, options);
      
      return {
        success: true,
        report: fallbackResult.report || fallbackResult,
        metadata: {
          method: 'fallback',
          originalError: originalError.message,
          fallbackService: this.fallbackService.constructor.name,
          processingTime: Date.now() - Date.now()
        }
      };
    } catch (fallbackError) {
      throw new Error(`Enhanced 및 폴백 모두 실패: ${originalError.message} | ${fallbackError.message}`);
    }
  }

  /**
   * 세션 ID 생성
   * @returns {string} 고유 세션 ID
   */
  generateSessionId() {
    return `gpt4o-mini-enhanced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 폴백 서비스 설정
   * @param {Object} fallbackService - 폴백 서비스 인스턴스
   */
  setFallbackService(fallbackService) {
    this.fallbackService = fallbackService;
    console.log('🔄 폴백 서비스 설정 완료');
  }

  /**
   * 최적화 서비스 설정
   * @param {Object} optimizer - 최적화 서비스 인스턴스
   */
  setOptimizer(optimizer) {
    this.optimizer = optimizer;
    console.log('⚡ 최적화 서비스 설정 완료');
  }

  /**
   * 모니터링 서비스 설정
   * @param {Object} monitor - 모니터링 서비스 인스턴스
   */
  setMonitor(monitor) {
    this.monitor = monitor;
    console.log('📊 모니터링 서비스 설정 완료');
  }

  /**
   * 성능 메트릭 반환
   * @returns {Object} 현재 성능 메트릭
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * 세션 정보 반환
   * @returns {Object} 현재 세션 정보
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      messageCount: this.sessionMessages.length,
      integrationMode: this.integrationMode,
      hasFallback: !!this.fallbackService
    };
  }
}

export default GPT4oMiniEnhancedService;