/**
 * Integration Orchestrator for GPT-4o Mini Enhanced System
 * 
 * 모든 통합 구성 요소를 조율하는 중앙 관리자
 * GPT4oMiniEnhancedService, SessionFlowOptimizer, PerformanceMonitor, CompatibilityManager 통합
 */

import { GPT4oMiniEnhancedService } from '../services/gpt4oMiniEnhancedService.js';
import { SessionFlowOptimizer } from '../optimization/sessionFlowOptimizer.js';
import { PerformanceMonitor } from '../monitoring/performanceMonitor.js';
import { CompatibilityManager } from './compatibilityManager.js';
import fs from 'fs/promises';
import path from 'path';

export class IntegrationOrchestrator {
  constructor(options = {}) {
    // 통합 설정
    this.config = {
      // 서비스 활성화 설정
      enableEnhancedService: options.enableEnhancedService ?? true,
      enableOptimization: options.enableOptimization ?? true,
      enableMonitoring: options.enableMonitoring ?? true,
      enableCompatibility: options.enableCompatibility ?? true,
      
      // 통합 모드
      integrationMode: options.integrationMode || 'gradual', // 'immediate', 'gradual', 'ab_test'
      
      // 로깅 설정
      enableDetailedLogging: options.enableDetailedLogging ?? true,
      logDirectory: options.logDirectory || './logs/integration',
      
      // 자동 조정 설정
      enableAutoTuning: options.enableAutoTuning ?? true,
      tuningInterval: options.tuningInterval || 60 * 60 * 1000, // 1시간
      
      // 알림 설정
      enableAlerts: options.enableAlerts ?? true,
      alertThresholds: {
        errorRate: 0.05, // 5%
        responseTime: 30000, // 30초
        compatibilityScore: 0.8
      }
    };
    
    // 구성 요소 초기화
    this.components = {};
    this.isInitialized = false;
    this.isRunning = false;
    
    // 통합 상태
    this.state = {
      startTime: null,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastHealthCheck: null,
      
      // 구성 요소 상태
      componentStatus: {
        enhancedService: 'inactive',
        optimizer: 'inactive',
        monitor: 'inactive',
        compatibility: 'inactive'
      },
      
      // 성능 요약
      performanceSummary: {
        averageResponseTime: 0,
        tokenSavings: 0,
        qualityScore: 0,
        compatibilityScore: 0
      }
    };
    
    // 자동 조정 타이머
    this.autoTuningTimer = null;
    
    console.log('🎼 Integration Orchestrator 초기화 완료');
  }

  /**
   * 통합 시스템 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ 이미 초기화되었습니다.');
      return;
    }
    
    console.log('🚀 통합 시스템 초기화 중...');
    
    try {
      // 로그 디렉토리 생성
      await this.ensureLogDirectory();
      
      // 구성 요소 초기화
      await this.initializeComponents();
      
      // 구성 요소 간 연결 설정
      this.setupComponentConnections();
      
      // 자동 조정 시작
      if (this.config.enableAutoTuning) {
        this.startAutoTuning();
      }
      
      this.isInitialized = true;
      this.state.startTime = Date.now();
      
      console.log('✅ 통합 시스템 초기화 완료');
      
    } catch (error) {
      console.error('❌ 통합 시스템 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 구성 요소 초기화
   */
  async initializeComponents() {
    console.log('🔧 구성 요소 초기화 중...');
    
    // Enhanced Service 초기화
    if (this.config.enableEnhancedService) {
      this.components.enhancedService = new GPT4oMiniEnhancedService({
        logDirectory: path.join(this.config.logDirectory, 'enhanced-service')
      });
      this.state.componentStatus.enhancedService = 'active';
      console.log('✅ Enhanced Service 초기화됨');
    }
    
    // Session Flow Optimizer 초기화
    if (this.config.enableOptimization) {
      this.components.optimizer = new SessionFlowOptimizer({
        logDirectory: path.join(this.config.logDirectory, 'optimizer')
      });
      this.state.componentStatus.optimizer = 'active';
      console.log('✅ Session Flow Optimizer 초기화됨');
    }
    
    // Performance Monitor 초기화
    if (this.config.enableMonitoring) {
      this.components.monitor = new PerformanceMonitor({
        logDirectory: path.join(this.config.logDirectory, 'monitor'),
        enableRealTimeMonitoring: true,
        enableAutoOptimization: true
      });
      await this.components.monitor.start();
      this.state.componentStatus.monitor = 'active';
      console.log('✅ Performance Monitor 초기화됨');
    }
    
    // Compatibility Manager 초기화
    if (this.config.enableCompatibility) {
      this.components.compatibility = new CompatibilityManager({
        logDirectory: path.join(this.config.logDirectory, 'compatibility'),
        integrationMode: this.config.integrationMode
      });
      await this.components.compatibility.start();
      this.state.componentStatus.compatibility = 'active';
      console.log('✅ Compatibility Manager 초기화됨');
    }
  }

