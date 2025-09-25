/**
 * 실시간 성능 모니터링 시스템
 * 처리 진행 상황, 정확도, 시스템 성능을 실시간으로 추적
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            processing: {
                totalTasks: 0,
                completedTasks: 0,
                failedTasks: 0,
                averageProcessingTime: 0,
                currentProgress: 0
            },
            accuracy: {
                dynamicWeightingAccuracy: 0,
                hybridStrategyAccuracy: 0,
                overallAccuracy: 0,
                accuracyTrend: []
            },
            system: {
                memoryUsage: 0,
                cpuUsage: 0,
                responseTime: 0,
                errorRate: 0
            },
            realtime: {
                activeConnections: 0,
                lastUpdate: new Date(),
                updateInterval: 1000 // 1초
            }
        };
        
        this.listeners = new Set();
        this.taskHistory = [];
        this.accuracyHistory = [];
        this.startTime = Date.now();
        
        // 실시간 업데이트 시작
        this.startRealTimeUpdates();
    }
    
    /**
     * 실시간 업데이트 시작
     */
    startRealTimeUpdates() {
        setInterval(() => {
            this.updateSystemMetrics();
            this.notifyListeners();
        }, this.metrics.realtime.updateInterval);
    }
    
    /**
     * 리스너 등록
     */
    addListener(callback) {
        this.listeners.add(callback);
        this.metrics.realtime.activeConnections++;
        return () => {
            this.listeners.delete(callback);
            this.metrics.realtime.activeConnections--;
        };
    }
    
    /**
     * 모든 리스너에게 업데이트 알림
     */
    notifyListeners() {
        const data = this.getCurrentMetrics();
        this.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('리스너 알림 오류:', error);
            }
        });
    }
    
    /**
     * 작업 시작 기록
     */
    startTask(taskId, taskType = 'general') {
        const task = {
            id: taskId,
            type: taskType,
            startTime: Date.now(),
            status: 'processing'
        };
        
        this.taskHistory.push(task);
        this.metrics.processing.totalTasks++;
        this.updateProgress();
        
        return task;
    }
    
    /**
     * 작업 완료 기록
     */
    completeTask(taskId, result = {}) {
        const task = this.taskHistory.find(t => t.id === taskId);
        if (task) {
            task.endTime = Date.now();
            task.processingTime = task.endTime - task.startTime;
            task.status = 'completed';
            task.result = result;
            
            this.metrics.processing.completedTasks++;
            this.updateAverageProcessingTime();
            this.updateProgress();
            
            // 정확도 업데이트
            if (result.accuracy) {
                this.updateAccuracy(result.accuracy);
            }
        }
    }
    
    /**
     * 작업 실패 기록
     */
    failTask(taskId, error) {
        const task = this.taskHistory.find(t => t.id === taskId);
        if (task) {
            task.endTime = Date.now();
            task.processingTime = task.endTime - task.startTime;
            task.status = 'failed';
            task.error = error;
            
            this.metrics.processing.failedTasks++;
            this.metrics.system.errorRate = 
                this.metrics.processing.failedTasks / this.metrics.processing.totalTasks;
            this.updateProgress();
        }
    }
    
    /**
     * 정확도 업데이트
     */
    updateAccuracy(accuracyData) {
        if (accuracyData.dynamicWeighting) {
            this.metrics.accuracy.dynamicWeightingAccuracy = accuracyData.dynamicWeighting;
        }
        
        if (accuracyData.hybridStrategy) {
            this.metrics.accuracy.hybridStrategyAccuracy = accuracyData.hybridStrategy;
        }
        
        if (accuracyData.overall) {
            this.metrics.accuracy.overallAccuracy = accuracyData.overall;
            
            // 정확도 트렌드 업데이트
            this.accuracyHistory.push({
                timestamp: Date.now(),
                accuracy: accuracyData.overall
            });
            
            // 최근 10개 기록만 유지
            if (this.accuracyHistory.length > 10) {
                this.accuracyHistory.shift();
            }
            
            this.metrics.accuracy.accuracyTrend = this.accuracyHistory.map(h => h.accuracy);
        }
    }
    
    /**
     * 진행률 업데이트
     */
    updateProgress() {
        if (this.metrics.processing.totalTasks > 0) {
            this.metrics.processing.currentProgress = 
                (this.metrics.processing.completedTasks / this.metrics.processing.totalTasks) * 100;
        }
    }
    
    /**
     * 평균 처리 시간 업데이트
     */
    updateAverageProcessingTime() {
        const completedTasks = this.taskHistory.filter(t => t.status === 'completed');
        if (completedTasks.length > 0) {
            const totalTime = completedTasks.reduce((sum, task) => sum + task.processingTime, 0);
            this.metrics.processing.averageProcessingTime = totalTime / completedTasks.length;
        }
    }
    
    /**
     * 시스템 메트릭 업데이트
     */
    updateSystemMetrics() {
        // 메모리 사용량
        if (process.memoryUsage) {
            const memUsage = process.memoryUsage();
            this.metrics.system.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
        }
        
        // 응답 시간 (최근 완료된 작업 기준)
        const recentTasks = this.taskHistory
            .filter(t => t.status === 'completed')
            .slice(-5);
        
        if (recentTasks.length > 0) {
            const avgResponseTime = recentTasks.reduce((sum, task) => 
                sum + task.processingTime, 0) / recentTasks.length;
            this.metrics.system.responseTime = avgResponseTime;
        }
        
        this.metrics.realtime.lastUpdate = new Date();
    }
    
    /**
     * 현재 메트릭 반환
     */
    getCurrentMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.startTime,
            timestamp: Date.now()
        };
    }
    
    /**
     * 성능 리포트 생성
     */
    generatePerformanceReport() {
        const metrics = this.getCurrentMetrics();
        
        return {
            summary: {
                totalTasks: metrics.processing.totalTasks,
                successRate: metrics.processing.totalTasks > 0 ? 
                    ((metrics.processing.completedTasks / metrics.processing.totalTasks) * 100).toFixed(2) + '%' : '0%',
                averageAccuracy: metrics.accuracy.overallAccuracy.toFixed(2) + '%',
                averageProcessingTime: metrics.processing.averageProcessingTime.toFixed(2) + 'ms',
                uptime: this.formatUptime(metrics.uptime)
            },
            detailed: metrics,
            recommendations: this.generateRecommendations(metrics)
        };
    }
    
    /**
     * 성능 개선 권장사항 생성
     */
    generateRecommendations(metrics) {
        const recommendations = [];
        
        // 정확도 기반 권장사항
        if (metrics.accuracy.overallAccuracy < 90) {
            recommendations.push({
                type: 'accuracy',
                priority: 'high',
                message: '전체 정확도가 90% 미만입니다. 하이브리드 전략 가중치 조정을 권장합니다.'
            });
        }
        
        // 성능 기반 권장사항
        if (metrics.processing.averageProcessingTime > 5000) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                message: '평균 처리 시간이 5초를 초과합니다. 처리 로직 최적화를 권장합니다.'
            });
        }
        
        // 오류율 기반 권장사항
        if (metrics.system.errorRate > 0.05) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                message: '오류율이 5%를 초과합니다. 오류 처리 로직을 점검해주세요.'
            });
        }
        
        return recommendations;
    }
    
    /**
     * 업타임 포맷팅
     */
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        return `${hours}시간 ${minutes % 60}분 ${seconds % 60}초`;
    }
    
    /**
     * 메트릭 초기화
     */
    reset() {
        this.metrics.processing = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            averageProcessingTime: 0,
            currentProgress: 0
        };
        
        this.taskHistory = [];
        this.accuracyHistory = [];
        this.startTime = Date.now();
    }
}

export default PerformanceMonitor;