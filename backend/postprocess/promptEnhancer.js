/**
 * AI 프롬프트 보강 시스템 (Phase 2)
 * 의료 문서 컨텍스트를 분석하여 AI 프롬프트를 동적으로 최적화
 * 
 * 주요 기능:
 * - 의료 문서 복잡도 분석
 * - 컨텍스트 기반 프롬프트 생성
 * - 병원별 특화 프롬프트 적용
 * - AI 모델별 최적화된 프롬프트 제공
 * 
 * @version 2.0.0
 * @author VNEXSUS AI Team
 */

import fs from 'fs';
import path from 'path';

class PromptEnhancer {
  constructor() {
    this.version = '2.0.0';
    this.initialized = false;
    
    // 컨텍스트 분석 가중치
    this.contextWeights = {
      complexity: 0.3,      // 문서 복잡도
      medical_terms: 0.25,  // 의료 용어 밀도
      structure: 0.2,       // 문서 구조화 정도
      hospital_type: 0.15,  // 병원 유형별 특성
      urgency: 0.1         // 응급도/우선순위
    };
    
    // 프롬프트 템플릿 저장소
    this.promptTemplates = {
      base: {},
      enhanced: {},
      specialized: {}
    };
    
    // 의료 용어 사전
    this.medicalTerms = {
      procedures: new Set(),
      diagnoses: new Set(),
      medications: new Set(),
      anatomy: new Set()
    };
    
    // 병원별 특화 패턴
    this.hospitalPatterns = new Map();
    
    // 성능 메트릭
    this.performanceMetrics = {
      totalEnhancements: 0,
      averageImprovement: 0,
      contextAnalysisTime: 0,
      promptGenerationTime: 0
    };
    
    console.log('🚀 AI 프롬프트 보강 시스템 초기화 중...');
  }
  
