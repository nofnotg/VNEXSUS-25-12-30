import express from 'express';
import HybridController from '../controllers/hybridController.js';
import IntelligentRouter from '../services/intelligentRouter.js';

const router = express.Router();
const hybridController = new HybridController();
const intelligentRouter = new IntelligentRouter();

/**
 * 대시보드 실시간 메트릭 API
 * GET /api/dashboard/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    // 하이브리드 컨트롤러에서 메트릭 데이터 직접 수집
    const systemMetrics = {
      processing: {
        averageTime: hybridController.stats.averageProcessingTime || 0,
        throughput: hybridController.calculateThroughput() || 0,
        successRate: hybridController.calculateSuccessRate() || 0,
        errorRate: hybridController.calculateErrorRate() || 0,
        totalRequests: hybridController.stats.totalRequests || 0
      },
      cache: {
        l1: { hits: 0, misses: 0, size: 0 },
        l2: { hits: 0, misses: 0, size: 0 },
        l3: { hits: 0, misses: 0, size: 0 }
      },
      memory: process.memoryUsage(),
      engines: {
        legacy: { averageTime: 1200, processedCount: 0, successRate: 95 },
        hybrid: { averageTime: 800, processedCount: 0, successRate: 98 },
        core: { averageTime: 600, processedCount: 0, successRate: 99 }
      }
    };
    
    // 추가 대시보드 전용 메트릭
    const dashboardMetrics = {
      ...systemMetrics,
      routing: {
        totalRouted: intelligentRouter.getRoutingStats().totalRouted,
        routingDistribution: intelligentRouter.getRoutingStats().routingDistribution,
        averageConfidence: intelligentRouter.getRoutingStats().averageConfidence
      },
      optimization: {
        cacheStats: {
          l1: { hits: 0, misses: 0, size: 0 },
          l2: { hits: 0, misses: 0, size: 0 },
          l3: { hits: 0, misses: 0, size: 0 }
        },
        memoryOptimization: {
          averageUsage: 0.45,
          maxUsage: 0.67,
          currentUsage: 0.52
        },
        parallelProcessing: {
          maxWorkers: 8,
          activeWorkers: 2,
          queueLength: 0
        }
      },
      alerts: generateAlerts()
    };
    
    res.json({
      success: true,
      data: dashboardMetrics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 대시보드 메트릭 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 실시간 로그 스트림 API
 * GET /api/dashboard/logs
 */
router.get('/logs', (req, res) => {
  try {
    const { level = 'all', limit = 100 } = req.query;
    
    // SSE (Server-Sent Events) 설정
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // 실시간 로그 전송 (예시)
    const sendLog = (logData) => {
      res.write(`data: ${JSON.stringify(logData)}\n\n`);
    };
    
    // 초기 로그 데이터 전송
    const initialLogs = getRecentLogs(level, limit);
    initialLogs.forEach(log => sendLog(log));
    
    // 주기적으로 새로운 로그 전송 (실제 구현에서는 로그 이벤트 리스너 사용)
    const logInterval = setInterval(() => {
      const newLogs = getNewLogs(level);
      newLogs.forEach(log => sendLog(log));
    }, 1000);
    
    // 클라이언트 연결 종료 시 정리
    req.on('close', () => {
      clearInterval(logInterval);
    });
    
  } catch (error) {
    console.error('❌ 실시간 로그 스트림 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 시스템 알림 API
 * GET /api/dashboard/alerts
 */
router.get('/alerts', (req, res) => {
  try {
    const alerts = generateAlerts();
    
    res.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 시스템 알림 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 성능 비교 분석 API
 * GET /api/dashboard/performance-comparison
 */
router.get('/performance-comparison', async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    
    const comparisonData = {
      engines: {
        legacy: {
          averageTime: 1200,
          successRate: 95,
          throughput: 45,
          memoryUsage: 85
        },
        hybrid: {
          averageTime: 800,
          successRate: 98,
          throughput: 75,
          memoryUsage: 65
        },
        core: {
          averageTime: 600,
          successRate: 99,
          throughput: 120,
          memoryUsage: 55
        }
      },
      trends: generatePerformanceTrends(timeRange),
      recommendations: generatePerformanceRecommendations()
    };
    
    res.json({
      success: true,
      data: comparisonData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 성능 비교 분석 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 헬퍼 함수들
 */

function generateAlerts() {
  const alerts = [];
  
  // 메모리 사용량 체크
  const memoryUsage = process.memoryUsage();
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  if (memoryUsagePercent > 80) {
    alerts.push({
      id: 'memory-high',
      type: 'warning',
      title: '높은 메모리 사용량',
      message: `메모리 사용량이 ${memoryUsagePercent.toFixed(1)}%입니다`,
      timestamp: new Date().toISOString(),
      severity: 'medium'
    });
  }
  
  // 처리 시간 체크 (예시)
  const avgProcessingTime = hybridController.stats.averageProcessingTime;
  if (avgProcessingTime > 2000) {
    alerts.push({
      id: 'processing-slow',
      type: 'error',
      title: '처리 속도 저하',
      message: `평균 처리 시간이 ${avgProcessingTime}ms입니다`,
      timestamp: new Date().toISOString(),
      severity: 'high'
    });
  }
  
  return alerts;
}

function getRecentLogs(level, limit) {
  // 실제 구현에서는 로그 저장소에서 조회
  return [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '하이브리드 시스템 정상 작동 중',
      source: 'HybridController'
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 1000).toISOString(),
      level: 'success',
      message: '문서 처리 완료 (처리시간: 850ms)',
      source: 'IntelligentRouter'
    }
  ].slice(0, limit);
}

function getNewLogs(level) {
  // 실제 구현에서는 새로운 로그만 반환
  return [
    {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `실시간 로그 업데이트 - ${new Date().toLocaleTimeString()}`,
      source: 'System'
    }
  ];
}

function generatePerformanceTrends(timeRange) {
  // 실제 구현에서는 시계열 데이터 조회
  const now = Date.now();
  const trends = [];
  
  for (let i = 0; i < 24; i++) {
    trends.push({
      timestamp: new Date(now - (i * 60 * 60 * 1000)).toISOString(),
      legacy: Math.random() * 1000 + 800,
      hybrid: Math.random() * 600 + 600,
      core: Math.random() * 400 + 400
    });
  }
  
  return trends.reverse();
}

function generatePerformanceRecommendations() {
  return [
    {
      id: 'cache-optimization',
      title: '캐시 최적화',
      description: 'L1 캐시 히트율이 낮습니다. 캐시 크기를 늘려보세요.',
      priority: 'medium',
      impact: 'performance'
    },
    {
      id: 'parallel-processing',
      title: '병렬 처리 확장',
      description: '워커 풀 크기를 늘려 처리량을 향상시킬 수 있습니다.',
      priority: 'high',
      impact: 'throughput'
    }
  ];
}

export default router;