/**
 * 성능 모니터링 미들웨어
 * Express 요청/응답 사이클에서 성능 메트릭을 수집합니다.
 * @module middleware/performanceMiddleware
 */

import performanceMonitor from '../utils/performanceMonitor.js';
import { createLogger } from '../utils/enhancedLogger.js';

const logger = createLogger('PERFORMANCE_MIDDLEWARE');

/**
 * 성능 추적 미들웨어
 * 각 요청의 응답 시간과 메모리 사용량을 추적합니다.
 */
export const performanceTracker = (req, res, next) => {
  const startTime = Date.now();
  const endRequest = performanceMonitor.trackRequest();

  // 요청 정보 로깅
  logger.debug(`요청 시작: ${req.method} ${req.path}`, {
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // 응답 완료 시 메트릭 수집
  res.on('finish', () => {
    const responseTime = endRequest(res.statusCode >= 400);
    
    // 느린 요청 경고 (2초 이상)
    if (responseTime > 2000) {
      logger.warn(`느린 요청 감지: ${req.method} ${req.path} - ${responseTime}ms`, {
        statusCode: res.statusCode,
        responseTime,
        path: req.path,
        method: req.method
      });
    }

    // 성공적인 요청 로깅
    logger.debug(`요청 완료: ${req.method} ${req.path} - ${responseTime}ms`, {
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('Content-Length') || 0
    });
  });

  // 에러 발생 시 메트릭 수집
  res.on('error', (error) => {
    endRequest(true);
    logger.error(`요청 에러: ${req.method} ${req.path}`, error);
  });

  next();
};

/**
 * 메모리 사용량 체크 미들웨어
 * 높은 메모리 사용량 시 경고를 발생시킵니다.
 */
export const memoryChecker = (req, res, next) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  // 메모리 사용량이 85% 이상일 때 경고
  if (memoryUsagePercent > 85) {
    logger.warn(`높은 메모리 사용량: ${Math.round(memoryUsagePercent)}% (${heapUsedMB}MB/${heapTotalMB}MB)`, {
      path: req.path,
      method: req.method,
      memoryUsage: {
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        percentage: Math.round(memoryUsagePercent)
      }
    });

    // 메모리 사용량이 95% 이상일 때 가비지 컬렉션 시도
    if (memoryUsagePercent > 95) {
      performanceMonitor.forceGarbageCollection();
    }
  }

  next();
};

/**
 * 성능 메트릭 API 엔드포인트
 * 현재 성능 상태를 반환합니다.
 */
export const performanceMetricsEndpoint = (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        memory: {
          heapUsed: `${metrics.memory.heapUsed}MB`,
          heapTotal: `${metrics.memory.heapTotal}MB`,
          rss: `${metrics.memory.rss}MB`,
          external: `${metrics.memory.external}MB`,
          usage: `${Math.round(metrics.memory.heapUsed / metrics.memory.heapTotal * 100)}%`
        },
        cpu: {
          usage: `${metrics.cpu.usage}%`,
          loadAverage: metrics.cpu.loadAverage
        },
        system: {
          uptime: `${Math.floor(metrics.system.uptime / 60)}분`,
          freeMemory: `${metrics.system.freeMemory}MB`,
          totalMemory: `${metrics.system.totalMemory}MB`,
          memoryUsage: `${Math.round((metrics.system.totalMemory - metrics.system.freeMemory) / metrics.system.totalMemory * 100)}%`
        },
        requests: {
          total: metrics.requests.total,
          active: metrics.requests.active,
          errors: metrics.requests.errors,
          avgResponseTime: `${metrics.requests.avgResponseTime}ms`,
          errorRate: metrics.requests.total > 0 ? 
            `${Math.round(metrics.requests.errors / metrics.requests.total * 100)}%` : '0%'
        }
      }
    });

    logger.info('성능 메트릭 조회 완료', {
      requestedBy: req.ip,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('성능 메트릭 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '성능 메트릭을 가져오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
};

/**
 * 성능 메트릭 리셋 엔드포인트
 */
export const resetMetricsEndpoint = (req, res) => {
  try {
    performanceMonitor.resetMetrics();
    
    res.json({
      success: true,
      message: '성능 메트릭이 리셋되었습니다.',
      timestamp: new Date().toISOString()
    });

    logger.info('성능 메트릭 리셋 완료', {
      requestedBy: req.ip,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('성능 메트릭 리셋 실패:', error);
    res.status(500).json({
      success: false,
      error: '성능 메트릭 리셋 중 오류가 발생했습니다.',
      message: error.message
    });
  }
};

/**
 * 가비지 컬렉션 강제 실행 엔드포인트
 */
export const forceGCEndpoint = (req, res) => {
  try {
    const beforeMemory = process.memoryUsage();
    performanceMonitor.forceGarbageCollection();
    const afterMemory = process.memoryUsage();

    const beforeMB = Math.round(beforeMemory.heapUsed / 1024 / 1024);
    const afterMB = Math.round(afterMemory.heapUsed / 1024 / 1024);
    const freedMB = beforeMB - afterMB;

    res.json({
      success: true,
      message: '가비지 컬렉션이 실행되었습니다.',
      memoryStats: {
        before: `${beforeMB}MB`,
        after: `${afterMB}MB`,
        freed: `${freedMB}MB`
      },
      timestamp: new Date().toISOString()
    });

    logger.info('가비지 컬렉션 강제 실행 완료', {
      memoryFreed: `${freedMB}MB`,
      requestedBy: req.ip,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('가비지 컬렉션 실행 실패:', error);
    res.status(500).json({
      success: false,
      error: '가비지 컬렉션 실행 중 오류가 발생했습니다.',
      message: error.message
    });
  }
};