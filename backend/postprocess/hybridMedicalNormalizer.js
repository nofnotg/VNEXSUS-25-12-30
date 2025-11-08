/**
 * Hybrid Medical Document Normalizer Module
 * 
 * 기존 MedicalDocumentNormalizer의 안정성과 
 * 코어엔진 NestedDateResolver의 고도화된 의료 맥락 분석을 결합한 하이브리드 정규화기
 * 
 * 핵심 기능:
 * 1. 기존 시스템의 안정적인 의료 문서 정규화
 * 2. 코어엔진의 정밀한 중첩 날짜 해결 및 의료 맥락 분석
 * 3. 어댑터 패턴을 통한 결과 통합 및 검증
 * 4. 의료 타임라인 구축 및 이벤트 상관관계 분석
 */

import MedicalDocumentNormalizer from './medicalDocumentNormalizer.js';
import { NestedDateResolver } from '../services/core-engine/enhanced/nestedDateResolver.js';

class HybridMedicalNormalizer extends MedicalDocumentNormalizer {
  constructor(options = {}) {
    super();
    
    // 코어엔진 인스턴스 초기화
    this.nestedResolver = new NestedDateResolver();
    
    // 하이브리드 정규화 옵션
    this.hybridOptions = {
      // 정규화 모드: 'legacy', 'core', 'hybrid', 'adaptive'
      normalizationMode: options.normalizationMode || 'hybrid',
      
      // 의료 맥락 분석 강도 (0.0 ~ 1.0)
      medicalContextIntensity: options.medicalContextIntensity || 0.8,
      
      // 타임라인 구축 전략: 'chronological', 'medical_priority', 'hybrid'
      timelineStrategy: options.timelineStrategy || 'hybrid',
      
      // 이벤트 상관관계 분석 활성화
      enableCorrelationAnalysis: options.enableCorrelationAnalysis !== false,
      
      // 성능 모니터링 활성화
      enableMonitoring: options.enableMonitoring !== false,
      
      // 백업 처리 활성화
      enableFallback: options.enableFallback !== false
    };
    
    // 성능 메트릭
    this.metrics = {
      totalNormalized: 0,
      legacyNormalized: 0,
      coreEnhanced: 0,
      hybridNormalized: 0,
      averageProcessingTime: 0,
      successRate: 0,
      medicalEventCount: 0,
      timelineAccuracy: 0
    };
    
    // 의료 이벤트 상관관계 분석기
    this.correlationAnalyzer = new MedicalEventCorrelationAnalyzer();
    
    // 하이브리드 타임라인 빌더
    this.timelineBuilder = new HybridTimelineBuilder(this.hybridOptions.timelineStrategy);
    
    console.log('🏥 HybridMedicalNormalizer 초기화 완료');
    console.log(`📋 정규화 모드: ${this.hybridOptions.normalizationMode}`);
    console.log(`🧠 의료 맥락 분석 강도: ${this.hybridOptions.medicalContextIntensity * 100}%`);
  }

