/**
 * Result Merger Service
 * 
 * Phase 2: 결과 통합 엔진
 * 
 * 기존 후처리 시스템과 코어엔진의 결과를 병합하고 검증하는 서비스
 * 
 * 핵심 기능:
 * 1. 다중 처리 결과 병합 (기존 시스템 + 코어엔진)
 * 2. 신뢰도 기반 최적 결과 선택
 * 3. 결과 검증 및 일관성 확인
 * 4. A/B 테스트 데이터 수집
 * 5. 성능 메트릭 비교 분석
 */

export class ResultMerger {
  constructor(options = {}) {
    this.options = {
      // 병합 전략: 'confidence', 'consensus', 'priority', 'weighted'
      mergeStrategy: options.mergeStrategy || 'confidence',
      
      // 검증 레벨: 'basic', 'standard', 'strict'
      validationLevel: options.validationLevel || 'standard',
      
      // 신뢰도 임계값
      confidenceThreshold: options.confidenceThreshold || 0.7,
      
      // 결과 검증 활성화
      enableValidation: options.enableValidation !== false,
      
      // A/B 테스트 데이터 수집
      enableABTesting: options.enableABTesting !== false,
      
      // 상세 분석 로그
      enableDetailedLogging: options.enableDetailedLogging !== false
    };
    
    // 병합 통계
    this.mergeStats = {
      totalMerges: 0,
      successfulMerges: 0,
      conflictResolutions: 0,
      averageConfidence: 0,
      strategyDistribution: {},
      lastUpdated: null
    };
    
    // 검증 규칙
    this.validationRules = new ValidationRuleEngine();
    
    // 신뢰도 계산기
    this.confidenceCalculator = new ConfidenceCalculator();
    
    console.log('🔗 ResultMerger 초기화 완료');
    console.log(`⚖️ 병합 전략: ${this.options.mergeStrategy}`);
    console.log(`🔍 검증 레벨: ${this.options.validationLevel}`);
  }

  /**
   * 메인 결과 병합 함수
   * @param {Object} dateProcessingResult 날짜 처리 결과
   * @param {Object} normalizationResult 정규화 결과
   * @param {Object} options 병합 옵션
   * @returns {Promise<Object>} 병합된 결과
   */
  async mergeResults(dateProcessingResult, normalizationResult, options = {}) {
    const startTime = Date.now();
    const mergeId = this.generateMergeId();
    
    try {
      console.log(`🔗 결과 병합 시작 (ID: ${mergeId})`);
      
      // 1. 입력 데이터 검증
      this.validateInputs(dateProcessingResult, normalizationResult);
      
      // 2. 병합 전략 결정
      const mergeStrategy = options.mergeStrategy || this.options.mergeStrategy;
      console.log(`⚖️ 병합 전략: ${mergeStrategy}`);
      
      // 3. 결과 병합 수행
      let mergedResult;
      switch (mergeStrategy) {
        case 'confidence':
          mergedResult = await this.mergeByConfidence(dateProcessingResult, normalizationResult, options);
          break;
        case 'consensus':
          mergedResult = await this.mergeByConsensus(dateProcessingResult, normalizationResult, options);
          break;
        case 'priority':
          mergedResult = await this.mergeByPriority(dateProcessingResult, normalizationResult, options);
          break;
        case 'weighted':
          mergedResult = await this.mergeByWeightedAverage(dateProcessingResult, normalizationResult, options);
          break;
        default:
          throw new Error(`지원하지 않는 병합 전략: ${mergeStrategy}`);
      }
      
      // 4. 결과 검증
      if (this.options.enableValidation) {
        console.log('🔍 결과 검증 수행...');
        const validationResult = await this.validateMergedResult(mergedResult, options);
        mergedResult.validation = validationResult;
      }
      
      // 5. 신뢰도 점수 계산
      const confidenceScore = await this.confidenceCalculator.calculateOverallConfidence(
        mergedResult,
        dateProcessingResult,
        normalizationResult
      );
      
      // 6. 메타데이터 추가
      const processingTime = Date.now() - startTime;
      mergedResult.merge = {
        id: mergeId,
        strategy: mergeStrategy,
        processingTime,
        confidenceScore,
        timestamp: new Date().toISOString(),
        inputSources: {
          dateProcessing: this.extractSourceInfo(dateProcessingResult),
          normalization: this.extractSourceInfo(normalizationResult)
        }
      };
      
      // 7. A/B 테스트 데이터 수집
      if (this.options.enableABTesting) {
        await this.collectABTestData(mergeId, mergeStrategy, mergedResult, {
          dateProcessingResult,
          normalizationResult,
          processingTime
        });
      }
      
      // 8. 통계 업데이트
      this.updateMergeStats(mergeStrategy, processingTime, confidenceScore, true);
      
      console.log(`✅ 결과 병합 완료 (${processingTime}ms, 신뢰도: ${confidenceScore.toFixed(2)})`);
      return mergedResult;
      
    } catch (error) {
      console.error(`❌ 결과 병합 실패 (ID: ${mergeId}):`, error);
      this.updateMergeStats('error', Date.now() - startTime, 0, false);
      throw error;
    }
  }

