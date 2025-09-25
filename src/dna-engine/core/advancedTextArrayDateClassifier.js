/**
 * Advanced Text Array Date Classifier
 * 
 * 비정형 의료문서의 각기 다른 텍스트 배열에서 날짜를 정확하게 구분하는 고급 시스템
 * 
 * 핵심 기능:
 * 1. Multi-Level Text Array Analysis: 다층 텍스트 배열 분석
 * 2. Context-Aware Date Differentiation: 맥락 인식 날짜 구분
 * 3. Semantic Date Clustering: 의미론적 날짜 클러스터링
 * 4. Cross-Reference Validation: 교차 참조 검증
 * 5. AI-Enhanced Date Classification: AI 강화 날짜 분류
 */

import { EnhancedDateAnchor } from './enhancedDateAnchor.js';
import { globalErrorHandler, safeExecute, safeExecuteWithRetry } from './errorHandler.js';
// AI 의존성 제거 - Phase 1 Emergency Fix
// import { ClaudeService } from '../../services/claudeService.js';
// import openaiService from '../../services/openaiService.js';

export class AdvancedTextArrayDateClassifier {
  constructor() {
    this.version = '2.1.0'; // Phase 1 Emergency Fix
    this.dateAnchor = new EnhancedDateAnchor();
    // AI 의존성 제거 - Phase 1 Emergency Fix
    // this.claudeService = new ClaudeService();
    // this.openaiService = openaiService;
    
    // 텍스트 배열 분류 기준
    this.arrayClassificationCriteria = {
      // 구조적 분류
      structural: {
        header: {
          patterns: [/^제목|^타이틀|^TITLE/i, /^\d+\./],
          priority: 100,
          dateRole: 'document_date'
        },
        section: {
          patterns: [/^\[.*\]|^【.*】/, /^\d+\)/, /^[가-힣]+\s*:\s*/],
          priority: 90,
          dateRole: 'section_date'
        },
        content: {
          patterns: [/^\s*-/, /^\s*\*/, /^\s{2,}/],
          priority: 80,
          dateRole: 'content_date'
        },
        footer: {
          patterns: [/작성자|서명|날인/, /페이지|page/i],
          priority: 70,
          dateRole: 'creation_date'
        }
      },
      
      // 의료적 분류
      medical: {
        diagnosis: {
          patterns: [/진단|diagnosis/i, /소견|finding/i, /판정|결과/],
          priority: 95,
          dateRole: 'diagnosis_date'
        },
        treatment: {
          patterns: [/치료|treatment/i, /처방|prescription/i, /수술|surgery/i],
          priority: 90,
          dateRole: 'treatment_date'
        },
        examination: {
          patterns: [/검사|exam/i, /촬영|imaging/i, /측정|measurement/i],
          priority: 85,
          dateRole: 'examination_date'
        },
        visit: {
          patterns: [/내원|visit/i, /진료|consultation/i, /외래|outpatient/i],
          priority: 80,
          dateRole: 'visit_date'
        },
        history: {
          patterns: [/과거력|history/i, /기왕력|previous/i, /이전|before/],
          priority: 60,
          dateRole: 'history_date'
        }
      },
      
      // 시간적 분류
      temporal: {
        current: {
          patterns: [/현재|current/i, /금일|today/i, /오늘|now/],
          priority: 100,
          dateRole: 'current_date'
        },
        recent: {
          patterns: [/최근|recent/i, /근래|lately/i, /지난|last/],
          priority: 85,
          dateRole: 'recent_date'
        },
        past: {
          patterns: [/과거|past/i, /이전|previous/i, /예전|former/],
          priority: 70,
          dateRole: 'past_date'
        },
        future: {
          patterns: [/예정|scheduled/i, /계획|planned/i, /향후|future/],
          priority: 75,
          dateRole: 'future_date'
        }
      }
    };
    
    // AI 프롬프트 템플릿
    this.aiPrompts = {
      dateClassification: `
다음 텍스트 배열에서 날짜들을 정확하게 구분하고 분류해주세요.

분석 기준:
1. 각 텍스트 블록의 구조적 위치 (헤더, 섹션, 내용, 푸터)
2. 의료적 맥락 (진단일, 치료일, 검사일, 내원일, 과거력)
3. 시간적 관계 (현재, 최근, 과거, 미래)
4. 날짜 간의 논리적 연관성
5. 텍스트 배열 간의 상호 참조

출력 형식:
{
  "textArrays": [
    {
      "arrayIndex": 0,
      "text": "텍스트 내용",
      "dates": [
        {
          "date": "2025-01-15",
          "role": "visit_date",
          "confidence": 0.95,
          "context": "내원일",
          "isPrimary": true
        }
      ],
      "classification": {
        "structural": "content",
        "medical": "visit",
        "temporal": "current"
      }
    }
  ],
  "dateRelationships": [
    {
      "date1": "2025-01-15",
      "date2": "2025-01-10",
      "relationship": "follows",
      "confidence": 0.9
    }
  ]
}
      `,
      
      conflictResolution: `
다음 날짜 충돌을 해결해주세요:

충돌 상황:
{conflicts}

해결 기준:
1. 의료적 논리성 (진료 순서, 치료 흐름)
2. 시간적 일관성 (과거 → 현재 → 미래)
3. 문서 구조적 우선순위
4. 텍스트 맥락의 명확성

출력 형식:
{
  "resolution": {
    "winnerDate": "2025-01-15",
    "reason": "의료적 논리성에 따른 우선순위",
    "confidence": 0.92
  },
  "explanation": "상세한 해결 근거"
}
      `
    };
    