  /**
   * 구성 요소 간 연결 설정
   */
  setupComponentConnections() {
    console.log('🔗 구성 요소 간 연결 설정 중...');
    
    // Enhanced Service와 Optimizer 연결
    if (this.components.enhancedService && this.components.optimizer) {
      // Optimizer의 최적화 설정을 Enhanced Service에 적용
      this.components.enhancedService.setOptimizer(this.components.optimizer);
    }
    
    // Monitor와 다른 구성 요소 연결
    if (this.components.monitor) {
      // 모든 구성 요소의 메트릭을 Monitor에 전달
      this.setupMonitoringConnections();
    }
    
    // Compatibility Manager와 다른 구성 요소 연결
    if (this.components.compatibility) {
      // 호환성 결과를 다른 구성 요소에 전달
      this.setupCompatibilityConnections();
    }
    
    console.log('✅ 구성 요소 간 연결 설정 완료');
  }

  /**
   * 모니터링 연결 설정
   */
  setupMonitoringConnections() {
    const monitor = this.components.monitor;
    
    // Enhanced Service 메트릭 연결
    if (this.components.enhancedService) {
      this.components.enhancedService.onMetrics = (metrics) => {
        monitor.recordRequest({
          service: 'enhanced',
          ...metrics
        });
      };
    }
    
    // Optimizer 메트릭 연결
    if (this.components.optimizer) {
      this.components.optimizer.onOptimization = (optimization) => {
        monitor.recordOptimization(optimization);
      };
    }
  }

  /**
   * 호환성 연결 설정
   */
  setupCompatibilityConnections() {
    const compatibility = this.components.compatibility;
    
    // 다른 구성 요소의 호환성 이벤트 수신
    if (this.components.enhancedService) {
      this.components.enhancedService.onCompatibilityEvent = (event) => {
        compatibility.trackRequest(event.service, event.result, event.context);
      };
    }
  }

