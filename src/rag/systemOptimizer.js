/**
 * Progressive RAG 시스템 통합 최적화 도구
 * 
 * 성능, 메모리, 응답 시간을 종합적으로 최적화
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 시스템 메트릭 수집기
 */
class SystemMetricsCollector {
  constructor() {
    this.metrics = {
      performance: new Map(),
      memory: new Map(),
      cache: new Map(),
      database: new Map(),
      embedding: new Map()
    };
    this.isCollecting = false;
    this.collectionInterval = null;
  }

  /**
   * 메트릭 수집 시작
   */
  startCollection(intervalMs = 5000) {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);

    console.log('📊 시스템 메트릭 수집 시작');
  }

  /**
   * 메트릭 수집 중지
   */
  stopCollection() {
    if (!this.isCollecting) return;

    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    console.log('📊 시스템 메트릭 수집 중지');
  }

  /**
   * 시스템 메트릭 수집
   */
  collectSystemMetrics() {
    const timestamp = Date.now();
    
    // 메모리 메트릭
    const memoryUsage = process.memoryUsage();
    this.metrics.memory.set(timestamp, {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss
    });

    // CPU 메트릭 (Node.js 환경에서 간접적으로 측정)
    const cpuUsage = process.cpuUsage();
    this.metrics.performance.set(timestamp, {
      user: cpuUsage.user,
      system: cpuUsage.system
    });

    // 메트릭 데이터 정리 (최근 1시간만 유지)
    this.cleanupOldMetrics(timestamp - 3600000); // 1시간 = 3600000ms
  }

  /**
   * 오래된 메트릭 정리
   */
  cleanupOldMetrics(cutoffTime) {
    for (const [category, metricsMap] of Object.entries(this.metrics)) {
      if (metricsMap instanceof Map) {
        for (const [timestamp] of metricsMap) {
          if (timestamp < cutoffTime) {
            metricsMap.delete(timestamp);
          }
        }
      }
    }
  }

  /**
   * 메트릭 분석
   */
  analyzeMetrics() {
    const analysis = {
      memory: this.analyzeMemoryMetrics(),
      performance: this.analyzePerformanceMetrics(),
      trends: this.analyzeTrends()
    };

    return analysis;
  }

  /**
   * 메모리 메트릭 분석
   */
  analyzeMemoryMetrics() {
    const memoryData = Array.from(this.metrics.memory.values());
    if (memoryData.length === 0) return null;

    const latest = memoryData[memoryData.length - 1];
    const heapUsages = memoryData.map(m => m.heapUsed);
    
    return {
      current: latest,
      average: heapUsages.reduce((sum, val) => sum + val, 0) / heapUsages.length,
      peak: Math.max(...heapUsages),
      trend: this.calculateTrend(heapUsages),
      utilizationRate: (latest.heapUsed / latest.heapTotal) * 100
    };
  }

  /**
   * 성능 메트릭 분석
   */
  analyzePerformanceMetrics() {
    const perfData = Array.from(this.metrics.performance.values());
    if (perfData.length === 0) return null;

    const latest = perfData[perfData.length - 1];
    const userTimes = perfData.map(p => p.user);
    
    return {
      current: latest,
      averageUserTime: userTimes.reduce((sum, val) => sum + val, 0) / userTimes.length,
      trend: this.calculateTrend(userTimes)
    };
  }

  /**
   * 트렌드 분석
   */
  analyzeTrends() {
    const memoryTrend = this.calculateMemoryTrend();
    const performanceTrend = this.calculatePerformanceTrend();

    return {
      memory: memoryTrend,
      performance: performanceTrend,
      overall: this.calculateOverallTrend(memoryTrend, performanceTrend)
    };
  }

  /**
   * 트렌드 계산 (단순 선형 회귀)
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  /**
   * 메모리 트렌드 계산
   */
  calculateMemoryTrend() {
    const memoryData = Array.from(this.metrics.memory.values());
    const heapUsages = memoryData.map(m => m.heapUsed);
    return this.calculateTrend(heapUsages);
  }

  /**
   * 성능 트렌드 계산
   */
  calculatePerformanceTrend() {
    const perfData = Array.from(this.metrics.performance.values());
    const userTimes = perfData.map(p => p.user);
    return this.calculateTrend(userTimes);
  }

  /**
   * 전체 트렌드 계산
   */
  calculateOverallTrend(memoryTrend, performanceTrend) {
    // 메모리와 성능 트렌드를 종합하여 전체 트렌드 계산
    return (memoryTrend + performanceTrend) / 2;
  }
}