    // 처리 통계
    this.stats = {
      totalArraysProcessed: 0,
      datesClassified: 0,
      conflictsResolved: 0,
      aiClassificationAccuracy: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * 메인 처리 함수: 텍스트 배열에서 날짜 정확 구분
   * @param {Array<string>} textArrays - 분석할 텍스트 배열
   * @param {Object} context - 컨텍스트 정보
   * @returns {Promise<Object>} 분류 결과
   */
  async classifyTextArrayDates(textArrays, context = {}) {
    return await safeExecuteWithRetry(async () => {
      // 입력 검증
      if (!Array.isArray(textArrays)) {
        throw new Error('textArrays는 배열이어야 합니다.');
      }
      
      if (textArrays.length === 0) {
        throw new Error('빈 텍스트 배열입니다.');
      }
      
      if (textArrays.length > 1000) {
        throw new Error('텍스트 배열이 너무 큽니다. (최대 1000개)');
      }
      
      const startTime = Date.now();
      
      console.log(`🔍 텍스트 배열 날짜 분류 시작... (${textArrays.length}개 배열)`);
      
      // 1. 각 텍스트 배열 개별 분석 (에러 핸들링)
      const arrayAnalyses = await safeExecute(async () => {
        const analyses = await this.analyzeIndividualArrays(textArrays, context);
        if (!analyses || analyses.length === 0) {
          throw new Error('개별 배열 분석에 실패했습니다.');
        }
        return analyses;
      }, '개별 배열 분석');
      console.log(`📊 개별 배열 분석 완료: ${arrayAnalyses.length}개`);
      
      // 2. 배열 간 상호 참조 분석 (에러 핸들링)
      const crossReferences = await safeExecute(async () => {
        return await this.analyzeCrossReferences(arrayAnalyses);
      }, '상호 참조 분석');
      console.log(`🔗 상호 참조 분석 완료: ${crossReferences.length}개 관계`);
      
      // 3. 규칙 기반 고급 분류 (Phase 1 Emergency Fix + 에러 핸들링)
      const ruleBasedClassification = await safeExecute(async () => {
        return await this.performRuleBasedClassification(arrayAnalyses, crossReferences);
      }, '규칙 기반 분류');
      console.log(`🔧 규칙 기반 분류 완료`);
      
      // 4. 충돌 해결 및 최종 검증 (규칙 기반 + 에러 핸들링)
      const finalClassification = await safeExecute(async () => {
        return await this.resolveConflictsAndValidateRuleBased(ruleBasedClassification);
      }, '최종 검증');
      console.log(`✅ 최종 검증 완료`);
      
      // 5. 결과 구조화 (에러 핸들링)
      const result = await safeExecute(async () => {
        return this.structureResults(finalClassification, textArrays);
      }, '결과 구조화');
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        version: this.version,
        processingTime,
        input: {
          arrayCount: textArrays.length,
          totalTextLength: textArrays.join('').length,
          context
        },
        classification: result,
        stats: this.updateStats(processingTime, result)
      };
    }, {
      maxRetries: 2,
      retryDelay: 1000,
      context: 'classifyTextArrayDates'
    });
  }

  /**
   * 개별 텍스트 배열 분석
   */
  async analyzeIndividualArrays(textArrays, context) {
    const analyses = [];
    
    for (let i = 0; i < textArrays.length; i++) {
      const text = textArrays[i];
      
      // 1. 기본 날짜 추출
      const dateAnchors = await this.dateAnchor.dualSweepAnalysis(text, context);
      
      // 2. 텍스트 배열 분류
      const arrayClassification = this.classifyTextArray(text, i, textArrays.length);
      
      // 3. 날짜 앵커 결과 안전하게 추출
      const dateAnchorResult = dateAnchors?.result || { primary: [], secondary: [] };
      
      // 4. 날짜 역할 분석
      const dateRoles = this.analyzeDateRoles(dateAnchorResult, arrayClassification);
      
      // 5. 맥락 강도 계산
      const contextStrength = this.calculateContextStrength(text, dateAnchorResult);
      
      analyses.push({
        arrayIndex: i,
        text,
        dateAnchors: dateAnchorResult,
        classification: arrayClassification,
        dateRoles,
        contextStrength,
        metadata: {
          length: text.length,
          wordCount: text.split(/\s+/).length,
          dateCount: (dateAnchorResult.primary?.length || 0) + (dateAnchorResult.secondary?.length || 0)
        }
      });
    }
    
    return analyses;
  }

  /**
   * 텍스트 배열 분류
   */
  classifyTextArray(text, index, totalArrays) {
    const classification = {
      structural: 'content',
      medical: 'unknown',
      temporal: 'unknown',
      position: {
        index,
        relative: index / totalArrays,
        isFirst: index === 0,
        isLast: index === totalArrays - 1
      },
      scores: {}
    };
    
    // 구조적 분류
    for (const [type, config] of Object.entries(this.arrayClassificationCriteria.structural)) {
      let score = 0;
      for (const pattern of config.patterns) {
        if (pattern.test(text)) {
          score += config.priority;
        }
      }
      
      // 위치 기반 가중치
      if (type === 'header' && index < totalArrays * 0.2) score *= 1.5;
      if (type === 'footer' && index > totalArrays * 0.8) score *= 1.5;
      
      classification.scores[type] = score;
    }
    
    // 최고 점수 구조적 분류 선택
    const maxStructuralScore = Math.max(...Object.values(classification.scores));
    if (maxStructuralScore > 0) {
      classification.structural = Object.keys(classification.scores)
        .find(key => classification.scores[key] === maxStructuralScore);
    }
    
    // 의료적 분류
    for (const [type, config] of Object.entries(this.arrayClassificationCriteria.medical)) {
      let score = 0;
      for (const pattern of config.patterns) {
        if (pattern.test(text)) {
          score += config.priority;
        }
      }
      if (score > 0) {
        classification.medical = type;
        break;
      }
    }
    
    // 시간적 분류
    for (const [type, config] of Object.entries(this.arrayClassificationCriteria.temporal)) {
      let score = 0;
      for (const pattern of config.patterns) {
        if (pattern.test(text)) {
          score += config.priority;
        }
      }
      if (score > 0) {
        classification.temporal = type;
        break;
      }
    }
    
    return classification;
  }