  /**
   * 통합 시스템 시작
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isRunning) {
      console.log('⚠️ 이미 실행 중입니다.');
      return;
    }
    
    console.log('▶️ 통합 시스템 시작...');
    
    this.isRunning = true;
    
    // 초기 상태 확인
    await this.performHealthCheck();
    
    console.log('✅ 통합 시스템 시작됨');
  }

  /**
   * 통합 시스템 중지
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ 실행되고 있지 않습니다.');
      return;
    }
    
    console.log('⏹️ 통합 시스템 중지 중...');
    
    // 자동 조정 중지
    if (this.autoTuningTimer) {
      clearInterval(this.autoTuningTimer);
      this.autoTuningTimer = null;
    }
    
    // 구성 요소 중지
    if (this.components.monitor) {
      await this.components.monitor.stop();
    }
    
    this.isRunning = false;
    
    console.log('✅ 통합 시스템 중지됨');
  }

  /**
   * 의료 보고서 생성 (통합 엔드포인트)
   * @param {string} prompt - 입력 프롬프트
   * @param {Object} options - 생성 옵션
   * @returns {Object} 생성 결과
   */
  async generateMedicalReport(prompt, options = {}) {
    if (!this.isRunning) {
      throw new Error('통합 시스템이 실행되고 있지 않습니다.');
    }
    
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    console.log(`📋 의료 보고서 생성 시작 (ID: ${requestId})`);
    
    try {
      // 요청 카운터 증가
      this.state.totalRequests++;
      
      // 서비스 선택
      const selectedService = this.selectService(options);
      
      // 최적화 적용
      const optimizedInput = await this.applyOptimization(prompt, options);
      
      // 보고서 생성
      const result = await this.executeGeneration(selectedService, optimizedInput, options);
      
      // 결과 후처리
      const finalResult = await this.postProcessResult(result, {
        requestId,
        service: selectedService,
        startTime,
        originalPrompt: prompt,
        optimizedPrompt: optimizedInput.prompt
      });
      
      // 성공 카운터 증가
      this.state.successfulRequests++;
      
      // 메트릭 기록
      await this.recordRequestMetrics(requestId, selectedService, finalResult, startTime);
      
      console.log(`✅ 의료 보고서 생성 완료 (ID: ${requestId}, 시간: ${Date.now() - startTime}ms)`);
      
      return finalResult;
      
    } catch (error) {
      // 실패 카운터 증가
      this.state.failedRequests++;
      
      console.error(`❌ 의료 보고서 생성 실패 (ID: ${requestId}):`, error);
      
      // 에러 메트릭 기록
      await this.recordErrorMetrics(requestId, error, startTime);
      
      // 폴백 시도
      return await this.handleGenerationError(error, prompt, options, requestId);
    }
  }

  /**
   * 서비스 선택
   * @param {Object} options - 옵션
   * @returns {string} 선택된 서비스
   */
  selectService(options) {
    // 호환성 관리자가 있으면 사용
    if (this.components.compatibility) {
      return this.components.compatibility.selectService(options);
    }
    
    // 기본 로직
    if (this.config.enableEnhancedService && this.components.enhancedService) {
      return 'enhanced';
    }
    
    return 'existing';
  }

  /**
   * 최적화 적용
   * @param {string} prompt - 원본 프롬프트
   * @param {Object} options - 옵션
   * @returns {Object} 최적화된 입력
   */
  async applyOptimization(prompt, options) {
    if (!this.components.optimizer) {
      return { prompt, options };
    }
    
    try {
      const optimized = await this.components.optimizer.optimizeInput({
        prompt,
        options,
        context: options.context || {}
      });
      
      return optimized;
      
    } catch (error) {
      console.warn('⚠️ 최적화 적용 실패, 원본 사용:', error);
      return { prompt, options };
    }
  }

  /**
   * 보고서 생성 실행
   * @param {string} service - 서비스 타입
   * @param {Object} input - 입력 데이터
   * @param {Object} options - 옵션
   * @returns {Object} 생성 결과
   */
  async executeGeneration(service, input, options) {
    if (service === 'enhanced' && this.components.enhancedService) {
      return await this.components.enhancedService.generateMedicalReport(
        input.prompt, 
        input.options || options
      );
    }
    
    // 기존 서비스 사용 (모의 구현)
    return await this.executeExistingService(input.prompt, input.options || options);
  }

  /**
   * 기존 서비스 실행 (모의 구현)
   * @param {string} prompt - 프롬프트
   * @param {Object} options - 옵션
   * @returns {Object} 결과
   */
  async executeExistingService(prompt, options) {
    // 실제 구현에서는 기존 AIService 호출
    const startTime = Date.now();
    
    // 모의 지연
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    const responseTime = Date.now() - startTime;
    
    return {
      success: Math.random() > 0.05, // 95% 성공률
      content: `기존 서비스로 생성된 의료 보고서\n\n입력: ${prompt.substring(0, 100)}...`,
      metadata: {
        service: 'existing',
        responseTime,
        tokenUsage: {
          promptTokens: Math.floor(prompt.length / 4),
          completionTokens: Math.floor(Math.random() * 500) + 200,
          totalTokens: 0
        }
      },
      responseTime
    };
  }

