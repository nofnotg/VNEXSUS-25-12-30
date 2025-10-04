/**
 * Compatibility Manager for GPT-4o Mini Enhanced Integration
 * 
 * 기존 시스템과의 호환성 보장 및 A/B 테스트 구현
 * 점진적 전환, 폴백 처리, 호환성 검증 기능 제공
 */

import fs from 'fs/promises';
import path from 'path';

export class CompatibilityManager {
  constructor(options = {}) {
    // 호환성 설정
    this.config = {
      // A/B 테스트 설정
      enableABTest: options.enableABTest ?? true,
      enhancedServiceRatio: options.enhancedServiceRatio || 0.3, // 30%부터 시작
      abTestDuration: options.abTestDuration || 7 * 24 * 60 * 60 * 1000, // 7일
      
      // 점진적 전환 설정
      enableGradualRollout: options.enableGradualRollout ?? true,
      rolloutStages: options.rolloutStages || [0.1, 0.3, 0.5, 0.8, 1.0],
      stageTransitionThreshold: options.stageTransitionThreshold || 0.95, // 95% 성공률
      
      // 호환성 검증 설정
      enableCompatibilityCheck: options.enableCompatibilityCheck ?? true,
      compatibilityThreshold: options.compatibilityThreshold || 0.9,
      
      // 폴백 설정
      enableAutoFallback: options.enableAutoFallback ?? true,
      fallbackThreshold: options.fallbackThreshold || 0.8,
      fallbackCooldown: options.fallbackCooldown || 300000, // 5분
      
      // 모니터링 설정
      enableDetailedLogging: options.enableDetailedLogging ?? true,
      logDirectory: options.logDirectory || './logs/compatibility',
      metricsRetention: options.metricsRetention || 30 // 30일
    };
    
    // 호환성 상태
    this.state = {
      currentStage: 0,
      rolloutStartTime: null,
      lastStageTransition: null,
      isRollingBack: false,
      
      // A/B 테스트 상태
      abTestActive: false,
      abTestStartTime: null,
      abTestResults: {
        enhanced: { requests: 0, successes: 0, failures: 0, totalTime: 0 },
        existing: { requests: 0, successes: 0, failures: 0, totalTime: 0 }
      },
      
      // 호환성 메트릭
      compatibilityScore: 1.0,
      lastCompatibilityCheck: null,
      
      // 폴백 상태
      fallbackActive: false,
      fallbackReason: null,
      fallbackStartTime: null,
      fallbackCount: 0
    };
    
    // 호환성 검증 규칙
    this.compatibilityRules = {
      // API 호환성
      apiCompatibility: {
        requiredMethods: ['generateMedicalReport', 'chat', 'summarizeMedicalRecord'],
        requiredParameters: ['prompt', 'options'],
        responseFormat: ['content', 'metadata', 'usage']
      },
      
      // 데이터 호환성
      dataCompatibility: {
        inputFormats: ['string', 'object'],
        outputFormats: ['object'],
        requiredFields: ['content', 'success']
      },
      
      // 성능 호환성
      performanceCompatibility: {
        maxResponseTime: 30000, // 30초
        minSuccessRate: 0.95,
        maxMemoryIncrease: 0.2 // 20%
      }
    };
    
    // 메트릭 저장소
    this.metrics = {
      compatibility: [],
      performance: [],
      abTest: [],
      rollout: [],
      fallback: []
    };
    
    // 사용자 세그먼트 (A/B 테스트용)
    this.userSegments = new Map();
    
    console.log('🔧 Compatibility Manager 초기화 완료');
  }

  /**
   * 호환성 관리자 시작
   */
  async start() {
    console.log('🚀 호환성 관리자 시작...');
    
    // 로그 디렉토리 생성
    await this.ensureLogDirectory();
    
    // 초기 호환성 검증
    if (this.config.enableCompatibilityCheck) {
      await this.performCompatibilityCheck();
    }
    
    // A/B 테스트 시작
    if (this.config.enableABTest) {
      await this.startABTest();
    }
    
    // 점진적 전환 시작
    if (this.config.enableGradualRollout) {
      await this.startGradualRollout();
    }
    
    console.log('✅ 호환성 관리자 활성화됨');
  }