  /**
   * 시스템 초기화
   */
  async initialize() {
    try {
      await this._loadMedicalTerms();
      await this._loadPromptTemplates();
      await this._loadHospitalPatterns();
      
      this.initialized = true;
      console.log('✅ AI 프롬프트 보강 시스템 초기화 완료');
      
      return {
        success: true,
        version: this.version,
        loadedTemplates: Object.keys(this.promptTemplates.base).length,
        medicalTermsCount: this._getTotalMedicalTerms()
      };
    } catch (error) {
      console.error('❌ 프롬프트 보강 시스템 초기화 실패:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 의료 문서 컨텍스트 분석 및 프롬프트 보강
   * @param {string} text - 의료 문서 텍스트
   * @param {Object} options - 보강 옵션
   * @returns {Object} 보강된 프롬프트 정보
   */
  async enhancePrompt(text, options = {}) {
    const startTime = Date.now();
    
    try {
      // 1. 컨텍스트 분석
      const context = await this._analyzeContext(text, options);
      
      // 2. 복잡도 평가
      const complexity = this._assessComplexity(context);
      
      // 3. 프롬프트 생성
      const enhancedPrompt = await this._generateEnhancedPrompt(context, complexity, options);
      
      // 4. 성능 메트릭 업데이트
      const processingTime = Date.now() - startTime;
      this._updateMetrics(processingTime, enhancedPrompt.improvementScore);
      
      console.log(`🔧 프롬프트 보강 완료: ${enhancedPrompt.improvementScore.toFixed(1)}% 개선 (${processingTime}ms)`);
      
      return {
        success: true,
        originalText: text,
        context,
        complexity,
        enhancedPrompt: enhancedPrompt.prompt,
        systemPrompt: enhancedPrompt.systemPrompt,
        metadata: {
          improvementScore: enhancedPrompt.improvementScore,
          processingTime,
          contextFeatures: context.features,
          recommendedModel: enhancedPrompt.recommendedModel
        }
      };
      
    } catch (error) {
      console.error('❌ 프롬프트 보강 실패:', error);
      return {
        success: false,
        error: error.message,
        fallbackPrompt: this._getFallbackPrompt(text)
      };
    }
  }
  
  /**
   * 의료 문서 컨텍스트 분석
   * @private
   */
  async _analyzeContext(text, options) {
    const context = {
      textLength: text.length,
      features: {},
      medicalDensity: 0,
      structureScore: 0,
      hospitalType: options.hospital || 'unknown',
      urgencyLevel: 'normal'
    };
    
    // 의료 용어 밀도 분석
    context.medicalDensity = this._calculateMedicalDensity(text);
    
    // 문서 구조 분석
    context.structureScore = this._analyzeDocumentStructure(text);
    
    // 특수 패턴 감지
    context.features = {
      hasDatePatterns: /\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(text),
      hasTimePatterns: /\d{1,2}:\d{2}/.test(text),
      hasMedicalCodes: /[A-Z]\d{2}[\.\d]*/.test(text),
      hasVitalSigns: /(BP|HR|RR|Temp|체온|혈압|맥박)/.test(text),
      hasLabResults: /(검사결과|Lab|laboratory|혈액검사)/.test(text),
      hasImagingResults: /(MRI|CT|X-ray|초음파|영상)/.test(text),
      hasPrescriptions: /(처방|medication|약물|투약)/.test(text)
    };
    
    // 응급도 평가
    context.urgencyLevel = this._assessUrgency(text);
    
    return context;
  }
  
  /**
   * 문서 복잡도 평가
   * @private
   */
  _assessComplexity(context) {
    let complexityScore = 0;
    
    // 텍스트 길이 기반 복잡도
    if (context.textLength > 50000) complexityScore += 0.4;
    else if (context.textLength > 20000) complexityScore += 0.3;
    else if (context.textLength > 5000) complexityScore += 0.2;
    else complexityScore += 0.1;
    
    // 의료 용어 밀도 기반
    complexityScore += context.medicalDensity * 0.3;
    
    // 구조화 정도 (역상관)
    complexityScore += (1 - context.structureScore) * 0.2;
    
    // 특수 패턴 개수
    const featureCount = Object.values(context.features).filter(Boolean).length;
    complexityScore += (featureCount / 7) * 0.1;
    
    return Math.min(complexityScore, 1.0);
  }
  
  /**
   * 보강된 프롬프트 생성
   * @private
   */
  async _generateEnhancedPrompt(context, complexity, options) {
    const basePrompt = this._getBasePrompt(options.taskType || 'general');
    
    // 복잡도별 프롬프트 조정
    let enhancedPrompt = basePrompt;
    let systemPrompt = this._getSystemPrompt('standard');
    let improvementScore = 0;
    
    if (complexity > 0.7) {
      // 고복잡도: 상세 분석 프롬프트
      enhancedPrompt = this._buildComplexPrompt(context, basePrompt);
      systemPrompt = this._getSystemPrompt('expert');
      improvementScore = 35;
    } else if (complexity > 0.4) {
      // 중복잡도: 균형 프롬프트
      enhancedPrompt = this._buildBalancedPrompt(context, basePrompt);
      systemPrompt = this._getSystemPrompt('standard');
      improvementScore = 20;
    } else {
      // 저복잡도: 간소화 프롬프트
      enhancedPrompt = this._buildSimplePrompt(context, basePrompt);
      systemPrompt = this._getSystemPrompt('efficient');
      improvementScore = 15;
    }
    
    // 병원별 특화 적용
    if (context.hospitalType !== 'unknown' && this.hospitalPatterns.has(context.hospitalType)) {
      enhancedPrompt = this._applyHospitalSpecialization(enhancedPrompt, context.hospitalType);
      improvementScore += 10;
    }
    
    // 컨텍스트 특성 반영
    enhancedPrompt = this._applyContextFeatures(enhancedPrompt, context.features);
    improvementScore += Object.values(context.features).filter(Boolean).length * 2;
    
    return {
      prompt: enhancedPrompt,
      systemPrompt,
      improvementScore: Math.min(improvementScore, 100),
      recommendedModel: this._recommendModel(complexity, context)
    };
  }
  
  /**
   * 의료 용어 밀도 계산
   * @private
   */
  _calculateMedicalDensity(text) {
    const words = text.toLowerCase().split(/\s+/);
    let medicalTermCount = 0;
    
    for (const word of words) {
      if (this._isMedicalTerm(word)) {
        medicalTermCount++;
      }
    }
    
    return words.length > 0 ? medicalTermCount / words.length : 0;
  }
  
  /**
   * 문서 구조 분석
   * @private
   */
  _analyzeDocumentStructure(text) {
    let structureScore = 0;
    
    // 섹션 헤더 존재
    if (/^[A-Z\s]{3,}:|\d+\.\s+[A-Z]/.test(text)) structureScore += 0.3;
    
    // 목록 구조
    if (/[-*•]\s+/.test(text) || /\d+\)\s+/.test(text)) structureScore += 0.2;
    
    // 표 구조
    if (/\|.*\|/.test(text) || /\t.*\t/.test(text)) structureScore += 0.2;
    
    // 일관된 날짜 형식
    const dateMatches = text.match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g);
    if (dateMatches && dateMatches.length > 2) structureScore += 0.15;
    
    // 의료 코드 일관성
    if (/[A-Z]\d{2}[\.\d]*/.test(text)) structureScore += 0.15;
    
    return Math.min(structureScore, 1.0);
  }
  
  /**
   * 응급도 평가
   * @private
   */
  _assessUrgency(text) {
    const urgentKeywords = ['응급', '급성', 'emergency', 'urgent', '위급', '심각'];
    const routineKeywords = ['정기', 'routine', '예약', '검진'];
    
    const urgentCount = urgentKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword)).length;
    const routineCount = routineKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword)).length;
    
    if (urgentCount > routineCount) return 'urgent';
    if (routineCount > 0) return 'routine';
    return 'normal';
  }
  
  /**
   * 의료 용어 여부 확인
   * @private
   */
  _isMedicalTerm(word) {
    return this.medicalTerms.procedures.has(word) ||
           this.medicalTerms.diagnoses.has(word) ||
           this.medicalTerms.medications.has(word) ||
           this.medicalTerms.anatomy.has(word);
  }
  
  /**
   * 기본 프롬프트 템플릿 로드
   * @private
   */
  async _loadPromptTemplates() {
    this.promptTemplates.base = {
      general: `다음 의료 문서를 분석하여 주요 정보를 추출하고 구조화하세요.
      
문서 내용:
{text}

분석 요구사항:
1. 환자 기본 정보
2. 주요 진단 및 소견
3. 치료 계획 및 처방
4. 중요 날짜 및 일정
5. 추가 검사 필요사항

결과를 JSON 형식으로 구조화하여 제공하세요.`,

      extraction: `의료 문서에서 핵심 정보를 정확하게 추출하세요.
      
문서: {text}

추출 대상:
- 환자 정보 (이름, 나이, 성별)
- 진료 날짜 및 시간
- 진단명 및 질병 코드
- 처방 약물 및 용법
- 검사 결과 및 수치
- 의료진 소견

정확성을 최우선으로 하며, 불확실한 정보는 명시하세요.`,

      summary: `의료 문서를 간결하고 명확하게 요약하세요.
      
원본 문서:
{text}

요약 기준:
1. 핵심 의료 정보만 포함
2. 시간순 정리
3. 중요도별 우선순위
4. 의료진 및 환자가 이해하기 쉬운 언어 사용

3-5개 문단으로 구성된 요약을 제공하세요.`
    };
    
    this.promptTemplates.enhanced = {
      complex: `복잡한 의료 케이스 분석을 위한 심층 분석을 수행하세요.`,
      simple: `간단한 의료 문서 처리를 위한 효율적 분석을 수행하세요.`,
      balanced: `표준적인 복잡도의 의료 문서를 균형있게 분석하세요.`
    };
  }
  
  /**
   * 의료 용어 사전 로드
   * @private
   */
  async _loadMedicalTerms() {
    // 기본 의료 용어 세트 (실제 구현시 외부 파일에서 로드)
    const basicTerms = {
      procedures: ['수술', 'surgery', 'MRI', 'CT', 'X-ray', '검사', '치료'],
      diagnoses: ['진단', '질병', '증상', '소견', '병변', '이상'],
      medications: ['약물', '처방', '투약', '복용', '주사', 'medication'],
      anatomy: ['심장', '폐', '간', '신장', '뇌', '혈관', '근육']
    };
    
    for (const [category, terms] of Object.entries(basicTerms)) {
      this.medicalTerms[category] = new Set(terms);
    }
  }
  
  /**
   * 병원별 패턴 로드
   * @private
   */
  async _loadHospitalPatterns() {
    // 기본 병원 패턴 (실제 구현시 외부 데이터에서 로드)
    this.hospitalPatterns.set('대학병원', {
      specialization: 'academic',
      promptModifiers: ['상세한 의학적 근거 제시', '연구 데이터 포함']
    });
    
    this.hospitalPatterns.set('종합병원', {
      specialization: 'general',
      promptModifiers: ['포괄적 진료 정보', '다학제 접근']
    });
    
    this.hospitalPatterns.set('전문병원', {
      specialization: 'specialized',
      promptModifiers: ['전문 분야 집중', '특화된 치료법']
    });
  }
  
  /**
   * 복잡도별 프롬프트 빌더
   * @private
   */
  _buildComplexPrompt(context, basePrompt) {
    return `${basePrompt}

고복잡도 문서 분석 지침:
- 다중 진료과 연관성 분석
- 시간적 인과관계 추적
- 복합 진단 가능성 검토
- 상호작용 및 부작용 고려
- 장기적 치료 계획 수립

특별 주의사항:
- 의료진 간 소통 내용 정리
- 환자 상태 변화 추이 분석
- 응급 상황 대응 방안 포함`;
  }
  
  _buildBalancedPrompt(context, basePrompt) {
    return `${basePrompt}

표준 분석 지침:
- 주요 진료 정보 중심 정리
- 핵심 진단 및 치료 계획
- 필수 추적 관찰 사항
- 환자 교육 및 주의사항`;
  }
  
  _buildSimplePrompt(context, basePrompt) {
    return `${basePrompt}

간소화 분석 지침:
- 핵심 정보만 추출
- 명확하고 간결한 정리
- 즉시 필요한 조치사항 우선`;
  }
  
  /**
   * 시스템 프롬프트 생성
   * @private
   */
  _getSystemPrompt(level) {
    const systemPrompts = {
      efficient: '당신은 효율적인 의료 정보 처리 전문가입니다. 핵심 정보를 빠르고 정확하게 추출하세요.',
      standard: '당신은 의료 문서 분석 전문가입니다. 정확하고 체계적인 분석을 제공하세요.',
      expert: '당신은 고급 의료 정보 분석 전문가입니다. 복잡한 케이스에 대한 심층적이고 포괄적인 분석을 수행하세요.'
    };
    
    return systemPrompts[level] || systemPrompts.standard;
  }
  
  /**
   * 기본 프롬프트 반환
   * @private
   */
  _getBasePrompt(taskType) {
    return this.promptTemplates.base[taskType] || this.promptTemplates.base.general;
  }
  
  /**
   * 병원별 특화 적용
   * @private
   */
  _applyHospitalSpecialization(prompt, hospitalType) {
    const pattern = this.hospitalPatterns.get(hospitalType);
    if (!pattern) return prompt;
    
    const modifiers = pattern.promptModifiers.join('\n- ');
    return `${prompt}

${hospitalType} 특화 요구사항:
- ${modifiers}`;
  }
  
  /**
   * 컨텍스트 특성 반영
   * @private
   */
  _applyContextFeatures(prompt, features) {
    const activeFeatures = Object.entries(features)
      .filter(([key, value]) => value)
      .map(([key]) => key);
    
    if (activeFeatures.length === 0) return prompt;
    
    const featureInstructions = {
      hasDatePatterns: '시간순 정렬 및 날짜 정확성 검증',
      hasTimePatterns: '시간 정보 정밀 추출',
      hasMedicalCodes: '의료 코드 검증 및 분류',
      hasVitalSigns: '생체 징후 트렌드 분석',
      hasLabResults: '검사 결과 정상/비정상 판정',
      hasImagingResults: '영상 소견 구조화',
      hasPrescriptions: '처방 정보 안전성 검토'
    };
    
    const instructions = activeFeatures
      .map(feature => featureInstructions[feature])
      .filter(Boolean)
      .join('\n- ');
    
    return `${prompt}

특별 처리 요구사항:
- ${instructions}`;
  }
  
  /**
   * AI 모델 추천
   * @private
   */
  _recommendModel(complexity, context) {
    if (complexity > 0.7) {
      return 'gpt-4o'; // 고복잡도: 고성능 모델
    } else if (complexity > 0.4) {
      return 'gpt-4o-mini'; // 중복잡도: 균형 모델
    } else {
      return 'gpt-4o-mini'; // 저복잡도: 효율 모델
    }
  }
  
  /**
   * 폴백 프롬프트 제공
   * @private
   */
  _getFallbackPrompt(text) {
    return {
      prompt: `다음 의료 문서를 분석하여 주요 정보를 추출하세요:\n\n${text.substring(0, 1000)}...`,
      systemPrompt: '당신은 의료 문서 분석 AI입니다. 정확하고 유용한 정보를 제공하세요.',
      metadata: { fallback: true }
    };
  }
  
  /**
   * 성능 메트릭 업데이트
   * @private
   */
  _updateMetrics(processingTime, improvementScore) {
    this.performanceMetrics.totalEnhancements++;
    this.performanceMetrics.averageImprovement = 
      (this.performanceMetrics.averageImprovement * (this.performanceMetrics.totalEnhancements - 1) + improvementScore) 
      / this.performanceMetrics.totalEnhancements;
    this.performanceMetrics.promptGenerationTime = 
      (this.performanceMetrics.promptGenerationTime * (this.performanceMetrics.totalEnhancements - 1) + processingTime) 
      / this.performanceMetrics.totalEnhancements;
  }
  
  /**
   * 전체 의료 용어 수 반환
   * @private
   */
  _getTotalMedicalTerms() {
    return Object.values(this.medicalTerms)
      .reduce((total, termSet) => total + termSet.size, 0);
  }
  
  /**
   * 성능 메트릭 반환
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      version: this.version,
      initialized: this.initialized
    };
  }
  
  /**
   * 시스템 상태 확인
   */
  getSystemStatus() {
    return {
      version: this.version,
      initialized: this.initialized,
      templatesLoaded: Object.keys(this.promptTemplates.base).length,
      medicalTermsCount: this._getTotalMedicalTerms(),
      hospitalPatternsCount: this.hospitalPatterns.size,
      totalEnhancements: this.performanceMetrics.totalEnhancements
    };
  }
}

// 싱글톤 인스턴스 생성
const promptEnhancer = new PromptEnhancer();

export default promptEnhancer;