  /**
   * 결과 후처리
   * @param {Object} result - 생성 결과
   * @param {Object} context - 컨텍스트
   * @returns {Object} 후처리된 결과
   */
  async postProcessResult(result, context) {
    // 통합 메타데이터 추가
    const enhancedResult = {
      ...result,
      integration: {
        requestId: context.requestId,
        service: context.service,
        processingTime: Date.now() - context.startTime,
        orchestratorVersion: '1.0.0',
        optimizationApplied: !!this.components.optimizer,
        monitoringEnabled: !!this.components.monitor
      }
    };
    
    // 품질 검증
    if (this.components.optimizer) {
      try {
        const qualityScore = await this.components.optimizer.validateQuality(result);
        enhancedResult.integration.qualityScore = qualityScore;
      } catch (error) {
        console.warn('⚠️ 품질 검증 실패:', error);
      }
    }
    
    return enhancedResult;
  }

  /**
   * 요청 메트릭 기록
   * @param {string} requestId - 요청 ID
   * @param {string} service - 서비스 타입
   * @param {Object} result - 결과
   * @param {number} startTime - 시작 시간
   */
  async recordRequestMetrics(requestId, service, result, startTime) {
    const metrics = {
      requestId,
      service,
      success: result.success !== false,
      responseTime: Date.now() - startTime,
      tokenUsage: result.metadata?.tokenUsage || {},
      qualityScore: result.integration?.qualityScore || 0
    };
    
    // Performance Monitor에 기록
    if (this.components.monitor) {
      this.components.monitor.recordRequest(metrics);
    }
    
    // Compatibility Manager에 기록
    if (this.components.compatibility) {
      this.components.compatibility.trackRequest(service, result, { requestId });
    }
    
    // 성능 요약 업데이트
    this.updatePerformanceSummary(metrics);
  }

  /**
   * 에러 메트릭 기록
   * @param {string} requestId - 요청 ID
   * @param {Error} error - 에러
   * @param {number} startTime - 시작 시간
   */
  async recordErrorMetrics(requestId, error, startTime) {
    const errorMetrics = {
      requestId,
      error: error.message,
      responseTime: Date.now() - startTime,
      timestamp: Date.now()
    };
    
    if (this.components.monitor) {
      this.components.monitor.recordError(errorMetrics);
    }
  }

  /**
   * 생성 에러 처리
   * @param {Error} error - 에러
   * @param {string} prompt - 원본 프롬프트
   * @param {Object} options - 옵션
   * @param {string} requestId - 요청 ID
   * @returns {Object} 폴백 결과
   */
  async handleGenerationError(error, prompt, options, requestId) {
    console.log(`🔄 폴백 시도 (ID: ${requestId})`);
    
    try {
      // 기존 서비스로 폴백
      const fallbackResult = await this.executeExistingService(prompt, options);
      
      return {
        ...fallbackResult,
        integration: {
          requestId,
          service: 'fallback',
          originalError: error.message,
          fallbackUsed: true
        }
      };
      
    } catch (fallbackError) {
      console.error(`❌ 폴백도 실패 (ID: ${requestId}):`, fallbackError);
      
      return {
        success: false,
        error: `원본 에러: ${error.message}, 폴백 에러: ${fallbackError.message}`,
        integration: {
          requestId,
          service: 'failed',
          originalError: error.message,
          fallbackError: fallbackError.message
        }
      };
    }
  }

