/**
 * 성능 모니터링 유틸리티
 * CPU, 메모리, 응답 시간 등을 추적하고 모니터링합니다.
 * @module utils/performanceMonitor
 */

import os from 'os';
import process from 'process';
import { createLogger } from './enhancedLogger.js';

const logger = createLogger('PERFORMANCE');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        active: 0,
        errors: 0,
        avgResponseTime: 0,
        responseTimes: []
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      },
      cpu: {
        usage: 0,
        loadAverage: []
      },
      system: {
        uptime: 0,
        freeMemory: 0,
        totalMemory: 0
      }
    };

    this.startTime = Date.now();
    this.monitoringInterval = null;
    this.isMonitoring = false;
  }

  /**
   * 성능 모니터링 시작
   * @param {number} interval - 모니터링 간격 (밀리초)
   */
  startMonitoring(interval = 30000) {
    if (this.isMonitoring) {
      logger.warn('성능 모니터링이 이미 실행 중입니다.');
      return;
    }

    this.isMonitoring = true;
    logger.info(`성능 모니터링을 시작합니다. 간격: ${interval}ms`);

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.logMetrics();
    }, interval);

    // 초기 메트릭 수집
    this.collectMetrics();
  }

  /**
   * 성능 모니터링 중지
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      logger.warn('성능 모니터링이 실행되고 있지 않습니다.');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('성능 모니터링을 중지했습니다.');
  }

  /**
   * 메트릭 수집
   */
  collectMetrics() {
    // 메모리 사용량
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100 // MB
    };

    // CPU 사용량
    const cpus = os.cpus();
    this.metrics.cpu = {
      usage: this.calculateCpuUsage(cpus),
      loadAverage: os.loadavg()
    };

    // 시스템 정보
    this.metrics.system = {
      uptime: Math.round((Date.now() - this.startTime) / 1000), // 초
      freeMemory: Math.round(os.freemem() / 1024 / 1024), // MB
      totalMemory: Math.round(os.totalmem() / 1024 / 1024) // MB
    };

    // 평균 응답 시간 계산
    if (this.metrics.requests.responseTimes.length > 0) {
      const sum = this.metrics.requests.responseTimes.reduce((a, b) => a + b, 0);
      this.metrics.requests.avgResponseTime = Math.round(sum / this.metrics.requests.responseTimes.length);
      
      // 최근 100개 응답 시간만 유지
      if (this.metrics.requests.responseTimes.length > 100) {
        this.metrics.requests.responseTimes = this.metrics.requests.responseTimes.slice(-100);
      }
    }
  }

  /**
   * CPU 사용률 계산
   * @param {Array} cpus - CPU 정보 배열
   * @returns {number} CPU 사용률 (%)
   */
  calculateCpuUsage(cpus) {
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * 요청 시작 추적
   * @returns {Function} 요청 종료 함수
   */
  trackRequest() {
    const startTime = Date.now();
    this.metrics.requests.total++;
    this.metrics.requests.active++;

    return (isError = false) => {
      const responseTime = Date.now() - startTime;
      this.metrics.requests.active--;
      this.metrics.requests.responseTimes.push(responseTime);

      if (isError) {
        this.metrics.requests.errors++;
      }

      return responseTime;
    };
  }

  /**
   * 메트릭 로깅
   */
  logMetrics() {
    const { memory, cpu, system, requests } = this.metrics;
    
    logger.performance('성능 메트릭', {
      memory: {
        heapUsed: `${memory.heapUsed}MB`,
        heapTotal: `${memory.heapTotal}MB`,
        rss: `${memory.rss}MB`,
        usage: `${Math.round(memory.heapUsed / memory.heapTotal * 100)}%`
      },
      cpu: {
        usage: `${cpu.usage}%`,
        loadAverage: cpu.loadAverage.map(avg => Math.round(avg * 100) / 100)
      },
      system: {
        uptime: `${Math.floor(system.uptime / 60)}분`,
        memoryUsage: `${system.totalMemory - system.freeMemory}MB / ${system.totalMemory}MB`
      },
      requests: {
        total: requests.total,
        active: requests.active,
        errors: requests.errors,
        avgResponseTime: `${requests.avgResponseTime}ms`,
        errorRate: requests.total > 0 ? `${Math.round(requests.errors / requests.total * 100)}%` : '0%'
      }
    });

    // 경고 임계값 확인
    this.checkThresholds();
  }

  /**
   * 임계값 확인 및 경고
   */
  checkThresholds() {
    // 경고 로그 비활성화 - 디버깅 중 노이즈 제거
    return;
    
    const { memory, cpu, requests } = this.metrics;

    // 메모리 사용량 경고 (80% 이상)
    const memoryUsage = memory.heapUsed / memory.heapTotal;
    if (memoryUsage > 0.8) {
      logger.warn(`높은 메모리 사용량 감지: ${Math.round(memoryUsage * 100)}%`);
    }

    // CPU 사용량 경고 (90% 이상)
    if (cpu.usage > 90) {
      logger.warn(`높은 CPU 사용량 감지: ${cpu.usage}%`);
    }

    // 평균 응답 시간 경고 (5초 이상)
    if (requests.avgResponseTime > 5000) {
      logger.warn(`느린 응답 시간 감지: ${requests.avgResponseTime}ms`);
    }

    // 에러율 경고 (10% 이상)
    const errorRate = requests.total > 0 ? requests.errors / requests.total : 0;
    if (errorRate > 0.1) {
      logger.warn(`높은 에러율 감지: ${Math.round(errorRate * 100)}%`);
    }
  }

  /**
   * 현재 메트릭 반환
   * @returns {Object} 현재 성능 메트릭
   */
  getMetrics() {
    this.collectMetrics();
    return { ...this.metrics };
  }

  /**
   * 메트릭 리셋
   */
  resetMetrics() {
    this.metrics.requests = {
      total: 0,
      active: 0,
      errors: 0,
      avgResponseTime: 0,
      responseTimes: []
    };

    logger.info('성능 메트릭을 리셋했습니다.');
  }

  /**
   * 메모리 사용량 강제 정리
   */
  forceGarbageCollection() {
    if (global.gc) {
      logger.info('가비지 컬렉션을 수동으로 실행합니다.');
      global.gc();
      this.collectMetrics();
      logger.info(`가비지 컬렉션 후 메모리 사용량: ${this.metrics.memory.heapUsed}MB`);
    } else {
      logger.warn('가비지 컬렉션을 사용할 수 없습니다. --expose-gc 플래그로 Node.js를 시작하세요.');
    }
  }
}

// 싱글톤 인스턴스
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
export { PerformanceMonitor };