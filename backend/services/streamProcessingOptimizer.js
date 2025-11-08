/**
 * Stream Processing Optimizer Service
 * 
 * 대용량 파일 처리 시 메모리 효율성을 극대화하는 스트림 처리 최적화 서비스
 * 
 * 핵심 기능:
 * 1. 적응형 청크 크기 조절
 * 2. 백프레셔 관리 및 플로우 제어
 * 3. 메모리 기반 스트림 라우팅
 * 4. 병렬 스트림 처리
 * 5. 스트림 풀링 및 재사용
 * 6. 실시간 성능 모니터링
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const stream = require('stream');
const { pipeline, Readable, Transform, Writable } = require('stream');
const { promisify } = require('util');
const EventEmitter = require('events');
import { createLogger } from '../utils/enhancedLogger.js';
import { globalMemoryOptimizer } from '../utils/memoryOptimizer.js';

const pipelineAsync = promisify(pipeline);
const logger = createLogger('STREAM_OPTIMIZER');

class StreamProcessingOptimizer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // 기본 청크 크기 설정
            baseChunkSize: options.baseChunkSize || 64 * 1024, // 64KB
            minChunkSize: options.minChunkSize || 16 * 1024,   // 16KB
            maxChunkSize: options.maxChunkSize || 1024 * 1024, // 1MB
            
            // 메모리 임계값
            memoryThreshold: options.memoryThreshold || 0.8, // 80%
            criticalMemoryThreshold: options.criticalMemoryThreshold || 0.9, // 90%
            
            // 스트림 풀 설정
            maxStreamPoolSize: options.maxStreamPoolSize || 10,
            streamIdleTimeout: options.streamIdleTimeout || 5 * 60 * 1000, // 5분
            
            // 병렬 처리 설정
            maxConcurrentStreams: options.maxConcurrentStreams || 4,
            backpressureThreshold: options.backpressureThreshold || 16, // 16개 청크
            
            // 성능 모니터링
            enableMetrics: options.enableMetrics !== false,
            metricsInterval: options.metricsInterval || 30000, // 30초
            
            ...options
        };
        
        // 스트림 풀 및 관리
        this.streamPool = new Map();
        this.activeStreams = new Map();
        this.streamMetrics = new Map();
        
        // 적응형 청크 크기 관리
        this.adaptiveChunkSizes = new Map();
        this.performanceHistory = [];
        
        // 백프레셔 관리
        this.backpressureQueue = [];
        this.processingQueue = [];
        
        // 메트릭 수집
        this.metrics = {
            totalStreamsProcessed: 0,
            totalBytesProcessed: 0,
            averageProcessingSpeed: 0,
            memoryEfficiencyRatio: 0,
            backpressureEvents: 0,
            poolHitRate: 0,
            adaptiveOptimizations: 0
        };
        
        this.initializeOptimizer();
    }
    
    /**
     * 최적화기 초기화
     */
    initializeOptimizer() {
        // 메트릭 수집 시작
        if (this.options.enableMetrics) {
            this.startMetricsCollection();
        }
        
        // 스트림 풀 정리 스케줄러
        this.poolCleanupInterval = setInterval(() => {
            this.cleanupStreamPool();
        }, this.options.streamIdleTimeout);
        
        // 메모리 모니터링
        this.memoryMonitorInterval = setInterval(() => {
            this.monitorMemoryUsage();
        }, 10000); // 10초마다
        
        logger.info('Stream Processing Optimizer initialized', {
            options: this.options,
            poolSize: this.streamPool.size
        });
    }
    
    /**
     * 대용량 파일 스트림 처리 (메인 메서드)
     * @param {Readable} inputStream - 입력 스트림
     * @param {Function} processingFunction - 처리 함수
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Object>} 처리 결과
     */
    async processLargeFileStream(inputStream, processingFunction, options = {}) {
        const streamId = this.generateStreamId();
        const startTime = Date.now();
        
        try {
            // 메모리 상태 확인
            const memoryStatus = this.checkMemoryStatus();
            if (memoryStatus.critical) {
                throw new Error('Critical memory usage detected. Cannot start new stream processing.');
            }
            
            // 적응형 청크 크기 계산
            const chunkSize = this.calculateAdaptiveChunkSize(options);
            
            // 스트림 풀에서 재사용 가능한 스트림 찾기
            const optimizedStream = this.getOptimizedStream(chunkSize, options);
            
            // 백프레셔 관리 설정
            const backpressureController = this.createBackpressureController();
            
            // 처리 결과 수집
            const results = [];
            let totalBytes = 0;
            let chunkCount = 0;
            
            // 변환 스트림 생성
            const transformStream = new Transform({
                objectMode: false,
                highWaterMark: chunkSize,
                transform: async (chunk, encoding, callback) => {
                    try {
                        chunkCount++;
                        totalBytes += chunk.length;
                        
                        // 백프레셔 체크
                        if (await backpressureController.checkBackpressure(chunkCount)) {
                            await backpressureController.waitForRelief();
                        }
                        
                        // 메모리 사용량 모니터링
                        if (chunkCount % 100 === 0) {
                            await this.monitorStreamMemory(streamId, chunkCount, totalBytes);
                        }
                        
                        // 처리 함수 실행
                        const processed = await processingFunction(chunk, {
                            chunkIndex: chunkCount,
                            totalBytes,
                            streamId
                        });
                        
                        results.push(processed);
                        callback(null, processed);
                        
                    } catch (error) {
                        logger.error('Stream chunk processing failed', {
                            streamId,
                            chunkIndex: chunkCount,
                            error: error.message
                        });
                        callback(error);
                    }
                }
            });
            
            // 출력 스트림 생성
            const outputStream = new Writable({
                objectMode: true,
                write(chunk, encoding, callback) {
                    // 결과 처리 (필요시 추가 로직)
                    callback();
                }
            });
            
            // 스트림 파이프라인 실행
            await pipelineAsync(
                inputStream,
                optimizedStream,
                transformStream,
                outputStream
            );
            
            const processingTime = Date.now() - startTime;
            
            // 성능 메트릭 업데이트
            this.updatePerformanceMetrics(streamId, {
                processingTime,
                totalBytes,
                chunkCount,
                chunkSize,
                memoryEfficient: !memoryStatus.warning
            });
            
            // 스트림을 풀로 반환
            this.returnStreamToPool(optimizedStream);
            
            logger.info('Large file stream processing completed', {
                streamId,
                processingTimeMs: processingTime,
                totalMB: (totalBytes / 1024 / 1024).toFixed(2),
                chunksProcessed: chunkCount,
                avgChunkSize: Math.round(totalBytes / chunkCount),
                throughputMBps: ((totalBytes / 1024 / 1024) / (processingTime / 1000)).toFixed(2)
            });
            
            return {
                success: true,
                streamId,
                results,
                metrics: {
                    processingTime,
                    totalBytes,
                    chunkCount,
                    throughput: totalBytes / (processingTime / 1000),
                    memoryEfficient: !memoryStatus.warning
                }
            };
            
        } catch (error) {
            logger.error('Large file stream processing failed', {
                streamId,
                error: error.message,
                processingTime: Date.now() - startTime
            });
            
            // 실패한 스트림 정리
            this.cleanupFailedStream(streamId);
            
            throw error;
        }
    }
    
    /**
     * 병렬 스트림 처리
     * @param {Array} inputStreams - 입력 스트림 배열
     * @param {Function} processingFunction - 처리 함수
     * @param {Object} options - 처리 옵션
     * @returns {Promise<Array>} 처리 결과 배열
     */
    async processMultipleStreams(inputStreams, processingFunction, options = {}) {
        const maxConcurrency = Math.min(
            inputStreams.length,
            this.options.maxConcurrentStreams,
            options.maxConcurrency || this.options.maxConcurrentStreams
        );
        
        logger.info('Starting parallel stream processing', {
            streamCount: inputStreams.length,
            maxConcurrency
        });
        
        const results = [];
        const semaphore = new Semaphore(maxConcurrency);
        
        const processingPromises = inputStreams.map(async (inputStream, index) => {
            await semaphore.acquire();
            
            try {
                const result = await this.processLargeFileStream(
                    inputStream,
                    processingFunction,
                    { ...options, streamIndex: index }
                );
                results[index] = result;
                return result;
            } finally {
                semaphore.release();
            }
        });
        
        await Promise.all(processingPromises);
        
        logger.info('Parallel stream processing completed', {
            streamCount: inputStreams.length,
            successCount: results.filter(r => r.success).length
        });
        
        return results;
    }
    
    /**
     * 적응형 청크 크기 계산
     * @param {Object} options - 처리 옵션
     * @returns {number} 최적화된 청크 크기
     */
    calculateAdaptiveChunkSize(options = {}) {
        const memoryStatus = this.checkMemoryStatus();
        const systemLoad = this.getSystemLoad();
        
        let chunkSize = this.options.baseChunkSize;
        
        // 메모리 상태에 따른 조절
        if (memoryStatus.critical) {
            chunkSize = this.options.minChunkSize;
        } else if (memoryStatus.warning) {
            chunkSize = Math.max(
                this.options.minChunkSize,
                chunkSize * 0.5
            );
        } else if (memoryStatus.optimal) {
            chunkSize = Math.min(
                this.options.maxChunkSize,
                chunkSize * 1.5
            );
        }
        
        // 시스템 로드에 따른 조절
        if (systemLoad > 0.8) {
            chunkSize = Math.max(
                this.options.minChunkSize,
                chunkSize * 0.7
            );
        }
        
        // 과거 성능 데이터 기반 조절
        const historicalOptimal = this.getHistoricalOptimalChunkSize();
        if (historicalOptimal) {
            chunkSize = Math.round((chunkSize + historicalOptimal) / 2);
        }
        
        // 옵션에서 지정된 크기 고려
        if (options.preferredChunkSize) {
            chunkSize = Math.min(chunkSize, options.preferredChunkSize);
        }
        
        logger.debug('Adaptive chunk size calculated', {
            baseSize: this.options.baseChunkSize,
            adaptedSize: chunkSize,
            memoryStatus: memoryStatus.level,
            systemLoad,
            historicalOptimal
        });
        
        return chunkSize;
    }
    
    /**
     * 백프레셔 컨트롤러 생성
     * @returns {Object} 백프레셔 컨트롤러
     */
    createBackpressureController() {
        let pendingChunks = 0;
        const maxPending = this.options.backpressureThreshold;
        
        return {
            async checkBackpressure(chunkCount) {
                pendingChunks++;
                
                if (pendingChunks > maxPending) {
                    this.metrics.backpressureEvents++;
                    logger.warn('Backpressure detected', {
                        pendingChunks,
                        maxPending,
                        chunkCount
                    });
                    return true;
                }
                return false;
            },
            
            async waitForRelief() {
                while (pendingChunks > maxPending * 0.7) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                logger.debug('Backpressure relief achieved', { pendingChunks });
            },
            
            releaseChunk() {
                pendingChunks = Math.max(0, pendingChunks - 1);
            }
        };
    }
    
    /**
     * 최적화된 스트림 가져오기 (풀에서 재사용)
     * @param {number} chunkSize - 청크 크기
     * @param {Object} options - 옵션
     * @returns {Transform} 최적화된 변환 스트림
     */
    getOptimizedStream(chunkSize, options = {}) {
        const poolKey = `${chunkSize}_${JSON.stringify(options)}`;
        
        // 풀에서 재사용 가능한 스트림 찾기
        if (this.streamPool.has(poolKey)) {
            const pooledStreams = this.streamPool.get(poolKey);
            if (pooledStreams.length > 0) {
                const stream = pooledStreams.pop();
                this.metrics.poolHitRate++;
                logger.debug('Reusing stream from pool', { poolKey, poolSize: pooledStreams.length });
                return stream;
            }
        }
        
        // 새 스트림 생성
        const optimizedStream = new Transform({
            objectMode: false,
            highWaterMark: chunkSize,
            transform(chunk, encoding, callback) {
                // 기본 패스스루 변환
                callback(null, chunk);
            }
        });
        
        // 스트림 메타데이터 설정
        optimizedStream._streamMetadata = {
            chunkSize,
            createdAt: Date.now(),
            poolKey,
            usageCount: 0
        };
        
        logger.debug('Created new optimized stream', { poolKey, chunkSize });
        return optimizedStream;
    }
    
    /**
     * 스트림을 풀로 반환
     * @param {Transform} stream - 반환할 스트림
     */
    returnStreamToPool(stream) {
        if (!stream._streamMetadata) return;
        
        const { poolKey } = stream._streamMetadata;
        stream._streamMetadata.usageCount++;
        
        // 풀 크기 제한 확인
        if (!this.streamPool.has(poolKey)) {
            this.streamPool.set(poolKey, []);
        }
        
        const pooledStreams = this.streamPool.get(poolKey);
        if (pooledStreams.length < this.options.maxStreamPoolSize) {
            // 스트림 리셋
            stream.removeAllListeners();
            stream._streamMetadata.returnedAt = Date.now();
            
            pooledStreams.push(stream);
            logger.debug('Stream returned to pool', { 
                poolKey, 
                poolSize: pooledStreams.length,
                usageCount: stream._streamMetadata.usageCount
            });
        }
    }
    
    /**
     * 메모리 상태 확인
     * @returns {Object} 메모리 상태 정보
     */
    checkMemoryStatus() {
        const memUsage = process.memoryUsage();
        const totalMemory = require('os').totalmem();
        const usageRatio = memUsage.heapUsed / totalMemory;
        
        let level = 'optimal';
        let critical = false;
        let warning = false;
        
        if (usageRatio > this.options.criticalMemoryThreshold) {
            level = 'critical';
            critical = true;
            warning = true;
        } else if (usageRatio > this.options.memoryThreshold) {
            level = 'warning';
            warning = true;
        }
        
        return {
            level,
            critical,
            warning,
            optimal: !warning,
            usageRatio,
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
            totalMemoryMB: Math.round(totalMemory / 1024 / 1024)
        };
    }
    
    /**
     * 시스템 로드 가져오기
     * @returns {number} 시스템 로드 (0-1)
     */
    getSystemLoad() {
        const loadavg = require('os').loadavg();
        const cpuCount = require('os').cpus().length;
        return Math.min(1, loadavg[0] / cpuCount);
    }
    
    /**
     * 과거 최적 청크 크기 가져오기
     * @returns {number|null} 최적 청크 크기
     */
    getHistoricalOptimalChunkSize() {
        if (this.performanceHistory.length < 5) return null;
        
        // 최근 성능 데이터에서 최적 청크 크기 계산
        const recentData = this.performanceHistory.slice(-10);
        const bestPerformance = recentData.reduce((best, current) => {
            const currentThroughput = current.totalBytes / current.processingTime;
            const bestThroughput = best.totalBytes / best.processingTime;
            return currentThroughput > bestThroughput ? current : best;
        });
        
        return bestPerformance.chunkSize;
    }
    
    /**
     * 스트림 메모리 모니터링
     * @param {string} streamId - 스트림 ID
     * @param {number} chunkCount - 처리된 청크 수
     * @param {number} totalBytes - 총 처리 바이트
     */
    async monitorStreamMemory(streamId, chunkCount, totalBytes) {
        const memoryStatus = this.checkMemoryStatus();
        
        if (memoryStatus.warning) {
            logger.warn('High memory usage during stream processing', {
                streamId,
                chunkCount,
                totalMB: (totalBytes / 1024 / 1024).toFixed(2),
                memoryLevel: memoryStatus.level,
                heapUsedMB: memoryStatus.heapUsedMB
            });
            
            // 메모리 정리 트리거
            if (memoryStatus.critical) {
                await globalMemoryOptimizer.forceGarbageCollection();
            }
        }
        
        // 스트림 메트릭 업데이트
        this.streamMetrics.set(streamId, {
            chunkCount,
            totalBytes,
            memoryStatus: memoryStatus.level,
            timestamp: Date.now()
        });
    }
    
    /**
     * 성능 메트릭 업데이트
     * @param {string} streamId - 스트림 ID
     * @param {Object} metrics - 메트릭 데이터
     */
    updatePerformanceMetrics(streamId, metrics) {
        // 전역 메트릭 업데이트
        this.metrics.totalStreamsProcessed++;
        this.metrics.totalBytesProcessed += metrics.totalBytes;
        
        const throughput = metrics.totalBytes / (metrics.processingTime / 1000);
        this.metrics.averageProcessingSpeed = 
            (this.metrics.averageProcessingSpeed + throughput) / 2;
        
        if (metrics.memoryEfficient) {
            this.metrics.memoryEfficiencyRatio = 
                (this.metrics.memoryEfficiencyRatio + 1) / 2;
        }
        
        // 성능 히스토리 추가
        this.performanceHistory.push({
            streamId,
            timestamp: Date.now(),
            ...metrics
        });
        
        // 히스토리 크기 제한
        if (this.performanceHistory.length > 100) {
            this.performanceHistory = this.performanceHistory.slice(-50);
        }
        
        // 적응형 최적화 트리거
        if (this.performanceHistory.length % 10 === 0) {
            this.triggerAdaptiveOptimization();
        }
    }
    
    /**
     * 적응형 최적화 트리거
     */
    triggerAdaptiveOptimization() {
        this.metrics.adaptiveOptimizations++;
        
        // 성능 트렌드 분석
        const recentPerformance = this.performanceHistory.slice(-10);
        const avgThroughput = recentPerformance.reduce((sum, p) => 
            sum + (p.totalBytes / p.processingTime), 0) / recentPerformance.length;
        
        // 최적화 권장사항 생성
        const recommendations = this.generateOptimizationRecommendations(recentPerformance);
        
        logger.info('Adaptive optimization triggered', {
            avgThroughputMBps: (avgThroughput / 1024 / 1024 * 1000).toFixed(2),
            recommendations: recommendations.length,
            totalOptimizations: this.metrics.adaptiveOptimizations
        });
        
        this.emit('optimization', { recommendations, avgThroughput });
    }
    
    /**
     * 최적화 권장사항 생성
     * @param {Array} performanceData - 성능 데이터
     * @returns {Array} 권장사항 배열
     */
    generateOptimizationRecommendations(performanceData) {
        const recommendations = [];
        
        // 청크 크기 최적화 권장
        const chunkSizes = performanceData.map(p => p.chunkSize);
        const avgChunkSize = chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length;
        const bestPerformance = performanceData.reduce((best, current) => {
            const currentThroughput = current.totalBytes / current.processingTime;
            const bestThroughput = best.totalBytes / best.processingTime;
            return currentThroughput > bestThroughput ? current : best;
        });
        
        if (Math.abs(avgChunkSize - bestPerformance.chunkSize) > 16384) { // 16KB 차이
            recommendations.push({
                type: 'chunk_size',
                current: Math.round(avgChunkSize),
                recommended: bestPerformance.chunkSize,
                reason: 'Better throughput observed with different chunk size'
            });
        }
        
        // 메모리 효율성 권장
        const memoryIssues = performanceData.filter(p => !p.memoryEfficient).length;
        if (memoryIssues > performanceData.length * 0.3) {
            recommendations.push({
                type: 'memory_optimization',
                issue: 'frequent_memory_pressure',
                recommendation: 'Consider reducing concurrent streams or chunk sizes',
                frequency: `${Math.round(memoryIssues / performanceData.length * 100)}%`
            });
        }
        
        return recommendations;
    }
    
    /**
     * 스트림 풀 정리
     */
    cleanupStreamPool() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [poolKey, streams] of this.streamPool.entries()) {
            const activeStreams = streams.filter(stream => {
                const age = now - (stream._streamMetadata?.returnedAt || 0);
                if (age > this.options.streamIdleTimeout) {
                    cleanedCount++;
                    return false;
                }
                return true;
            });
            
            if (activeStreams.length !== streams.length) {
                this.streamPool.set(poolKey, activeStreams);
            }
            
            // 빈 풀 제거
            if (activeStreams.length === 0) {
                this.streamPool.delete(poolKey);
            }
        }
        
        if (cleanedCount > 0) {
            logger.debug('Stream pool cleanup completed', {
                cleanedStreams: cleanedCount,
                remainingPools: this.streamPool.size
            });
        }
    }
    
    /**
     * 메모리 사용량 모니터링
     */
    monitorMemoryUsage() {
        const memoryStatus = this.checkMemoryStatus();
        
        if (memoryStatus.warning) {
            logger.warn('Memory usage warning during stream processing', {
                level: memoryStatus.level,
                usageRatio: memoryStatus.usageRatio.toFixed(3),
                heapUsedMB: memoryStatus.heapUsedMB,
                activeStreams: this.activeStreams.size,
                poolSize: this.streamPool.size
            });
            
            // 메모리 압박 시 풀 크기 축소
            if (memoryStatus.critical) {
                this.emergencyPoolCleanup();
            }
        }
    }
    
    /**
     * 긴급 풀 정리
     */
    emergencyPoolCleanup() {
        let cleanedCount = 0;
        
        for (const [poolKey, streams] of this.streamPool.entries()) {
            // 각 풀의 50% 정리
            const keepCount = Math.floor(streams.length / 2);
            const removed = streams.splice(keepCount);
            cleanedCount += removed.length;
        }
        
        logger.warn('Emergency pool cleanup executed', {
            cleanedStreams: cleanedCount,
            reason: 'critical_memory_usage'
        });
    }
    
    /**
     * 실패한 스트림 정리
     * @param {string} streamId - 스트림 ID
     */
    cleanupFailedStream(streamId) {
        this.activeStreams.delete(streamId);
        this.streamMetrics.delete(streamId);
        
        logger.debug('Failed stream cleaned up', { streamId });
    }
    
    /**
     * 메트릭 수집 시작
     */
    startMetricsCollection() {
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, this.options.metricsInterval);
        
        logger.debug('Metrics collection started', {
            interval: this.options.metricsInterval
        });
    }
    
    /**
     * 메트릭 수집
     */
    collectMetrics() {
        const memoryStatus = this.checkMemoryStatus();
        const systemLoad = this.getSystemLoad();
        
        const currentMetrics = {
            timestamp: new Date().toISOString(),
            memory: memoryStatus,
            systemLoad,
            activeStreams: this.activeStreams.size,
            poolSize: this.streamPool.size,
            ...this.metrics
        };
        
        this.emit('metrics', currentMetrics);
        
        logger.debug('Metrics collected', {
            activeStreams: currentMetrics.activeStreams,
            poolSize: currentMetrics.poolSize,
            memoryLevel: memoryStatus.level,
            totalProcessed: this.metrics.totalStreamsProcessed
        });
    }
    
    /**
     * 스트림 ID 생성
     * @returns {string} 고유 스트림 ID
     */
    generateStreamId() {
        return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 현재 메트릭 가져오기
     * @returns {Object} 현재 메트릭
     */
    getMetrics() {
        return {
            ...this.metrics,
            activeStreams: this.activeStreams.size,
            poolSize: this.streamPool.size,
            memoryStatus: this.checkMemoryStatus(),
            systemLoad: this.getSystemLoad(),
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 최적화기 종료
     */
    destroy() {
        // 인터벌 정리
        if (this.poolCleanupInterval) {
            clearInterval(this.poolCleanupInterval);
        }
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
        }
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        // 활성 스트림 정리
        this.activeStreams.clear();
        this.streamPool.clear();
        this.streamMetrics.clear();
        
        logger.info('Stream Processing Optimizer destroyed', {
            finalMetrics: this.getMetrics()
        });
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

// 전역 스트림 처리 최적화기 인스턴스
const globalStreamOptimizer = new StreamProcessingOptimizer();

// 프로세스 종료 시 정리
process.on('exit', () => {
    globalStreamOptimizer.destroy();
});

process.on('SIGINT', () => {
    globalStreamOptimizer.destroy();
    process.exit(0);
});

export {
    StreamProcessingOptimizer,
    globalStreamOptimizer
};