/**
 * Progressive RAG 응답 시간 최적화 도구
 * 
 * 응답 시간 모니터링, 병렬 처리 최적화, 캐싱 전략 개선
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 응답 시간 모니터링 클래스
 */
class ResponseTimeMonitor {
  constructor(config = {}) {
    this.config = {
      slowThreshold: config.slowThreshold || 1000, // 1초
      verySlowThreshold: config.verySlowThreshold || 3000, // 3초
      maxHistory: config.maxHistory || 1000,
      enableDetailedLogging: config.enableDetailedLogging !== false,
      ...config
    };

    this.responseHistory = [];
    this.slowQueries = [];
    this.activeRequests = new Map();
  }

  /**
   * 요청 시작 추적
   */
  startRequest(requestId, metadata = {}) {
    const startTime = performance.now();
    this.activeRequests.set(requestId, {
      startTime,
      metadata,
      timestamp: new Date().toISOString()
    });

    return requestId;
  }

  /**
   * 요청 완료 추적
   */
  endRequest(requestId, result = {}) {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      console.warn(`요청 ID를 찾을 수 없음: ${requestId}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - request.startTime;

    const responseData = {
      requestId,
      duration,
      startTime: request.startTime,
      endTime,
      timestamp: request.timestamp,
      metadata: request.metadata,
      result,
      category: this.categorizeResponse(duration)
    };

    // 히스토리에 추가
    this.responseHistory.push(responseData);
    
    // 느린 쿼리 추적
    if (duration > this.config.slowThreshold) {
      this.slowQueries.push(responseData);
    }

    // 활성 요청에서 제거
    this.activeRequests.delete(requestId);

    // 히스토리 크기 제한
    if (this.responseHistory.length > this.config.maxHistory) {
      this.responseHistory = this.responseHistory.slice(-this.config.maxHistory);
    }

    // 느린 쿼리 크기 제한
    if (this.slowQueries.length > 100) {
      this.slowQueries = this.slowQueries.slice(-100);
    }

    // 로깅
    if (this.config.enableDetailedLogging) {
      this.logResponse(responseData);
    }

    return responseData;
  }

  /**
   * 응답 카테고리 분류
   */
  categorizeResponse(duration) {
    if (duration < 100) return 'fast';
    if (duration < this.config.slowThreshold) return 'normal';
    if (duration < this.config.verySlowThreshold) return 'slow';
    return 'very_slow';
  }

  /**
   * 응답 로깅
   */
  logResponse(responseData) {
    const { requestId, duration, category, metadata } = responseData;
    const emoji = {
      fast: '⚡',
      normal: '✅',
      slow: '⚠️',
      very_slow: '🐌'
    };

    console.log(`${emoji[category]} [${requestId}] ${duration.toFixed(2)}ms - ${metadata.operation || 'unknown'}`);
  }

  /**
   * 통계 생성
   */
  getStatistics() {
    if (this.responseHistory.length === 0) {
      return null;
    }

    const durations = this.responseHistory.map(r => r.duration);
    const categories = this.responseHistory.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {});

    const sorted = durations.sort((a, b) => a - b);

    return {
      total: this.responseHistory.length,
      categories,
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      },
      slowQueries: this.slowQueries.length,
      activeRequests: this.activeRequests.size
    };
  }

  /**
   * 느린 쿼리 분석
   */
  analyzeSlowQueries() {
    if (this.slowQueries.length === 0) {
      return { patterns: [], recommendations: [] };
    }

    const patterns = {};
    const recommendations = [];

    // 패턴 분석
    for (const query of this.slowQueries) {
      const operation = query.metadata.operation || 'unknown';
      if (!patterns[operation]) {
        patterns[operation] = { count: 0, totalDuration: 0, queries: [] };
      }
      patterns[operation].count++;
      patterns[operation].totalDuration += query.duration;
      patterns[operation].queries.push(query);
    }

    // 권장사항 생성
    for (const [operation, data] of Object.entries(patterns)) {
      const avgDuration = data.totalDuration / data.count;
      if (avgDuration > this.config.verySlowThreshold) {
        recommendations.push(`${operation} 작업이 평균 ${avgDuration.toFixed(2)}ms로 매우 느립니다. 최적화가 필요합니다.`);
      }
    }

    return { patterns, recommendations };
  }
}

/**
 * 병렬 처리 최적화 클래스
 */
class ParallelProcessingOptimizer {
  constructor(config = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency || 4,
      batchSize: config.batchSize || 10,
      timeoutMs: config.timeoutMs || 30000,
      enableWorkerThreads: config.enableWorkerThreads !== false,
      ...config
    };

    this.activeWorkers = new Set();
    this.taskQueue = [];
    this.isProcessing = false;
  }

  /**
   * 병렬 작업 실행
   */
  async executeParallel(tasks, options = {}) {
    const {
      concurrency = this.config.maxConcurrency,
      timeout = this.config.timeoutMs
    } = options;

    const results = [];
    const errors = [];
    const semaphore = new Semaphore(concurrency);

    const promises = tasks.map(async (task, index) => {
      await semaphore.acquire();
      
      try {
        const result = await Promise.race([
          this.executeTask(task, index),
          this.createTimeout(timeout)
        ]);
        results[index] = result;
      } catch (error) {
        errors[index] = error;
        console.error(`작업 ${index} 실행 오류:`, error);
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);

    return { results, errors };
  }

  /**
   * 배치 처리
   */
  async executeBatch(items, processor, options = {}) {
    const {
      batchSize = this.config.batchSize,
      concurrency = this.config.maxConcurrency
    } = options;

    const batches = this.createBatches(items, batchSize);
    const batchTasks = batches.map(batch => ({
      type: 'batch',
      data: batch,
      processor
    }));

    return await this.executeParallel(batchTasks, { concurrency });
  }

  /**
   * 배치 생성
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 작업 실행
   */
  async executeTask(task, index) {
    if (task.type === 'batch') {
      return await task.processor(task.data);
    } else if (typeof task === 'function') {
      return await task();
    } else {
      throw new Error(`지원되지 않는 작업 타입: ${task.type}`);
    }
  }

  /**
   * 타임아웃 생성
   */
  createTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`작업 타임아웃: ${ms}ms`)), ms);
    });
  }

  /**
   * 워커 스레드 실행 (실험적)
   */
  async executeWithWorker(workerScript, data) {
    if (!this.config.enableWorkerThreads) {
      throw new Error('워커 스레드가 비활성화되어 있습니다.');
    }

    return new Promise((resolve, reject) => {
      const worker = new Worker(workerScript, {
        workerData: data
      });

      this.activeWorkers.add(worker);

      worker.on('message', (result) => {
        this.activeWorkers.delete(worker);
        resolve(result);
      });

      worker.on('error', (error) => {
        this.activeWorkers.delete(worker);
        reject(error);
      });

      worker.on('exit', (code) => {
        this.activeWorkers.delete(worker);
        if (code !== 0) {
          reject(new Error(`워커가 코드 ${code}로 종료되었습니다.`));
        }
      });
    });
  }

  /**
   * 모든 워커 정리
   */
  async cleanup() {
    const terminationPromises = Array.from(this.activeWorkers).map(worker => {
      return worker.terminate();
    });

    await Promise.all(terminationPromises);
    this.activeWorkers.clear();
  }
}

/**
 * 세마포어 클래스 (동시성 제어)
 */
class Semaphore {
  constructor(permits) {
    this.permits = permits;
    this.waiting = [];
  }

  async acquire() {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release() {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      this.permits--;
      resolve();
    }
  }
}

/**
 * 응답 시간 최적화 도구
 */
export class ResponseTimeOptimizer {
  constructor(ragSystem, config = {}) {
    this.ragSystem = ragSystem;
    this.config = {
      enableMonitoring: config.enableMonitoring !== false,
      enableParallelProcessing: config.enableParallelProcessing !== false,
      enableCacheOptimization: config.enableCacheOptimization !== false,
      ...config
    };

    this.monitor = new ResponseTimeMonitor(config.monitor);
    this.parallelProcessor = new ParallelProcessingOptimizer(config.parallel);
    this.optimizations = new Map();
    this.isOptimizing = false;
  }

  /**
   * 최적화 시작
   */
  async startOptimization() {
    if (this.isOptimizing) {
      console.log('응답 시간 최적화가 이미 실행 중입니다.');
      return;
    }

    this.isOptimizing = true;

    // RAG 시스템 메서드 래핑
    if (this.config.enableMonitoring) {
      this.wrapRAGMethods();
    }

    console.log('🚀 응답 시간 최적화 시작');
  }

  /**
   * 최적화 중지
   */
  async stopOptimization() {
    if (!this.isOptimizing) {
      return;
    }

    this.isOptimizing = false;

    // 워커 정리
    await this.parallelProcessor.cleanup();

    // 원본 메서드 복원
    this.restoreRAGMethods();

    console.log('⏹️ 응답 시간 최적화 중지');
  }

  /**
   * RAG 시스템 메서드 래핑
   */
  wrapRAGMethods() {
    const methodsToWrap = [
      'searchMedicalTerms',
      'searchICDCodes',
      'saveAnalysisResult',
      'getAnalysisResult'
    ];

    for (const methodName of methodsToWrap) {
      if (typeof this.ragSystem[methodName] === 'function') {
        const originalMethod = this.ragSystem[methodName].bind(this.ragSystem);
        this.optimizations.set(methodName, originalMethod);

        this.ragSystem[methodName] = async (...args) => {
          const requestId = `${methodName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          this.monitor.startRequest(requestId, {
            operation: methodName,
            args: args.length
          });

          try {
            const result = await originalMethod(...args);
            this.monitor.endRequest(requestId, { success: true });
            return result;
          } catch (error) {
            this.monitor.endRequest(requestId, { success: false, error: error.message });
            throw error;
          }
        };
      }
    }