  /**
   * 성능 요약 업데이트
   * @param {Object} metrics - 메트릭
   */
  updatePerformanceSummary(metrics) {
    const summary = this.state.performanceSummary;
    
    // 평균 응답 시간 업데이트 (지수 이동 평균)
    if (summary.averageResponseTime === 0) {
      summary.averageResponseTime = metrics.responseTime;
    } else {
      summary.averageResponseTime = 
        (summary.averageResponseTime * 0.9) + (metrics.responseTime * 0.1);
    }
    
    // 품질 점수 업데이트
    if (metrics.qualityScore > 0) {
      if (summary.qualityScore === 0) {
        summary.qualityScore = metrics.qualityScore;
      } else {
        summary.qualityScore = 
          (summary.qualityScore * 0.9) + (metrics.qualityScore * 0.1);
      }
    }
    
    // 호환성 점수 업데이트
    if (this.components.compatibility) {
      summary.compatibilityScore = this.components.compatibility.state.compatibilityScore;
    }
  }

  /**
   * 자동 조정 시작
   */
  startAutoTuning() {
    console.log('🔧 자동 조정 시작...');
    
    this.autoTuningTimer = setInterval(async () => {
      try {
        await this.performAutoTuning();
      } catch (error) {
        console.error('❌ 자동 조정 실패:', error);
      }
    }, this.config.tuningInterval);
  }

  /**
   * 자동 조정 수행
   */
  async performAutoTuning() {
    console.log('🔧 자동 조정 수행 중...');
    
    // 성능 분석
    const performanceAnalysis = await this.analyzePerformance();
    
    // 최적화 권장사항 적용
    if (this.components.optimizer && performanceAnalysis.optimizationRecommendations) {
      await this.applyOptimizationRecommendations(performanceAnalysis.optimizationRecommendations);
    }
    
    // 호환성 조정
    if (this.components.compatibility && performanceAnalysis.compatibilityIssues) {
      await this.adjustCompatibilitySettings(performanceAnalysis.compatibilityIssues);
    }
    
    // 알림 확인
    if (this.config.enableAlerts) {
      await this.checkAndSendAlerts(performanceAnalysis);
    }
    
    console.log('✅ 자동 조정 완료');
  }

  /**
   * 성능 분석
   * @returns {Object} 성능 분석 결과
   */
  async analyzePerformance() {
    const analysis = {
      timestamp: Date.now(),
      totalRequests: this.state.totalRequests,
      successRate: this.state.totalRequests > 0 ? 
        this.state.successfulRequests / this.state.totalRequests : 0,
      averageResponseTime: this.state.performanceSummary.averageResponseTime,
      qualityScore: this.state.performanceSummary.qualityScore,
      compatibilityScore: this.state.performanceSummary.compatibilityScore
    };
    
    // 성능 이슈 식별
    analysis.issues = [];
    analysis.optimizationRecommendations = [];
    analysis.compatibilityIssues = [];
    
    if (analysis.successRate < 0.95) {
      analysis.issues.push('낮은 성공률');
      analysis.optimizationRecommendations.push('에러 처리 개선');
    }
    
    if (analysis.averageResponseTime > 15000) {
      analysis.issues.push('높은 응답 시간');
      analysis.optimizationRecommendations.push('응답 시간 최적화');
    }
    
    if (analysis.compatibilityScore < 0.8) {
      analysis.issues.push('낮은 호환성 점수');
      analysis.compatibilityIssues.push('호환성 개선 필요');
    }
    
    return analysis;
  }

  /**
   * 최적화 권장사항 적용
   * @param {Array} recommendations - 권장사항 목록
   */
  async applyOptimizationRecommendations(recommendations) {
    for (const recommendation of recommendations) {
      try {
        await this.components.optimizer.applyRecommendation(recommendation);
        console.log(`✅ 최적화 권장사항 적용: ${recommendation}`);
      } catch (error) {
        console.warn(`⚠️ 최적화 권장사항 적용 실패: ${recommendation}`, error);
      }
    }
  }

