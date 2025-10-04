/**
 * Performance Monitor for GPT-4o Mini Enhanced Continuous Session
 * 
 * 연속 세션 방식의 성능 모니터링 및 최적화 지표 설정
 * 실시간 성능 추적, 알림, 자동 최적화 권장사항 제공
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class PerformanceMonitor {
  constructor(options = {}) {
    // 모니터링 설정
    this.config = {
      // 메트릭 수집 설정
      enableRealTimeMonitoring: options.enableRealTimeMonitoring ?? true,
      metricsCollectionInterval: options.metricsCollectionInterval || 5000, // 5초
      performanceLogRetention: options.performanceLogRetention || 7, // 7일
      
      // 알림 임계값
      thresholds: {
        tokenEfficiency: options.tokenEfficiencyThreshold || 0.7, // 70% 이상
        responseTime: options.responseTimeThreshold || 10000, // 10초 이하
        qualityScore: options.qualityScoreThreshold || 0.85, // 85% 이상
        errorRate: options.errorRateThreshold || 0.05, // 5% 이하
        memoryUsage: options.memoryUsageThreshold || 0.8, // 80% 이하
        cacheHitRate: options.cacheHitRateThreshold || 0.6 // 60% 이상
      },
      
      // 리포팅 설정
      enableDetailedLogging: options.enableDetailedLogging ?? true,
      enablePerformanceAlerts: options.enablePerformanceAlerts ?? true,
      logDirectory: options.logDirectory || './logs/performance',
      
      // 자동 최적화
      enableAutoOptimization: options.enableAutoOptimization ?? false,
      optimizationTriggerThreshold: options.optimizationTriggerThreshold || 0.6
    };
    
    // 성능 메트릭 저장소
    this.metrics = {
      // 실시간 메트릭
      current: {
        tokenEfficiency: 0,
        averageResponseTime: 0,
        qualityScore: 0,
        errorRate: 0,
        throughput: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        cpuUsage: 0
      },
      
      // 히스토리 메트릭
      history: {
        tokenEfficiency: [],
        responseTime: [],
        qualityScore: [],
        errorRate: [],
        throughput: [],
        cacheHitRate: [],
        systemResources: []
      },
      
      // 집계 메트릭
      aggregated: {
        hourly: new Map(),
        daily: new Map(),
        weekly: new Map()
      },
      
      // 세션별 메트릭
      sessions: new Map()
    };
    
    // 성능 이벤트 추적
    this.events = {
      requests: [],
      errors: [],
      optimizations: [],
      alerts: []
    };
    
    // 모니터링 상태
    this.state = {
      isMonitoring: false,
      startTime: null,
      lastMetricsUpdate: null,
      totalRequests: 0,
      totalErrors: 0,
      monitoringInterval: null
    };
    
    // 알림 시스템
    this.alertSystem = {
      activeAlerts: new Map(),
      alertHistory: [],
      suppressedAlerts: new Set()
    };
    
    console.log('📊 Performance Monitor 초기화 완료');
  }

  /**
   * 모니터링 시작 (별칭 메서드)
   */
  async start() {
    return await this.startMonitoring();
  }

  /**
   * 모니터링 중지 (별칭 메서드)
   */
  async stop() {
    return await this.stopMonitoring();
  }

  /**
   * 모니터링 시작
   */
  async startMonitoring() {
    if (this.state.isMonitoring) {
      console.log('⚠️ 모니터링이 이미 실행 중입니다.');
      return;
    }
    
    console.log('🚀 성능 모니터링 시작...');
    
    this.state.isMonitoring = true;
    this.state.startTime = Date.now();
    this.state.lastMetricsUpdate = Date.now();
    
    // 로그 디렉토리 생성
    await this.ensureLogDirectory();
    
    // 실시간 모니터링 시작
    if (this.config.enableRealTimeMonitoring) {
      this.state.monitoringInterval = setInterval(
        () => this.collectSystemMetrics(),
        this.config.metricsCollectionInterval
      );
    }
    
    // 초기 시스템 상태 수집
    await this.collectSystemMetrics();
    
    console.log('✅ 성능 모니터링 활성화됨');
  }

  /**
   * 모니터링 중지
   */
  async stopMonitoring() {
    if (!this.state.isMonitoring) {
      console.log('⚠️ 모니터링이 실행되고 있지 않습니다.');
      return;
    }
    
    console.log('🛑 성능 모니터링 중지...');
    
    this.state.isMonitoring = false;
    
    if (this.state.monitoringInterval) {
      clearInterval(this.state.monitoringInterval);
      this.state.monitoringInterval = null;
    }
    
    // 최종 리포트 생성
    await this.generateFinalReport();
    
    console.log('✅ 성능 모니터링 중지됨');
  }

  /**
   * 요청 성능 추적
   * @param {Object} requestData - 요청 데이터
   * @returns {Function} 완료 콜백
   */
  trackRequest(requestData = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    const requestInfo = {
      id: requestId,
      startTime,
      sessionId: requestData.sessionId,
      type: requestData.type || 'medical_report',
      inputTokens: requestData.inputTokens || 0,
      metadata: requestData.metadata || {}
    };
    
    this.events.requests.push(requestInfo);
    this.state.totalRequests++;
    
    console.log(`📝 요청 추적 시작: ${requestId}`);
    
    // 완료 콜백 반환
    return (result = {}) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const completedRequest = {
        ...requestInfo,
        endTime,
        responseTime,
        outputTokens: result.outputTokens || 0,
        totalTokens: (requestInfo.inputTokens || 0) + (result.outputTokens || 0),
        qualityScore: result.qualityScore || 0,
        success: result.success !== false,
        error: result.error || null,
        optimizationMetrics: result.optimizationMetrics || {}
      };
      
      // 요청 정보 업데이트
      const requestIndex = this.events.requests.findIndex(r => r.id === requestId);
      if (requestIndex !== -1) {
        this.events.requests[requestIndex] = completedRequest;
      }
      
      // 세션별 메트릭 업데이트
      if (requestData.sessionId) {
        this.updateSessionMetrics(requestData.sessionId, completedRequest);
      }
      
      // 실시간 메트릭 업데이트
      this.updateRealTimeMetrics(completedRequest);
      
      // 성능 알림 확인
      this.checkPerformanceAlerts(completedRequest);
      
      console.log(`✅ 요청 완료: ${requestId} (${responseTime}ms)`);
      
      return completedRequest;
    };
  }

  /**
   * 에러 추적
   * @param {Error} error - 에러 객체
   * @param {Object} context - 컨텍스트 정보
   */
  trackError(error, context = {}) {
    const errorInfo = {
      id: this.generateRequestId(),
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      sessionId: context.sessionId,
      requestId: context.requestId,
      severity: this.classifyErrorSeverity(error),
      metadata: context.metadata || {}
    };
    
    this.events.errors.push(errorInfo);
    this.state.totalErrors++;
    
    // 에러율 업데이트
    this.updateErrorRate();
    
    // 심각한 에러의 경우 즉시 알림
    if (errorInfo.severity === 'critical') {
      this.triggerAlert('critical_error', {
        message: `심각한 에러 발생: ${error.message}`,
        error: errorInfo
      });
    }
    
    console.error(`❌ 에러 추적: ${errorInfo.id} - ${error.message}`);
    
    return errorInfo;
  }

  /**
   * 에러 기록 (별칭 메서드)
   * @param {Object} errorData - 에러 데이터
   */
  recordError(errorData) {
    const error = new Error(errorData.message || 'Unknown error');
    error.stack = errorData.stack;
    return this.trackError(error, errorData.context || {});
  }

  /**
   * 요청 기록 (별칭 메서드)
   * @param {Object} requestData - 요청 데이터
   */
  recordRequest(requestData) {
    return this.trackRequest(requestData);
  }

  /**
   * 최적화 기록 (별칭 메서드)
   * @param {Object} optimizationData - 최적화 데이터
   */
  recordOptimization(optimizationData) {
    return this.trackOptimization(optimizationData);
  }

  /**
   * 최적화 이벤트 추적
   * @param {Object} optimizationData - 최적화 데이터
   */
  trackOptimization(optimizationData) {
    const optimizationInfo = {
      id: this.generateRequestId(),
      timestamp: Date.now(),
      type: optimizationData.type || 'session_optimization',
      sessionId: optimizationData.sessionId,
      metrics: optimizationData.metrics || {},
      improvements: optimizationData.improvements || {},
      duration: optimizationData.duration || 0
    };
    
    this.events.optimizations.push(optimizationInfo);
    
    console.log(`🎯 최적화 추적: ${optimizationInfo.id}`);
    
    return optimizationInfo;
  }

  /**
   * 시스템 메트릭 수집
   */
  async collectSystemMetrics() {
    try {
      const systemMetrics = {
        timestamp: Date.now(),
        memory: this.getMemoryUsage(),
        cpu: await this.getCpuUsage(),
        nodeVersion: process.version,
        uptime: process.uptime()
      };
      
      this.metrics.history.systemResources.push(systemMetrics);
      this.metrics.current.memoryUsage = systemMetrics.memory.usagePercent;
      this.metrics.current.cpuUsage = systemMetrics.cpu;
      
      // 히스토리 크기 제한
      this.limitHistorySize();
      
      // 집계 메트릭 업데이트
      this.updateAggregatedMetrics();
      
    } catch (error) {
      console.error('❌ 시스템 메트릭 수집 실패:', error);
    }
  }

  /**
   * 메모리 사용량 조회
   * @returns {Object} 메모리 사용량 정보
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    const totalMemory = os.totalmem();
    
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      totalMemory,
      usagePercent: usage.rss / totalMemory
    };
  }

  /**
   * CPU 사용량 조회
   * @returns {Promise<number>} CPU 사용률
   */
  async getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const elapsedTime = Date.now() - startTime;
        
        const cpuPercent = (currentUsage.user + currentUsage.system) / (elapsedTime * 1000);
        resolve(Math.min(100, cpuPercent * 100));
      }, 100);
    });
  }

  /**
   * 실시간 메트릭 업데이트
   * @param {Object} requestData - 요청 데이터
   */
  updateRealTimeMetrics(requestData) {
    // 토큰 효율성 계산
    if (requestData.totalTokens > 0 && requestData.optimizationMetrics.tokenSavingsPercent) {
      const efficiency = 1 - (requestData.optimizationMetrics.tokenSavingsPercent / 100);
      this.metrics.current.tokenEfficiency = 
        (this.metrics.current.tokenEfficiency * 0.8) + (efficiency * 0.2);
    }
    
    // 응답 시간 업데이트
    if (requestData.responseTime) {
      this.metrics.current.averageResponseTime = 
        (this.metrics.current.averageResponseTime * 0.8) + (requestData.responseTime * 0.2);
      
      this.metrics.history.responseTime.push({
        timestamp: requestData.endTime,
        value: requestData.responseTime
      });
    }
    
    // 품질 점수 업데이트
    if (requestData.qualityScore) {
      this.metrics.current.qualityScore = 
        (this.metrics.current.qualityScore * 0.8) + (requestData.qualityScore * 0.2);
      
      this.metrics.history.qualityScore.push({
        timestamp: requestData.endTime,
        value: requestData.qualityScore
      });
    }
    
    // 처리량 계산
    this.updateThroughput();
    
    // 캐시 적중률 업데이트
    if (requestData.optimizationMetrics.cacheInfo) {
      this.updateCacheHitRate(requestData.optimizationMetrics.cacheInfo);
    }
    
    this.state.lastMetricsUpdate = Date.now();
  }

  /**
   * 세션별 메트릭 업데이트
   * @param {string} sessionId - 세션 ID
   * @param {Object} requestData - 요청 데이터
   */
  updateSessionMetrics(sessionId, requestData) {
    if (!this.metrics.sessions.has(sessionId)) {
      this.metrics.sessions.set(sessionId, {
        sessionId,
        startTime: requestData.startTime,
        requestCount: 0,
        totalTokens: 0,
        totalResponseTime: 0,
        qualityScores: [],
        errors: [],
        optimizations: []
      });
    }
    
    const sessionMetrics = this.metrics.sessions.get(sessionId);
    
    sessionMetrics.requestCount++;
    sessionMetrics.totalTokens += requestData.totalTokens || 0;
    sessionMetrics.totalResponseTime += requestData.responseTime || 0;
    sessionMetrics.lastActivity = requestData.endTime;
    
    if (requestData.qualityScore) {
      sessionMetrics.qualityScores.push(requestData.qualityScore);
    }
    
    if (requestData.error) {
      sessionMetrics.errors.push(requestData.error);
    }
    
    if (requestData.optimizationMetrics) {
      sessionMetrics.optimizations.push(requestData.optimizationMetrics);
    }
    
    // 세션 평균 계산
    sessionMetrics.averageResponseTime = sessionMetrics.totalResponseTime / sessionMetrics.requestCount;
    sessionMetrics.averageQualityScore = sessionMetrics.qualityScores.length > 0 
      ? sessionMetrics.qualityScores.reduce((sum, score) => sum + score, 0) / sessionMetrics.qualityScores.length
      : 0;
    sessionMetrics.errorRate = sessionMetrics.errors.length / sessionMetrics.requestCount;
  }

  /**
   * 에러율 업데이트
   */
  updateErrorRate() {
    if (this.state.totalRequests > 0) {
      this.metrics.current.errorRate = this.state.totalErrors / this.state.totalRequests;
      
      this.metrics.history.errorRate.push({
        timestamp: Date.now(),
        value: this.metrics.current.errorRate
      });
    }
  }

  /**
   * 처리량 업데이트
   */
  updateThroughput() {
    const now = Date.now();
    const timeWindow = 60000; // 1분
    
    const recentRequests = this.events.requests.filter(
      req => req.endTime && (now - req.endTime) <= timeWindow
    );
    
    this.metrics.current.throughput = recentRequests.length;
  }

  /**
   * 캐시 적중률 업데이트
   * @param {Object} cacheInfo - 캐시 정보
   */
  updateCacheHitRate(cacheInfo) {
    if (cacheInfo.totalRequests > 0) {
      const hitRate = cacheInfo.hits / cacheInfo.totalRequests;
      this.metrics.current.cacheHitRate = 
        (this.metrics.current.cacheHitRate * 0.8) + (hitRate * 0.2);
      
      this.metrics.history.cacheHitRate.push({
        timestamp: Date.now(),
        value: hitRate
      });
    }
  }

  /**
   * 집계 메트릭 업데이트
   */
  updateAggregatedMetrics() {
    const now = Date.now();
    const hourKey = Math.floor(now / (60 * 60 * 1000));
    const dayKey = Math.floor(now / (24 * 60 * 60 * 1000));
    const weekKey = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
    
    // 시간별 집계
    this.updateAggregatedMetric('hourly', hourKey);
    
    // 일별 집계
    this.updateAggregatedMetric('daily', dayKey);
    
    // 주별 집계
    this.updateAggregatedMetric('weekly', weekKey);
  }

  /**
   * 집계 메트릭 업데이트 (특정 기간)
   * @param {string} period - 기간 (hourly, daily, weekly)
   * @param {number} key - 시간 키
   */
  updateAggregatedMetric(period, key) {
    const aggregated = this.metrics.aggregated[period];
    
    if (!aggregated.has(key)) {
      aggregated.set(key, {
        timestamp: key,
        requestCount: 0,
        totalTokens: 0,
        totalResponseTime: 0,
        errorCount: 0,
        qualityScores: []
      });
    }
    
    const metric = aggregated.get(key);
    
    // 현재 메트릭으로 업데이트
    metric.requestCount = this.state.totalRequests;
    metric.errorCount = this.state.totalErrors;
    metric.averageResponseTime = this.metrics.current.averageResponseTime;
    metric.averageQualityScore = this.metrics.current.qualityScore;
    metric.tokenEfficiency = this.metrics.current.tokenEfficiency;
    metric.cacheHitRate = this.metrics.current.cacheHitRate;
  }

  /**
   * 성능 알림 확인
   * @param {Object} requestData - 요청 데이터
   */
  checkPerformanceAlerts(requestData) {
    const alerts = [];
    
    // 응답 시간 알림
    if (requestData.responseTime > this.config.thresholds.responseTime) {
      alerts.push({
        type: 'slow_response',
        severity: 'warning',
        message: `응답 시간이 임계값을 초과했습니다: ${requestData.responseTime}ms`,
        threshold: this.config.thresholds.responseTime,
        actual: requestData.responseTime
      });
    }
    
    // 품질 점수 알림
    if (requestData.qualityScore < this.config.thresholds.qualityScore) {
      alerts.push({
        type: 'low_quality',
        severity: 'warning',
        message: `품질 점수가 임계값 미만입니다: ${requestData.qualityScore}`,
        threshold: this.config.thresholds.qualityScore,
        actual: requestData.qualityScore
      });
    }
    
    // 토큰 효율성 알림
    if (this.metrics.current.tokenEfficiency < this.config.thresholds.tokenEfficiency) {
      alerts.push({
        type: 'low_token_efficiency',
        severity: 'info',
        message: `토큰 효율성이 낮습니다: ${(this.metrics.current.tokenEfficiency * 100).toFixed(1)}%`,
        threshold: this.config.thresholds.tokenEfficiency,
        actual: this.metrics.current.tokenEfficiency
      });
    }
    
    // 에러율 알림
    if (this.metrics.current.errorRate > this.config.thresholds.errorRate) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `에러율이 임계값을 초과했습니다: ${(this.metrics.current.errorRate * 100).toFixed(1)}%`,
        threshold: this.config.thresholds.errorRate,
        actual: this.metrics.current.errorRate
      });
    }
    
    // 메모리 사용량 알림
    if (this.metrics.current.memoryUsage > this.config.thresholds.memoryUsage) {
      alerts.push({
        type: 'high_memory_usage',
        severity: 'warning',
        message: `메모리 사용량이 높습니다: ${(this.metrics.current.memoryUsage * 100).toFixed(1)}%`,
        threshold: this.config.thresholds.memoryUsage,
        actual: this.metrics.current.memoryUsage
      });
    }
    
    // 알림 처리
    alerts.forEach(alert => this.triggerAlert(alert.type, alert));
  }

  /**
   * 알림 트리거
   * @param {string} type - 알림 타입
   * @param {Object} alertData - 알림 데이터
   */
  triggerAlert(type, alertData) {
    const alertId = `${type}_${Date.now()}`;
    
    // 중복 알림 방지
    if (this.alertSystem.suppressedAlerts.has(type)) {
      return;
    }
    
    const alert = {
      id: alertId,
      type,
      timestamp: Date.now(),
      severity: alertData.severity || 'info',
      message: alertData.message,
      data: alertData,
      acknowledged: false
    };
    
    this.alertSystem.activeAlerts.set(alertId, alert);
    this.alertSystem.alertHistory.push(alert);
    this.events.alerts.push(alert);
    
    // 알림 출력
    const severityIcon = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨'
    };
    
    console.log(`${severityIcon[alert.severity]} [${alert.type.toUpperCase()}] ${alert.message}`);
    
    // 자동 최적화 트리거 확인
    if (this.config.enableAutoOptimization && this.shouldTriggerAutoOptimization(alert)) {
      this.triggerAutoOptimization(alert);
    }
    
    // 일정 시간 후 알림 억제 (스팸 방지)
    setTimeout(() => {
      this.alertSystem.suppressedAlerts.delete(type);
    }, 300000); // 5분
    
    this.alertSystem.suppressedAlerts.add(type);
  }

  /**
   * 자동 최적화 트리거 여부 확인
   * @param {Object} alert - 알림 객체
   * @returns {boolean} 트리거 여부
   */
  shouldTriggerAutoOptimization(alert) {
    const triggerTypes = ['slow_response', 'low_token_efficiency', 'high_memory_usage'];
    return triggerTypes.includes(alert.type) && 
           this.metrics.current.tokenEfficiency < this.config.optimizationTriggerThreshold;
  }

  /**
   * 자동 최적화 트리거
   * @param {Object} alert - 알림 객체
   */
  triggerAutoOptimization(alert) {
    console.log('🤖 자동 최적화 트리거됨:', alert.type);
    
    const optimizationEvent = {
      trigger: alert,
      timestamp: Date.now(),
      type: 'auto_optimization',
      recommendations: this.generateOptimizationRecommendations(alert)
    };
    
    this.trackOptimization(optimizationEvent);
  }

  /**
   * 최적화 권장사항 생성
   * @param {Object} alert - 알림 객체
   * @returns {Array} 권장사항 목록
   */
  generateOptimizationRecommendations(alert) {
    const recommendations = [];
    
    switch (alert.type) {
      case 'slow_response':
        recommendations.push('세션 메시지 압축 비율 증가');
        recommendations.push('캐시 활용도 개선');
        recommendations.push('병렬 처리 활성화 검토');
        break;
        
      case 'low_token_efficiency':
        recommendations.push('토큰 압축 알고리즘 강화');
        recommendations.push('불필요한 컨텍스트 제거');
        recommendations.push('스마트 트렁케이션 활성화');
        break;
        
      case 'high_memory_usage':
        recommendations.push('캐시 크기 제한');
        recommendations.push('메모리 정리 주기 단축');
        recommendations.push('세션 히스토리 제한');
        break;
        
      case 'low_quality':
        recommendations.push('품질 임계값 조정');
        recommendations.push('압축 비율 완화');
        recommendations.push('중요 정보 보존 강화');
        break;
    }
    
    return recommendations;
  }

  /**
   * 에러 심각도 분류
   * @param {Error} error - 에러 객체
   * @returns {string} 심각도 (info, warning, critical)
   */
  classifyErrorSeverity(error) {
    const criticalPatterns = [
      /out of memory/i,
      /maximum call stack/i,
      /cannot read property/i,
      /network error/i,
      /timeout/i
    ];
    
    const warningPatterns = [
      /deprecated/i,
      /warning/i,
      /invalid/i
    ];
    
    const errorMessage = error.message.toLowerCase();
    
    if (criticalPatterns.some(pattern => pattern.test(errorMessage))) {
      return 'critical';
    }
    
    if (warningPatterns.some(pattern => pattern.test(errorMessage))) {
      return 'warning';
    }
    
    return 'info';
  }

  /**
   * 히스토리 크기 제한
   */
  limitHistorySize() {
    const maxHistorySize = 1000;
    
    Object.keys(this.metrics.history).forEach(key => {
      const history = this.metrics.history[key];
      if (Array.isArray(history) && history.length > maxHistorySize) {
        this.metrics.history[key] = history.slice(-maxHistorySize);
      }
    });
    
    // 이벤트 히스토리 제한
    if (this.events.requests.length > maxHistorySize) {
      this.events.requests = this.events.requests.slice(-maxHistorySize);
    }
    
    if (this.events.errors.length > maxHistorySize) {
      this.events.errors = this.events.errors.slice(-maxHistorySize);
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
   * 성능 리포트 생성
   * @param {string} type - 리포트 타입 (summary, detailed, session)
   * @param {Object} options - 옵션
   * @returns {Object} 성능 리포트
   */
  generatePerformanceReport(type = 'summary', options = {}) {
    const now = Date.now();
    const uptime = this.state.startTime ? now - this.state.startTime : 0;
    
    const baseReport = {
      reportType: type,
      timestamp: now,
      uptime: uptime,
      monitoringDuration: uptime,
      
      // 기본 통계
      summary: {
        totalRequests: this.state.totalRequests,
        totalErrors: this.state.totalErrors,
        successRate: this.state.totalRequests > 0 
          ? ((this.state.totalRequests - this.state.totalErrors) / this.state.totalRequests) * 100 
          : 100,
        averageResponseTime: this.metrics.current.averageResponseTime,
        tokenEfficiency: this.metrics.current.tokenEfficiency * 100,
        qualityScore: this.metrics.current.qualityScore * 100,
        cacheHitRate: this.metrics.current.cacheHitRate * 100,
        throughput: this.metrics.current.throughput
      },
      
      // 현재 상태
      currentMetrics: { ...this.metrics.current },
      
      // 알림 상태
      alerts: {
        active: this.alertSystem.activeAlerts.size,
        total: this.alertSystem.alertHistory.length,
        critical: this.alertSystem.alertHistory.filter(a => a.severity === 'critical').length
      }
    };
    
    switch (type) {
      case 'detailed':
        return {
          ...baseReport,
          detailedMetrics: {
            history: this.metrics.history,
            aggregated: Object.fromEntries(this.metrics.aggregated),
            events: {
              recentRequests: this.events.requests.slice(-50),
              recentErrors: this.events.errors.slice(-20),
              recentOptimizations: this.events.optimizations.slice(-10)
            }
          },
          systemInfo: {
            nodeVersion: process.version,
            platform: process.platform,
            architecture: process.arch,
            memoryUsage: this.getMemoryUsage()
          }
        };
        
      case 'session':
        const sessionId = options.sessionId;
        const sessionMetrics = sessionId ? this.metrics.sessions.get(sessionId) : null;
        
        return {
          ...baseReport,
          sessionMetrics: sessionMetrics || null,
          allSessions: sessionId ? null : Array.from(this.metrics.sessions.values())
        };
        
      default:
        return baseReport;
    }
  }

  /**
   * 성능 대시보드 데이터 생성
   * @returns {Object} 대시보드 데이터
   */
  generateDashboardData() {
    const now = Date.now();
    const timeWindow = 3600000; // 1시간
    
    // 최근 1시간 데이터 필터링
    const recentRequests = this.events.requests.filter(
      req => req.endTime && (now - req.endTime) <= timeWindow
    );
    
    const recentErrors = this.events.errors.filter(
      err => (now - err.timestamp) <= timeWindow
    );
    
    return {
      timestamp: now,
      
      // 실시간 메트릭
      realtime: {
        ...this.metrics.current,
        requestsPerMinute: Math.round(recentRequests.length / 60),
        errorsPerMinute: Math.round(recentErrors.length / 60),
        activeAlerts: this.alertSystem.activeAlerts.size
      },
      
      // 차트 데이터
      charts: {
        responseTime: this.metrics.history.responseTime.slice(-100),
        qualityScore: this.metrics.history.qualityScore.slice(-100),
        tokenEfficiency: this.metrics.history.tokenEfficiency.slice(-100),
        errorRate: this.metrics.history.errorRate.slice(-100),
        systemResources: this.metrics.history.systemResources.slice(-100)
      },
      
      // 최근 이벤트
      recentEvents: {
        requests: recentRequests.slice(-10),
        errors: recentErrors.slice(-5),
        alerts: this.events.alerts.slice(-5)
      },
      
      // 성능 지표
      kpis: {
        availability: this.calculateAvailability(),
        reliability: this.calculateReliability(),
        efficiency: this.calculateEfficiency(),
        userSatisfaction: this.calculateUserSatisfaction()
      }
    };
  }

  /**
   * 가용성 계산
   * @returns {number} 가용성 (%)
   */
  calculateAvailability() {
    const totalTime = Date.now() - (this.state.startTime || Date.now());
    const downtime = this.events.errors
      .filter(err => err.severity === 'critical')
      .reduce((sum, err) => sum + (err.duration || 0), 0);
    
    return totalTime > 0 ? ((totalTime - downtime) / totalTime) * 100 : 100;
  }

  /**
   * 신뢰성 계산
   * @returns {number} 신뢰성 (%)
   */
  calculateReliability() {
    return this.state.totalRequests > 0 
      ? ((this.state.totalRequests - this.state.totalErrors) / this.state.totalRequests) * 100
      : 100;
  }

  /**
   * 효율성 계산
   * @returns {number} 효율성 (%)
   */
  calculateEfficiency() {
    return (this.metrics.current.tokenEfficiency + 
            (this.metrics.current.cacheHitRate || 0) + 
            (1 - this.metrics.current.memoryUsage)) / 3 * 100;
  }

  /**
   * 사용자 만족도 계산
   * @returns {number} 사용자 만족도 (%)
   */
  calculateUserSatisfaction() {
    const responseTimeScore = this.metrics.current.averageResponseTime < 5000 ? 1 : 0.5;
    const qualityScore = this.metrics.current.qualityScore;
    const reliabilityScore = this.calculateReliability() / 100;
    
    return (responseTimeScore + qualityScore + reliabilityScore) / 3 * 100;
  }

  /**
   * 최종 리포트 생성
   */
  async generateFinalReport() {
    const finalReport = this.generatePerformanceReport('detailed');
    
    try {
      const reportPath = path.join(
        this.config.logDirectory, 
        `final-report-${Date.now()}.json`
      );
      
      await fs.writeFile(reportPath, JSON.stringify(finalReport, null, 2));
      console.log(`📊 최종 성능 리포트 저장: ${reportPath}`);
      
    } catch (error) {
      console.error('❌ 최종 리포트 저장 실패:', error);
    }
  }

  /**
   * 요청 ID 생성
   * @returns {string} 고유 요청 ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 알림 확인 처리
   * @param {string} alertId - 알림 ID
   */
  acknowledgeAlert(alertId) {
    const alert = this.alertSystem.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      console.log(`✅ 알림 확인됨: ${alertId}`);
    }
  }

  /**
   * 모든 알림 확인 처리
   */
  acknowledgeAllAlerts() {
    this.alertSystem.activeAlerts.forEach((alert, alertId) => {
      this.acknowledgeAlert(alertId);
    });
  }

  /**
   * 성능 메트릭 초기화
   */
  resetMetrics() {
    console.log('🔄 성능 메트릭 초기화...');
    
    // 메트릭 초기화
    Object.keys(this.metrics.current).forEach(key => {
      this.metrics.current[key] = 0;
    });
    
    Object.keys(this.metrics.history).forEach(key => {
      this.metrics.history[key] = [];
    });
    
    this.metrics.aggregated.hourly.clear();
    this.metrics.aggregated.daily.clear();
    this.metrics.aggregated.weekly.clear();
    this.metrics.sessions.clear();
    
    // 이벤트 초기화
    this.events.requests = [];
    this.events.errors = [];
    this.events.optimizations = [];
    this.events.alerts = [];
    
    // 상태 초기화
    this.state.totalRequests = 0;
    this.state.totalErrors = 0;
    this.state.startTime = Date.now();
    
    // 알림 시스템 초기화
    this.alertSystem.activeAlerts.clear();
    this.alertSystem.alertHistory = [];
    this.alertSystem.suppressedAlerts.clear();
    
    console.log('✅ 성능 메트릭 초기화 완료');
  }

  /**
   * 현재 상태 반환
   * @returns {Object} 현재 모니터링 상태
   */
  getStatus() {
    return {
      isMonitoring: this.state.isMonitoring,
      uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
      totalRequests: this.state.totalRequests,
      totalErrors: this.state.totalErrors,
      activeAlerts: this.alertSystem.activeAlerts.size,
      currentMetrics: { ...this.metrics.current },
      lastUpdate: this.state.lastMetricsUpdate
    };
  }
}

export default PerformanceMonitor;