    console.log('📊 RAG 메서드 모니터링 활성화');
  }

  /**
   * 원본 메서드 복원
   */
  restoreRAGMethods() {
    for (const [methodName, originalMethod] of this.optimizations) {
      this.ragSystem[methodName] = originalMethod;
    }
    this.optimizations.clear();
    console.log('🔄 RAG 메서드 복원 완료');
  }

  /**
   * 배치 검색 최적화
   */
  async optimizedBatchSearch(queries, searchType = 'medical') {
    const requestId = `batch_search_${Date.now()}`;
    this.monitor.startRequest(requestId, {
      operation: 'batchSearch',
      queryCount: queries.length,
      searchType
    });

    try {
      const processor = async (batch) => {
        const results = [];
        for (const query of batch) {
          let result;
          if (searchType === 'medical') {
            result = await this.ragSystem.searchMedicalTerms(query);
          } else if (searchType === 'icd') {
            result = await this.ragSystem.searchICDCodes(query);
          }
          results.push({ query, result });
        }
        return results;
      };

      const { results } = await this.parallelProcessor.executeBatch(
        queries,
        processor,
        { batchSize: 5, concurrency: 3 }
      );

      const flatResults = results.flat().filter(Boolean);
      this.monitor.endRequest(requestId, { success: true, resultCount: flatResults.length });
      
      return flatResults;

    } catch (error) {
      this.monitor.endRequest(requestId, { success: false, error: error.message });
      throw error;
    }
  }

  /**
   * 캐시 예열
   */
  async warmupCache(commonQueries) {
    console.log('🔥 캐시 예열 시작...');
    
    const requestId = `cache_warmup_${Date.now()}`;
    this.monitor.startRequest(requestId, {
      operation: 'cacheWarmup',
      queryCount: commonQueries.length
    });

    try {
      // 병렬로 임베딩 생성 및 캐시
      const embeddingTasks = commonQueries.map(query => async () => {
        return await this.ragSystem.embeddingService.getEmbedding(query);
      });

      await this.parallelProcessor.executeParallel(embeddingTasks, { concurrency: 4 });

      this.monitor.endRequest(requestId, { success: true });
      console.log('✅ 캐시 예열 완료');

    } catch (error) {
      this.monitor.endRequest(requestId, { success: false, error: error.message });
      console.error('캐시 예열 오류:', error);
    }
  }

  /**
   * 응답 시간 분석
   */
  analyzeResponseTimes() {
    const statistics = this.monitor.getStatistics();
    const slowQueryAnalysis = this.monitor.analyzeSlowQueries();

    return {
      statistics,
      slowQueryAnalysis,
      recommendations: this.generateOptimizationRecommendations(statistics, slowQueryAnalysis)
    };
  }

  /**
   * 최적화 권장사항 생성
   */
  generateOptimizationRecommendations(statistics, slowQueryAnalysis) {
    const recommendations = [];

    if (!statistics) {
      return ['충분한 데이터가 없습니다. 더 많은 요청을 처리한 후 분석하세요.'];
    }

    // 평균 응답 시간 분석
    if (statistics.duration.avg > 1000) {
      recommendations.push('평균 응답 시간이 1초를 초과합니다. 캐싱 전략을 강화하세요.');
    }

    // 느린 쿼리 비율 분석
    const slowRatio = statistics.slowQueries / statistics.total;
    if (slowRatio > 0.1) {
      recommendations.push(`느린 쿼리 비율이 ${(slowRatio * 100).toFixed(1)}%입니다. 인덱싱을 최적화하세요.`);
    }

    // P95 응답 시간 분석
    if (statistics.duration.p95 > 3000) {
      recommendations.push('95% 응답 시간이 3초를 초과합니다. 병렬 처리를 고려하세요.');
    }

    // 활성 요청 수 분석
    if (statistics.activeRequests > 10) {
      recommendations.push('동시 요청 수가 많습니다. 큐잉 시스템을 도입하세요.');
    }

    // 느린 쿼리 패턴 분석
    for (const recommendation of slowQueryAnalysis.recommendations) {
      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * 성능 리포트 생성
   */
  generatePerformanceReport() {
    const analysis = this.analyzeResponseTimes();
    
    return {
      timestamp: new Date().toISOString(),
      optimization: {
        isActive: this.isOptimizing,
        monitoring: this.config.enableMonitoring,
        parallelProcessing: this.config.enableParallelProcessing
      },
      performance: analysis,
      systemInfo: {
        activeWorkers: this.parallelProcessor.activeWorkers.size,
        wrappedMethods: this.optimizations.size
      }
    };
  }

  /**
   * 실시간 성능 대시보드 데이터
   */
  getDashboardData() {
    const statistics = this.monitor.getStatistics();
    
    if (!statistics) {
      return { message: '데이터 없음' };
    }

    return {
      currentTime: new Date().toISOString(),
      responseTime: {
        avg: statistics.duration.avg.toFixed(2),
        p95: statistics.duration.p95.toFixed(2),
        max: statistics.duration.max.toFixed(2)
      },
      throughput: {
        total: statistics.total,
        slow: statistics.slowQueries,
        active: statistics.activeRequests
      },
      categories: statistics.categories,
      health: this.calculateHealthScore(statistics)
    };
  }

  /**
   * 시스템 건강도 점수 계산
   */
  calculateHealthScore(statistics) {
    let score = 100;

    // 평균 응답 시간 페널티
    if (statistics.duration.avg > 500) score -= 20;
    if (statistics.duration.avg > 1000) score -= 30;

    // 느린 쿼리 비율 페널티
    const slowRatio = statistics.slowQueries / statistics.total;
    if (slowRatio > 0.05) score -= 15;
    if (slowRatio > 0.1) score -= 25;

    // P95 응답 시간 페널티
    if (statistics.duration.p95 > 2000) score -= 15;
    if (statistics.duration.p95 > 5000) score -= 30;

    return Math.max(0, score);
  }
}

export default ResponseTimeOptimizer;