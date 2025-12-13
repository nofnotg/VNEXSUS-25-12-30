/**
 * 통합 의료 분석 서비스
 * 
 * DNA 시퀀싱 엔진과 AI 분석을 통합하는 핵심 서비스
 * 
 * 주요 기능:
 * 1. DNA 기반 텍스트 분석과 날짜 추출
 * 2. AI 기반 의료 문서 해석
 * 3. 통합 워크플로우 관리
 * 4. 실시간 품질 보증
 * 5. 성능 모니터링 및 최적화
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import OpenAI from 'openai';
import { TextArrayDateController } from '../../src/dna-engine/core/textArrayDateControllerComplete.js';
import { AdvancedTextArrayDateClassifier } from '../../src/dna-engine/core/advancedTextArrayDateClassifier.js';
import { EnhancedDateAnchor } from '../../src/dna-engine/core/enhancedDateAnchor.js';
// import { DNASequencingEngine } from '../../src/dna-engine/core/dnaSequencingEngine.js';
import { NestedDateResolver } from '../../src/dna-engine/core/nestedDateResolver.js';

class MedicalAnalysisService {
  constructor() {
    this.version = '2.0.0';
    this.serviceName = 'MedicalAnalysisService';

    // DNA 엔진 컴포넌트 초기화
    this.textArrayController = new TextArrayDateController();
    this.advancedClassifier = new AdvancedTextArrayDateClassifier();
    this.dateAnchor = new EnhancedDateAnchor();
    // this.dnaEngine = new DNASequencingEngine();
    this.nestedResolver = new NestedDateResolver();

    // AI 서비스 초기화
    this.openaiClient = null;

    // 통합 캐시 및 성능 관리
    this.analysisCache = new Map();
    this.performanceMetrics = {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      averageProcessingTime: 0,
      dnaAccuracy: 0,
      aiAccuracy: 0,
      lastUpdated: null
    };

    // 워크플로우 설정
    this.workflowConfig = {
      enableDNASequencing: true,
      enableAdvancedClassification: true,
      enableAIAnalysis: true,
      enableQualityAssurance: true,
      confidenceThreshold: 0.8,
      maxRetries: 3
    };

    console.log(`🧬 ${this.serviceName} v${this.version} 초기화 완료`);
  }

  /**
   * OpenAI 클라이언트 lazy initialization
   */
  getOpenAIClient() {
    if (!this.openaiClient) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
      });
    }
    return this.openaiClient;
  }

  /**
   * 통합 의료 문서 분석
   * 
   * @param {string} medicalText - 분석할 의료 텍스트
   * @param {Object} options - 분석 옵션
   * @returns {Object} 통합 분석 결과
   */
  async analyzeDocument(medicalText, options = {}) {
    const startTime = Date.now();
    const analysisId = this.generateAnalysisId();

    try {
      console.log(`🔬 통합 의료 문서 분석 시작 (ID: ${analysisId})`);

      // 1. 입력 검증
      if (!medicalText || !medicalText.trim()) {
        throw new Error('분석할 의료 텍스트가 필요합니다.');
      }

      // 2. 캐시 확인
      const cacheKey = this.generateCacheKey(medicalText, options);
      if (this.analysisCache.has(cacheKey)) {
        console.log(`📋 캐시된 결과 반환 (ID: ${analysisId})`);
        return {
          ...this.analysisCache.get(cacheKey),
          cached: true,
          analysisId
        };
      }

      // 3. DNA 기반 텍스트 분석
      console.log(`🧬 DNA 시퀀싱 분석 시작 (ID: ${analysisId})`);
      const dnaAnalysisResult = await this.performDNAAnalysis(medicalText, options);

      // 4. AI 기반 의료 문서 해석
      console.log(`🤖 AI 의료 문서 해석 시작 (ID: ${analysisId})`);
      const aiAnalysisResult = await this.performAIAnalysis(medicalText, dnaAnalysisResult, options);

      // 5. 통합 결과 구성
      const integratedResult = await this.integrateResults(
        dnaAnalysisResult,
        aiAnalysisResult,
        medicalText,
        options
      );

      // 6. 품질 보증
      const qualityAssessment = await this.performQualityAssurance(integratedResult, options);

      // 7. 최종 결과 구성
      const finalResult = {
        analysisId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        version: this.version,

        // 핵심 분석 결과
        dnaAnalysis: dnaAnalysisResult,
        aiAnalysis: aiAnalysisResult,
        integratedResult: integratedResult,
        qualityAssessment: qualityAssessment,

        // 메타데이터
        metadata: {
          textLength: medicalText.length,
          options: options,
          workflowConfig: this.workflowConfig,
          cached: false
        }
      };

      // 8. 캐시 저장
      this.saveToCache(cacheKey, finalResult);

      // 9. 성능 메트릭 업데이트
      this.updatePerformanceMetrics(finalResult, true);

      console.log(`✅ 통합 의료 문서 분석 완료 (ID: ${analysisId}, ${Date.now() - startTime}ms)`);

      return finalResult;

    } catch (error) {
      console.error(`❌ 통합 의료 문서 분석 실패 (ID: ${analysisId}):`, error);

      // 성능 메트릭 업데이트 (실패)
      this.updatePerformanceMetrics(null, false);

      throw new Error(`통합 의료 문서 분석 실패: ${error.message}`);
    }
  }

  /**
   * DNA 기반 텍스트 분석 수행
   */
  async performDNAAnalysis(medicalText, options) {
    try {
      const dnaOptions = {
        enableDNASequencing: options.enableDNASequencing ?? this.workflowConfig.enableDNASequencing,
        enableAdvancedClassification: options.enableAdvancedClassification ?? this.workflowConfig.enableAdvancedClassification,
        confidenceThreshold: options.confidenceThreshold ?? this.workflowConfig.confidenceThreshold,
        ...options
      };

      // TextArrayDateController를 통한 통합 DNA 분석
      const result = await this.textArrayController.processDocumentDateArrays(medicalText, dnaOptions);

      return {
        success: true,
        extractedDates: result.result?.extractedDates || [],
        documentSummary: result.result?.documentSummary || {},
        dnaPatterns: result.result?.dnaAnalysis?.patterns || [],
        qualityMetrics: result.result?.qualityMetrics || {},
        processingTime: result.processingTime || 0,
        confidence: result.result?.qualityMetrics?.overallConfidence || 0
      };

    } catch (error) {
      console.error('❌ DNA 분석 실패:', error);
      return {
        success: false,
        error: error.message,
        extractedDates: [],
        documentSummary: {},
        dnaPatterns: [],
        qualityMetrics: {},
        processingTime: 0,
        confidence: 0
      };
    }
  }

  /**
   * AI 기반 의료 문서 해석 수행 (Progressive RAG 통합)
   */
  async performAIAnalysis(medicalText, dnaAnalysisResult, options) {
    try {
      if (!options.enableAIAnalysis && !this.workflowConfig.enableAIAnalysis) {
        return {
          success: false,
          message: 'AI 분석이 비활성화되었습니다.',
          reportText: '',
          processingTime: 0
        };
      }

      const startTime = Date.now();

      // Progressive RAG 통합 분석
      let ragEnhancedResult = null;
      if (options.enableProgressiveRAG) {
        try {
          ragEnhancedResult = await this.performProgressiveRAGAnalysis(medicalText, dnaAnalysisResult, options);
        } catch (ragError) {
          console.warn('⚠️ Progressive RAG 분석 실패, 기본 AI 분석으로 진행:', ragError.message);
        }
      }

      // DNA 분석 결과를 활용한 프롬프트 구성
      const systemPrompt = this.buildSystemPrompt(dnaAnalysisResult, ragEnhancedResult);
      const userPrompt = this.buildUserPrompt(medicalText, dnaAnalysisResult, ragEnhancedResult);

      // OpenAI GPT-4o-mini 호출
      const completion = await this.getOpenAIClient().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        reportText: completion.choices[0].message.content,
        model: 'gpt-4o-mini',
        processingTime: processingTime,
        tokenUsage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        },
        timestamp: new Date().toISOString(),
        ragEnhanced: !!ragEnhancedResult,
        ragResult: ragEnhancedResult
      };

    } catch (error) {
      console.error('❌ AI 분석 실패:', error);
      return {
        success: false,
        error: error.message,
        reportText: '',
        processingTime: 0
      };
    }
  }

  /**
   * Progressive RAG 기반 의료 문서 분석
   */
  async performProgressiveRAGAnalysis(medicalText, dnaAnalysisResult, options) {
    try {
      // Progressive RAG 매니저 동적 로드
      const { ProgressiveRAGManager } = await import('../../src/rag/progressiveRAG.js');

      // RAG 매니저 초기화 (싱글톤 패턴)
      if (!this.ragManager) {
        this.ragManager = new ProgressiveRAGManager({
          embeddingModel: 'text-embedding-3-small',
          maxTokens: 4000,
          temperature: 0.1,
          enableCaching: true,
          cacheSize: 1000,
          enableFallback: true,
          fallbackModel: 'gpt-4o-mini'
        });

        await this.ragManager.initialize();
      }

      // 의료 용어 검색 및 컨텍스트 구성
      const medicalTerms = this.extractMedicalTerms(medicalText, dnaAnalysisResult);
      const ragContext = await this.ragManager.searchMedicalTerms(medicalTerms, {
        maxResults: 10,
        confidenceThreshold: 0.7
      });

      // ICD 코드 검색
      const icdResults = await this.ragManager.searchICDCodes(medicalTerms, {
        maxResults: 5,
        includeDescriptions: true
      });

      // 의료 문서 분석 (RAG 강화)
      const analysisResult = await this.ragManager.analyzeMedicalDocument(medicalText, {
        includeContext: true,
        contextSources: ragContext.results,
        icdCodes: icdResults.results,
        dnaAnalysis: dnaAnalysisResult
      });

      return {
        success: true,
        medicalTermsContext: ragContext,
        icdCodesContext: icdResults,
        analysisResult: analysisResult,
        extractedTerms: medicalTerms,
        processingTime: ragContext.processingTime + icdResults.processingTime + analysisResult.processingTime
      };

    } catch (error) {
      console.error('❌ Progressive RAG 분석 실패:', error);
      throw new Error(`Progressive RAG 분석 실패: ${error.message}`);
    }
  }

  /**
   * 의료 텍스트에서 핵심 의료 용어 추출
   */
  extractMedicalTerms(medicalText, dnaAnalysisResult) {
    const terms = new Set();

    // DNA 분석 결과에서 의료 용어 추출
    if (dnaAnalysisResult && dnaAnalysisResult.dnaPatterns) {
      dnaAnalysisResult.dnaPatterns.forEach(pattern => {
        if (pattern.medicalTerms) {
          pattern.medicalTerms.forEach(term => terms.add(term));
        }
      });
    }

    // 정규표현식을 통한 의료 용어 추출
    const medicalTermPatterns = [
      /\b(?:고혈압|당뇨병|심장병|뇌졸중|암|종양|폐렴|간염|신부전|관절염)\b/g,
      /\b(?:CT|MRI|X-ray|초음파|내시경|혈액검사|소변검사)\b/gi,
      /\b(?:수술|입원|외래|응급실|중환자실|병동)\b/g,
      /\b(?:처방|투약|복용|주사|점적)\b/g,
      /\b[A-Z]\d{2}(?:\.\d{1,2})?\b/g // ICD-10 코드 패턴
    ];

    medicalTermPatterns.forEach(pattern => {
      const matches = medicalText.match(pattern);
      if (matches) {
        matches.forEach(match => terms.add(match.trim()));
      }
    });

    return Array.from(terms).filter(term => term.length > 1);
  }

  /**
   * DNA 분석과 AI 분석 결과 통합
   */
  async integrateResults(dnaResult, aiResult, originalText, options) {
    try {
      // 1. 날짜 정보 통합
      const integratedDates = this.integrateDateInformation(dnaResult, aiResult);

      // 2. 의료 이벤트 통합
      const integratedEvents = this.integrateMedicalEvents(dnaResult, aiResult, originalText);

      // 3. 신뢰도 스코어 계산
      const confidenceScore = this.calculateIntegratedConfidence(dnaResult, aiResult);

      // 4. 품질 메트릭 통합
      const qualityMetrics = this.integrateQualityMetrics(dnaResult, aiResult);

      return {
        integratedDates: integratedDates,
        integratedEvents: integratedEvents,
        confidenceScore: confidenceScore,
        qualityMetrics: qualityMetrics,
        summary: {
          totalDates: integratedDates.length,
          totalEvents: integratedEvents.length,
          dnaAccuracy: dnaResult.confidence || 0,
          aiAccuracy: aiResult.success ? 0.9 : 0, // AI 성공률 기반 추정
          overallAccuracy: confidenceScore
        }
      };

    } catch (error) {
      console.error('❌ 결과 통합 실패:', error);
      return {
        integratedDates: [],
        integratedEvents: [],
        confidenceScore: 0,
        qualityMetrics: {},
        summary: {
          totalDates: 0,
          totalEvents: 0,
          dnaAccuracy: 0,
          aiAccuracy: 0,
          overallAccuracy: 0
        },
        error: error.message
      };
    }
  }

  /**
   * 품질 보증 수행
   */
  async performQualityAssurance(integratedResult, options) {
    try {
      const qaChecks = {
        dateConsistency: this.checkDateConsistency(integratedResult),
        eventCoherence: this.checkEventCoherence(integratedResult),
        confidenceThreshold: this.checkConfidenceThreshold(integratedResult, options),
        dataCompleteness: this.checkDataCompleteness(integratedResult)
      };

      const overallQuality = Object.values(qaChecks).every(check => check.passed);
      const qualityScore = Object.values(qaChecks).reduce((sum, check) => sum + check.score, 0) / Object.keys(qaChecks).length;

      return {
        passed: overallQuality,
        score: qualityScore,
        checks: qaChecks,
        recommendations: this.generateQARecommendations(qaChecks),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ 품질 보증 실패:', error);
      return {
        passed: false,
        score: 0,
        checks: {},
        recommendations: ['품질 보증 프로세스에서 오류가 발생했습니다.'],
        error: error.message
      };
    }
  }

  // === 헬퍼 메서드 ===

  /**
   * 시스템 프롬프트 구성 (Progressive RAG 통합)
   */
  buildSystemPrompt(dnaAnalysisResult, ragEnhancedResult = null) {
    let ragContext = '';

    if (ragEnhancedResult && ragEnhancedResult.success) {
      ragContext = `
## 🔍 Progressive RAG 강화 컨텍스트
**의료 용어 컨텍스트**: ${ragEnhancedResult.medicalTermsContext?.results?.length || 0}개 항목
**ICD 코드 컨텍스트**: ${ragEnhancedResult.icdCodesContext?.results?.length || 0}개 항목
**RAG 분석 결과**: ${ragEnhancedResult.analysisResult?.summary || '분석 완료'}

### 관련 의료 용어 정보:
${ragEnhancedResult.medicalTermsContext?.results?.map(item =>
        `- ${item.term}: ${item.description || item.context}`
      ).join('\n') || '없음'}

### 관련 ICD 코드:
${ragEnhancedResult.icdCodesContext?.results?.map(item =>
        `- ${item.code}: ${item.description}`
      ).join('\n') || '없음'}
`;
    }

    return `# 🧬 의료문서 시간축 분석 전문가 (DNA 시퀀싱 + Progressive RAG 통합)

당신은 **보험 손해사정 전문가**로서 의료 기록을 **DNA 시퀀싱 기반 시간축 분석**과 **Progressive RAG 강화 컨텍스트**로 체계적으로 정리하는 세계 최고의 전문가입니다.

## 🧬 DNA 분석 결과 활용
**추출된 날짜**: ${JSON.stringify(dnaAnalysisResult.extractedDates || [], null, 2)}
**DNA 패턴**: ${JSON.stringify(dnaAnalysisResult.dnaPatterns || [], null, 2)}
**신뢰도 메트릭**: ${JSON.stringify(dnaAnalysisResult.qualityMetrics || {}, null, 2)}
${ragContext}
## 🎯 핵심 미션
1. DNA 분석 결과와 RAG 컨텍스트를 활용한 정확한 시간축 구성
2. 의료 이벤트의 정확한 분류 및 정렬
3. 보험 가입 시점 대비 치료 시점 분석
4. 고지의무 관련 위험 요소 식별
5. RAG 강화 의료 용어 및 ICD 코드 정보 활용

모든 분석에서 DNA 시퀀싱 결과의 신뢰도와 RAG 컨텍스트를 반영하여 정확하고 객관적인 의료 시간축을 구성하세요.`;
  }

  /**
   * 사용자 프롬프트 구성 (Progressive RAG 통합)
   */
  buildUserPrompt(medicalText, dnaAnalysisResult, ragEnhancedResult = null) {
    let ragInfo = '';

    if (ragEnhancedResult && ragEnhancedResult.success) {
      ragInfo = `
**RAG 강화 정보**:
- 추출된 의료 용어: ${ragEnhancedResult.extractedTerms?.join(', ') || '없음'}
- 컨텍스트 소스: ${ragEnhancedResult.medicalTermsContext?.results?.length || 0}개
- ICD 코드 매칭: ${ragEnhancedResult.icdCodesContext?.results?.length || 0}개
- RAG 처리 시간: ${ragEnhancedResult.processingTime || 0}ms
`;
    }

    return `🚨 DNA 시퀀싱 + Progressive RAG 기반 의료문서 분석 미션

다음은 보험 청구와 관련된 의료 기록입니다.
DNA 분석 결과와 RAG 강화 컨텍스트를 활용하여 정확한 시간축 분석을 수행하세요.

**DNA 분석 신뢰도**: ${dnaAnalysisResult.confidence || 0}
**추출된 날짜 수**: ${dnaAnalysisResult.extractedDates?.length || 0}
**DNA 패턴 수**: ${dnaAnalysisResult.dnaPatterns?.length || 0}
${ragInfo}
**분석 대상 의료 기록:**
${medicalText}

DNA 분석 결과와 RAG 컨텍스트를 기반으로 Report_Sample.txt 양식에 맞춰 정확한 의료 시간축을 구성하세요.`;
  }

  /**
   * 날짜 정보 통합
   */
  integrateDateInformation(dnaResult, aiResult) {
    const dnaDate = dnaResult.extractedDates || [];
    // AI 결과에서 날짜 추출 (간단한 정규식 기반)
    const aiDateMatches = aiResult.reportText?.match(/\d{4}-\d{2}-\d{2}/g) || [];

    // DNA 결과를 우선으로 하고 AI 결과로 보완
    const integratedDates = [...dnaDate];

    aiDateMatches.forEach(dateStr => {
      if (!integratedDates.some(d => d.standardizedDate === dateStr)) {
        integratedDates.push({
          originalText: dateStr,
          standardizedDate: dateStr,
          confidence: 0.7, // AI 추출 날짜의 기본 신뢰도
          source: 'ai_extraction'
        });
      }
    });

    return integratedDates.sort((a, b) => new Date(a.standardizedDate) - new Date(b.standardizedDate));
  }

  /**
   * 의료 이벤트 통합
   */
  integrateMedicalEvents(dnaResult, aiResult, originalText) {
    const events = [];

    // DNA 분석 결과에서 이벤트 추출
    if (dnaResult.extractedDates) {
      dnaResult.extractedDates.forEach(dateInfo => {
        events.push({
          date: dateInfo.standardizedDate,
          type: 'medical_event',
          source: 'dna_analysis',
          confidence: dateInfo.confidence || 0,
          description: dateInfo.originalText || '',
          dnaPattern: dateInfo.dnaPattern || 'unknown'
        });
      });
    }

    // AI 분석 결과에서 추가 이벤트 정보 추출
    if (aiResult.success && aiResult.reportText) {
      const eventPatterns = [
        /\[진료 기록\][\s\S]*?(?=\[|$)/g,
        /\[입원 기록\][\s\S]*?(?=\[|$)/g,
        /\[수술 기록\][\s\S]*?(?=\[|$)/g
      ];

      eventPatterns.forEach(pattern => {
        const matches = aiResult.reportText.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const dateMatch = match.match(/\d{4}-\d{2}-\d{2}/);
            if (dateMatch) {
              events.push({
                date: dateMatch[0],
                type: 'ai_extracted_event',
                source: 'ai_analysis',
                confidence: 0.8,
                description: match.trim(),
                aiGenerated: true
              });
            }
          });
        }
      });
    }

    return events.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * 통합 신뢰도 계산
   */
  calculateIntegratedConfidence(dnaResult, aiResult) {
    const dnaConfidence = dnaResult.confidence || 0;
    const aiConfidence = aiResult.success ? 0.9 : 0;

    // 가중 평균 (DNA 70%, AI 30%)
    return (dnaConfidence * 0.7) + (aiConfidence * 0.3);
  }

  /**
   * 품질 메트릭 통합
   */
  integrateQualityMetrics(dnaResult, aiResult) {
    return {
      dna: dnaResult.qualityMetrics || {},
      ai: {
        success: aiResult.success,
        processingTime: aiResult.processingTime || 0,
        tokenUsage: aiResult.tokenUsage || {}
      },
      integrated: {
        overallConfidence: this.calculateIntegratedConfidence(dnaResult, aiResult),
        dataCompleteness: this.calculateDataCompleteness(dnaResult, aiResult),
        consistency: this.calculateConsistency(dnaResult, aiResult)
      }
    };
  }

  /**
   * 품질 보증 체크 메서드들
   */
  checkDateConsistency(result) {
    const dates = result.integratedDates || [];
    const inconsistencies = [];

    // 날짜 순서 확인
    for (let i = 1; i < dates.length; i++) {
      if (new Date(dates[i].standardizedDate) < new Date(dates[i - 1].standardizedDate)) {
        inconsistencies.push(`날짜 순서 불일치: ${dates[i - 1].standardizedDate} > ${dates[i].standardizedDate}`);
      }
    }

    return {
      passed: inconsistencies.length === 0,
      score: inconsistencies.length === 0 ? 1.0 : Math.max(0, 1 - (inconsistencies.length * 0.2)),
      issues: inconsistencies
    };
  }

  checkEventCoherence(result) {
    const events = result.integratedEvents || [];
    const issues = [];

    // 이벤트 일관성 확인
    events.forEach((event, index) => {
      if (event.confidence < 0.5) {
        issues.push(`낮은 신뢰도 이벤트: ${event.description} (${event.confidence})`);
      }
    });

    return {
      passed: issues.length === 0,
      score: issues.length === 0 ? 1.0 : Math.max(0, 1 - (issues.length * 0.1)),
      issues: issues
    };
  }

  checkConfidenceThreshold(result, options) {
    const threshold = options.confidenceThreshold || this.workflowConfig.confidenceThreshold;
    const confidence = result.confidenceScore || 0;

    return {
      passed: confidence >= threshold,
      score: confidence,
      threshold: threshold,
      actual: confidence
    };
  }

  checkDataCompleteness(result) {
    const completeness = {
      hasDates: (result.integratedDates?.length || 0) > 0,
      hasEvents: (result.integratedEvents?.length || 0) > 0,
      hasConfidence: (result.confidenceScore || 0) > 0
    };

    const completenessScore = Object.values(completeness).filter(Boolean).length / Object.keys(completeness).length;

    return {
      passed: completenessScore >= 0.8,
      score: completenessScore,
      details: completeness
    };
  }

  /**
   * QA 권장사항 생성
   */
  generateQARecommendations(qaChecks) {
    const recommendations = [];

    if (!qaChecks.dateConsistency?.passed) {
      recommendations.push('날짜 일관성을 확인하고 정렬을 재검토하세요.');
    }

    if (!qaChecks.eventCoherence?.passed) {
      recommendations.push('이벤트 신뢰도가 낮은 항목들을 재검토하세요.');
    }

    if (!qaChecks.confidenceThreshold?.passed) {
      recommendations.push('전체 신뢰도가 임계값보다 낮습니다. 추가 검증이 필요합니다.');
    }

    if (!qaChecks.dataCompleteness?.passed) {
      recommendations.push('데이터 완성도가 부족합니다. 추가 정보 수집을 고려하세요.');
    }

    return recommendations.length > 0 ? recommendations : ['모든 품질 검사를 통과했습니다.'];
  }

  /**
   * 유틸리티 메서드들
   */
  generateAnalysisId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCacheKey(text, options) {
    const textHash = this.simpleHash(text);
    const optionsHash = this.simpleHash(JSON.stringify(options));
    return `${textHash}_${optionsHash}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit integer로 변환
    }
    return Math.abs(hash).toString(36);
  }

  saveToCache(key, result) {
    // 캐시 크기 제한
    if (this.analysisCache.size >= 100) {
      const firstKey = this.analysisCache.keys().next().value;
      this.analysisCache.delete(firstKey);
    }

    this.analysisCache.set(key, {
      ...result,
      cachedAt: new Date().toISOString()
    });
  }

  updatePerformanceMetrics(result, success) {
    this.performanceMetrics.totalAnalyses++;

    if (success) {
      this.performanceMetrics.successfulAnalyses++;

      if (result) {
        // 평균 처리 시간 업데이트
        const currentAvg = this.performanceMetrics.averageProcessingTime;
        const newTime = result.processingTime || 0;
        this.performanceMetrics.averageProcessingTime =
          (currentAvg * (this.performanceMetrics.successfulAnalyses - 1) + newTime) / this.performanceMetrics.successfulAnalyses;

        // 정확도 업데이트
        if (result.dnaAnalysis?.confidence) {
          this.performanceMetrics.dnaAccuracy =
            (this.performanceMetrics.dnaAccuracy * (this.performanceMetrics.successfulAnalyses - 1) + result.dnaAnalysis.confidence) /
            this.performanceMetrics.successfulAnalyses;
        }

        if (result.aiAnalysis?.success) {
          this.performanceMetrics.aiAccuracy =
            (this.performanceMetrics.aiAccuracy * (this.performanceMetrics.successfulAnalyses - 1) + 0.9) /
            this.performanceMetrics.successfulAnalyses;
        }
      }
    }

    this.performanceMetrics.lastUpdated = new Date().toISOString();
  }

  calculateDataCompleteness(dnaResult, aiResult) {
    const factors = {
      dnaSuccess: dnaResult.success ? 1 : 0,
      aiSuccess: aiResult.success ? 1 : 0,
      hasDates: (dnaResult.extractedDates?.length || 0) > 0 ? 1 : 0,
      hasPatterns: (dnaResult.dnaPatterns?.length || 0) > 0 ? 1 : 0,
      hasReport: aiResult.reportText?.length > 100 ? 1 : 0
    };

    return Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;
  }

  calculateConsistency(dnaResult, aiResult) {
    // DNA와 AI 결과 간의 일관성 계산
    const dnaDateCount = dnaResult.extractedDates?.length || 0;
    const aiDateMatches = aiResult.reportText?.match(/\d{4}-\d{2}-\d{2}/g)?.length || 0;

    if (dnaDateCount === 0 && aiDateMatches === 0) return 1.0;
    if (dnaDateCount === 0 || aiDateMatches === 0) return 0.5;

    const ratio = Math.min(dnaDateCount, aiDateMatches) / Math.max(dnaDateCount, aiDateMatches);
    return ratio;
  }

  /**
   * 서비스 상태 조회
   */
  getServiceStatus() {
    return {
      serviceName: this.serviceName,
      version: this.version,
      status: 'healthy',
      uptime: process.uptime(),
      cacheSize: this.analysisCache.size,
      performanceMetrics: this.performanceMetrics,
      workflowConfig: this.workflowConfig,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 캐시 정리
   */
  clearCache() {
    const clearedCount = this.analysisCache.size;
    this.analysisCache.clear();
    console.log(`🧹 ${this.serviceName} 캐시 정리 완료: ${clearedCount}개 항목`);
    return clearedCount;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig) {
    this.workflowConfig = {
      ...this.workflowConfig,
      ...newConfig
    };
    console.log(`⚙️ ${this.serviceName} 설정 업데이트:`, newConfig);
  }
}

export default new MedicalAnalysisService();