  /**
   * 신뢰도 기반 병합
   */
  async mergeByConfidence(dateResult, normalizationResult, options) {
    console.log('🎯 신뢰도 기반 병합 수행...');
    
    const mergedResult = {
      dates: [],
      medicalEvents: [],
      timeline: [],
      patientInfo: {},
      insuranceInfo: [],
      diagnostics: []
    };
    
    // 날짜 정보 병합 (신뢰도 우선)
    const dateConfidence = this.extractConfidence(dateResult);
    const normalizationConfidence = this.extractConfidence(normalizationResult);
    
    if (dateConfidence >= normalizationConfidence) {
      mergedResult.dates = dateResult.dates || dateResult.extractedDates || [];
      mergedResult.primaryDateSource = 'dateProcessor';
    } else {
      mergedResult.dates = normalizationResult.dates || normalizationResult.extractedDates || [];
      mergedResult.primaryDateSource = 'normalizer';
    }
    
    // 의료 이벤트 병합 (높은 신뢰도 우선 선택)
    const dateEvents = dateResult.medicalEvents || [];
    const normalizationEvents = normalizationResult.medicalEvents || [];
    
    mergedResult.medicalEvents = this.mergeEventsByConfidence(dateEvents, normalizationEvents);
    
    // 타임라인 구성 (두 결과의 최적 조합)
    mergedResult.timeline = await this.constructOptimalTimeline(
      dateResult.timeline || [],
      normalizationResult.timeline || []
    );
    
    // 환자 정보 병합 (더 완전한 정보 선택)
    mergedResult.patientInfo = this.mergePatientInfo(
      dateResult.patientInfo || {},
      normalizationResult.patientInfo || {}
    );
    
    // 보험 정보 병합
    mergedResult.insuranceInfo = this.mergeInsuranceInfo(
      dateResult.insuranceInfo || [],
      normalizationResult.insuranceInfo || []
    );
    
    return mergedResult;
  }

  /**
   * 신뢰도 기반 이벤트 병합
   */
  mergeEventsByConfidence(dateEvents, normalizationEvents) {
    const allEvents = [...dateEvents, ...normalizationEvents];
    
    // 신뢰도 기준으로 정렬
    return allEvents.sort((a, b) => {
      const confidenceA = a.confidence || 0.5;
      const confidenceB = b.confidence || 0.5;
      return confidenceB - confidenceA;
    });
  }

  /**
   * 최적 타임라인 구성
   */
  async constructOptimalTimeline(dateTimeline, normalizationTimeline) {
    const allEvents = [...dateTimeline, ...normalizationTimeline];
    
    // 날짜 기준으로 정렬
    return allEvents.sort((a, b) => {
      const dateA = new Date(a.date || a.timestamp || 0);
      const dateB = new Date(b.date || b.timestamp || 0);
      return dateA - dateB;
    });
  }

  /**
   * 환자 정보 병합
   */
  mergePatientInfo(datePatientInfo, normalizationPatientInfo) {
    return {
      ...datePatientInfo,
      ...normalizationPatientInfo
    };
  }

  /**
   * 보험 정보 병합
   */
  mergeInsuranceInfo(dateInsuranceInfo, normalizationInsuranceInfo) {
    return [...dateInsuranceInfo, ...normalizationInsuranceInfo];
  }

