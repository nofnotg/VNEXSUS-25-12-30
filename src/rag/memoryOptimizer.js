/**
 * Progressive RAG 메모리 최적화 도구
 * 
 * 메모리 사용량 모니터링, 가비지 컬렉션 최적화, 메모리 누수 감지
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 메모리 모니터링 클래스
 */
class MemoryMonitor {
  constructor(config = {}) {
    this.config = {
      monitoringInterval: config.monitoringInterval || 5000, // 5초
      alertThreshold: config.alertThreshold || 500 * 1024 * 1024, // 500MB
      logPath: config.logPath || path.join(__dirname, '../data/memory-logs'),
      maxLogFiles: config.maxLogFiles || 10,
      ...config
    };

    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.memoryHistory = [];
    this.alerts = [];
    this.baseline = null;
  }

  /**
   * 모니터링 시작
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('메모리 모니터링이 이미 실행 중입니다.');
      return;
    }

    this.isMonitoring = true;
    this.baseline = process.memoryUsage();
    
    // 로그 디렉토리 생성
    if (!fs.existsSync(this.config.logPath)) {
      fs.mkdirSync(this.config.logPath, { recursive: true });
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMemoryData();
    }, this.config.monitoringInterval);

    console.log('🔍 메모리 모니터링 시작');
  }

  /**
   * 모니터링 중지
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // 최종 로그 저장
    this.saveMemoryLog();
    console.log('⏹️ 메모리 모니터링 중지');
  }

  /**
   * 메모리 데이터 수집
   */
  collectMemoryData() {
    const memoryUsage = process.memoryUsage();
    const timestamp = new Date().toISOString();

    const data = {
      timestamp,
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers || 0
    };

    this.memoryHistory.push(data);

    // 메모리 사용량 임계값 확인
    if (memoryUsage.heapUsed > this.config.alertThreshold) {
      this.createAlert('HIGH_MEMORY_USAGE', {
        current: memoryUsage.heapUsed,
        threshold: this.config.alertThreshold,
        timestamp
      });
    }

    // 메모리 누수 감지
    this.detectMemoryLeak(data);

    // 히스토리 크기 제한 (최근 1000개만 유지)
    if (this.memoryHistory.length > 1000) {
      this.memoryHistory = this.memoryHistory.slice(-1000);
    }
  }

  /**
   * 메모리 누수 감지
   */
  detectMemoryLeak(currentData) {
    if (this.memoryHistory.length < 10) return;

    const recentHistory = this.memoryHistory.slice(-10);
    const trend = this.calculateMemoryTrend(recentHistory);

    // 지속적인 메모리 증가 패턴 감지
    if (trend.slope > 1024 * 1024) { // 1MB/측정 이상 증가
      this.createAlert('MEMORY_LEAK_SUSPECTED', {
        trend: trend.slope,
        duration: recentHistory.length * this.config.monitoringInterval,
        timestamp: currentData.timestamp
      });
    }
  }

  /**
   * 메모리 사용량 트렌드 계산
   */
  calculateMemoryTrend(history) {
    if (history.length < 2) return { slope: 0, correlation: 0 };

    const n = history.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = history.map(h => h.heapUsed);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return { slope, correlation: this.calculateCorrelation(x, y) };
  }

  /**
   * 상관관계 계산
   */
  calculateCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * 알림 생성
   */
  createAlert(type, data) {
    const alert = {
      type,
      timestamp: new Date().toISOString(),
      data,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.alerts.push(alert);
    console.warn(`⚠️ 메모리 알림 [${type}]:`, data);

    // 최근 100개 알림만 유지
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * 메모리 로그 저장
   */
  saveMemoryLog() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(this.config.logPath, `memory_${timestamp}.json`);

      const logData = {
        timestamp: new Date().toISOString(),
        baseline: this.baseline,
        history: this.memoryHistory,
        alerts: this.alerts,
        summary: this.generateSummary()
      };

      fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
      console.log(`💾 메모리 로그 저장: ${logFile}`);

      // 오래된 로그 파일 정리
      this.cleanupOldLogs();

    } catch (error) {
      console.error('메모리 로그 저장 오류:', error);
    }
  }

