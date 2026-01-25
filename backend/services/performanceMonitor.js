/**
 * Performance Monitor Service
 * 
 * Phase 2: 실시간 성능 모니터링 시스템
 * 
 * 하이브리드 시스템의 성능 메트릭을 실시간으로 수집, 분석, 모니터링하는 서비스
 * 
 * 핵심 기능:
 * 1. 실시간 성능 메트릭 수집
 * 2. 처리 모드별 성능 비교 분석
 * 3. A/B 테스트 데이터 관리
 * 4. 성능 알림 및 경고 시스템
 * 5. 히스토리컬 데이터 분석
 */

export class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      // 실시간 메트릭 활성화
      enableRealTimeMetrics: options.enableRealTimeMetrics !== false,
      
      // 메트릭 보존 기간 (일)
      metricsRetentionDays: options.metricsRetentionDays || 7,
      
      // 샘플링 간격 (밀리초)
      samplingInterval: options.samplingInterval || 1000,
      
      // 성능 임계값
      performanceThresholds: {
        processingTime: options.processingTimeThreshold || 5000, // 5초
        memoryUsage: options.memoryThreshold || 512 * 1024 * 1024, // 512MB
        errorRate: options.errorRateThreshold || 0.05, // 5%
        ...options.performanceThresholds
      },
      
      // 알림 설정
      enableAlerts: options.enableAlerts !== false,
      alertChannels: options.alertChannels || ['console']
    };
    
    // 메트릭 저장소
    this.metrics = {
      realTime: {
        processingTime: [],
        memoryUsage: [],
        cpuUsage: [],
        requestCount: 0,
        errorCount: 0,
        lastUpdated: null
      },
      historical: new Map(), // 날짜별 히스토리컬 데이터
      processingModes: new Map(), // 처리 모드별 성능 데이터
      abTests: new Map() // A/B 테스트 데이터
    };
    
    // 성능 알림 시스템
    this.alertSystem = new PerformanceAlertSystem(this.options);
    
    // 메트릭 수집 인터벌
    this.metricsInterval = null;
    
    // 시작 시간
    this.startTime = Date.now();
    
    this.initializeMonitoring();
    
    console.log('📊 PerformanceMonitor 초기화 완료');
    console.log(`⏱️ 샘플링 간격: ${this.options.samplingInterval}ms`);
    console.log(`📅 데이터 보존 기간: ${this.options.metricsRetentionDays}일`);
  }

  /**
   * 모니터링 시스템 초기화
   */
  initializeMonitoring() {
    if (this.options.enableRealTimeMetrics) {
      this.startRealTimeMonitoring();
    }
    
    // 정리 작업 스케줄링 (매일 자정)
    this.scheduleCleanup();
  }

  /**
   * 실시간 모니터링 시작
   */
  startRealTimeMonitoring() {
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.options.samplingInterval);
    
    console.log('🔄 실시간 성능 모니터링 시작');
  }

  /**
   * 실시간 모니터링 중지
   */
  stopRealTimeMonitoring() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      console.log('⏹️ 실시간 성능 모니터링 중지');
    }
  }

  /**
   * 시스템 메트릭 수집
   */
  collectSystemMetrics() {
    const now = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // 실시간 메트릭 업데이트
    this.metrics.realTime.memoryUsage.push({
      timestamp: now,
      rss: memoryUsage.rss,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external
    });
    
    this.metrics.realTime.cpuUsage.push({
      timestamp: now,
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    // 배열 크기 제한 (최근 1000개 항목만 유지)
    if (this.metrics.realTime.memoryUsage.length > 1000) {
      this.metrics.realTime.memoryUsage = this.metrics.realTime.memoryUsage.slice(-1000);
    }
    
    if (this.metrics.realTime.cpuUsage.length > 1000) {
      this.metrics.realTime.cpuUsage = this.metrics.realTime.cpuUsage.slice(-1000);
    }
    
    this.metrics.realTime.lastUpdated = now;
    
    // 성능 임계값 확인
    this.checkPerformanceThresholds(memoryUsage, cpuUsage);
  }

  /**
   * 처리 메트릭 기록 (별칭 메서드)
   */
  async recordProcessing(data) {
    return await this.collectMetrics(data);
  }

  /**
   * 처리 메트릭 수집
   */
  async collectMetrics(data) {
    const {
      requestId,
      processingTime,
      dateProcessingTime,
      normalizationTime,
      processingMode,
      success,
      errorMessage
    } = data;
    
    const now = Date.now();
    
    // 실시간 메트릭 업데이트
    this.metrics.realTime.processingTime.push({
      timestamp: now,
      requestId,
      total: processingTime,
      dateProcessing: dateProcessingTime,
      normalization: normalizationTime,
      processingMode,
      success
    });
    
    this.metrics.realTime.requestCount++;
    
    if (!success) {
      this.metrics.realTime.errorCount++;
    }
    
    // 처리 모드별 메트릭 업데이트
    if (!this.metrics.processingModes.has(processingMode)) {
      this.metrics.processingModes.set(processingMode, {
        requestCount: 0,
        totalProcessingTime: 0,
        successCount: 0,
        errorCount: 0,
        averageProcessingTime: 0,
        minProcessingTime: Infinity,
        maxProcessingTime: 0
      });
    }
    
    const modeMetrics = this.metrics.processingModes.get(processingMode);
    modeMetrics.requestCount++;
    modeMetrics.totalProcessingTime += processingTime;
    
    if (success) {
      modeMetrics.successCount++;
    } else {
      modeMetrics.errorCount++;
    }
    
    modeMetrics.averageProcessingTime = modeMetrics.totalProcessingTime / modeMetrics.requestCount;
    modeMetrics.minProcessingTime = Math.min(modeMetrics.minProcessingTime, processingTime);
    modeMetrics.maxProcessingTime = Math.max(modeMetrics.maxProcessingTime, processingTime);
    
    // 히스토리컬 데이터 저장
    await this.saveHistoricalData(data);
    
    // 성능 메트릭 반환
    return {
      requestId,
      processingTime,
      processingMode,
      systemMetrics: this.getCurrentSystemMetrics(),
      modeComparison: this.getProcessingModeComparison()
    };
  }

  /**
   * 에러 메트릭 수집
   */
  async collectErrorMetrics(data) {
    const { requestId, error, processingTime, stack } = data;
    
    const errorMetric = {
      timestamp: Date.now(),
      requestId,
      error,
      processingTime,
      stack: stack ? stack.substring(0, 500) : null // 스택 트레이스 제한
    };
    
    // 에러 로그 저장
    if (!this.metrics.errors) {
      this.metrics.errors = [];
    }
    
    this.metrics.errors.push(errorMetric);
    
    // 에러 배열 크기 제한
    if (this.metrics.errors.length > 100) {
      this.metrics.errors = this.metrics.errors.slice(-100);
    }
    
    // 에러 알림 발송
    if (this.options.enableAlerts) {
      await this.alertSystem.sendErrorAlert(errorMetric);
    }
  }

  /**
   * A/B 테스트 데이터 수집
   */
  async collectABTestData(data) {
    const { testId, variant, metrics, feedback, timestamp } = data;
    
    if (!this.metrics.abTests.has(testId)) {
      this.metrics.abTests.set(testId, {
        variants: new Map(),
        startTime: timestamp,
        totalSamples: 0
      });
    }
    
    const testData = this.metrics.abTests.get(testId);
    
    if (!testData.variants.has(variant)) {
      testData.variants.set(variant, {
        samples: [],
        totalSamples: 0,
        averageMetrics: {},
        feedback: []
      });
    }
    
    const variantData = testData.variants.get(variant);
    variantData.samples.push({
      timestamp,
      metrics,
      feedback
    });
    
    variantData.totalSamples++;
    testData.totalSamples++;
    
    // 평균 메트릭 계산
    this.updateAverageMetrics(variantData, metrics);
    
    console.log(`📊 A/B 테스트 데이터 수집: ${testId}/${variant}`);
    
    return {
      testId,
      variant,
      totalSamples: variantData.totalSamples,
      averageMetrics: variantData.averageMetrics
    };
  }

  /**
   * 처리 모드별 성능 비교
   */
  async compareProcessingModes(options = {}) {
    const { timeRange = '24h', includeDetails = false } = options;
    
    const comparison = {
      timeRange,
      modes: {},
      summary: {
        totalRequests: 0,
        totalProcessingTime: 0,
        overallSuccessRate: 0
      },
      recommendations: []
    };
    
    // 각 처리 모드별 성능 데이터 수집
    for (const [mode, metrics] of this.metrics.processingModes) {
      const successRate = metrics.requestCount > 0 
        ? (metrics.successCount / metrics.requestCount * 100).toFixed(2)
        : '0';
      
      comparison.modes[mode] = {
        requestCount: metrics.requestCount,
        averageProcessingTime: Math.round(metrics.averageProcessingTime),
        minProcessingTime: metrics.minProcessingTime === Infinity ? 0 : metrics.minProcessingTime,
        maxProcessingTime: metrics.maxProcessingTime,
        successRate: `${successRate}%`,
        errorCount: metrics.errorCount
      };
      
      comparison.summary.totalRequests += metrics.requestCount;
      comparison.summary.totalProcessingTime += metrics.totalProcessingTime;
    }
    
    // 전체 성공률 계산
    const totalSuccessCount = Array.from(this.metrics.processingModes.values())
      .reduce((sum, metrics) => sum + metrics.successCount, 0);
    
    comparison.summary.overallSuccessRate = comparison.summary.totalRequests > 0
      ? `${(totalSuccessCount / comparison.summary.totalRequests * 100).toFixed(2)}%`
      : '0%';
    
    // 성능 권장사항 생성
    comparison.recommendations = this.generatePerformanceRecommendations(comparison.modes);
    
    return comparison;
  }

  /**
   * 현재 시스템 메트릭 반환
   */
  getCurrentSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    
    return {
      uptime,
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) // MB
      },
      requests: {
        total: this.metrics.realTime.requestCount,
        errors: this.metrics.realTime.errorCount,
        errorRate: this.metrics.realTime.requestCount > 0
          ? `${(this.metrics.realTime.errorCount / this.metrics.realTime.requestCount * 100).toFixed(2)}%`
          : '0%'
      }
    };
  }

  /**
   * 처리 모드 비교 데이터 반환
   */
  getProcessingModeComparison() {
    const comparison = {};
    
    for (const [mode, metrics] of this.metrics.processingModes) {
      comparison[mode] = {
        averageTime: Math.round(metrics.averageProcessingTime),
        requestCount: metrics.requestCount,
        successRate: metrics.requestCount > 0
          ? `${(metrics.successCount / metrics.requestCount * 100).toFixed(1)}%`
          : '0%'
      };
    }
    
    return comparison;
  }

  /**
   * 현재 메트릭 반환 (모니터링 API용)
   */
  getCurrentMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    
    return {
      system: {
        uptime,
        memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        errorRate: this.metrics.realTime.requestCount > 0
          ? this.metrics.realTime.errorCount / this.metrics.realTime.requestCount
          : 0,
        responseTime: this.calculateAverageResponseTime()
      },
      realtime: {
        activeConnections: this.metrics.realTime.requestCount,
        requestCount: this.metrics.realTime.requestCount,
        errorCount: this.metrics.realTime.errorCount
      },
      accuracy: {
        overallAccuracy: this.calculateOverallAccuracy(),
        dynamicWeightingAccuracy: 0.95, // 기본값
        hybridStrategyAccuracy: 0.93 // 기본값
      },
      uptime
    };
  }

  /**
   * 평균 응답 시간 계산
   */
  calculateAverageResponseTime() {
    if (this.metrics.realTime.processingTime.length === 0) {
      return 0;
    }
    
    const recentTimes = this.metrics.realTime.processingTime.slice(-100); // 최근 100개
    const totalTime = recentTimes.reduce((sum, item) => sum + item.total, 0);
    return totalTime / recentTimes.length;
  }

  /**
   * 전체 정확도 계산
   */
  calculateOverallAccuracy() {
    if (this.metrics.realTime.requestCount === 0) {
      return 1.0;
    }
    
    const successRate = (this.metrics.realTime.requestCount - this.metrics.realTime.errorCount) / this.metrics.realTime.requestCount;
    return Math.max(0, Math.min(1, successRate));
  }

  /**
   * 업타임 포맷팅
   */
  formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}일 ${hours % 24}시간 ${minutes % 60}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`;
    } else {
      return `${seconds}초`;
    }
  }
  /**
   * 성능 임계값 확인 (개선된 버전)
   */
  checkPerformanceThresholds(memoryUsage, cpuUsage) {
    const now = Date.now();
    const alerts = [];
    
    // 적응형 메모리 임계값 계산
    const adaptiveMemoryThreshold = this.calculateAdaptiveMemoryThreshold(memoryUsage);
    
    // 메모리 사용량 확인
    if (memoryUsage.heapUsed > adaptiveMemoryThreshold) {
      alerts.push({
        type: 'memory_high',
        severity: memoryUsage.heapUsed > adaptiveMemoryThreshold * 1.2 ? 'critical' : 'warning',
        message: `메모리 사용량이 적응형 임계값을 초과했습니다: ${this.formatBytes(memoryUsage.heapUsed)}`,
        threshold: this.formatBytes(adaptiveMemoryThreshold),
        actual: this.formatBytes(memoryUsage.heapUsed),
        timestamp: now,
        recommendations: this.generateMemoryOptimizationRecommendations(memoryUsage)
      });
    }
    
    // CPU 사용량 트렌드 분석
    const cpuTrend = this.analyzeCpuTrend();
    if (cpuTrend.isHighUsage) {
      alerts.push({
        type: 'cpu_high',
        severity: cpuTrend.severity,
        message: `CPU 사용량이 지속적으로 높습니다: ${cpuTrend.averageUsage.toFixed(2)}%`,
        trend: cpuTrend.trend,
        timestamp: now,
        recommendations: this.generateCpuOptimizationRecommendations(cpuTrend)
      });
    }
    
    // 응답 시간 분석
    const responseTimeAnalysis = this.analyzeResponseTime();
    if (responseTimeAnalysis.isSlowResponse) {
      alerts.push({
        type: 'response_time_slow',
        severity: responseTimeAnalysis.severity,
        message: `평균 응답 시간이 임계값을 초과했습니다: ${responseTimeAnalysis.averageTime}ms`,
        threshold: this.options.performanceThresholds.processingTime,
        actual: responseTimeAnalysis.averageTime,
        timestamp: now,
        recommendations: this.generateResponseTimeOptimizationRecommendations(responseTimeAnalysis)
      });
    }
    
    // 에러율 확인
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.options.performanceThresholds.errorRate) {
      alerts.push({
        type: 'error_rate_high',
        severity: errorRate > this.options.performanceThresholds.errorRate * 2 ? 'critical' : 'warning',
        message: `에러율이 임계값을 초과했습니다: ${(errorRate * 100).toFixed(2)}%`,
        threshold: (this.options.performanceThresholds.errorRate * 100).toFixed(2) + '%',
        actual: (errorRate * 100).toFixed(2) + '%',
        timestamp: now,
        recommendations: this.generateErrorReductionRecommendations(errorRate)
      });
    }
    
    // 알림 발송
    if (alerts.length > 0) {
      this.alertSystem.sendAlerts(alerts);
    }
    
    return alerts;
  }
  
  /**
   * 적응형 메모리 임계값 계산
   */
  calculateAdaptiveMemoryThreshold(memoryUsage) {
    const baseThreshold = this.options.performanceThresholds.memoryUsage;
    const totalMemory = memoryUsage.heapTotal;
    const availableMemory = totalMemory - memoryUsage.heapUsed;
    
    // 시스템 부하에 따른 적응형 조정
    const systemLoad = this.calculateSystemLoad();
    let adaptiveFactor = 1.0;
    
    if (systemLoad > 0.8) {
      adaptiveFactor = 0.7; // 높은 부하시 더 보수적으로
    } else if (availableMemory > baseThreshold * 2) {
      adaptiveFactor = 1.3; // 여유 메모리가 많으면 더 관대하게
    }
    
    return Math.min(baseThreshold * adaptiveFactor, totalMemory * 0.9);
  }
  
  /**
   * 시스템 부하 계산
   */
  calculateSystemLoad() {
    const recentMetrics = this.metrics.realTime.memoryUsage.slice(-10);
    if (recentMetrics.length < 3) return 0.5;
    
    const avgUsage = recentMetrics.reduce((sum, metric) => 
      sum + (metric.heapUsed / metric.heapTotal), 0) / recentMetrics.length;
    
    return Math.min(avgUsage, 1.0);
  }
  
  /**
   * CPU 사용량 트렌드 분석
   */
  analyzeCpuTrend() {
    const recentCpuMetrics = this.metrics.realTime.cpuUsage.slice(-20);
    if (recentCpuMetrics.length < 5) {
      return { isHighUsage: false, trend: 'stable', averageUsage: 0, severity: 'info' };
    }
    
    const cpuUsages = recentCpuMetrics.map(metric => 
      (metric.user + metric.system) / 1000000); // 마이크로초를 초로 변환
    
    const averageUsage = cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length;
    const trend = this.calculateTrend(cpuUsages);
    
    const isHighUsage = averageUsage > 80; // 80% 이상
    const severity = averageUsage > 95 ? 'critical' : averageUsage > 85 ? 'warning' : 'info';
    
    return {
      isHighUsage,
      trend,
      averageUsage,
      severity,
      recentUsages: cpuUsages.slice(-5)
    };
  }
  
  /**
   * 응답 시간 분석
   */
  analyzeResponseTime() {
    const recentTimes = this.metrics.realTime.processingTime.slice(-50);
    if (recentTimes.length < 10) {
      return { isSlowResponse: false, averageTime: 0, severity: 'info' };
    }
    
    const times = recentTimes.map(entry => entry.duration);
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const p95Time = this.calculatePercentile(times, 95);
    
    const threshold = this.options.performanceThresholds.processingTime;
    const isSlowResponse = averageTime > threshold || p95Time > threshold * 1.5;
    const severity = p95Time > threshold * 2 ? 'critical' : averageTime > threshold ? 'warning' : 'info';
    
    return {
      isSlowResponse,
      averageTime: Math.round(averageTime),
      p95Time: Math.round(p95Time),
      severity,
      trend: this.calculateTrend(times.slice(-10))
    };
  }
  
  /**
   * 에러율 계산
   */
  calculateErrorRate() {
    const totalRequests = this.metrics.realTime.requestCount;
    const totalErrors = this.metrics.realTime.errorCount;
    
    if (totalRequests === 0) return 0;
    return totalErrors / totalRequests;
  }
  
  /**
   * 트렌드 계산 유틸리티
   */
  calculateTrend(values) {
    if (values.length < 3) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }
  
  /**
   * 백분위수 계산
   */
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * 메모리 최적화 권장사항 생성
   */
  generateMemoryOptimizationRecommendations(memoryUsage) {
    const recommendations = [];
    
    const heapUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    if (heapUsageRatio > 0.9) {
      recommendations.push('즉시 가비지 컬렉션 실행');
      recommendations.push('활성 스트림 및 캐시 정리');
    } else if (heapUsageRatio > 0.8) {
      recommendations.push('메모리 집약적 작업 일시 중단');
      recommendations.push('불필요한 객체 참조 해제');
    }
    
    if (memoryUsage.external > 100 * 1024 * 1024) { // 100MB
      recommendations.push('외부 메모리 사용량 최적화');
    }
    
    return recommendations;
  }
  
  /**
   * CPU 최적화 권장사항 생성
   */
  generateCpuOptimizationRecommendations(cpuTrend) {
    const recommendations = [];
    
    if (cpuTrend.averageUsage > 95) {
      recommendations.push('긴급: CPU 집약적 작업 중단');
      recommendations.push('워커 프로세스 수 조정');
    } else if (cpuTrend.averageUsage > 85) {
      recommendations.push('병렬 처리 작업 수 제한');
      recommendations.push('비동기 작업 큐 최적화');
    }
    
    if (cpuTrend.trend === 'increasing') {
      recommendations.push('CPU 사용량 증가 추세 모니터링 강화');
    }
    
    return recommendations;
  }
  
  /**
   * 응답 시간 최적화 권장사항 생성
   */
  generateResponseTimeOptimizationRecommendations(responseTimeAnalysis) {
    const recommendations = [];
    
    if (responseTimeAnalysis.p95Time > responseTimeAnalysis.averageTime * 2) {
      recommendations.push('응답 시간 편차가 큽니다. 병목 지점 분석 필요');
    }
    
    if (responseTimeAnalysis.averageTime > 10000) { // 10초
      recommendations.push('타임아웃 설정 검토');
      recommendations.push('캐싱 전략 강화');
    }
    
    if (responseTimeAnalysis.trend === 'increasing') {
      recommendations.push('응답 시간 증가 추세 - 시스템 리소스 확인');
    }
    
    return recommendations;
  }
  
  /**
   * 에러 감소 권장사항 생성
   */
  generateErrorReductionRecommendations(errorRate) {
    const recommendations = [];
    
    if (errorRate > 0.1) { // 10%
      recommendations.push('긴급: 높은 에러율 - 시스템 점검 필요');
      recommendations.push('최근 배포 롤백 검토');
    } else if (errorRate > 0.05) { // 5%
      recommendations.push('에러 로그 분석 및 패턴 파악');
      recommendations.push('입력 검증 로직 강화');
    }
    
    return recommendations;
  }
  
  /**
   * 바이트를 읽기 쉬운 형태로 포맷
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 히스토리컬 데이터 저장
   */
  async saveHistoricalData(data) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!this.metrics.historical.has(date)) {
      this.metrics.historical.set(date, {
        requests: [],
        summary: {
          totalRequests: 0,
          totalProcessingTime: 0,
          successCount: 0,
          errorCount: 0
        }
      });
    }
    
    const dayData = this.metrics.historical.get(date);
    dayData.requests.push({
      timestamp: Date.now(),
      processingTime: data.processingTime,
      processingMode: data.processingMode,
      success: data.success
    });
    
    // 일일 요약 업데이트
    dayData.summary.totalRequests++;
    dayData.summary.totalProcessingTime += data.processingTime;
    
    if (data.success) {
      dayData.summary.successCount++;
    } else {
      dayData.summary.errorCount++;
    }
  }

  /**
   * 성능 권장사항 생성
   */
  generatePerformanceRecommendations(modes) {
    const recommendations = [];
    
    // 가장 빠른 모드 찾기
    let fastestMode = null;
    let fastestTime = Infinity;
    
    for (const [mode, metrics] of Object.entries(modes)) {
      if (metrics.averageProcessingTime < fastestTime) {
        fastestTime = metrics.averageProcessingTime;
        fastestMode = mode;
      }
    }
    
    if (fastestMode) {
      recommendations.push({
        type: 'performance',
        message: `가장 빠른 처리 모드: ${fastestMode} (평균 ${fastestTime}ms)`
      });
    }
    
    // 높은 에러율 모드 경고
    for (const [mode, metrics] of Object.entries(modes)) {
      const errorRate = parseFloat(metrics.successRate.replace('%', ''));
      if (errorRate < 95) {
        recommendations.push({
          type: 'reliability',
          level: 'warning',
          message: `${mode} 모드의 성공률이 낮습니다: ${metrics.successRate}`
        });
      }
    }
    
    return recommendations;
  }

  /**
   * 정리 작업 스케줄링
   */
  scheduleCleanup() {
    // 매일 자정에 오래된 데이터 정리
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.cleanupOldData();
      // 24시간마다 반복
      setInterval(() => {
        this.cleanupOldData();
      }, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
  }

  /**
   * 오래된 데이터 정리
   */
  cleanupOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.metricsRetentionDays);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];
    
    let removedCount = 0;
    for (const [date] of this.metrics.historical) {
      if (date < cutoffDateString) {
        this.metrics.historical.delete(date);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`🧹 오래된 성능 데이터 정리: ${removedCount}일치 데이터 삭제`);
    }
  }

  /**
   * 평균 메트릭 업데이트
   */
  updateAverageMetrics(variantData, newMetrics) {
    if (!variantData.averageMetrics) {
      variantData.averageMetrics = { ...newMetrics };
      return;
    }
    
    const sampleCount = variantData.totalSamples;
    for (const [key, value] of Object.entries(newMetrics)) {
      if (typeof value === 'number') {
        const currentAvg = variantData.averageMetrics[key] || 0;
        variantData.averageMetrics[key] = (currentAvg * (sampleCount - 1) + value) / sampleCount;
      }
    }
  }

  /**
   * 모니터링 종료
   */
  shutdown() {
    this.stopRealTimeMonitoring();
    console.log('📊 PerformanceMonitor 종료');
  }
}

/**
 * 성능 알림 시스템
 */
class PerformanceAlertSystem {
  constructor(options) {
    this.options = options;
  }

  async sendAlerts(alerts) {
    // 알림 비활성화 확인
    if (!this.options.enableAlerts) {
      return;
    }
    
    for (const alert of alerts) {
      if (this.options.alertChannels.includes('console')) {
        console.warn(`🚨 성능 알림 [${alert.level}]: ${alert.message}`);
      }
      
      // 추가 알림 채널 (이메일, 슬랙 등) 구현 가능
    }
  }

  async sendErrorAlert(errorMetric) {
    const message = `에러 발생: ${errorMetric.error} (요청 ID: ${errorMetric.requestId})`;
    
    if (this.options.alertChannels.includes('console')) {
      console.error(`🚨 에러 알림: ${message}`);
    }
  }
}

export default PerformanceMonitor;