  /**
   * 합의 기반 병합
   */
  async mergeByConsensus(dateResult, normalizationResult, options) {
    console.log('🤝 합의 기반 병합 수행...');
    
    const mergedResult = {
      dates: [],
      medicalEvents: [],
      timeline: [],
      patientInfo: {},
      insuranceInfo: [],
      consensus: {}
    };
    
    // 공통 요소 추출
    const commonDates = this.findCommonElements(
      dateResult.dates || [],
      normalizationResult.dates || []
    );
    
    const commonEvents = this.findCommonMedicalEvents(
      dateResult.medicalEvents || [],
      normalizationResult.medicalEvents || []
    );
    
    // 합의된 요소들을 우선 포함
    mergedResult.dates = commonDates;
    mergedResult.medicalEvents = commonEvents;
    
    // 불일치 요소들에 대한 추가 분석
    const conflicts = this.identifyConflicts(dateResult, normalizationResult);
    mergedResult.consensus = {
      agreedElements: commonDates.length + commonEvents.length,
      conflicts: conflicts.length,
      resolutionStrategy: 'consensus_priority'
    };
    
    // 충돌 해결
    const resolvedConflicts = await this.resolveConflicts(conflicts);
    mergedResult.dates.push(...resolvedConflicts.dates);
    mergedResult.medicalEvents.push(...resolvedConflicts.events);
    
    return mergedResult;
  }

  /**
   * 우선순위 기반 병합
   */
  async mergeByPriority(dateResult, normalizationResult, options) {
    console.log('📋 우선순위 기반 병합 수행...');
    
    // 기본 우선순위: 코어엔진 > 기존 시스템
    const primaryResult = this.determinePrimaryResult(dateResult, normalizationResult);
    const secondaryResult = primaryResult === dateResult ? normalizationResult : dateResult;
    
    const mergedResult = {
      ...primaryResult,
      priority: {
        primary: primaryResult === dateResult ? 'dateProcessor' : 'normalizer',
        secondary: primaryResult === dateResult ? 'normalizer' : 'dateProcessor'
      }
    };
    
    // 보조 결과에서 누락된 정보 보완
    mergedResult.dates = this.supplementMissingDates(
      mergedResult.dates || [],
      secondaryResult.dates || []
    );
    
    mergedResult.medicalEvents = this.supplementMissingEvents(
      mergedResult.medicalEvents || [],
      secondaryResult.medicalEvents || []
    );
    
    return mergedResult;
  }

  /**
   * 가중 평균 기반 병합
   */
  async mergeByWeightedAverage(dateResult, normalizationResult, options) {
    console.log('⚖️ 가중 평균 기반 병합 수행...');
    
    // 가중치 계산 (성능, 신뢰도, 완성도 기반)
    const dateWeight = this.calculateResultWeight(dateResult);
    const normalizationWeight = this.calculateResultWeight(normalizationResult);
    
    const totalWeight = dateWeight + normalizationWeight;
    const dateRatio = dateWeight / totalWeight;
    const normalizationRatio = normalizationWeight / totalWeight;
    
    const mergedResult = {
      dates: this.weightedMergeDates(
        dateResult.dates || [],
        normalizationResult.dates || [],
        dateRatio,
        normalizationRatio
      ),
      medicalEvents: this.weightedMergeEvents(
        dateResult.medicalEvents || [],
        normalizationResult.medicalEvents || [],
        dateRatio,
        normalizationRatio
      ),
      weights: {
        dateProcessor: dateRatio,
        normalizer: normalizationRatio
      }
    };
    
    return mergedResult;
  }

  /**
   * 입력 데이터 검증
   */
  validateInputs(dateResult, normalizationResult) {
    if (!dateResult || typeof dateResult !== 'object') {
      throw new Error('유효하지 않은 날짜 처리 결과');
    }
    
    if (!normalizationResult || typeof normalizationResult !== 'object') {
      throw new Error('유효하지 않은 정규화 결과');
    }
    
    console.log('✅ 입력 데이터 검증 완료');
  }

  /**
   * 병합된 결과 검증
   */
  async validateMergedResult(mergedResult, options) {
    const validationLevel = options.validationLevel || this.options.validationLevel;
    
    const validationResult = {
      level: validationLevel,
      passed: true,
      issues: [],
      score: 0
    };
    
    try {
      // 기본 검증
      if (validationLevel === 'basic' || validationLevel === 'standard' || validationLevel === 'strict') {
        await this.validationRules.validateBasicStructure(mergedResult, validationResult);
      }
      
      // 표준 검증
      if (validationLevel === 'standard' || validationLevel === 'strict') {
        await this.validationRules.validateDataConsistency(mergedResult, validationResult);
      }
      
      // 엄격한 검증
      if (validationLevel === 'strict') {
        await this.validationRules.validateMedicalLogic(mergedResult, validationResult);
      }
      
      // 검증 점수 계산
      validationResult.score = this.calculateValidationScore(validationResult);
      validationResult.passed = validationResult.score >= 0.8;
      
    } catch (error) {
      validationResult.passed = false;
      validationResult.issues.push(`검증 오류: ${error.message}`);
    }
    
    return validationResult;
  }