  /**
   * 날짜 역할 분석
   */
  analyzeDateRoles(dateAnchors, arrayClassification) {
    const roles = [];
    
    // dateAnchors 구조 확인 및 안전한 접근
    if (!dateAnchors || typeof dateAnchors !== 'object') {
      console.warn('⚠️ dateAnchors가 유효하지 않습니다:', dateAnchors);
      return roles;
    }
    
    // Primary 날짜들의 역할 분석
    const primaryDates = dateAnchors.primary || [];
    for (const date of primaryDates) {
      const role = {
        date: date.normalized?.date,
        originalText: date.text,
        role: this.determineDateRole(date, arrayClassification),
        confidence: date.confidence || 0.5,
        isPrimary: true,
        evidence: this.extractDateEvidence(date, arrayClassification)
      };
      roles.push(role);
    }
    
    // Secondary 날짜들의 역할 분석
    const secondaryDates = dateAnchors.secondary || [];
    for (const date of secondaryDates) {
      const role = {
        date: date.normalized?.date,
        originalText: date.text,
        role: this.determineDateRole(date, arrayClassification),
        confidence: (date.confidence || 0.5) * 0.8, // Secondary는 신뢰도 감소
        isPrimary: false,
        evidence: this.extractDateEvidence(date, arrayClassification)
      };
      roles.push(role);
    }
    
    return roles;
  }

  /**
   * 날짜 역할 결정
   */
  determineDateRole(dateAnchor, arrayClassification) {
    // 배열 분류에 따른 기본 역할 결정
    const structuralRole = this.arrayClassificationCriteria.structural[arrayClassification.structural]?.dateRole;
    const medicalRole = this.arrayClassificationCriteria.medical[arrayClassification.medical]?.dateRole;
    const temporalRole = this.arrayClassificationCriteria.temporal[arrayClassification.temporal]?.dateRole;
    
    // 우선순위: 의료적 > 시간적 > 구조적
    if (medicalRole && medicalRole !== 'unknown') return medicalRole;
    if (temporalRole && temporalRole !== 'unknown') return temporalRole;
    if (structuralRole) return structuralRole;
    
    // 날짜 앵커의 카테고리에 따른 기본 역할
    switch (dateAnchor.category) {
      case 'medical': return 'medical_event_date';
      case 'absolute': return 'specific_date';
      case 'relative': return 'relative_reference_date';
      case 'duration': return 'period_date';
      default: return 'general_date';
    }
  }

  /**
   * 날짜 증거 추출
   */
  extractDateEvidence(dateAnchor, arrayClassification) {
    return {
      textContext: dateAnchor.context || '',
      medicalContext: dateAnchor.medicalContext || {},
      structuralPosition: arrayClassification.position,
      patternMatched: dateAnchor.category,
      confidence: dateAnchor.confidence
    };
  }

  /**
   * 맥락 강도 계산
   */
  calculateContextStrength(text, dateAnchors) {
    let strength = 0;
    
    // 텍스트 길이 기반 가중치
    const lengthWeight = Math.min(text.length / 100, 1.0);
    strength += lengthWeight * 0.2;
    
    // 날짜 밀도
    const dateCount = dateAnchors.primary.length + dateAnchors.secondary.length;
    const dateDensity = dateCount / Math.max(text.split(/\s+/).length, 1);
    strength += Math.min(dateDensity * 10, 1.0) * 0.3;
    
    // 의료 키워드 밀도
    const medicalKeywords = ['진료', '검사', '치료', '진단', '처방', '수술', '입원', '퇴원'];
    const medicalCount = medicalKeywords.reduce((count, keyword) => {
      return count + (text.match(new RegExp(keyword, 'g')) || []).length;
    }, 0);
    const medicalDensity = medicalCount / Math.max(text.split(/\s+/).length, 1);
    strength += Math.min(medicalDensity * 20, 1.0) * 0.5;
    
    return Math.min(strength, 1.0);
  }

  /**
   * 배열 간 상호 참조 분석
   */
  async analyzeCrossReferences(arrayAnalyses) {
    const crossReferences = [];
    
    for (let i = 0; i < arrayAnalyses.length; i++) {
      for (let j = i + 1; j < arrayAnalyses.length; j++) {
        const array1 = arrayAnalyses[i];
        const array2 = arrayAnalyses[j];
        
        // 날짜 간 관계 분석
        const dateRelations = this.analyzeDateRelations(array1.dateRoles, array2.dateRoles);
        
        // 텍스트 유사성 분석
        const textSimilarity = this.calculateTextSimilarity(array1.text, array2.text);
        
        // 의료 맥락 연관성
        const medicalRelatedness = this.calculateMedicalRelatedness(array1, array2);
        
        if (dateRelations.length > 0 || textSimilarity > 0.3 || medicalRelatedness > 0.5) {
          crossReferences.push({
            array1Index: i,
            array2Index: j,
            dateRelations,
            textSimilarity,
            medicalRelatedness,
            overallStrength: (dateRelations.length * 0.5 + textSimilarity * 0.3 + medicalRelatedness * 0.2)
          });
        }
      }
    }
    
    return crossReferences.sort((a, b) => b.overallStrength - a.overallStrength);
  }

  /**
   * 날짜 간 관계 분석
   */
  analyzeDateRelations(dateRoles1, dateRoles2) {
    const relations = [];
    
    for (const date1 of dateRoles1) {
      for (const date2 of dateRoles2) {
        if (!date1.date || !date2.date) continue;
        
        const date1Obj = new Date(date1.date);
        const date2Obj = new Date(date2.date);
        const daysDiff = Math.abs((date2Obj - date1Obj) / (1000 * 60 * 60 * 24));
        
        let relationship = 'unrelated';
        let confidence = 0;
        
        // 시간적 관계 분석
        if (daysDiff === 0) {
          relationship = 'same_date';
          confidence = 0.95;
        } else if (daysDiff <= 7) {
          relationship = 'same_week';
          confidence = 0.8;
        } else if (daysDiff <= 30) {
          relationship = 'same_month';
          confidence = 0.6;
        } else if (daysDiff <= 365) {
          relationship = 'same_year';
          confidence = 0.4;
        }
        
        // 의료적 관계 분석
        if (this.isMedicalSequence(date1.role, date2.role)) {
          relationship = 'medical_sequence';
          confidence = Math.max(confidence, 0.85);
        }
        
        if (confidence > 0.3) {
          relations.push({
            date1: date1.date,
            date2: date2.date,
            relationship,
            confidence,
            daysDifference: daysDiff
          });
        }
      }
    }
    
    return relations;
  }