/**
 * 최적화 전략 관리자
 */
class OptimizationStrategyManager {
  constructor() {
    this.strategies = new Map();
    this.activeStrategies = new Set();
    this.setupDefaultStrategies();
  }

  /**
   * 기본 최적화 전략 설정
   */
  setupDefaultStrategies() {
    // 메모리 최적화 전략
    this.registerStrategy('memory_cleanup', {
      name: '메모리 정리',
      description: '사용하지 않는 메모리 정리',
      priority: 'high',
      trigger: (metrics) => metrics.memory?.utilizationRate > 80,
      action: this.performMemoryCleanup.bind(this)
    });

    this.registerStrategy('cache_optimization', {
      name: '캐시 최적화',
      description: '캐시 크기 및 TTL 최적화',
      priority: 'medium',
      trigger: (metrics) => metrics.cache?.hitRate < 70,
      action: this.optimizeCache.bind(this)
    });

    this.registerStrategy('embedding_batch_optimization', {
      name: '임베딩 배치 최적화',
      description: '임베딩 생성 배치 크기 최적화',
      priority: 'medium',
      trigger: (metrics) => metrics.embedding?.avgDuration > 1000,
      action: this.optimizeEmbeddingBatch.bind(this)
    });

    this.registerStrategy('database_index_optimization', {
      name: '데이터베이스 인덱스 최적화',
      description: '벡터 데이터베이스 인덱스 최적화',
      priority: 'low',
      trigger: (metrics) => metrics.database?.queryTime > 500,
      action: this.optimizeDatabaseIndex.bind(this)
    });

    this.registerStrategy('response_time_optimization', {
      name: '응답 시간 최적화',
      description: '전체 응답 시간 개선',
      priority: 'high',
      trigger: (metrics) => metrics.performance?.avgResponseTime > 2000,
      action: this.optimizeResponseTime.bind(this)
    });
  }

  /**
   * 최적화 전략 등록
   */
  registerStrategy(id, strategy) {
    this.strategies.set(id, {
      id,
      ...strategy,
      executionCount: 0,
      lastExecuted: null,
      successCount: 0,
      failureCount: 0
    });
  }

  /**
   * 최적화 전략 평가 및 실행
   */
  async evaluateAndExecuteStrategies(metrics, ragSystem) {
    const executedStrategies = [];

    for (const [id, strategy] of this.strategies) {
      try {
        // 트리거 조건 확인
        if (strategy.trigger(metrics)) {
          console.log(`🔧 최적화 전략 실행: ${strategy.name}`);
          
          const startTime = performance.now();
          await strategy.action(ragSystem, metrics);
          const duration = performance.now() - startTime;

          // 실행 통계 업데이트
          strategy.executionCount++;
          strategy.lastExecuted = new Date().toISOString();
          strategy.successCount++;

          executedStrategies.push({
            id,
            name: strategy.name,
            duration,
            success: true
          });

          this.activeStrategies.add(id);
        }
      } catch (error) {
        console.error(`최적화 전략 실행 오류 [${strategy.name}]:`, error);
        
        strategy.failureCount++;
        executedStrategies.push({
          id,
          name: strategy.name,
          success: false,
          error: error.message
        });
      }
    }

    return executedStrategies;
  }

  // === 최적화 액션 구현 ===

  /**
   * 메모리 정리 수행
   */
  async performMemoryCleanup(ragSystem, metrics) {
    // 가비지 컬렉션 강제 실행
    if (global.gc) {
      global.gc();
    }

    // 캐시 정리
    if (ragSystem.cacheManager) {
      await ragSystem.cacheManager.cleanup();
    }

    // 벡터 데이터베이스 메모리 정리
    if (ragSystem.vectorDatabase && ragSystem.vectorDatabase.cleanup) {
      await ragSystem.vectorDatabase.cleanup();
    }

    console.log('🧹 메모리 정리 완료');
  }

  /**
   * 캐시 최적화
   */
  async optimizeCache(ragSystem, metrics) {
    if (!ragSystem.cacheManager) return;

    // 캐시 히트율이 낮으면 TTL 증가
    const currentTTL = ragSystem.cacheManager.defaultTTL || 3600000;
    const newTTL = Math.min(currentTTL * 1.5, 7200000); // 최대 2시간

    ragSystem.cacheManager.defaultTTL = newTTL;

    // 사용하지 않는 캐시 항목 정리
    await ragSystem.cacheManager.cleanup();

    console.log(`🚀 캐시 TTL 최적화: ${currentTTL}ms → ${newTTL}ms`);
  }