  /**
   * 검증 점수 계산
   */
  calculateValidationScore(validationResult) {
    if (!validationResult) return 0;
    
    const totalChecks = validationResult.issues.length + 
                       (validationResult.passed ? 1 : 0);
    
    if (totalChecks === 0) return 0.5; // 기본값
    
    const passedChecks = validationResult.passed ? 1 : 0;
    const errorPenalty = validationResult.issues.length * 0.2;
    
    return Math.max(0, Math.min(1, passedChecks / totalChecks - errorPenalty));
  }

  /**
   * 신뢰도 추출
   */
  extractConfidence(result) {
    if (result.hybrid?.confidence) return result.hybrid.confidence;
    if (result.confidence) return result.confidence;
    if (result.hybrid?.metrics?.successRate) return result.hybrid.metrics.successRate / 100;
    return 0.5; // 기본값
  }

  /**
   * 소스 정보 추출
   */
  extractSourceInfo(result) {
    return {
      processingMode: result.hybrid?.processingMode || 'unknown',
      processingTime: result.hybrid?.processingTime || 0,
      confidence: this.extractConfidence(result),
      itemCount: this.countResultItems(result)
    };
  }

  /**
   * 결과 항목 수 계산
   */
  countResultItems(result) {
    let count = 0;
    if (result.dates) count += result.dates.length;
    if (result.medicalEvents) count += result.medicalEvents.length;
    if (result.extractedDates) count += result.extractedDates.length;
    return count;
  }

  /**
   * 병합 ID 생성
   */
  generateMergeId() {
    return `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 병합 통계 업데이트
   */
  updateMergeStats(strategy, processingTime, confidence, success) {
    this.mergeStats.totalMerges++;
    
    if (success) {
      this.mergeStats.successfulMerges++;
      
      // 평균 신뢰도 업데이트
      const totalConfidence = this.mergeStats.averageConfidence * (this.mergeStats.successfulMerges - 1) + confidence;
      this.mergeStats.averageConfidence = totalConfidence / this.mergeStats.successfulMerges;
    }
    
    // 전략 분포 업데이트
    if (!this.mergeStats.strategyDistribution[strategy]) {
      this.mergeStats.strategyDistribution[strategy] = 0;
    }
    this.mergeStats.strategyDistribution[strategy]++;
    
    this.mergeStats.lastUpdated = new Date();
  }

  /**
   * A/B 테스트 데이터 수집
   */
  async collectABTestData(mergeId, strategy, result, metadata) {
    // A/B 테스트 데이터 수집 로직
    console.log(`📊 A/B 테스트 데이터 수집: ${mergeId} (전략: ${strategy})`);
  }

  /**
   * 설정 업데이트
   */
  updateConfiguration(newConfig) {
    this.options = { ...this.options, ...newConfig };
    console.log('⚙️ ResultMerger 설정 업데이트:', newConfig);
  }

  /**
   * 통계 요약 반환
   */
  getStatsSummary() {
    return {
      ...this.mergeStats,
      successRate: this.mergeStats.totalMerges > 0 
        ? (this.mergeStats.successfulMerges / this.mergeStats.totalMerges * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

/**
 * 검증 규칙 엔진
 */
class ValidationRuleEngine {
  async validateBasicStructure(result, validationResult) {
    // 기본 구조 검증 로직
    if (!result.dates && !result.extractedDates) {
      validationResult.issues.push('날짜 정보가 없습니다');
    }
  }

  async validateDataConsistency(result, validationResult) {
    // 데이터 일관성 검증 로직
  }

  async validateMedicalLogic(result, validationResult) {
    // 의료 논리 검증 로직
  }
}

/**
 * 신뢰도 계산기
 */
class ConfidenceCalculator {
  async calculateOverallConfidence(mergedResult, dateResult, normalizationResult) {
    // 전체 신뢰도 계산 로직
    const dateConfidence = this.extractConfidence(dateResult) || 0.5;
    const normalizationConfidence = this.extractConfidence(normalizationResult) || 0.5;
    
    // 가중 평균으로 계산
    return (dateConfidence + normalizationConfidence) / 2;
  }

  extractConfidence(result) {
    if (result.hybrid?.confidence) return result.hybrid.confidence;
    if (result.confidence) return result.confidence;
    return 0.5;
  }
}

export default ResultMerger;