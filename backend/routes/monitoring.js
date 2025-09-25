/**
 * 실시간 모니터링 API 엔드포인트
 * 성능 메트릭, 진행 상황, 시스템 상태를 실시간으로 제공
 */

import express from 'express';
import PerformanceMonitor from '../services/PerformanceMonitor.js';

const router = express.Router();

// 전역 성능 모니터 인스턴스
const globalMonitor = new PerformanceMonitor();

/**
 * 실시간 메트릭 조회
 * GET /api/monitoring/metrics
 */
router.get('/metrics', (req, res) => {
    try {
        const metrics = globalMonitor.getCurrentMetrics();
        res.json({
            success: true,
            data: metrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 성능 리포트 생성
 * GET /api/monitoring/report
 */
router.get('/report', (req, res) => {
    try {
        const report = globalMonitor.generatePerformanceReport();
        res.json({
            success: true,
            data: report,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 실시간 스트리밍 (Server-Sent Events)
 * GET /api/monitoring/stream
 */
router.get('/stream', (req, res) => {
    // SSE 헤더 설정
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 클라이언트에게 연결 확인 메시지 전송
    res.write('data: {"type":"connected","message":"실시간 모니터링 연결됨"}\n\n');

    // 실시간 업데이트 리스너 등록
    const removeListener = globalMonitor.addListener((metrics) => {
        const data = {
            type: 'metrics',
            data: metrics,
            timestamp: new Date().toISOString()
        };
        
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    });

    // 클라이언트 연결 해제 시 리스너 제거
    req.on('close', () => {
        removeListener();
        res.end();
    });

    req.on('error', () => {
        removeListener();
        res.end();
    });
});

/**
 * 모니터링 상태 초기화
 * POST /api/monitoring/reset
 */
router.post('/reset', (req, res) => {
    try {
        globalMonitor.reset();
        res.json({
            success: true,
            message: '모니터링 상태가 초기화되었습니다.',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 특정 작업 상태 조회
 * GET /api/monitoring/task/:taskId
 */
router.get('/task/:taskId', (req, res) => {
    try {
        const { taskId } = req.params;
        const metrics = globalMonitor.getCurrentMetrics();
        const task = globalMonitor.taskHistory.find(t => t.id === taskId);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                error: '작업을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            data: {
                task,
                currentMetrics: metrics
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 시스템 상태 체크
 * GET /api/monitoring/health
 */
router.get('/health', (req, res) => {
    try {
        const metrics = globalMonitor.getCurrentMetrics();
        const isHealthy = {
            overall: true,
            checks: {
                errorRate: metrics.system.errorRate < 0.05,
                responseTime: metrics.system.responseTime < 5000,
                memoryUsage: metrics.system.memoryUsage < 1000, // 1GB
                activeConnections: metrics.realtime.activeConnections >= 0
            }
        };
        
        isHealthy.overall = Object.values(isHealthy.checks).every(check => check);
        
        const statusCode = isHealthy.overall ? 200 : 503;
        
        res.status(statusCode).json({
            success: isHealthy.overall,
            data: {
                status: isHealthy.overall ? 'healthy' : 'unhealthy',
                checks: isHealthy.checks,
                metrics: {
                    errorRate: `${(metrics.system.errorRate * 100).toFixed(2)}%`,
                    responseTime: `${metrics.system.responseTime.toFixed(2)}ms`,
                    memoryUsage: `${metrics.system.memoryUsage.toFixed(2)}MB`,
                    uptime: globalMonitor.formatUptime(metrics.uptime)
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 정확도 트렌드 조회
 * GET /api/monitoring/accuracy-trend
 */
router.get('/accuracy-trend', (req, res) => {
    try {
        const metrics = globalMonitor.getCurrentMetrics();
        const { limit = 10 } = req.query;
        
        const trend = globalMonitor.accuracyHistory
            .slice(-parseInt(limit))
            .map(entry => ({
                timestamp: new Date(entry.timestamp).toISOString(),
                accuracy: entry.accuracy
            }));
        
        res.json({
            success: true,
            data: {
                trend,
                current: {
                    overall: metrics.accuracy.overallAccuracy,
                    dynamicWeighting: metrics.accuracy.dynamicWeightingAccuracy,
                    hybridStrategy: metrics.accuracy.hybridStrategyAccuracy
                },
                statistics: {
                    average: trend.length > 0 ? 
                        trend.reduce((sum, t) => sum + t.accuracy, 0) / trend.length : 0,
                    min: trend.length > 0 ? Math.min(...trend.map(t => t.accuracy)) : 0,
                    max: trend.length > 0 ? Math.max(...trend.map(t => t.accuracy)) : 0
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 전역 모니터 인스턴스 내보내기 (다른 모듈에서 사용)
export default router;
export { globalMonitor };