  /**
   * 임베딩 배치 최적화
   */
  async optimizeEmbeddingBatch(ragSystem, metrics) {
    if (!ragSystem.embeddingService) return;

    // 현재 배치 크기 확인 및 조정
    const currentBatchSize = ragSystem.embeddingService.batchSize || 10;
    const newBatchSize = Math.min(currentBatchSize + 5, 50); // 최대 50

    ragSystem.embeddingService.batchSize = newBatchSize;

    console.log(`⚡ 임베딩 배치 크기 최적화: ${currentBatchSize} → ${newBatchSize}`);
  }

  /**
   * 데이터베이스 인덱스 최적화
   */
  async optimizeDatabaseIndex(ragSystem, metrics) {
    if (!ragSystem.vectorDatabase) return;

    // 인덱스 재구성 (구현에 따라 다름)
    if (ragSystem.vectorDatabase.optimizeIndex) {
      await ragSystem.vectorDatabase.optimizeIndex();
    }

    console.log('🗃️ 데이터베이스 인덱스 최적화 완료');
  }

  /**
   * 응답 시간 최적화
   */
  async optimizeResponseTime(ragSystem, metrics) {
    // 병렬 처리 최적화
    if (ragSystem.responseTimeOptimizer) {
      await ragSystem.responseTimeOptimizer.optimizeConcurrency();
    }

    // 캐시 워밍업
    if (ragSystem.cacheManager) {
      await ragSystem.cacheManager.warmup();
    }

    console.log('⚡ 응답 시간 최적화 완료');
  }

  /**
   * 전략 통계 조회
   */
  getStrategyStats() {
    const stats = {};
    
    for (const [id, strategy] of this.strategies) {
      stats[id] = {
        name: strategy.name,
        executionCount: strategy.executionCount,
        successCount: strategy.successCount,
        failureCount: strategy.failureCount,
        successRate: strategy.executionCount > 0 ? 
          (strategy.successCount / strategy.executionCount) * 100 : 0,
        lastExecuted: strategy.lastExecuted
      };
    }

    return stats;
  }
}

/**
 * Progressive RAG 시스템 최적화기
 */
export class ProgressiveRAGSystemOptimizer {
  constructor(ragSystem, config = {}) {
    this.ragSystem = ragSystem;
    this.config = {
      metricsInterval: config.metricsInterval || 5000,
      optimizationInterval: config.optimizationInterval || 30000,
      outputDir: config.outputDir || path.join(__dirname, '../data/optimization'),
      enableAutoOptimization: config.enableAutoOptimization !== false,
      enableReporting: config.enableReporting !== false,
      ...config
    };

    this.metricsCollector = new SystemMetricsCollector();
    this.strategyManager = new OptimizationStrategyManager();
    this.optimizationHistory = [];
    this.isRunning = false;
    this.optimizationInterval = null;
  }

  /**
   * 최적화 시작
   */
  async start() {
    if (this.isRunning) return;

    this.isRunning = true;

    // 출력 디렉토리 생성
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // 메트릭 수집 시작
    this.metricsCollector.startCollection(this.config.metricsInterval);

    // 자동 최적화 활성화
    if (this.config.enableAutoOptimization) {
      this.optimizationInterval = setInterval(() => {
        this.performOptimization();
      }, this.config.optimizationInterval);
    }

    console.log('🚀 Progressive RAG 시스템 최적화기 시작');
  }

  /**
   * 최적화 중지
   */
  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    // 메트릭 수집 중지
    this.metricsCollector.stopCollection();

    // 자동 최적화 중지
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    // 최종 리포트 생성
    if (this.config.enableReporting) {
      await this.generateOptimizationReport();
    }