  /**
   * 오래된 로그 파일 정리
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.config.logPath)
        .filter(file => file.startsWith('memory_') && file.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length > this.config.maxLogFiles) {
        const filesToDelete = files.slice(this.config.maxLogFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(path.join(this.config.logPath, file));
        }
        console.log(`🗑️ 오래된 로그 파일 ${filesToDelete.length}개 삭제`);
      }
    } catch (error) {
      console.error('로그 파일 정리 오류:', error);
    }
  }

  /**
   * 메모리 사용량 요약 생성
   */
  generateSummary() {
    if (this.memoryHistory.length === 0) return null;

    const heapUsages = this.memoryHistory.map(h => h.heapUsed);
    const rssUsages = this.memoryHistory.map(h => h.rss);

    return {
      duration: this.memoryHistory.length * this.config.monitoringInterval,
      heap: {
        min: Math.min(...heapUsages),
        max: Math.max(...heapUsages),
        avg: heapUsages.reduce((sum, val) => sum + val, 0) / heapUsages.length,
        current: heapUsages[heapUsages.length - 1]
      },
      rss: {
        min: Math.min(...rssUsages),
        max: Math.max(...rssUsages),
        avg: rssUsages.reduce((sum, val) => sum + val, 0) / rssUsages.length,
        current: rssUsages[rssUsages.length - 1]
      },
      alertCount: this.alerts.length
    };
  }

  /**
   * 현재 메모리 상태 조회
   */
  getCurrentStatus() {
    const current = process.memoryUsage();
    const summary = this.generateSummary();

    return {
      current,
      baseline: this.baseline,
      isMonitoring: this.isMonitoring,
      summary,
      recentAlerts: this.alerts.slice(-5)
    };
  }
}

/**
 * 메모리 최적화 도구
 */
export class MemoryOptimizer {
  constructor(config = {}) {
    this.config = {
      gcInterval: config.gcInterval || 30000, // 30초
      cacheCleanupInterval: config.cacheCleanupInterval || 60000, // 1분
      maxCacheSize: config.maxCacheSize || 100 * 1024 * 1024, // 100MB
      enableAutoGC: config.enableAutoGC !== false,
      enableCacheCleanup: config.enableCacheCleanup !== false,
      ...config
    };

    this.monitor = new MemoryMonitor(config.monitor);
    this.gcInterval = null;
    this.cacheCleanupInterval = null;
    this.cacheReferences = new Set();
    this.isOptimizing = false;
  }

  /**
   * 최적화 시작
   */
  startOptimization() {
    if (this.isOptimizing) {
      console.log('메모리 최적화가 이미 실행 중입니다.');
      return;
    }

    this.isOptimizing = true;

    // 메모리 모니터링 시작
    this.monitor.startMonitoring();

    // 자동 가비지 컬렉션
    if (this.config.enableAutoGC) {
      this.startAutoGC();
    }

    // 캐시 정리
    if (this.config.enableCacheCleanup) {
      this.startCacheCleanup();
    }

    console.log('🚀 메모리 최적화 시작');
  }

