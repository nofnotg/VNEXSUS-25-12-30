/**
 * 성능 모니터링 API 라우트
 * 성능 메트릭 조회, 리셋, 가비지 컬렉션 등의 기능을 제공합니다.
 * @module routes/performanceRoutes
 */

import express from 'express';
import { 
  performanceMetricsEndpoint, 
  resetMetricsEndpoint, 
  forceGCEndpoint 
} from '../middleware/performanceMiddleware.js';
import performanceMonitor from '../utils/performanceMonitor.js';
import { createLogger } from '../utils/enhancedLogger.js';

const router = express.Router();
const logger = createLogger('PERFORMANCE_ROUTES');

/**
 * 성능 메트릭 조회
 * GET /api/performance/metrics
 */
router.get('/metrics', performanceMetricsEndpoint);

/**
 * 성능 메트릭 리셋
 * POST /api/performance/reset
 */
router.post('/reset', resetMetricsEndpoint);

/**
 * 가비지 컬렉션 강제 실행
 * POST /api/performance/gc
 */
router.post('/gc', forceGCEndpoint);

/**
 * 성능 모니터링 시작/중지
 * POST /api/performance/monitoring
 */
router.post('/monitoring', (req, res) => {
  try {
    const { action, interval } = req.body;

    if (action === 'start') {
      const monitoringInterval = interval || 30000;
      performanceMonitor.startMonitoring(monitoringInterval);
      
      res.json({
        success: true,
        message: `성능 모니터링이 시작되었습니다. (간격: ${monitoringInterval}ms)`,
        interval: monitoringInterval,
        timestamp: new Date().toISOString()
      });

      logger.info(`성능 모니터링 시작 - 간격: ${monitoringInterval}ms`, {
        requestedBy: req.ip
      });

    } else if (action === 'stop') {
      performanceMonitor.stopMonitoring();
      
      res.json({
        success: true,
        message: '성능 모니터링이 중지되었습니다.',
        timestamp: new Date().toISOString()
      });

      logger.info('성능 모니터링 중지', {
        requestedBy: req.ip
      });

    } else {
      res.status(400).json({
        success: false,
        error: '잘못된 액션입니다. "start" 또는 "stop"을 사용하세요.',
        validActions: ['start', 'stop']
      });
    }

  } catch (error) {
    logger.error('성능 모니터링 제어 실패:', error);
    res.status(500).json({
      success: false,
      error: '성능 모니터링 제어 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * 성능 상태 요약
 * GET /api/performance/status
 */
router.get('/status', (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics();
    const memoryUsage = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    const systemMemoryUsage = ((metrics.system.totalMemory - metrics.system.freeMemory) / metrics.system.totalMemory) * 100;
    const errorRate = metrics.requests.total > 0 ? (metrics.requests.errors / metrics.requests.total) * 100 : 0;

    // 상태 판정
    let status = 'healthy';
    const issues = [];

    if (memoryUsage > 85) {
      status = 'warning';
      issues.push(`높은 힙 메모리 사용량: ${Math.round(memoryUsage)}%`);
    }

    if (systemMemoryUsage > 90) {
      status = 'warning';
      issues.push(`높은 시스템 메모리 사용량: ${Math.round(systemMemoryUsage)}%`);
    }

    if (metrics.cpu.usage > 90) {
      status = 'critical';
      issues.push(`높은 CPU 사용량: ${metrics.cpu.usage}%`);
    }

    if (metrics.requests.avgResponseTime > 5000) {
      status = 'warning';
      issues.push(`느린 평균 응답 시간: ${metrics.requests.avgResponseTime}ms`);
    }

    if (errorRate > 10) {
      status = 'critical';
      issues.push(`높은 에러율: ${Math.round(errorRate)}%`);
    }

    res.json({
      success: true,
      status,
      issues,
      summary: {
        memoryUsage: `${Math.round(memoryUsage)}%`,
        cpuUsage: `${metrics.cpu.usage}%`,
        avgResponseTime: `${metrics.requests.avgResponseTime}ms`,
        errorRate: `${Math.round(errorRate)}%`,
        activeRequests: metrics.requests.active,
        uptime: `${Math.floor(metrics.system.uptime / 60)}분`
      },
      timestamp: new Date().toISOString()
    });

    logger.debug('성능 상태 조회 완료', {
      status,
      issueCount: issues.length,
      requestedBy: req.ip
    });

  } catch (error) {
    logger.error('성능 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '성능 상태 조회 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * 성능 히스토리 (간단한 구현)
 * GET /api/performance/history
 */
router.get('/history', (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics();
    
    // 최근 응답 시간 히스토리 (최대 100개)
    const responseTimeHistory = metrics.requests.responseTimes.slice(-50).map((time, index) => ({
      index: index + 1,
      responseTime: time,
      timestamp: new Date(Date.now() - (50 - index) * 1000).toISOString()
    }));

    res.json({
      success: true,
      history: {
        responseTimes: responseTimeHistory,
        summary: {
          min: Math.min(...metrics.requests.responseTimes),
          max: Math.max(...metrics.requests.responseTimes),
          avg: metrics.requests.avgResponseTime,
          count: metrics.requests.responseTimes.length
        }
      },
      timestamp: new Date().toISOString()
    });

    logger.debug('성능 히스토리 조회 완료', {
      historyCount: responseTimeHistory.length,
      requestedBy: req.ip
    });

  } catch (error) {
    logger.error('성능 히스토리 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '성능 히스토리 조회 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 라우터 초기화 로그
logger.info('성능 모니터링 라우트가 초기화되었습니다.');

export default router;