    console.log('⏹️ Progressive RAG 시스템 최적화기 중지');
  }

  /**
   * 최적화 수행
   */
  async performOptimization() {
    try {
      console.log('🔍 시스템 최적화 분석 시작');

      // 현재 메트릭 분석
      const metrics = this.metricsCollector.analyzeMetrics();
      
      // 추가 메트릭 수집
      const additionalMetrics = await this.collectAdditionalMetrics();
      const combinedMetrics = { ...metrics, ...additionalMetrics };

      // 최적화 전략 실행
      const executedStrategies = await this.strategyManager.evaluateAndExecuteStrategies(
        combinedMetrics, 
        this.ragSystem
      );

      // 최적화 결과 기록
      const optimizationResult = {
        timestamp: new Date().toISOString(),
        metrics: combinedMetrics,
        executedStrategies,
        systemStatus: await this.getSystemStatus()
      };

      this.optimizationHistory.push(optimizationResult);

      // 히스토리 정리 (최근 100개만 유지)
      if (this.optimizationHistory.length > 100) {
        this.optimizationHistory = this.optimizationHistory.slice(-100);
      }

      console.log(`✅ 최적화 완료: ${executedStrategies.length}개 전략 실행`);

      return optimizationResult;

    } catch (error) {
      console.error('최적화 수행 오류:', error);
      throw error;
    }
  }

  /**
   * 추가 메트릭 수집
   */
  async collectAdditionalMetrics() {
    const metrics = {};

    try {
      // 캐시 메트릭
      if (this.ragSystem.cacheManager) {
        metrics.cache = await this.collectCacheMetrics();
      }

      // 데이터베이스 메트릭
      if (this.ragSystem.vectorDatabase) {
        metrics.database = await this.collectDatabaseMetrics();
      }

      // 임베딩 서비스 메트릭
      if (this.ragSystem.embeddingService) {
        metrics.embedding = await this.collectEmbeddingMetrics();
      }

      // 응답 시간 메트릭
      if (this.ragSystem.responseTimeOptimizer) {
        metrics.performance = await this.collectPerformanceMetrics();
      }

    } catch (error) {
      console.error('추가 메트릭 수집 오류:', error);
    }

    return metrics;
  }

  /**
   * 캐시 메트릭 수집
   */
  async collectCacheMetrics() {
    const cacheStats = this.ragSystem.cacheManager.getStats ? 
      this.ragSystem.cacheManager.getStats() : {};

    return {
      hitRate: cacheStats.hitRate || 0,
      size: cacheStats.size || 0,
      memoryUsage: cacheStats.memoryUsage || 0
    };
  }

  /**
   * 데이터베이스 메트릭 수집
   */
  async collectDatabaseMetrics() {
    // 간단한 쿼리 성능 테스트
    const testVector = Array.from({ length: 100 }, () => Math.random());
    const startTime = performance.now();
    
    try {
      await this.ragSystem.vectorDatabase.query(testVector, 5);
      const queryTime = performance.now() - startTime;
      
      return {
        queryTime,
        indexSize: this.ragSystem.vectorDatabase.getIndexSize ? 
          this.ragSystem.vectorDatabase.getIndexSize() : 0
      };
    } catch (error) {
      return { queryTime: -1, indexSize: 0 };
    }
  }

  /**
   * 임베딩 메트릭 수집
   */
  async collectEmbeddingMetrics() {
    const testText = '테스트 텍스트';
    const startTime = performance.now();
    
    try {
      await this.ragSystem.embeddingService.getEmbedding(testText);
      const avgDuration = performance.now() - startTime;
      
      return {
        avgDuration,
        cacheHitRate: this.ragSystem.embeddingService.getCacheHitRate ? 
          this.ragSystem.embeddingService.getCacheHitRate() : 0
      };
    } catch (error) {
      return { avgDuration: -1, cacheHitRate: 0 };
    }
  }

  /**
   * 성능 메트릭 수집
   */
  async collectPerformanceMetrics() {
    if (!this.ragSystem.responseTimeOptimizer) return {};

    const dashboard = this.ragSystem.responseTimeOptimizer.getDashboardData ? 
      this.ragSystem.responseTimeOptimizer.getDashboardData() : {};

    return {
      avgResponseTime: dashboard.avgResponseTime || 0,
      throughput: dashboard.throughput || 0,
      healthScore: dashboard.healthScore || 0
    };
  }

  /**
   * 시스템 상태 조회
   */
  async getSystemStatus() {
    const memoryUsage = process.memoryUsage();
    
    return {
      uptime: process.uptime(),
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 최적화 리포트 생성
   */
  async generateOptimizationReport() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(this.config.outputDir, `optimization_report_${timestamp}.html`);
      
      const html = this.generateHTMLReport();
      fs.writeFileSync(reportPath, html);
      
      console.log(`📊 최적화 리포트 생성: ${reportPath}`);
      
      // JSON 데이터도 저장
      const dataPath = path.join(this.config.outputDir, `optimization_data_${timestamp}.json`);
      const reportData = {
        timestamp: new Date().toISOString(),
        config: this.config,
        optimizationHistory: this.optimizationHistory,
        strategyStats: this.strategyManager.getStrategyStats(),
        systemStatus: await this.getSystemStatus()
      };
      
      fs.writeFileSync(dataPath, JSON.stringify(reportData, null, 2));
      
    } catch (error) {
      console.error('최적화 리포트 생성 오류:', error);
    }
  }

  /**
   * HTML 리포트 생성
   */
  generateHTMLReport() {
    const strategyStats = this.strategyManager.getStrategyStats();
    const recentOptimizations = this.optimizationHistory.slice(-10);
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Progressive RAG 시스템 최적화 리포트</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .metrics { display: flex; gap: 20px; margin: 20px 0; }
        .metric { padding: 15px; background: #f9f9f9; border-radius: 8px; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .danger { color: #dc3545; }
        .chart { height: 200px; background: #f8f9fa; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Progressive RAG 시스템 최적화 리포트</h1>
        <p><strong>생성 시간:</strong> ${new Date().toISOString()}</p>
        <p><strong>최적화 실행 횟수:</strong> ${this.optimizationHistory.length}</p>
    </div>

    <div class="section">
        <h2>📊 최적화 전략 통계</h2>
        <table>
            <tr>
                <th>전략</th>
                <th>실행 횟수</th>
                <th>성공 횟수</th>
                <th>실패 횟수</th>
                <th>성공률</th>
                <th>마지막 실행</th>
            </tr>
            ${Object.entries(strategyStats).map(([id, stats]) => `
            <tr>
                <td>${stats.name}</td>
                <td>${stats.executionCount}</td>
                <td class="success">${stats.successCount}</td>
                <td class="danger">${stats.failureCount}</td>
                <td>${stats.successRate.toFixed(1)}%</td>
                <td>${stats.lastExecuted || '없음'}</td>
            </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>🔄 최근 최적화 실행</h2>
        <table>
            <tr>
                <th>시간</th>
                <th>실행된 전략</th>
                <th>메모리 사용률</th>
                <th>상태</th>
            </tr>
            ${recentOptimizations.map(opt => `
            <tr>
                <td>${new Date(opt.timestamp).toLocaleString()}</td>
                <td>${opt.executedStrategies.length}개 전략</td>
                <td>${opt.metrics.memory ? opt.metrics.memory.utilizationRate?.toFixed(1) + '%' : 'N/A'}</td>
                <td class="success">완료</td>
            </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>💡 최적화 권장사항</h2>
        <ul>
            <li>메모리 사용률이 80% 이상일 때 자동 정리가 실행됩니다.</li>
            <li>캐시 히트율이 70% 미만일 때 캐시 설정이 최적화됩니다.</li>
            <li>응답 시간이 2초 이상일 때 성능 최적화가 실행됩니다.</li>
            <li>정기적인 시스템 모니터링을 통해 성능을 유지하세요.</li>
        </ul>
    </div>

    <div class="section">
        <h2>⚙️ 시스템 설정</h2>
        <table>
            <tr><th>설정</th><th>값</th></tr>
            <tr><td>메트릭 수집 간격</td><td>${this.config.metricsInterval}ms</td></tr>
            <tr><td>최적화 실행 간격</td><td>${this.config.optimizationInterval}ms</td></tr>
            <tr><td>자동 최적화</td><td>${this.config.enableAutoOptimization ? '활성화' : '비활성화'}</td></tr>
            <tr><td>리포팅</td><td>${this.config.enableReporting ? '활성화' : '비활성화'}</td></tr>
        </table>
    </div>
</body>
</html>`;
  }

  /**
   * 실시간 대시보드 데이터 조회
   */
  getDashboardData() {
    const metrics = this.metricsCollector.analyzeMetrics();
    const strategyStats = this.strategyManager.getStrategyStats();
    const recentOptimization = this.optimizationHistory[this.optimizationHistory.length - 1];

    return {
      isRunning: this.isRunning,
      metrics,
      strategyStats,
      recentOptimization,
      optimizationCount: this.optimizationHistory.length,
      systemStatus: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 수동 최적화 실행
   */
  async runManualOptimization() {
    console.log('🔧 수동 최적화 실행');
    return await this.performOptimization();
  }
}

export default ProgressiveRAGSystemOptimizer;