  /**
   * 하이브리드 의료 문서 정규화 메인 함수
   * @param {string} rawText 원본 의료 문서 텍스트
   * @param {Object} options 정규화 옵션
   * @returns {Promise<Object>} 하이브리드 정규화 결과
   */
  async normalizeDocument(rawText, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🏥 하이브리드 의료 문서 정규화 시작...');
      
      // 정규화 모드 결정
      const normalizationMode = this.determineNormalizationMode(rawText, options);
      console.log(`📋 정규화 모드 결정: ${normalizationMode}`);
      
      let result;
      
      switch (normalizationMode) {
        case 'legacy':
          result = await this.normalizeWithLegacyOnly(rawText, options);
          break;
          
        case 'core':
          result = await this.normalizeWithCoreOnly(rawText, options);
          break;
          
        case 'hybrid':
          result = await this.normalizeWithHybrid(rawText, options);
          break;
          
        case 'adaptive':
          result = await this.normalizeWithAdaptive(rawText, options);
          break;
          
        default:
          throw new Error(`지원하지 않는 정규화 모드: ${normalizationMode}`);
      }
      
      // 성능 메트릭 업데이트
      const processingTime = Date.now() - startTime;
      this.updateMetrics(normalizationMode, processingTime, result.success);
      
      // 결과에 하이브리드 정보 추가
      result.hybrid = {
        normalizationMode,
        processingTime,
        coreEngineUsed: normalizationMode !== 'legacy',
        legacySystemUsed: normalizationMode !== 'core',
        medicalContextAnalyzed: this.hybridOptions.enableCorrelationAnalysis,
        metrics: this.getMetricsSummary()
      };
      
      console.log(`✅ 하이브리드 정규화 완료 (${processingTime}ms, 모드: ${normalizationMode})`);
      return result;
      
    } catch (error) {
      console.error('❌ 하이브리드 의료 문서 정규화 실패:', error);
      
      // 폴백 처리
      if (this.hybridOptions.enableFallback) {
        console.log('🔄 기존 시스템으로 폴백 처리 시도...');
        try {
          const fallbackResult = await super.normalizeDocument(rawText, options);
          this.metrics.fallbackCount = (this.metrics.fallbackCount || 0) + 1;
          
          fallbackResult.hybrid = {
            normalizationMode: 'fallback',
            originalError: error.message,
            fallbackUsed: true
          };
          
          return fallbackResult;
        } catch (fallbackError) {
          console.error('❌ 폴백 처리도 실패:', fallbackError);
        }
      }
      
      throw new Error(`하이브리드 의료 문서 정규화 실패: ${error.message}`);
    }
  }

  /**
   * 정규화 모드 결정 로직
   */
  determineNormalizationMode(text, options) {
    // 옵션에서 명시적으로 지정된 경우
    if (options.normalizationMode) {
      return options.normalizationMode;
    }
    
    // 기본 설정 사용
    if (this.hybridOptions.normalizationMode !== 'adaptive') {
      return this.hybridOptions.normalizationMode;
    }
    
    // 적응형 모드: 의료 문서 특성에 따라 자동 결정
    const medicalComplexity = this.analyzeMedicalComplexity(text);
    
    if (medicalComplexity.temporalComplexity < 0.3) {
      return 'legacy'; // 시간적 복잡도가 낮은 경우 기존 시스템
    } else if (medicalComplexity.medicalDensity > 0.8) {
      return 'core'; // 의료 용어 밀도가 높은 경우 코어엔진
    } else {
      return 'hybrid'; // 일반적인 경우 하이브리드
    }
  }

  /**
   * 기존 시스템만으로 정규화
   */
  async normalizeWithLegacyOnly(rawText, options) {
    console.log('📊 기존 시스템 전용 정규화...');
    this.metrics.legacyNormalized++;
    
    const result = await super.normalizeDocument(rawText, options);
    result.normalizationMethod = 'legacy_only';
    
    return result;
  }

  /**
   * 코어엔진만으로 정규화
   */
  async normalizeWithCoreOnly(rawText, options) {
    console.log('🧠 코어엔진 전용 정규화...');
    this.metrics.coreEnhanced++;
    
    try {
      // 1. 기본 전처리
      const preprocessedText = this._preprocessText(rawText);
      
      // 2. 코어엔진으로 중첩 날짜 해결
      const nestedDateResult = await this.nestedResolver.resolveNestedDates(preprocessedText, {
        medicalContext: true,
        referenceDate: options.referenceDate || new Date()
      });
      
      if (!nestedDateResult.success) {
        throw new Error('코어엔진 중첩 날짜 해결 실패');
      }
      
      // 3. 의료 맥락 기반 정규화
      const normalizedData = this.normalizeWithMedicalContext(
        preprocessedText, 
        nestedDateResult,
        options
      );
      
      // 4. 기존 시스템 형식으로 변환
      const convertedResult = this.convertCoreResultToLegacyFormat(
        normalizedData,
        nestedDateResult,
        rawText
      );
      
      convertedResult.normalizationMethod = 'core_only';
      return convertedResult;
      
    } catch (error) {
      console.error('❌ 코어엔진 전용 정규화 실패:', error);
      throw error;
    }
  }

  /**
   * 하이브리드 정규화 (기존 + 코어엔진)
   */
  async normalizeWithHybrid(rawText, options) {
    console.log('🔄 하이브리드 정규화...');
    this.metrics.hybridNormalized++;
    
    try {
      // 병렬로 두 시스템 실행
      const [legacyResult, coreResult] = await Promise.allSettled([
        super.normalizeDocument(rawText, options),
        this.enhanceWithCoreEngine(rawText, options)
      ]);
      
      // 결과 검증
      const validLegacyResult = legacyResult.status === 'fulfilled' ? legacyResult.value : null;
      const validCoreResult = coreResult.status === 'fulfilled' ? coreResult.value : null;
      
      if (!validLegacyResult && !validCoreResult) {
        throw new Error('두 시스템 모두 정규화 실패');
      }
      
      // 결과 통합
      const integratedResult = await this.integrateResults(
        validLegacyResult,
        validCoreResult,
        rawText,
        options
      );
      
      // 의료 이벤트 상관관계 분석
      if (this.hybridOptions.enableCorrelationAnalysis) {
        integratedResult.correlationAnalysis = await this.correlationAnalyzer.analyze(
          integratedResult.normalizedReport,
          integratedResult.timelineData
        );
      }
      
      integratedResult.normalizationMethod = 'hybrid';
      integratedResult.legacySuccess = !!validLegacyResult;
      integratedResult.coreSuccess = !!validCoreResult;
      
      return integratedResult;
      
    } catch (error) {
      console.error('❌ 하이브리드 정규화 실패:', error);
      throw error;
    }
  }

  /**
   * 적응형 정규화 (동적 전략 선택)
   */
  async normalizeWithAdaptive(rawText, options) {
    console.log('🎯 적응형 정규화...');
    
    // 의료 문서 복잡도 분석
    const complexity = this.analyzeMedicalComplexity(rawText);
    
    // 복잡도에 따른 전략 선택 - 더 적극적으로 하이브리드/코어 모드 선택
    if (complexity.overallScore < 0.2) {
      return await this.normalizeWithLegacyOnly(rawText, options);
    } else if (complexity.overallScore > 0.6) {
      return await this.normalizeWithCoreOnly(rawText, options);
    } else {
      return await this.normalizeWithHybrid(rawText, options);
    }
  }

  /**
   * 코어엔진으로 기존 결과 향상
   */
  async enhanceWithCoreEngine(rawText, options) {
    console.log('🧠 코어엔진으로 결과 향상...');
    
    // 1. 전처리
    const preprocessedText = this._preprocessText(rawText);
    
    // 2. 중첩 날짜 해결
    const nestedDateResult = await this.nestedResolver.resolveNestedDates(preprocessedText, {
      medicalContext: true,
      referenceDate: options.referenceDate || new Date()
    });
    
    // 3. 의료 맥락 분석
    const medicalContext = this.analyzeMedicalContextWithCore(
      preprocessedText,
      nestedDateResult
    );
    
    return {
      success: true,
      nestedDateResult,
      medicalContext,
      enhancedTimeline: this.buildEnhancedTimeline(nestedDateResult, medicalContext),
      processingTime: nestedDateResult.processingTime
    };
  }

  /**
   * 의료 문서 복잡도 분석
   */
  analyzeMedicalComplexity(text) {
    // 날짜 관련 복잡도
    const dateMatches = text.match(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/g) || [];
    const relativeDateMatches = text.match(/(오늘|어제|최근|과거|\d+일\s*전|\d+개월\s*전)/g) || [];
    const temporalComplexity = Math.min(1.0, (dateMatches.length + relativeDateMatches.length * 2) / 20);
    
    // 의료 용어 밀도
    const medicalTerms = text.match(/(진료|검사|수술|처방|투약|입원|퇴원|진단|치료|증상|질환|병원|의원)/g) || [];
    const medicalDensity = Math.min(1.0, medicalTerms.length / Math.max(text.length / 100, 1));
    
    // 구조적 복잡도
    const structuralElements = text.match(/(환자명|생년월일|진료일|입원일|퇴원일|진단명|처방전)/g) || [];
    const structuralComplexity = Math.min(1.0, structuralElements.length / 10);
    
    // 중첩 표현 복잡도
    const nestedExpressions = text.match(/(당시|그때|해당|상기|전술한|앞서|이전에|이후에)/g) || [];
    const nestedComplexity = Math.min(1.0, nestedExpressions.length / 15);
    
    const overallScore = (
      temporalComplexity * 0.3 +
      medicalDensity * 0.3 +
      structuralComplexity * 0.2 +
      nestedComplexity * 0.2
    );
    
    return {
      temporalComplexity,
      medicalDensity,
      structuralComplexity,
      nestedComplexity,
      overallScore,
      textLength: text.length
    };
  }

  /**
   * 의료 맥락 기반 정규화
   */
  normalizeWithMedicalContext(text, nestedDateResult, options) {
    console.log('🏥 의료 맥락 기반 정규화...');
    
    const normalizedData = {
      patientInfo: this.extractPatientInfoWithContext(text, nestedDateResult),
      medicalEvents: this.extractMedicalEventsWithTimeline(text, nestedDateResult),
      treatmentHistory: this.buildTreatmentHistory(text, nestedDateResult),
      diagnosticTimeline: this.buildDiagnosticTimeline(text, nestedDateResult)
    };
    
    return normalizedData;
  }

  /**
   * 환자 정보 추출 (맥락 강화)
   */
  extractPatientInfoWithContext(text, nestedDateResult) {
    // 기존 환자 정보 추출
    const basicInfo = this._extractPatientInfo(text);
    
    // 코어엔진 결과로 맥락 강화
    if (nestedDateResult.resolved && nestedDateResult.resolved.medicalTimeline) {
      const timeline = nestedDateResult.resolved.medicalTimeline;
      
      // 첫 진료일 추정
      const firstVisit = timeline.events?.find(event => 
        event.type === 'visit' || event.type === 'diagnosis'
      );
      
      if (firstVisit) {
        basicInfo.firstVisitDate = firstVisit.date;
        basicInfo.firstVisitContext = firstVisit.context;
      }
    }
    
    return basicInfo;
  }

  /**
   * 의료 이벤트 추출 (타임라인 강화)
   */
  extractMedicalEventsWithTimeline(text, nestedDateResult) {
    const events = [];
    
    // 기존 의료 기록 추출
    const basicRecords = this._extractMedicalRecords(text);
    
    // 코어엔진 타임라인과 결합
    if (nestedDateResult.resolved && nestedDateResult.resolved.medicalTimeline) {
      const coreEvents = nestedDateResult.resolved.medicalTimeline.events || [];
      
      // 이벤트 병합 및 강화
      basicRecords.forEach(record => {
        const matchingCoreEvent = coreEvents.find(coreEvent => 
          this.isSimilarDate(record.date, coreEvent.date)
        );
        
        events.push({
          ...record,
          coreEnhanced: !!matchingCoreEvent,
          medicalContext: matchingCoreEvent?.medicalContext,
          confidence: matchingCoreEvent ? 
            Math.max(record.confidence || 0.7, matchingCoreEvent.confidence || 0.8) :
            record.confidence || 0.7
        });
      });
      
      // 코어엔진 전용 이벤트 추가
      coreEvents.forEach(coreEvent => {
        const hasMatch = basicRecords.some(record => 
          this.isSimilarDate(record.date, coreEvent.date)
        );
        
        if (!hasMatch) {
          events.push({
            id: `core_event_${events.length}`,
            date: coreEvent.date,
            type: coreEvent.type,
            description: coreEvent.description || coreEvent.text,
            source: 'core_engine',
            medicalContext: coreEvent.medicalContext,
            confidence: coreEvent.confidence || 0.8
          });
        }
      });
    } else {
      // 코어엔진 결과가 없는 경우 기존 결과만 사용
      events.push(...basicRecords);
    }
    
    return events.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * 치료 이력 구축
   */
  buildTreatmentHistory(text, nestedDateResult) {
    const treatmentHistory = {
      medications: [],
      procedures: [],
      hospitalizations: []
    };
    
    // 투약 이력
    const medicationMatches = text.match(/(처방|투약|복용|약물)[\s\S]*?(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/g) || [];
    medicationMatches.forEach((match, index) => {
      const dateMatch = match.match(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/);
      if (dateMatch) {
        treatmentHistory.medications.push({
          id: `med_${index}`,
          date: dateMatch[0],
          description: match.replace(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/, '').trim(),
          source: 'text_extraction'
        });
      }
    });
    
    // 시술/수술 이력
    const procedureMatches = text.match(/(수술|시술|처치)[\s\S]*?(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/g) || [];
    procedureMatches.forEach((match, index) => {
      const dateMatch = match.match(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/);
      if (dateMatch) {
        treatmentHistory.procedures.push({
          id: `proc_${index}`,
          date: dateMatch[0],
          description: match.replace(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/, '').trim(),
          source: 'text_extraction'
        });
      }
    });
    
    // 입원 이력
    const hospitalizationMatches = text.match(/(입원|퇴원)[\s\S]*?(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/g) || [];
    hospitalizationMatches.forEach((match, index) => {
      const dateMatch = match.match(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/);
      if (dateMatch) {
        treatmentHistory.hospitalizations.push({
          id: `hosp_${index}`,
          date: dateMatch[0],
          type: match.includes('입원') ? 'admission' : 'discharge',
          description: match.replace(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/, '').trim(),
          source: 'text_extraction'
        });
      }
    });
    
    return treatmentHistory;
  }

  /**
   * 진단 타임라인 구축
   */
  buildDiagnosticTimeline(text, nestedDateResult) {
    const diagnosticEvents = [];
    
    // 진단 관련 패턴 매칭
    const diagnosisPatterns = [
      /(진단|diagnosis)[\s\S]*?(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/g,
      /(검사|test|exam)[\s\S]*?(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/g,
      /(소견|finding)[\s\S]*?(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/g
    ];
    
    diagnosisPatterns.forEach((pattern, patternIndex) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const dateMatch = match[2];
        if (dateMatch) {
          diagnosticEvents.push({
            id: `diag_${patternIndex}_${diagnosticEvents.length}`,
            date: dateMatch,
            type: patternIndex === 0 ? 'diagnosis' : patternIndex === 1 ? 'test' : 'finding',
            description: match[0].replace(dateMatch, '').trim(),
            source: 'pattern_matching'
          });
        }
      }
    });
    
    return diagnosticEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * 코어엔진으로 의료 맥락 분석
   */
  analyzeMedicalContextWithCore(text, nestedDateResult) {
    const context = {
      temporalRelations: [],
      medicalEntities: [],
      eventSequences: [],
      contextualReferences: []
    };
    
    if (nestedDateResult.resolved && nestedDateResult.resolved.medicalTimeline) {
      const timeline = nestedDateResult.resolved.medicalTimeline;
      
      // 시간적 관계 추출
      if (timeline.temporalRelations) {
        context.temporalRelations = timeline.temporalRelations;
      }
      
      // 의료 엔티티 추출
      if (timeline.medicalEntities) {
        context.medicalEntities = timeline.medicalEntities;
      }
      
      // 이벤트 시퀀스 분석
      if (timeline.events && timeline.events.length > 1) {
        context.eventSequences = this.analyzeEventSequences(timeline.events);
      }
    }
    
    return context;
  }

  /**
   * 이벤트 시퀀스 분석
   */
  analyzeEventSequences(events) {
    const sequences = [];
    
    for (let i = 0; i < events.length - 1; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];
      
      const timeDiff = new Date(nextEvent.date) - new Date(currentEvent.date);
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      
      sequences.push({
        id: `seq_${i}`,
        fromEvent: currentEvent.id,
        toEvent: nextEvent.id,
        daysBetween: daysDiff,
        sequenceType: this.determineSequenceType(currentEvent, nextEvent),
        medicalRelevance: this.calculateMedicalRelevance(currentEvent, nextEvent)
      });
    }
    
    return sequences;
  }

  /**
   * 시퀀스 타입 결정
   */
  determineSequenceType(event1, event2) {
    const type1 = event1.type || 'unknown';
    const type2 = event2.type || 'unknown';
    
    if (type1 === 'diagnosis' && type2 === 'treatment') {
      return 'diagnosis_to_treatment';
    } else if (type1 === 'treatment' && type2 === 'followup') {
      return 'treatment_to_followup';
    } else if (type1 === 'admission' && type2 === 'discharge') {
      return 'hospitalization_period';
    } else {
      return 'general_sequence';
    }
  }

  /**
   * 의료적 연관성 계산
   */
  calculateMedicalRelevance(event1, event2) {
    // 간단한 휴리스틱 기반 연관성 계산
    let relevance = 0.5; // 기본값
    
    // 같은 타입의 이벤트는 연관성이 높음
    if (event1.type === event2.type) {
      relevance += 0.2;
    }
    
    // 시간 간격이 짧을수록 연관성이 높음
    const timeDiff = Math.abs(new Date(event2.date) - new Date(event1.date));
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 7) {
      relevance += 0.3;
    } else if (daysDiff <= 30) {
      relevance += 0.1;
    }
    
    return Math.min(1.0, relevance);
  }

  /**
   * 결과 통합
   */
  async integrateResults(legacyResult, coreResult, rawText, options) {
    console.log('🔄 결과 통합 시작...');
    
    if (!legacyResult && !coreResult) {
      throw new Error('통합할 결과가 없습니다');
    }
    
    // 기본 결과 선택
    const baseResult = legacyResult || {};
    
    // 코어엔진 결과로 강화
    if (coreResult && coreResult.nestedDateResult) {
      // 타임라인 데이터 강화
      if (baseResult.timelineData && coreResult.enhancedTimeline) {
        baseResult.timelineData = this.mergeTimelines(
          baseResult.timelineData,
          coreResult.enhancedTimeline
        );
      }
      
      // 의료 맥락 정보 추가
      baseResult.medicalContext = coreResult.medicalContext;
      
      // 중첩 날짜 해결 결과 추가
      baseResult.nestedDateAnalysis = coreResult.nestedDateResult;
    }
    
    // 통합 메타데이터 추가
    baseResult.integration = {
      legacyDataUsed: !!legacyResult,
      coreEnhancementUsed: !!coreResult,
      integrationStrategy: 'enhancement',
      integrationTime: Date.now()
    };
    
    return baseResult;
  }

  /**
   * 타임라인 병합
   */
  mergeTimelines(legacyTimeline, enhancedTimeline) {
    const mergedEvents = [...(legacyTimeline.events || [])];
    
    // 강화된 타임라인의 이벤트 추가
    if (enhancedTimeline.events) {
      enhancedTimeline.events.forEach(enhancedEvent => {
        const existingEvent = mergedEvents.find(event => 
          this.isSimilarDate(event.date, enhancedEvent.date)
        );
        
        if (existingEvent) {
          // 기존 이벤트 강화
          existingEvent.enhanced = true;
          existingEvent.coreData = enhancedEvent;
          existingEvent.confidence = Math.max(
            existingEvent.confidence || 0.7,
            enhancedEvent.confidence || 0.8
          );
        } else {
          // 새 이벤트 추가
          mergedEvents.push({
            ...enhancedEvent,
            source: 'core_enhancement'
          });
        }
      });
    }
    
    // 날짜순 정렬
    mergedEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return {
      events: mergedEvents,
      totalEvents: mergedEvents.length,
      enhancedEvents: mergedEvents.filter(e => e.enhanced).length,
      coreOnlyEvents: mergedEvents.filter(e => e.source === 'core_enhancement').length
    };
  }

  /**
   * 코어엔진 결과를 기존 형식으로 변환
   */
  convertCoreResultToLegacyFormat(normalizedData, nestedDateResult, rawText) {
    const convertedResult = {
      success: true,
      normalizedReport: {
        patientInfo: normalizedData.patientInfo,
        medicalEvents: normalizedData.medicalEvents,
        treatmentHistory: normalizedData.treatmentHistory,
        diagnosticTimeline: normalizedData.diagnosticTimeline
      },
      timelineData: normalizedData.medicalEvents,
      statistics: {
        originalLength: rawText.length,
        processedLength: rawText.length,
        recordsFound: normalizedData.medicalEvents.length,
        timelineEvents: normalizedData.medicalEvents.length,
        source: 'core_conversion'
      },
      nestedDateAnalysis: nestedDateResult,
      processingTime: nestedDateResult.processingTime
    };
    
    return convertedResult;
  }

  /**
   * 날짜 유사성 검사
   */
  isSimilarDate(date1, date2, toleranceDays = 1) {
    if (!date1 || !date2) return false;
    
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= toleranceDays;
  }

  /**
   * 성능 메트릭 업데이트
   */
  updateMetrics(normalizationMode, processingTime, success) {
    this.metrics.totalNormalized++;
    
    // 처리 시간 업데이트
    const currentAvg = this.metrics.averageProcessingTime;
    const count = this.metrics.totalNormalized;
    this.metrics.averageProcessingTime = (currentAvg * (count - 1) + processingTime) / count;
    
    // 성공률 업데이트
    if (success) {
      const successCount = Math.round(this.metrics.successRate * (count - 1)) + 1;
      this.metrics.successRate = successCount / count;
    } else {
      const successCount = Math.round(this.metrics.successRate * (count - 1));
      this.metrics.successRate = successCount / count;
    }
  }

  /**
   * 메트릭 요약 반환
   */
  getMetricsSummary() {
    return {
      ...this.metrics,
      hybridRatio: this.metrics.hybridNormalized / Math.max(this.metrics.totalNormalized, 1),
      coreEnhancementRatio: this.metrics.coreEnhanced / Math.max(this.metrics.totalNormalized, 1),
      legacyRatio: this.metrics.legacyNormalized / Math.max(this.metrics.totalNormalized, 1)
    };
  }
}

/**
 * 의료 이벤트 상관관계 분석기
 */
class MedicalEventCorrelationAnalyzer {
  constructor() {
    this.correlationRules = {
      // 진단-치료 상관관계
      diagnosis_treatment: {
        maxDaysBetween: 30,
        confidence: 0.8
      },
      // 치료-경과관찰 상관관계
      treatment_followup: {
        maxDaysBetween: 90,
        confidence: 0.7
      },
      // 입원-퇴원 상관관계
      admission_discharge: {
        maxDaysBetween: 365,
        confidence: 0.9
      }
    };
  }

  /**
   * 의료 이벤트 상관관계 분석
   */
  async analyze(normalizedReport, timelineData) {
    console.log('🔍 의료 이벤트 상관관계 분석...');
    
    const correlations = [];
    const events = timelineData.events || [];
    
    // 모든 이벤트 쌍에 대해 상관관계 분석
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const correlation = this.analyzeEventPair(events[i], events[j]);
        if (correlation.strength > 0.5) {
          correlations.push(correlation);
        }
      }
    }
    
    return {
      totalCorrelations: correlations.length,
      strongCorrelations: correlations.filter(c => c.strength > 0.8).length,
      correlations: correlations.sort((a, b) => b.strength - a.strength),
      analysisTime: Date.now()
    };
  }

  /**
   * 이벤트 쌍 상관관계 분석
   */
  analyzeEventPair(event1, event2) {
    const timeDiff = Math.abs(new Date(event2.date) - new Date(event1.date));
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    let correlationType = 'general';
    let baseStrength = 0.3;
    
    // 상관관계 타입 결정
    if (this.isDiagnosisTreatmentPair(event1, event2)) {
      correlationType = 'diagnosis_treatment';
      baseStrength = 0.7;
    } else if (this.isTreatmentFollowupPair(event1, event2)) {
      correlationType = 'treatment_followup';
      baseStrength = 0.6;
    } else if (this.isAdmissionDischargePair(event1, event2)) {
      correlationType = 'admission_discharge';
      baseStrength = 0.8;
    }
    
    // 시간 거리에 따른 강도 조정
    const rule = this.correlationRules[correlationType] || { maxDaysBetween: 365, confidence: 0.5 };
    const timeStrength = Math.max(0, 1 - (daysDiff / rule.maxDaysBetween));
    
    const finalStrength = Math.min(1.0, baseStrength * timeStrength * rule.confidence);
    
    return {
      event1Id: event1.id,
      event2Id: event2.id,
      type: correlationType,
      strength: finalStrength,
      daysBetween: daysDiff,
      description: this.generateCorrelationDescription(event1, event2, correlationType)
    };
  }

  /**
   * 진단-치료 쌍 검사
   */
  isDiagnosisTreatmentPair(event1, event2) {
    const types = [event1.type, event2.type];
    return types.includes('diagnosis') && 
           (types.includes('treatment') || types.includes('prescription'));
  }

  /**
   * 치료-경과관찰 쌍 검사
   */
  isTreatmentFollowupPair(event1, event2) {
    const types = [event1.type, event2.type];
    return types.includes('treatment') && types.includes('followup');
  }

  /**
   * 입원-퇴원 쌍 검사
   */
  isAdmissionDischargePair(event1, event2) {
    const types = [event1.type, event2.type];
    return types.includes('admission') && types.includes('discharge');
  }

  /**
   * 상관관계 설명 생성
   */
  generateCorrelationDescription(event1, event2, type) {
    switch (type) {
      case 'diagnosis_treatment':
        return `진단 후 치료 시작: ${event1.description} → ${event2.description}`;
      case 'treatment_followup':
        return `치료 후 경과관찰: ${event1.description} → ${event2.description}`;
      case 'admission_discharge':
        return `입원 기간: ${event1.description} → ${event2.description}`;
      default:
        return `일반적 연관성: ${event1.description} ↔ ${event2.description}`;
    }
  }
}

/**
 * 하이브리드 타임라인 빌더
 */
class HybridTimelineBuilder {
  constructor(strategy = 'hybrid') {
    this.strategy = strategy;
  }

  /**
   * 강화된 타임라인 구축
   */
  buildEnhancedTimeline(nestedDateResult, medicalContext) {
    console.log('📅 강화된 타임라인 구축...');
    
    const timeline = {
      events: [],
      periods: [],
      relationships: [],
      metadata: {
        strategy: this.strategy,
        buildTime: Date.now()
      }
    };
    
    // 중첩 날짜 결과에서 이벤트 추출
    if (nestedDateResult.resolved && nestedDateResult.resolved.dates) {
      nestedDateResult.resolved.dates.forEach((dateInfo, index) => {
        timeline.events.push({
          id: `timeline_event_${index}`,
          date: dateInfo.date,
          type: dateInfo.type || 'general',
          description: dateInfo.text || dateInfo.content,
          confidence: dateInfo.confidence || 0.7,
          source: 'nested_date_resolver'
        });
      });
    }
    
    // 의료 맥락에서 추가 이벤트 추출
    if (medicalContext.eventSequences) {
      medicalContext.eventSequences.forEach(sequence => {
        timeline.relationships.push({
          id: sequence.id,
          type: 'sequence',
          fromEvent: sequence.fromEvent,
          toEvent: sequence.toEvent,
          strength: sequence.medicalRelevance,
          description: `${sequence.sequenceType} (${sequence.daysBetween}일 간격)`
        });
      });
    }
    
    // 날짜순 정렬
    timeline.events.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return timeline;
  }
}

export default HybridMedicalNormalizer;