  /**
   * 서비스 선택 (A/B 테스트 및 점진적 전환 고려)
   * @param {Object} context - 요청 컨텍스트
   * @returns {string} 선택된 서비스 ('enhanced' | 'existing')
   */
  selectService(context = {}) {
    // 폴백 상태 확인
    if (this.state.fallbackActive) {
      this.logServiceSelection('existing', 'fallback_active', context);
      return 'existing';
    }
    
    // 호환성 점수 확인
    if (this.state.compatibilityScore < this.config.compatibilityThreshold) {
      this.logServiceSelection('existing', 'low_compatibility', context);
      return 'existing';
    }
    
    // A/B 테스트 활성화 시
    if (this.state.abTestActive) {
      const service = this.selectServiceForABTest(context);
      this.logServiceSelection(service, 'ab_test', context);
      return service;
    }
    
    // 점진적 전환 활성화 시
    if (this.config.enableGradualRollout) {
      const service = this.selectServiceForRollout(context);
      this.logServiceSelection(service, 'gradual_rollout', context);
      return service;
    }
    
    // 기본값: 기존 서비스
    this.logServiceSelection('existing', 'default', context);
    return 'existing';
  }

  /**
   * A/B 테스트용 서비스 선택
   * @param {Object} context - 요청 컨텍스트
   * @returns {string} 선택된 서비스
   */
  selectServiceForABTest(context) {
    const userId = context.userId || context.sessionId || 'anonymous';
    
    // 사용자 세그먼트 확인
    if (!this.userSegments.has(userId)) {
      // 새 사용자를 랜덤하게 세그먼트에 할당
      const isEnhanced = Math.random() < this.config.enhancedServiceRatio;
      this.userSegments.set(userId, {
        service: isEnhanced ? 'enhanced' : 'existing',
        assignedAt: Date.now(),
        requestCount: 0
      });
    }
    
    const segment = this.userSegments.get(userId);
    segment.requestCount++;
    
    return segment.service;
  }

  /**
   * 점진적 전환용 서비스 선택
   * @param {Object} context - 요청 컨텍스트
   * @returns {string} 선택된 서비스
   */
  selectServiceForRollout(context) {
    const currentRatio = this.config.rolloutStages[this.state.currentStage] || 0;
    const shouldUseEnhanced = Math.random() < currentRatio;
    
    return shouldUseEnhanced ? 'enhanced' : 'existing';
  }

  /**
   * 요청 결과 추적
   * @param {string} service - 사용된 서비스
   * @param {Object} result - 요청 결과
   * @param {Object} context - 요청 컨텍스트
   */
  trackRequest(service, result, context = {}) {
    const requestData = {
      service,
      timestamp: Date.now(),
      success: result.success !== false,
      responseTime: result.responseTime || 0,
      error: result.error || null,
      context: context
    };
    
    // A/B 테스트 메트릭 업데이트
    if (this.state.abTestActive) {
      this.updateABTestMetrics(service, requestData);
    }
    
    // 호환성 메트릭 업데이트
    this.updateCompatibilityMetrics(service, requestData);
    
    // 폴백 조건 확인
    this.checkFallbackConditions(service, requestData);
    
    // 점진적 전환 조건 확인
    if (this.config.enableGradualRollout) {
      this.checkRolloutProgression();
    }
    
    console.log(`📊 요청 추적: ${service} - ${requestData.success ? '성공' : '실패'} (${requestData.responseTime}ms)`);
  }

  /**
   * A/B 테스트 메트릭 업데이트
   * @param {string} service - 서비스 타입
   * @param {Object} requestData - 요청 데이터
   */
  updateABTestMetrics(service, requestData) {
    const metrics = this.state.abTestResults[service];
    if (!metrics) return;
    
    metrics.requests++;
    metrics.totalTime += requestData.responseTime;
    
    if (requestData.success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }
    
    // A/B 테스트 결과 로깅
    this.metrics.abTest.push({
      timestamp: requestData.timestamp,
      service,
      success: requestData.success,
      responseTime: requestData.responseTime,
      cumulativeMetrics: { ...metrics }
    });
  }