  /**
   * 호환성 설정 조정
   * @param {Array} issues - 호환성 이슈 목록
   */
  async adjustCompatibilitySettings(issues) {
    for (const issue of issues) {
      try {
        // 호환성 이슈에 따른 설정 조정
        if (issue.includes('호환성 개선')) {
          // 폴백 임계값 조정
          this.components.compatibility.config.fallbackThreshold += 0.05;
        }
        console.log(`✅ 호환성 설정 조정: ${issue}`);
      } catch (error) {
        console.warn(`⚠️ 호환성 설정 조정 실패: ${issue}`, error);
      }
    }
  }

  /**
   * 알림 확인 및 전송
   * @param {Object} analysis - 성능 분석 결과
   */
  async checkAndSendAlerts(analysis) {
    const alerts = [];
    
    if (analysis.successRate < (1 - this.config.alertThresholds.errorRate)) {
      alerts.push(`높은 에러율: ${((1 - analysis.successRate) * 100).toFixed(1)}%`);
    }
    
    if (analysis.averageResponseTime > this.config.alertThresholds.responseTime) {
      alerts.push(`높은 응답 시간: ${analysis.averageResponseTime.toFixed(0)}ms`);
    }
    
    if (analysis.compatibilityScore < this.config.alertThresholds.compatibilityScore) {
      alerts.push(`낮은 호환성 점수: ${(analysis.compatibilityScore * 100).toFixed(1)}%`);
    }
    
    if (alerts.length > 0) {
      console.warn('🚨 성능 알림:', alerts.join(', '));
      // 실제 구현에서는 이메일, 슬랙 등으로 알림 전송
    }
  }

  /**
   * 상태 확인
   */
  async performHealthCheck() {
    console.log('🏥 상태 확인 수행 중...');
    
    const healthStatus = {
      timestamp: Date.now(),
      overall: 'healthy',
      components: {}
    };
    
    // 각 구성 요소 상태 확인
    for (const [name, component] of Object.entries(this.components)) {
      try {
        if (component && typeof component.getStatus === 'function') {
          const status = component.getStatus();
          healthStatus.components[name] = {
            status: 'healthy',
            details: status
          };
        } else {
          healthStatus.components[name] = {
            status: 'unknown',
            details: 'Status method not available'
          };
        }
      } catch (error) {
        healthStatus.components[name] = {
          status: 'unhealthy',
          error: error.message
        };
        healthStatus.overall = 'degraded';
      }
    }
    
    this.state.lastHealthCheck = Date.now();
    
    console.log(`✅ 상태 확인 완료: ${healthStatus.overall}`);
    
    return healthStatus;
  }

  /**
   * 통합 리포트 생성
   * @returns {Object} 통합 리포트
   */
  async generateIntegrationReport() {
    const report = {
      timestamp: Date.now(),
      
      // 시스템 상태
      systemStatus: {
        isRunning: this.isRunning,
        uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
        totalRequests: this.state.totalRequests,
        successRate: this.state.totalRequests > 0 ? 
          this.state.successfulRequests / this.state.totalRequests : 0
      },
      
      // 구성 요소 상태
      componentStatus: { ...this.state.componentStatus },
      
      // 성능 요약
      performanceSummary: { ...this.state.performanceSummary },
      
      // 구성 요소별 상세 정보
      componentDetails: {}
    };
    
    // 각 구성 요소의 상세 리포트 수집
    for (const [name, component] of Object.entries(this.components)) {
      try {
        if (component && typeof component.generateReport === 'function') {
          report.componentDetails[name] = await component.generateReport();
        } else if (component && typeof component.getStatus === 'function') {
          report.componentDetails[name] = component.getStatus();
        }
      } catch (error) {
        report.componentDetails[name] = {
          error: error.message
        };
      }
    }
    
    return report;
  }

  /**
   * 요청 ID 생성
   * @returns {string} 고유 요청 ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * 현재 상태 반환
   * @returns {Object} 현재 상태
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      config: { ...this.config },
      state: { ...this.state },
      components: Object.keys(this.components)
    };
  }
}

export default IntegrationOrchestrator;