  /**
   * 최적화 중지
   */
  stopOptimization() {
    if (!this.isOptimizing) {
      return;
    }

    this.isOptimizing = false;

    // 모니터링 중지
    this.monitor.stopMonitoring();

    // 인터벌 정리
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }

    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }

    console.log('⏹️ 메모리 최적화 중지');
  }

  /**
   * 자동 가비지 컬렉션 시작
   */
  startAutoGC() {
    this.gcInterval = setInterval(() => {
      this.performGarbageCollection();
    }, this.config.gcInterval);

    console.log('🗑️ 자동 가비지 컬렉션 활성화');
  }

  /**
   * 가비지 컬렉션 수행
   */
  performGarbageCollection() {
    const beforeGC = process.memoryUsage();
    
    try {
      if (global.gc) {
        global.gc();
        const afterGC = process.memoryUsage();
        
        const freed = beforeGC.heapUsed - afterGC.heapUsed;
        if (freed > 1024 * 1024) { // 1MB 이상 해제된 경우만 로그
          console.log(`🗑️ GC 완료: ${(freed / 1024 / 1024).toFixed(2)}MB 해제`);
        }
      } else {
        console.warn('가비지 컬렉션을 사용할 수 없습니다. --expose-gc 플래그로 실행하세요.');
      }
    } catch (error) {
      console.error('가비지 컬렉션 오류:', error);
    }
  }

  /**
   * 캐시 정리 시작
   */
  startCacheCleanup() {
    this.cacheCleanupInterval = setInterval(() => {
      this.performCacheCleanup();
    }, this.config.cacheCleanupInterval);

    console.log('🧹 자동 캐시 정리 활성화');
  }

  /**
   * 캐시 정리 수행
   */
  performCacheCleanup() {
    let totalCleaned = 0;

    for (const cacheRef of this.cacheReferences) {
      try {
        if (cacheRef && typeof cacheRef.cleanup === 'function') {
          const cleaned = cacheRef.cleanup();
          totalCleaned += cleaned || 0;
        }
      } catch (error) {
        console.error('캐시 정리 오류:', error);
      }
    }

    if (totalCleaned > 0) {
      console.log(`🧹 캐시 정리 완료: ${totalCleaned}개 항목 제거`);
    }
  }

  /**
   * 캐시 참조 등록
   */
  registerCache(cacheInstance) {
    if (cacheInstance && typeof cacheInstance.cleanup === 'function') {
      this.cacheReferences.add(cacheInstance);
      console.log('📝 캐시 인스턴스 등록됨');
    }
  }

  /**
   * 캐시 참조 해제
   */
  unregisterCache(cacheInstance) {
    this.cacheReferences.delete(cacheInstance);
    console.log('🗑️ 캐시 인스턴스 등록 해제됨');
  }

  /**
   * 메모리 사용량 분석
   */
  analyzeMemoryUsage() {
    const current = process.memoryUsage();
    const status = this.monitor.getCurrentStatus();

    const analysis = {
      current,
      baseline: status.baseline,
      summary: status.summary,
      recommendations: []
    };

    // 메모리 사용량 분석 및 권장사항 생성
    const heapUsagePercent = (current.heapUsed / current.heapTotal) * 100;
    
    if (heapUsagePercent > 80) {
      analysis.recommendations.push('힙 사용률이 80%를 초과했습니다. 메모리 정리를 고려하세요.');
    }

    if (current.external > 50 * 1024 * 1024) { // 50MB
      analysis.recommendations.push('외부 메모리 사용량이 높습니다. 버퍼나 외부 리소스를 확인하세요.');
    }

    if (status.summary && status.summary.alertCount > 5) {
      analysis.recommendations.push('메모리 알림이 빈번합니다. 메모리 누수를 확인하세요.');
    }

    return analysis;
  }

  /**
   * 메모리 최적화 권장사항 생성
   */
  generateOptimizationRecommendations() {
    const analysis = this.analyzeMemoryUsage();
    const recommendations = [...analysis.recommendations];

    // 추가 권장사항
    if (!global.gc) {
      recommendations.push('--expose-gc 플래그로 실행하여 수동 가비지 컬렉션을 활성화하세요.');
    }

    if (this.cacheReferences.size === 0) {
      recommendations.push('캐시 인스턴스를 등록하여 자동 정리를 활성화하세요.');
    }

    return {
      analysis,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 메모리 최적화 리포트 생성
   */
  generateOptimizationReport() {
    const recommendations = this.generateOptimizationRecommendations();
    const status = this.monitor.getCurrentStatus();

    return {
      timestamp: new Date().toISOString(),
      memoryStatus: status,
      optimization: {
        isActive: this.isOptimizing,
        autoGC: this.config.enableAutoGC,
        cacheCleanup: this.config.enableCacheCleanup,
        registeredCaches: this.cacheReferences.size
      },
      recommendations: recommendations.recommendations,
      analysis: recommendations.analysis
    };
  }

  /**
   * 강제 메모리 정리
   */
  forceCleanup() {
    console.log('🧹 강제 메모리 정리 시작...');

    // 가비지 컬렉션
    this.performGarbageCollection();

    // 캐시 정리
    this.performCacheCleanup();

    // 메모리 상태 확인
    const afterCleanup = process.memoryUsage();
    console.log('✅ 강제 메모리 정리 완료');
    console.log(`현재 힙 사용량: ${(afterCleanup.heapUsed / 1024 / 1024).toFixed(2)}MB`);

    return afterCleanup;
  }
}

export default MemoryOptimizer;