  /**
   * 호환성 메트릭 업데이트
   * @param {string} service - 서비스 타입
   * @param {Object} requestData - 요청 데이터
   */
  updateCompatibilityMetrics(service, requestData) {
    const compatibilityMetric = {
      timestamp: requestData.timestamp,
      service,
      success: requestData.success,
      responseTime: requestData.responseTime,
      compatibilityScore: this.calculateRequestCompatibilityScore(requestData)
    };
    
    this.metrics.compatibility.push(compatibilityMetric);
    
    // 전체 호환성 점수 업데이트
    this.updateOverallCompatibilityScore();
  }

  /**
   * 요청별 호환성 점수 계산
   * @param {Object} requestData - 요청 데이터
   * @returns {number} 호환성 점수 (0-1)
   */
  calculateRequestCompatibilityScore(requestData) {
    let score = 1.0;
    
    // 성공률 기반 점수
    if (!requestData.success) {
      score -= 0.5;
    }
    
    // 응답 시간 기반 점수
    const maxResponseTime = this.compatibilityRules.performanceCompatibility.maxResponseTime;
    if (requestData.responseTime > maxResponseTime) {
      score -= 0.3;
    }
    
    // 에러 타입 기반 점수
    if (requestData.error) {
      if (requestData.error.includes('compatibility') || requestData.error.includes('format')) {
        score -= 0.4;
      } else {
        score -= 0.2;
      }
    }
    
    return Math.max(0, score);
  }

  /**
   * 전체 호환성 점수 업데이트
   */
  updateOverallCompatibilityScore() {
    const recentMetrics = this.metrics.compatibility.slice(-100); // 최근 100개 요청
    
    if (recentMetrics.length === 0) {
      this.state.compatibilityScore = 1.0;
      return;
    }
    
    const averageScore = recentMetrics.reduce((sum, metric) => 
      sum + metric.compatibilityScore, 0
    ) / recentMetrics.length;
    
    // 지수 이동 평균으로 부드럽게 업데이트
    this.state.compatibilityScore = 
      (this.state.compatibilityScore * 0.8) + (averageScore * 0.2);
    
    this.state.lastCompatibilityCheck = Date.now();
  }

  /**
   * 폴백 조건 확인
   * @param {string} service - 서비스 타입
   * @param {Object} requestData - 요청 데이터
   */
  checkFallbackConditions(service, requestData) {
    if (!this.config.enableAutoFallback || service !== 'enhanced') {
      return;
    }
    
    // 이미 폴백 상태이거나 쿨다운 중인 경우
    if (this.state.fallbackActive || this.isInFallbackCooldown()) {
      return;
    }
    
    // 최근 요청들의 성공률 확인
    const recentRequests = this.metrics.compatibility
      .filter(m => m.service === 'enhanced')
      .slice(-20); // 최근 20개 요청
    
    if (recentRequests.length < 10) {
      return; // 충분한 데이터가 없음
    }
    
    const successRate = recentRequests.filter(r => r.success).length / recentRequests.length;
    
    if (successRate < this.config.fallbackThreshold) {
      this.activateFallback('low_success_rate', { successRate, threshold: this.config.fallbackThreshold });
    }
    
    // 호환성 점수 확인
    if (this.state.compatibilityScore < this.config.fallbackThreshold) {
      this.activateFallback('low_compatibility', { 
        score: this.state.compatibilityScore, 
        threshold: this.config.fallbackThreshold 
      });
    }
  }

  /**
   * 폴백 활성화
   * @param {string} reason - 폴백 사유
   * @param {Object} data - 추가 데이터
   */
  activateFallback(reason, data = {}) {
    console.log(`🚨 폴백 활성화: ${reason}`);
    
    this.state.fallbackActive = true;
    this.state.fallbackReason = reason;
    this.state.fallbackStartTime = Date.now();
    this.state.fallbackCount++;
    
    // 폴백 메트릭 기록
    this.metrics.fallback.push({
      timestamp: Date.now(),
      reason,
      data,
      duration: null // 비활성화 시 업데이트
    });
    
    // A/B 테스트 일시 중단
    if (this.state.abTestActive) {
      console.log('⏸️ A/B 테스트 일시 중단 (폴백 활성화)');
    }
  }