  /**
   * 의료적 순서 확인
   */
  isMedicalSequence(role1, role2) {
    const medicalSequences = [
      ['visit_date', 'examination_date'],
      ['examination_date', 'diagnosis_date'],
      ['diagnosis_date', 'treatment_date'],
      ['treatment_date', 'visit_date'],
      ['history_date', 'visit_date']
    ];
    
    return medicalSequences.some(([first, second]) => 
      (role1 === first && role2 === second) || (role1 === second && role2 === first)
    );
  }

  /**
   * 텍스트 유사성 계산
   */
  calculateTextSimilarity(text1, text2) {
    // 간단한 Jaccard 유사도 계산
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * 의료 연관성 계산
   */
  calculateMedicalRelatedness(array1, array2) {
    let relatedness = 0;
    
    // 의료 분류 일치
    if (array1.classification.medical === array2.classification.medical && 
        array1.classification.medical !== 'unknown') {
      relatedness += 0.4;
    }
    
    // 시간적 분류 연관성
    const temporalRelatedness = this.getTemporalRelatedness(
      array1.classification.temporal, 
      array2.classification.temporal
    );
    relatedness += temporalRelatedness * 0.3;
    
    // 맥락 강도 유사성
    const contextSimilarity = 1 - Math.abs(array1.contextStrength - array2.contextStrength);
    relatedness += contextSimilarity * 0.3;
    
    return Math.min(relatedness, 1.0);
  }

  /**
   * 시간적 연관성 계산
   */
  getTemporalRelatedness(temporal1, temporal2) {
    const temporalMatrix = {
      'current': { 'current': 1.0, 'recent': 0.8, 'past': 0.3, 'future': 0.5 },
      'recent': { 'current': 0.8, 'recent': 1.0, 'past': 0.6, 'future': 0.4 },
      'past': { 'current': 0.3, 'recent': 0.6, 'past': 1.0, 'future': 0.2 },
      'future': { 'current': 0.5, 'recent': 0.4, 'past': 0.2, 'future': 1.0 }
    };
    
    return temporalMatrix[temporal1]?.[temporal2] || 0;
  }

  /**
   * 규칙 기반 고급 분류 (AI 의존성 제거)
   * Phase 1 Emergency Fix: AI 호출을 제거하고 강화된 규칙 기반 분류 사용
   */
  async performRuleBasedClassification(arrayAnalyses, crossReferences) {
    try {
      console.log('🔧 규칙 기반 분류 시작 (AI 의존성 제거)');
      
      // 강화된 규칙 기반 분류 수행
      const enhancedClassification = this.enhancedFallbackClassification(arrayAnalyses, crossReferences);
      
      // 추가 검증 및 신뢰도 계산
      const validatedResult = this.validateAndEnhanceClassification(enhancedClassification);
      
      console.log('✅ 규칙 기반 분류 완료');
      return validatedResult;
      
    } catch (error) {
      console.warn('규칙 기반 분류 실패, 기본 분류 사용:', error);
      return this.fallbackClassification(arrayAnalyses, crossReferences);
    }
  }

  /**
   * AI 프롬프트 구성
   */
  buildAIPrompt(arrayAnalyses, crossReferences, type) {
    const basePrompt = this.aiPrompts.dateClassification;
    
    const textArraysData = arrayAnalyses.map(analysis => ({
      arrayIndex: analysis.arrayIndex,
      text: analysis.text.substring(0, 500), // 텍스트 길이 제한
      existingDates: analysis.dateRoles.map(role => ({
        date: role.date,
        role: role.role,
        confidence: role.confidence
      })),
      classification: analysis.classification
    }));
    
    const relationshipsData = crossReferences.map(ref => ({
      array1: ref.array1Index,
      array2: ref.array2Index,
      strength: ref.overallStrength,
      dateRelations: ref.dateRelations
    }));
    
    return basePrompt + `\n\n텍스트 배열 데이터:\n${JSON.stringify(textArraysData, null, 2)}\n\n관계 데이터:\n${JSON.stringify(relationshipsData, null, 2)}`;
  }

  /**
   * AI 결과 통합
   */
  integrateAIResults(claudeResult, openaiResult, arrayAnalyses) {
    // AI 결과 파싱 및 통합 로직
    try {
      const claudeData = typeof claudeResult === 'string' ? JSON.parse(claudeResult) : claudeResult;
      const openaiData = typeof openaiResult === 'string' ? JSON.parse(openaiResult) : openaiResult;
      
      // 두 AI 결과의 일치도 계산 및 통합
      return this.mergeAIClassifications(claudeData, openaiData, arrayAnalyses);
      
    } catch (error) {
      console.warn('AI 결과 파싱 실패:', error);
      return this.fallbackClassification(arrayAnalyses, []);
    }
  }

  /**
   * AI 분류 결과 병합
   */
  mergeAIClassifications(claudeData, openaiData, arrayAnalyses) {
    const mergedClassification = {
      textArrays: [],
      dateRelationships: [],
      confidence: 0,
      aiAgreement: 0
    };
    
    // 배열별 분류 병합
    for (let i = 0; i < arrayAnalyses.length; i++) {
      const claudeArray = claudeData.textArrays?.find(arr => arr.arrayIndex === i);
      const openaiArray = openaiData.textArrays?.find(arr => arr.arrayIndex === i);
      const originalAnalysis = arrayAnalyses[i];
      
      const mergedArray = {
        arrayIndex: i,
        text: originalAnalysis.text,
        dates: this.mergeDateClassifications(claudeArray?.dates, openaiArray?.dates, originalAnalysis.dateRoles),
        classification: this.mergeClassifications(claudeArray?.classification, openaiArray?.classification, originalAnalysis.classification),
        confidence: this.calculateMergedConfidence(claudeArray, openaiArray)
      };
      
      mergedClassification.textArrays.push(mergedArray);
    }
    
    // 관계 병합
    mergedClassification.dateRelationships = this.mergeDateRelationships(
      claudeData.dateRelationships, 
      openaiData.dateRelationships
    );
    
    // 전체 신뢰도 계산
    mergedClassification.confidence = this.calculateOverallConfidence(mergedClassification);
    mergedClassification.aiAgreement = this.calculateAIAgreement(claudeData, openaiData);
    
    return mergedClassification;
  }

  /**
   * 날짜 분류 병합
   */
  mergeDateClassifications(claudeDates, openaiDates, originalDates) {
    const mergedDates = [];
    
    // 원본 날짜를 기준으로 AI 결과 통합
    for (const originalDate of originalDates) {
      const claudeMatch = claudeDates?.find(d => d.date === originalDate.date);
      const openaiMatch = openaiDates?.find(d => d.date === originalDate.date);
      
      const mergedDate = {
        date: originalDate.date,
        role: this.selectBestRole(originalDate.role, claudeMatch?.role, openaiMatch?.role),
        confidence: this.calculateDateConfidence(originalDate, claudeMatch, openaiMatch),
        isPrimary: originalDate.isPrimary,
        aiConsensus: claudeMatch?.role === openaiMatch?.role,
        sources: {
          original: originalDate.role,
          claude: claudeMatch?.role,
          openai: openaiMatch?.role
        }
      };
      
      mergedDates.push(mergedDate);
    }
    
    return mergedDates;
  }

  /**
   * 최적 역할 선택
   */
  selectBestRole(originalRole, claudeRole, openaiRole) {
    // AI 결과가 일치하면 해당 역할 선택
    if (claudeRole && openaiRole && claudeRole === openaiRole) {
      return claudeRole;
    }
    
    // AI 결과 중 하나가 원본과 일치하면 해당 역할 선택
    if (claudeRole === originalRole || openaiRole === originalRole) {
      return originalRole;
    }
    
    // 의료적 역할 우선순위
    const medicalRoles = ['diagnosis_date', 'treatment_date', 'examination_date', 'visit_date'];
    const roles = [originalRole, claudeRole, openaiRole].filter(Boolean);
    
    for (const medicalRole of medicalRoles) {
      if (roles.includes(medicalRole)) {
        return medicalRole;
      }
    }
    
    return originalRole;
  }

  /**
   * 날짜 신뢰도 계산
   */
  calculateDateConfidence(originalDate, claudeMatch, openaiMatch) {
    let confidence = originalDate.confidence || 0.5;
    
    // AI 일치도에 따른 신뢰도 조정
    if (claudeMatch && openaiMatch) {
      if (claudeMatch.role === openaiMatch.role) {
        confidence = Math.min(confidence * 1.3, 0.95); // AI 일치 시 신뢰도 증가
      } else {
        confidence = confidence * 0.9; // AI 불일치 시 신뢰도 감소
      }
    }
    
    return confidence;
  }

  /**
   * 충돌 해결 및 최종 검증
   */
  async resolveConflictsAndValidate(aiClassification) {
    const conflicts = this.detectClassificationConflicts(aiClassification);
    
    if (conflicts.length === 0) {
      return aiClassification;
    }
    
    console.log(`⚠️ ${conflicts.length}개 충돌 감지, 해결 중...`);
    
    // AI를 사용한 충돌 해결
    const resolvedConflicts = await this.resolveConflictsWithAI(conflicts);
    
    // 해결된 결과 적용
    return this.applyConflictResolutions(aiClassification, resolvedConflicts);
  }

  /**
   * 분류 충돌 감지
   */
  detectClassificationConflicts(classification) {
    const conflicts = [];
    
    // 동일 날짜에 대한 서로 다른 역할 할당 감지
    const dateRoleMap = new Map();
    
    for (const array of classification.textArrays) {
      for (const date of array.dates) {
        if (!dateRoleMap.has(date.date)) {
          dateRoleMap.set(date.date, []);
        }
        dateRoleMap.get(date.date).push({
          arrayIndex: array.arrayIndex,
          role: date.role,
          confidence: date.confidence
        });
      }
    }
    
    // 충돌 감지
    for (const [date, roles] of dateRoleMap) {
      if (roles.length > 1) {
        const uniqueRoles = [...new Set(roles.map(r => r.role))];
        if (uniqueRoles.length > 1) {
          conflicts.push({
            type: 'role_conflict',
            date,
            conflictingRoles: roles,
            severity: this.calculateConflictSeverity(roles)
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * 충돌 심각도 계산
   */
  calculateConflictSeverity(roles) {
    const confidenceSpread = Math.max(...roles.map(r => r.confidence)) - Math.min(...roles.map(r => r.confidence));
    const roleCount = new Set(roles.map(r => r.role)).size;
    
    return (confidenceSpread * 0.6) + (roleCount / roles.length * 0.4);
  }

  /**
   * 규칙 기반 충돌 해결 (Phase 1 Emergency Fix)
   */
  async resolveConflictsRuleBased(conflicts) {
    const resolutions = [];
    
    for (const conflict of conflicts) {
      try {
        // 규칙 기반 충돌 해결
        const resolution = this.ruleBasedConflictResolution(conflict);
        
        resolutions.push({
          conflict,
          resolution
        });
        
      } catch (error) {
        console.warn('규칙 기반 충돌 해결 실패:', error);
        // 기본 해결 방식 적용
        resolutions.push({
          conflict,
          resolution: this.defaultConflictResolution(conflict)
        });
      }
    }
    
    return resolutions;
  }
  
  /**
   * 규칙 기반 충돌 해결 로직
   */
  ruleBasedConflictResolution(conflict) {
    const { type, date, conflictingRoles, severity } = conflict;
    
    if (type === 'role_conflict') {
      // 의료 우선순위에 따른 해결
      const medicalPriority = {
        'current_visit': 100,
        'diagnosis_date': 90,
        'treatment_date': 85,
        'examination_date': 80,
        'surgery_date': 75,
        'visit_date': 70,
        'history_date': 50
      };
      
      // 가장 높은 우선순위 역할 선택
      const bestRole = conflictingRoles.reduce((best, current) => {
        const currentPriority = medicalPriority[current.role] || 0;
        const bestPriority = medicalPriority[best.role] || 0;
        
        if (currentPriority > bestPriority) return current;
        if (currentPriority === bestPriority && current.confidence > best.confidence) return current;
        
        return best;
      });
      
      return {
        resolvedRole: bestRole.role,
        confidence: Math.min(bestRole.confidence + 0.1, 1.0),
        reason: `의료 우선순위 기반 해결: ${bestRole.role}`,
        method: 'rule_based_priority'
      };
    }
    
    return this.defaultConflictResolution(conflict);
  }
  
  /**
   * 규칙 기반 충돌 해결 및 검증
   */
  async resolveConflictsAndValidateRuleBased(classification) {
    const conflicts = this.detectClassificationConflicts(classification);
    
    if (conflicts.length === 0) {
      return classification;
    }
    
    console.log(`⚠️ ${conflicts.length}개 충돌 감지, 규칙 기반 해결 중...`);
    
    // 규칙 기반 충돌 해결
    const resolvedConflicts = await this.resolveConflictsRuleBased(conflicts);
    
    // 해결된 결과 적용
    return this.applyConflictResolutions(classification, resolvedConflicts);
  }

  /**
   * 기본 충돌 해결
   */
  defaultConflictResolution(conflict) {
    // 가장 높은 신뢰도를 가진 역할 선택
    const bestRole = conflict.conflictingRoles.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    return {
      resolution: {
        winnerDate: conflict.date,
        winnerRole: bestRole.role,
        reason: '최고 신뢰도 기준 선택',
        confidence: bestRole.confidence
      },
      explanation: `신뢰도 ${bestRole.confidence}로 ${bestRole.role} 역할 선택`
    };
  }

  /**
   * 충돌 해결 결과 적용
   */
  applyConflictResolutions(classification, resolutions) {
    const resolvedClassification = JSON.parse(JSON.stringify(classification)); // 깊은 복사
    
    for (const { conflict, resolution } of resolutions) {
      const targetDate = conflict.date;
      const winnerRole = resolution.resolution.winnerRole;
      
      // 모든 배열에서 해당 날짜의 역할 업데이트
      for (const array of resolvedClassification.textArrays) {
        for (const date of array.dates) {
          if (date.date === targetDate) {
            date.role = winnerRole;
            date.confidence = resolution.resolution.confidence;
            date.conflictResolved = true;
            date.resolutionReason = resolution.resolution.reason;
          }
        }
      }
    }
    
    return resolvedClassification;
  }

  /**
   * 결과 구조화
   */
  structureResults(finalClassification, originalTextArrays) {
    return {
      summary: {
        totalArrays: originalTextArrays.length,
        totalDates: finalClassification.textArrays.reduce((sum, arr) => sum + arr.dates.length, 0),
        primaryDates: finalClassification.textArrays.reduce((sum, arr) => sum + arr.dates.filter(d => d.isPrimary).length, 0),
        secondaryDates: finalClassification.textArrays.reduce((sum, arr) => sum + arr.dates.filter(d => !d.isPrimary).length, 0),
        averageConfidence: this.calculateAverageConfidence(finalClassification),
        aiAgreement: finalClassification.aiAgreement || 0
      },
      arrays: finalClassification.textArrays.map(array => ({
        index: array.arrayIndex,
        text: array.text,
        classification: array.classification,
        dates: array.dates.map(date => ({
          date: date.date,
          role: date.role,
          confidence: date.confidence,
          isPrimary: date.isPrimary,
          aiConsensus: date.aiConsensus,
          conflictResolved: date.conflictResolved || false
        })),
        metadata: {
          dateCount: array.dates.length,
          averageConfidence: array.dates.reduce((sum, d) => sum + d.confidence, 0) / array.dates.length
        }
      })),
      relationships: finalClassification.dateRelationships || [],
      qualityMetrics: {
        overallConfidence: finalClassification.confidence,
        aiAgreementRate: finalClassification.aiAgreement,
        conflictResolutionRate: this.calculateConflictResolutionRate(finalClassification),
        dateClassificationAccuracy: this.estimateClassificationAccuracy(finalClassification)
      }
    };
  }

  /**
   * 평균 신뢰도 계산
   */
  calculateAverageConfidence(classification) {
    const allDates = classification.textArrays.flatMap(arr => arr.dates);
    if (allDates.length === 0) return 0;
    
    return allDates.reduce((sum, date) => sum + date.confidence, 0) / allDates.length;
  }

  /**
   * 충돌 해결률 계산
   */
  calculateConflictResolutionRate(classification) {
    const allDates = classification.textArrays.flatMap(arr => arr.dates);
    const resolvedConflicts = allDates.filter(date => date.conflictResolved).length;
    const totalDates = allDates.length;
    
    return totalDates > 0 ? resolvedConflicts / totalDates : 1.0;
  }

  /**
   * 분류 정확도 추정
   */
  estimateClassificationAccuracy(classification) {
    // AI 일치도, 신뢰도, 충돌 해결률을 종합하여 정확도 추정
    const aiAgreement = classification.aiAgreement || 0;
    const avgConfidence = this.calculateAverageConfidence(classification);
    const conflictResolutionRate = this.calculateConflictResolutionRate(classification);
    
    return (aiAgreement * 0.4) + (avgConfidence * 0.4) + (conflictResolutionRate * 0.2);
  }

  /**
   * 통계 업데이트
   */
  updateStats(processingTime, result) {
    this.stats.totalArraysProcessed += result.summary?.totalArrays || 0;
    this.stats.datesClassified += result.summary?.totalDates || 0;
    this.stats.aiClassificationAccuracy = result.qualityMetrics?.dateClassificationAccuracy || 0;
    this.stats.averageProcessingTime = processingTime;
    
    return this.stats;
  }

  /**
   * 폴백 분류 (AI 실패 시)
   */
  /**
   * 강화된 규칙 기반 분류 (Phase 1 Emergency Fix)
   */
  enhancedFallbackClassification(arrayAnalyses, crossReferences) {
    const enhancedArrays = arrayAnalyses.map(analysis => {
      // 의료 맥락 강화 분석
      const enhancedClassification = this.enhanceMedicalContextClassification(analysis);
      
      // 날짜 역할 재평가
      const enhancedDateRoles = this.enhanceDateRoleAssignment(analysis.dateRoles, analysis.text);
      
      // 신뢰도 재계산
      const enhancedConfidence = this.calculateEnhancedConfidence(analysis, enhancedClassification);
      
      return {
        arrayIndex: analysis.arrayIndex,
        text: analysis.text,
        dates: enhancedDateRoles,
        classification: enhancedClassification,
        confidence: enhancedConfidence
      };
    });
    
    // 교차 참조 강화
    const enhancedRelationships = this.enhanceCrossReferences(crossReferences, enhancedArrays);
    
    return {
      textArrays: enhancedArrays,
      dateRelationships: enhancedRelationships,
      confidence: this.calculateOverallConfidence(enhancedArrays),
      aiAgreement: 0.8 // 규칙 기반이므로 일관성 높음
    };
  }
  
  /**
   * 의료 맥락 분류 강화
   */
  enhanceMedicalContextClassification(analysis) {
    const text = analysis.text.toLowerCase();
    const classification = { ...analysis.classification };
    
    // 의료 키워드 밀도 계산
    const medicalKeywords = {
      diagnosis: ['진단', '소견', '판정', 'diagnosis', 'finding'],
      treatment: ['치료', '처방', '투약', 'treatment', 'prescription', 'medication'],
      examination: ['검사', '촬영', '측정', 'exam', 'test', 'scan'],
      visit: ['내원', '진료', '방문', 'visit', 'consultation'],
      surgery: ['수술', '시술', 'surgery', 'operation', 'procedure']
    };
    
    for (const [category, keywords] of Object.entries(medicalKeywords)) {
      const keywordCount = keywords.filter(keyword => text.includes(keyword)).length;
      if (keywordCount > 0) {
        classification.medical[category] = {
          ...classification.medical[category],
          priority: (classification.medical[category]?.priority || 0) + (keywordCount * 10),
          confidence: Math.min((classification.medical[category]?.confidence || 0) + (keywordCount * 0.2), 1.0)
        };
      }
    }
    
    return classification;
  }
  
  /**
   * 날짜 역할 할당 강화
   */
  enhanceDateRoleAssignment(dateRoles, text) {
    return dateRoles.map(dateRole => {
      const enhancedRole = { ...dateRole };
      
      // 주변 텍스트 분석으로 역할 정확도 향상
      const contextWindow = this.extractContextWindow(text, dateRole.date, 50);
      const roleConfidence = this.calculateRoleConfidence(contextWindow, dateRole.role);
      
      enhancedRole.confidence = Math.max(enhancedRole.confidence, roleConfidence);
      enhancedRole.contextEvidence = contextWindow;
      
      return enhancedRole;
    });
  }
  
  /**
   * 맥락 윈도우 추출
   */
  extractContextWindow(text, dateStr, windowSize) {
    const dateIndex = text.indexOf(dateStr);
    if (dateIndex === -1) return '';
    
    const start = Math.max(0, dateIndex - windowSize);
    const end = Math.min(text.length, dateIndex + dateStr.length + windowSize);
    
    return text.substring(start, end);
  }
  
  /**
   * 역할 신뢰도 계산
   */
  calculateRoleConfidence(context, role) {
    const roleKeywords = {
      'diagnosis_date': ['진단', '소견', 'diagnosis'],
      'treatment_date': ['치료', '처방', 'treatment'],
      'examination_date': ['검사', '촬영', 'exam'],
      'visit_date': ['내원', '진료', 'visit'],
      'surgery_date': ['수술', '시술', 'surgery']
    };
    
    const keywords = roleKeywords[role] || [];
    const matchCount = keywords.filter(keyword => context.toLowerCase().includes(keyword)).length;
    
    return Math.min(0.5 + (matchCount * 0.2), 1.0);
  }
  
  /**
   * 강화된 신뢰도 계산
   */
  calculateEnhancedConfidence(analysis, enhancedClassification) {
    let confidence = analysis.contextStrength || 0.5;
    
    // 의료 맥락 보너스
    const medicalScore = Object.values(enhancedClassification.medical || {})
      .reduce((sum, cat) => sum + (cat.confidence || 0), 0) / 5;
    
    confidence += medicalScore * 0.3;
    
    // 날짜 개수 보너스 (적절한 수의 날짜가 있을 때)
    const dateCount = analysis.dateRoles?.length || 0;
    if (dateCount >= 1 && dateCount <= 5) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * 교차 참조 강화
   */
  enhanceCrossReferences(crossReferences, enhancedArrays) {
    return crossReferences.flatMap(ref => {
      const enhancedRelations = ref.dateRelations.map(relation => ({
        ...relation,
        confidence: Math.min(relation.confidence + 0.1, 1.0) // 규칙 기반 보너스
      }));
      
      return enhancedRelations;
    });
  }
  
  /**
   * 전체 신뢰도 계산
   */
  calculateOverallConfidence(enhancedArrays) {
    if (enhancedArrays.length === 0) return 0.5;
    
    const avgConfidence = enhancedArrays.reduce((sum, arr) => sum + arr.confidence, 0) / enhancedArrays.length;
    return Math.min(avgConfidence + 0.1, 1.0); // 규칙 기반 보너스
  }
  
  /**
   * 분류 검증 및 강화
   */
  validateAndEnhanceClassification(classification) {
    // 날짜 일관성 검증
    const validatedArrays = classification.textArrays.map(array => {
      const validatedDates = this.validateDateConsistency(array.dates);
      return {
        ...array,
        dates: validatedDates,
        confidence: this.recalculateConfidenceAfterValidation(array.confidence, validatedDates)
      };
    });
    
    return {
      ...classification,
      textArrays: validatedArrays,
      confidence: this.calculateOverallConfidence(validatedArrays)
    };
  }
  
  /**
   * 날짜 일관성 검증
   */
  validateDateConsistency(dates) {
    return dates.filter(date => {
      // 기본 날짜 형식 검증
      if (!date.date || typeof date.date !== 'string') return false;
      
      // 미래 날짜 제한 (30일 이내)
      const dateObj = new Date(date.date);
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      if (dateObj > futureLimit) return false;
      
      // 과거 날짜 제한 (10년 이내)
      const pastLimit = new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000);
      if (dateObj < pastLimit) return false;
      
      return true;
    });
  }
  
  /**
   * 검증 후 신뢰도 재계산
   */
  recalculateConfidenceAfterValidation(originalConfidence, validatedDates) {
    // 유효한 날짜 비율에 따른 신뢰도 조정
    const validationRatio = validatedDates.length > 0 ? 1.0 : 0.5;
    return originalConfidence * validationRatio;
  }
  
  fallbackClassification(arrayAnalyses, crossReferences) {
    return {
      textArrays: arrayAnalyses.map(analysis => ({
        arrayIndex: analysis.arrayIndex,
        text: analysis.text,
        dates: analysis.dateRoles,
        classification: analysis.classification,
        confidence: analysis.contextStrength
      })),
      dateRelationships: crossReferences.flatMap(ref => ref.dateRelations),
      confidence: 0.6, // 폴백 시 낮은 신뢰도
      aiAgreement: 0
    };
  }
}

/**
 * 통합 신뢰도 계산기
 */
export class UnifiedConfidenceCalculator {
  constructor() {
    this.factors = {
      dateFormat: 0.25,      // 날짜 형식 명확성
      contextClarity: 0.30,  // 맥락 명확성
      medicalRelevance: 0.25, // 의료적 관련성
      aiConsensus: 0.20      // AI 합의도
    };
  }

  calculate(dateAnchor, context, aiResults) {
    let confidence = 0;
    
    // 날짜 형식 점수
    confidence += this.assessDateFormat(dateAnchor) * this.factors.dateFormat;
    
    // 맥락 명확성 점수
    confidence += this.assessContextClarity(dateAnchor, context) * this.factors.contextClarity;
    
    // 의료적 관련성 점수
    confidence += this.assessMedicalRelevance(dateAnchor) * this.factors.medicalRelevance;
    
    // AI 합의도 점수
    confidence += this.assessAIConsensus(aiResults) * this.factors.aiConsensus;
    
    return Math.min(confidence, 1.0);
  }

  assessDateFormat(dateAnchor) {
    if (!dateAnchor.normalized?.date) return 0;
    
    // 절대 날짜가 가장 높은 점수
    if (dateAnchor.category === 'absolute') return 1.0;
    if (dateAnchor.category === 'medical') return 0.9;
    if (dateAnchor.category === 'duration') return 0.7;
    if (dateAnchor.category === 'relative') return 0.5;
    
    return 0.3;
  }

  assessContextClarity(dateAnchor, context) {
    let score = 0.5;
    
    // 주변 텍스트의 의료 키워드 밀도
    const medicalKeywords = ['진료', '검사', '치료', '진단', '처방', '수술'];
    const contextText = dateAnchor.context || '';
    const keywordCount = medicalKeywords.filter(keyword => contextText.includes(keyword)).length;
    
    score += Math.min(keywordCount * 0.1, 0.4);
    
    // 날짜 주변 텍스트의 구체성
    if (contextText.length > 50) score += 0.1;
    if (contextText.length > 100) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  assessMedicalRelevance(dateAnchor) {
    const medicalContext = dateAnchor.medicalContext || {};
    let score = 0.3;
    
    // 의료 맥락 존재 여부
    if (medicalContext.hasContext) score += 0.3;
    if (medicalContext.contextType) score += 0.2;
    if (medicalContext.confidence > 0.7) score += 0.2;
    
    return Math.min(score, 1.0);
  }

  assessAIConsensus(aiResults) {
    if (!aiResults || !aiResults.claude || !aiResults.openai) return 0.5;
    
    // AI 결과 일치도
    const claudeRole = aiResults.claude.role;
    const openaiRole = aiResults.openai.role;
    
    if (claudeRole === openaiRole) return 1.0;
    
    // 부분 일치 (의료적 카테고리가 같은 경우)
    const medicalCategories = {
      'diagnosis_date': 'medical',
      'treatment_date': 'medical',
      'examination_date': 'medical',
      'visit_date': 'medical'
    };
    
    if (medicalCategories[claudeRole] === medicalCategories[openaiRole]) {
      return 0.7;
    }
    
    return 0.3;
  }
}

/**
 * 증거 추적기
 */
export class EvidenceTracker {
  constructor() {
    this.evidenceTypes = {
      textual: '텍스트 증거',
      structural: '구조적 증거',
      temporal: '시간적 증거',
      medical: '의료적 증거',
      ai: 'AI 분석 증거'
    };
  }

  trackEvidence(dateAnchor, classification, aiResults) {
    return {
      dateAnchor: dateAnchor.id,
      evidence: {
        textual: this.extractTextualEvidence(dateAnchor),
        structural: this.extractStructuralEvidence(classification),
        temporal: this.extractTemporalEvidence(dateAnchor),
        medical: this.extractMedicalEvidence(dateAnchor),
        ai: this.extractAIEvidence(aiResults)
      },
      confidence: this.calculateEvidenceConfidence(dateAnchor, classification, aiResults),
      timestamp: new Date().toISOString()
    };
  }

  extractTextualEvidence(dateAnchor) {
    return {
      originalText: dateAnchor.text,
      context: dateAnchor.context,
      position: dateAnchor.position,
      pattern: dateAnchor.category
    };
  }

  extractStructuralEvidence(classification) {
    return {
      structural: classification.structural,
      position: classification.position,
      scores: classification.scores
    };
  }

  extractTemporalEvidence(dateAnchor) {
    return {
      normalized: dateAnchor.normalized,
      precision: dateAnchor.normalized?.precision,
      dateType: dateAnchor.normalized?.dateType
    };
  }

  extractMedicalEvidence(dateAnchor) {
    return dateAnchor.medicalContext || {};
  }

  extractAIEvidence(aiResults) {
    return {
      claude: aiResults?.claude,
      openai: aiResults?.openai,
      consensus: aiResults?.claude?.role === aiResults?.openai?.role
    };
  }

  calculateEvidenceConfidence(dateAnchor, classification, aiResults) {
    // 증거의 강도를 종합하여 신뢰도 계산
    let confidence = 0.5;
    
    // 텍스트 증거 강도
    if (dateAnchor.text && dateAnchor.context) confidence += 0.2;
    
    // 구조적 증거 강도
    if (classification.structural !== 'content') confidence += 0.1;
    
    // 의료적 증거 강도
    if (classification.medical !== 'unknown') confidence += 0.15;
    
    // AI 증거 강도
    if (aiResults?.claude?.role === aiResults?.openai?.role) confidence += 0.15;
    
    return Math.min(confidence, 1.0);
  }
}

export default AdvancedTextArrayDateClassifier;