  /**
   * 폴백 비활성화
   * @param {string} reason - 비활성화 사유
   */
  deactivateFallback(reason = 'manual') {
    if (!this.state.fallbackActive) {
      return;
    }
    
    console.log(`✅ 폴백 비활성화: ${reason}`);
    
    const duration = Date.now() - this.state.fallbackStartTime;
    
    // 마지막 폴백 메트릭 업데이트
    const lastFallback = this.metrics.fallback[this.metrics.fallback.length - 1];
    if (lastFallback && lastFallback.duration === null) {
      lastFallback.duration = duration;
      lastFallback.deactivationReason = reason;
    }
    
    this.state.fallbackActive = false;
    this.state.fallbackReason = null;
    this.state.fallbackStartTime = null;
  }

  /**
   * 폴백 쿨다운 확인
   * @returns {boolean} 쿨다운 중 여부
   */
  isInFallbackCooldown() {
    if (!this.state.fallbackStartTime) {
      return false;
    }
    
    const timeSinceLastFallback = Date.now() - this.state.fallbackStartTime;
    return timeSinceLastFallback < this.config.fallbackCooldown;
  }

  /**
   * A/B 테스트 시작
   */
  async startABTest() {
    if (this.state.abTestActive) {
      console.log('⚠️ A/B 테스트가 이미 실행 중입니다.');
      return;
    }
    
    console.log('🧪 A/B 테스트 시작...');
    
    this.state.abTestActive = true;
    this.state.abTestStartTime = Date.now();
    
    // A/B 테스트 결과 초기화
    this.state.abTestResults = {
      enhanced: { requests: 0, successes: 0, failures: 0, totalTime: 0 },
      existing: { requests: 0, successes: 0, failures: 0, totalTime: 0 }
    };
    
    // 자동 종료 타이머 설정
    setTimeout(() => {
      if (this.state.abTestActive) {
        this.stopABTest('duration_completed');
      }
    }, this.config.abTestDuration);
    
    console.log(`✅ A/B 테스트 활성화됨 (기간: ${this.config.abTestDuration / (24 * 60 * 60 * 1000)}일)`);
  }

  /**
   * A/B 테스트 중지
   * @param {string} reason - 중지 사유
   */
  async stopABTest(reason = 'manual') {
    if (!this.state.abTestActive) {
      console.log('⚠️ A/B 테스트가 실행되고 있지 않습니다.');
      return;
    }
    
    console.log(`🛑 A/B 테스트 중지: ${reason}`);
    
    // 최종 결과 분석
    const results = await this.analyzeABTestResults();
    
    this.state.abTestActive = false;
    
    // 결과 로깅
    await this.logABTestResults(results, reason);
    
    console.log('✅ A/B 테스트 중지됨');
    
    return results;
  }

  /**
   * A/B 테스트 결과 분석
   * @returns {Object} 분석 결과
   */
  async analyzeABTestResults() {
    const { enhanced, existing } = this.state.abTestResults;
    
    const analysis = {
      duration: Date.now() - this.state.abTestStartTime,
      enhanced: {
        ...enhanced,
        successRate: enhanced.requests > 0 ? enhanced.successes / enhanced.requests : 0,
        averageResponseTime: enhanced.requests > 0 ? enhanced.totalTime / enhanced.requests : 0,
        errorRate: enhanced.requests > 0 ? enhanced.failures / enhanced.requests : 0
      },
      existing: {
        ...existing,
        successRate: existing.requests > 0 ? existing.successes / existing.requests : 0,
        averageResponseTime: existing.requests > 0 ? existing.totalTime / existing.requests : 0,
        errorRate: existing.requests > 0 ? existing.failures / existing.requests : 0
      }
    };
    
    // 통계적 유의성 검증
    analysis.statisticalSignificance = this.calculateStatisticalSignificance(enhanced, existing);
    
    // 권장사항 생성
    analysis.recommendation = this.generateABTestRecommendation(analysis);
    
    return analysis;
  }

  /**
   * 통계적 유의성 계산
   * @param {Object} enhanced - Enhanced 서비스 결과
   * @param {Object} existing - 기존 서비스 결과
   * @returns {Object} 통계적 유의성 정보
   */
  calculateStatisticalSignificance(enhanced, existing) {
    // 간단한 Z-test 구현
    const n1 = enhanced.requests;
    const n2 = existing.requests;
    const p1 = n1 > 0 ? enhanced.successes / n1 : 0;
    const p2 = n2 > 0 ? existing.successes / n2 : 0;
    
    if (n1 < 30 || n2 < 30) {
      return {
        significant: false,
        reason: 'insufficient_sample_size',
        minSampleSize: 30
      };
    }
    
    const pooledP = (enhanced.successes + existing.successes) / (n1 + n2);
    const standardError = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
    const zScore = Math.abs(p1 - p2) / standardError;
    
    // 95% 신뢰도 (z = 1.96)
    const isSignificant = zScore > 1.96;
    
    return {
      significant: isSignificant,
      zScore: zScore,
      pValue: this.calculatePValue(zScore),
      confidenceLevel: 0.95,
      effectSize: p1 - p2
    };
  }

  /**
   * P-value 계산 (근사치)
   * @param {number} zScore - Z 점수
   * @returns {number} P-value
   */
  calculatePValue(zScore) {
    // 간단한 근사 공식 사용
    return 2 * (1 - this.normalCDF(Math.abs(zScore)));
  }

  /**
   * 정규분포 누적분포함수 (근사치)
   * @param {number} x - 입력값
   * @returns {number} CDF 값
   */
  normalCDF(x) {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * 오차함수 (근사치)
   * @param {number} x - 입력값
   * @returns {number} erf 값
   */
  erf(x) {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }

  /**
   * A/B 테스트 권장사항 생성
   * @param {Object} analysis - 분석 결과
   * @returns {Object} 권장사항
   */
  generateABTestRecommendation(analysis) {
    const { enhanced, existing, statisticalSignificance } = analysis;
    
    if (!statisticalSignificance.significant) {
      return {
        action: 'continue_testing',
        reason: 'no_significant_difference',
        details: '통계적으로 유의한 차이가 발견되지 않았습니다. 더 많은 데이터가 필요합니다.'
      };
    }
    
    // 성공률 비교
    const successRateDiff = enhanced.successRate - existing.successRate;
    const responseTimeDiff = enhanced.averageResponseTime - existing.averageResponseTime;
    
    if (successRateDiff > 0.05 && responseTimeDiff < 2000) {
      return {
        action: 'adopt_enhanced',
        reason: 'better_performance',
        details: `Enhanced 서비스가 더 나은 성능을 보입니다. 성공률: +${(successRateDiff * 100).toFixed(1)}%`
      };
    }
    
    if (successRateDiff < -0.05 || responseTimeDiff > 5000) {
      return {
        action: 'keep_existing',
        reason: 'enhanced_underperforms',
        details: `Enhanced 서비스의 성능이 기존 서비스보다 낮습니다.`
      };
    }
    
    return {
      action: 'gradual_rollout',
      reason: 'mixed_results',
      details: '결과가 혼재되어 있습니다. 점진적 전환을 권장합니다.'
    };
  }

  /**
   * 점진적 전환 시작
   */
  async startGradualRollout() {
    if (this.state.rolloutStartTime) {
      console.log('⚠️ 점진적 전환이 이미 진행 중입니다.');
      return;
    }
    
    console.log('📈 점진적 전환 시작...');
    
    this.state.rolloutStartTime = Date.now();
    this.state.currentStage = 0;
    this.state.lastStageTransition = Date.now();
    
    console.log(`✅ 점진적 전환 시작됨 (1단계: ${(this.config.rolloutStages[0] * 100).toFixed(0)}%)`);
  }

  /**
   * 점진적 전환 진행 확인
   */
  checkRolloutProgression() {
    if (!this.state.rolloutStartTime || this.state.isRollingBack) {
      return;
    }
    
    const currentStage = this.state.currentStage;
    const nextStage = currentStage + 1;
    
    if (nextStage >= this.config.rolloutStages.length) {
      return; // 이미 마지막 단계
    }
    
    // 최소 대기 시간 확인 (1시간)
    const minStageTime = 60 * 60 * 1000;
    const timeSinceLastTransition = Date.now() - this.state.lastStageTransition;
    
    if (timeSinceLastTransition < minStageTime) {
      return;
    }
    
    // 현재 단계의 성공률 확인
    const stageSuccessRate = this.calculateStageSuccessRate();
    
    if (stageSuccessRate >= this.config.stageTransitionThreshold) {
      this.transitionToNextStage();
    } else if (stageSuccessRate < 0.8) {
      // 성공률이 너무 낮으면 롤백
      this.rollbackStage('low_success_rate');
    }
  }

  /**
   * 현재 단계 성공률 계산
   * @returns {number} 성공률
   */
  calculateStageSuccessRate() {
    const stageStartTime = this.state.lastStageTransition;
    const recentRequests = this.metrics.compatibility.filter(
      m => m.timestamp >= stageStartTime && m.service === 'enhanced'
    );
    
    if (recentRequests.length < 10) {
      return 1.0; // 충분한 데이터가 없으면 성공으로 간주
    }
    
    const successes = recentRequests.filter(r => r.success).length;
    return successes / recentRequests.length;
  }

  /**
   * 다음 단계로 전환
   */
  transitionToNextStage() {
    const nextStage = this.state.currentStage + 1;
    
    if (nextStage >= this.config.rolloutStages.length) {
      console.log('🎉 점진적 전환 완료!');
      return;
    }
    
    this.state.currentStage = nextStage;
    this.state.lastStageTransition = Date.now();
    
    const nextRatio = this.config.rolloutStages[nextStage];
    
    console.log(`📈 다음 단계로 전환: ${nextStage + 1}단계 (${(nextRatio * 100).toFixed(0)}%)`);
    
    // 전환 메트릭 기록
    this.metrics.rollout.push({
      timestamp: Date.now(),
      stage: nextStage,
      ratio: nextRatio,
      successRate: this.calculateStageSuccessRate()
    });
  }

  /**
   * 단계 롤백
   * @param {string} reason - 롤백 사유
   */
  rollbackStage(reason) {
    if (this.state.currentStage === 0) {
      console.log('⚠️ 이미 첫 번째 단계입니다. 롤백할 수 없습니다.');
      return;
    }
    
    console.log(`🔄 단계 롤백: ${reason}`);
    
    this.state.isRollingBack = true;
    this.state.currentStage = Math.max(0, this.state.currentStage - 1);
    this.state.lastStageTransition = Date.now();
    
    // 롤백 메트릭 기록
    this.metrics.rollout.push({
      timestamp: Date.now(),
      stage: this.state.currentStage,
      ratio: this.config.rolloutStages[this.state.currentStage],
      action: 'rollback',
      reason: reason
    });
    
    // 롤백 상태 해제 (1시간 후)
    setTimeout(() => {
      this.state.isRollingBack = false;
    }, 60 * 60 * 1000);
  }

  /**
   * 호환성 검증 수행
   */
  async performCompatibilityCheck() {
    console.log('🔍 호환성 검증 수행 중...');
    
    try {
      const results = {
        timestamp: Date.now(),
        apiCompatibility: await this.checkAPICompatibility(),
        dataCompatibility: await this.checkDataCompatibility(),
        performanceCompatibility: await this.checkPerformanceCompatibility()
      };
      
      // 전체 호환성 점수 계산
      const scores = [
        results.apiCompatibility.score,
        results.dataCompatibility.score,
        results.performanceCompatibility.score
      ];
      
      results.overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      results.passed = results.overallScore >= this.config.compatibilityThreshold;
      
      // 결과 저장
      this.metrics.compatibility.push(results);
      this.state.compatibilityScore = results.overallScore;
      this.state.lastCompatibilityCheck = Date.now();
      
      console.log(`✅ 호환성 검증 완료: ${(results.overallScore * 100).toFixed(1)}%`);
      
      return results;
      
    } catch (error) {
      console.error('❌ 호환성 검증 실패:', error);
      return {
        timestamp: Date.now(),
        overallScore: 0,
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * API 호환성 검증
   * @returns {Object} API 호환성 결과
   */
  async checkAPICompatibility() {
    const rules = this.compatibilityRules.apiCompatibility;
    let score = 1.0;
    const issues = [];
    
    // 필수 메서드 확인 (모의 검증)
    rules.requiredMethods.forEach(method => {
      // 실제 구현에서는 서비스 인스턴스의 메서드 존재 여부 확인
      const exists = true; // 모의값
      if (!exists) {
        score -= 0.3;
        issues.push(`필수 메서드 누락: ${method}`);
      }
    });
    
    return {
      score: Math.max(0, score),
      passed: score >= 0.8,
      issues: issues,
      details: {
        requiredMethods: rules.requiredMethods.length,
        availableMethods: rules.requiredMethods.length // 모의값
      }
    };
  }

  /**
   * 데이터 호환성 검증
   * @returns {Object} 데이터 호환성 결과
   */
  async checkDataCompatibility() {
    const rules = this.compatibilityRules.dataCompatibility;
    let score = 1.0;
    const issues = [];
    
    // 입력 형식 확인
    const supportedInputFormats = ['string', 'object']; // 모의값
    const missingInputFormats = rules.inputFormats.filter(
      format => !supportedInputFormats.includes(format)
    );
    
    if (missingInputFormats.length > 0) {
      score -= 0.2 * missingInputFormats.length;
      issues.push(`지원되지 않는 입력 형식: ${missingInputFormats.join(', ')}`);
    }
    
    // 출력 형식 확인
    const supportedOutputFormats = ['object']; // 모의값
    const missingOutputFormats = rules.outputFormats.filter(
      format => !supportedOutputFormats.includes(format)
    );
    
    if (missingOutputFormats.length > 0) {
      score -= 0.3 * missingOutputFormats.length;
      issues.push(`지원되지 않는 출력 형식: ${missingOutputFormats.join(', ')}`);
    }
    
    return {
      score: Math.max(0, score),
      passed: score >= 0.8,
      issues: issues,
      details: {
        inputFormats: supportedInputFormats,
        outputFormats: supportedOutputFormats
      }
    };
  }

  /**
   * 성능 호환성 검증
   * @returns {Object} 성능 호환성 결과
   */
  async checkPerformanceCompatibility() {
    const rules = this.compatibilityRules.performanceCompatibility;
    let score = 1.0;
    const issues = [];
    
    // 최근 성능 데이터 분석
    const recentRequests = this.metrics.compatibility.slice(-50);
    
    if (recentRequests.length > 0) {
      // 평균 응답 시간 확인
      const avgResponseTime = recentRequests.reduce((sum, req) => 
        sum + (req.responseTime || 0), 0
      ) / recentRequests.length;
      
      if (avgResponseTime > rules.maxResponseTime) {
        score -= 0.3;
        issues.push(`응답 시간 초과: ${avgResponseTime.toFixed(0)}ms > ${rules.maxResponseTime}ms`);
      }
      
      // 성공률 확인
      const successRate = recentRequests.filter(req => req.success).length / recentRequests.length;
      
      if (successRate < rules.minSuccessRate) {
        score -= 0.4;
        issues.push(`성공률 미달: ${(successRate * 100).toFixed(1)}% < ${(rules.minSuccessRate * 100).toFixed(1)}%`);
      }
    }
    
    // 메모리 사용량 확인 (모의값)
    const memoryIncrease = 0.1; // 10% 증가 (모의값)
    if (memoryIncrease > rules.maxMemoryIncrease) {
      score -= 0.3;
      issues.push(`메모리 사용량 증가: ${(memoryIncrease * 100).toFixed(1)}% > ${(rules.maxMemoryIncrease * 100).toFixed(1)}%`);
    }
    
    return {
      score: Math.max(0, score),
      passed: score >= 0.8,
      issues: issues,
      details: {
        averageResponseTime: recentRequests.length > 0 ? 
          recentRequests.reduce((sum, req) => sum + (req.responseTime || 0), 0) / recentRequests.length : 0,
        successRate: recentRequests.length > 0 ?
          recentRequests.filter(req => req.success).length / recentRequests.length : 1,
        memoryIncrease: memoryIncrease
      }
    };
  }

  /**
   * 서비스 선택 로깅
   * @param {string} service - 선택된 서비스
   * @param {string} reason - 선택 사유
   * @param {Object} context - 컨텍스트
   */
  logServiceSelection(service, reason, context) {
    if (this.config.enableDetailedLogging) {
      console.log(`🎯 서비스 선택: ${service} (사유: ${reason})`);
    }
  }

  /**
   * A/B 테스트 결과 로깅
   * @param {Object} results - 테스트 결과
   * @param {string} reason - 종료 사유
   */
  async logABTestResults(results, reason) {
    try {
      const logPath = path.join(this.config.logDirectory, `ab-test-${Date.now()}.json`);
      const logData = {
        endReason: reason,
        results: results,
        timestamp: Date.now()
      };
      
      await fs.writeFile(logPath, JSON.stringify(logData, null, 2));
      console.log(`📊 A/B 테스트 결과 저장: ${logPath}`);
      
    } catch (error) {
      console.error('❌ A/B 테스트 결과 저장 실패:', error);
    }
  }

  /**
   * 로그 디렉토리 확인/생성
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      console.error('❌ 로그 디렉토리 생성 실패:', error);
    }
  }

  /**
   * 호환성 리포트 생성
   * @returns {Object} 호환성 리포트
   */
  generateCompatibilityReport() {
    return {
      timestamp: Date.now(),
      
      // 현재 상태
      currentState: {
        compatibilityScore: this.state.compatibilityScore,
        fallbackActive: this.state.fallbackActive,
        abTestActive: this.state.abTestActive,
        currentRolloutStage: this.state.currentStage,
        rolloutRatio: this.config.rolloutStages[this.state.currentStage] || 0
      },
      
      // A/B 테스트 결과
      abTestResults: this.state.abTestActive ? {
        ...this.state.abTestResults,
        duration: Date.now() - this.state.abTestStartTime
      } : null,
      
      // 호환성 메트릭
      compatibilityMetrics: {
        totalRequests: this.metrics.compatibility.length,
        averageScore: this.metrics.compatibility.length > 0 ?
          this.metrics.compatibility.reduce((sum, m) => sum + m.compatibilityScore, 0) / this.metrics.compatibility.length : 0,
        lastCheck: this.state.lastCompatibilityCheck
      },
      
      // 폴백 통계
      fallbackStats: {
        totalFallbacks: this.state.fallbackCount,
        currentlyActive: this.state.fallbackActive,
        lastReason: this.state.fallbackReason
      },
      
      // 권장사항
      recommendations: this.generateCompatibilityRecommendations()
    };
  }

  /**
   * 호환성 권장사항 생성
   * @returns {Array} 권장사항 목록
   */
  generateCompatibilityRecommendations() {
    const recommendations = [];
    
    if (this.state.compatibilityScore < 0.8) {
      recommendations.push('호환성 점수가 낮습니다. 시스템 검토가 필요합니다.');
    }
    
    if (this.state.fallbackCount > 5) {
      recommendations.push('폴백이 자주 발생하고 있습니다. Enhanced 서비스 안정성을 점검하세요.');
    }
    
    if (this.state.abTestActive && this.state.abTestResults.enhanced.requests < 100) {
      recommendations.push('A/B 테스트 샘플 크기가 작습니다. 더 많은 데이터 수집이 필요합니다.');
    }
    
    if (this.config.enableGradualRollout && this.state.currentStage === 0) {
      recommendations.push('점진적 전환이 첫 단계에 머물러 있습니다. 성능을 확인하세요.');
    }
    
    return recommendations;
  }

  /**
   * 현재 상태 반환
   * @returns {Object} 현재 호환성 관리 상태
   */
  getStatus() {
    return {
      ...this.state,
      config: { ...this.config },
      metrics: {
        compatibility: this.metrics.compatibility.length,
        abTest: this.metrics.abTest.length,
        rollout: this.metrics.rollout.length,
        fallback: this.metrics.fallback.length
      }
    };
  }
}

export default CompatibilityManager;