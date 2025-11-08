// memoryOptimizer.js - 메모리 최적화 유틸리티
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

import { createLogger } from './enhancedLogger.js';
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);

const logger = createLogger('MemoryOptimizer');

/**
 * 고정 길이 링버퍼 클래스
 */
class RingBuffer {
    constructor(capacity = 10) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
    }

    /**
     * 요소 추가
     */
    push(item) {
        this.buffer[this.tail] = item;
        this.tail = (this.tail + 1) % this.capacity;
        
        if (this.size < this.capacity) {
            this.size++;
        } else {
            // 버퍼가 가득 찬 경우 head 이동
            this.head = (this.head + 1) % this.capacity;
        }
    }

    /**
     * 현재 크기 반환
     */
    get length() {
        return this.size;
    }

    /**
     * 배열로 변환 (순서대로)
     */
    toArray() {
        if (this.size === 0) return [];
        
        const result = [];
        for (let i = 0; i < this.size; i++) {
            const index = (this.head + i) % this.capacity;
            result.push(this.buffer[index]);
        }
        return result;
    }

    /**
     * 마지막 n개 요소 반환
     */
    slice(start = 0, end = this.size) {
        const array = this.toArray();
        return array.slice(start, end);
    }

    /**
     * 버퍼 초기화
     */
    clear() {
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        this.buffer.fill(undefined);
    }

    /**
     * 특정 인덱스의 요소 접근
     */
    get(index) {
        if (index < 0 || index >= this.size) {
            return undefined;
        }
        const actualIndex = (this.head + index) % this.capacity;
        return this.buffer[actualIndex];
    }

    /**
     * 마지막 요소 반환
     */
    last() {
        if (this.size === 0) return undefined;
        const lastIndex = (this.tail - 1 + this.capacity) % this.capacity;
        return this.buffer[lastIndex];
    }

    /**
     * 첫 번째 요소 반환
     */
    first() {
        if (this.size === 0) return undefined;
        return this.buffer[this.head];
    }
}

class MemoryOptimizer {
    constructor(options = {}) {
        this.options = {
            maxMemoryUsage: options.maxMemoryUsage || 512 * 1024 * 1024, // 512MB
            gcThreshold: options.gcThreshold || 0.8, // 80%
            streamChunkSize: options.streamChunkSize || 64 * 1024, // 64KB
            monitorInterval: options.monitorInterval || 30000, // 30초
            historySize: options.historySize || 10, // 링버퍼 크기
            ...options
        };
        
        this.memoryStats = {
            peakUsage: 0,
            gcCount: 0,
            streamCount: 0,
            optimizationCount: 0
        };
        
        this.activeStreams = new Set();
        this.memoryLeakDetector = new Map();
        this.memoryHistory = new RingBuffer(this.options.historySize);
        this.peakMemoryUsage = 0;
        
        // 메모리 모니터링 시작
        this.startMemoryMonitoring();
        
        logger.info('MemoryOptimizer initialized', this.options);
    }
    
    /**
     * 메모리 모니터링 시작
     */
    startMemoryMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.checkMemoryUsage();
            this.detectMemoryLeaks();
        }, this.options.monitorInterval);
    }
    
    /**
     * 메모리 모니터링 중지
     */
    stopMemoryMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }
    
    /**
     * 메모리 사용량 확인 및 최적화 (개선된 버전)
     */
    checkMemoryUsage() {
        const memUsage = process.memoryUsage();
        const currentUsage = memUsage.heapUsed;
        const totalHeap = memUsage.heapTotal;
        const usagePercentage = (currentUsage / totalHeap) * 100;
        
        // 동적 임계값 조정
        const adaptiveThreshold = this.calculateAdaptiveThreshold(memUsage);
        
        // 피크 사용량 업데이트
        if (currentUsage > this.peakMemoryUsage) {
            this.peakMemoryUsage = currentUsage;
        }
        
        // 메모리 사용량 히스토리 업데이트 (링버퍼 자동 관리)
        this.memoryHistory.push({
            timestamp: Date.now(),
            heapUsed: currentUsage,
            heapTotal: totalHeap,
            usagePercentage: usagePercentage
        });
        
        // 임계값 초과 시 처리
        if (currentUsage > adaptiveThreshold) {
            logger.warn('Memory usage exceeds adaptive threshold', {
                currentUsage: this.formatBytes(currentUsage),
                threshold: this.formatBytes(adaptiveThreshold),
                usagePercentage: usagePercentage.toFixed(2) + '%',
                peakUsage: this.formatBytes(this.peakMemoryUsage)
            });
            
            // 단계별 메모리 정리
            this.performTieredCleanup(usagePercentage);
        }
        
        return {
            currentUsage,
            totalHeap,
            usagePercentage,
            threshold: adaptiveThreshold,
            peakUsage: this.peakMemoryUsage,
            trend: this.calculateMemoryTrend()
        };
    }
    
    /**
     * 적응형 임계값 계산
     */
    calculateAdaptiveThreshold(memUsage) {
        const baseThreshold = this.options.maxMemoryUsage;
        const availableMemory = memUsage.heapTotal - memUsage.heapUsed;
        const systemLoad = this.getSystemLoad();
        
        // 시스템 부하와 사용 가능한 메모리에 따라 임계값 조정
        let adaptiveFactor = 1.0;
        
        if (systemLoad > 0.8) {
            adaptiveFactor = 0.7; // 높은 부하시 더 보수적으로
        } else if (availableMemory > baseThreshold * 2) {
            adaptiveFactor = 1.3; // 여유 메모리가 많으면 더 관대하게
        }
        
        return Math.min(baseThreshold * adaptiveFactor, memUsage.heapTotal * 0.9);
    }
    
    /**
     * 시스템 부하 추정
     */
    getSystemLoad() {
        if (this.memoryHistory.length < 3) return 0.5;
        
        const recent = this.memoryHistory.slice(-3);
        const avgUsage = recent.reduce((sum, entry) => sum + entry.usagePercentage, 0) / recent.length;
        
        return Math.min(avgUsage / 100, 1.0);
    }
    
    /**
     * 단계별 메모리 정리
     */
    performTieredCleanup(usagePercentage) {
        if (usagePercentage > 90) {
            // 긴급 정리 (90% 초과)
            this.performEmergencyCleanup();
        } else if (usagePercentage > 80) {
            // 적극적 정리 (80-90%)
            this.performAggressiveCleanup();
        } else if (usagePercentage > 70) {
            // 일반 정리 (70-80%)
            this.forceGarbageCollection();
        }
    }
    
    /**
     * 긴급 메모리 정리
     */
    performEmergencyCleanup() {
        logger.warn('Performing emergency memory cleanup');
        
        // 1. 즉시 가비지 컬렉션
        if (global.gc) {
            global.gc();
            global.gc(); // 두 번 실행으로 더 철저한 정리
        }
        
        // 2. 활성 스트림 정리
        this.cleanupActiveStreams();
        
        // 3. 캐시 정리 (있다면)
        this.clearCaches();
        
        // 4. 메모리 사용량 재확인
        const afterCleanup = process.memoryUsage();
        logger.info('Emergency cleanup completed', {
            memoryFreed: this.formatBytes(this.peakMemoryUsage - afterCleanup.heapUsed),
            currentUsage: this.formatBytes(afterCleanup.heapUsed)
        });
    }
    
    /**
     * 적극적 메모리 정리
     */
    performAggressiveCleanup() {
        logger.info('Performing aggressive memory cleanup');
        
        // 1. 가비지 컬렉션
        if (global.gc) {
            global.gc();
        }
        
        // 2. 오래된 스트림 정리
        this.cleanupOldStreams();
        
        // 3. 메모리 압축 시도
        this.compactMemory();
    }
    
    /**
     * 활성 스트림 정리
     */
    cleanupActiveStreams() {
        let cleanedCount = 0;
        
        this.activeStreams.forEach((stream, id) => {
            try {
                if (stream && typeof stream.destroy === 'function') {
                    stream.destroy();
                    cleanedCount++;
                }
            } catch (error) {
                logger.warn(`Failed to cleanup stream ${id}`, { error: error.message });
            }
        });
        
        this.activeStreams.clear();
        
        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} active streams`);
        }
    }
    
    /**
     * 오래된 스트림 정리
     */
    cleanupOldStreams() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5분
        let cleanedCount = 0;
        
        this.activeStreams.forEach((stream, id) => {
            if (stream.createdAt && (now - stream.createdAt) > maxAge) {
                try {
                    if (typeof stream.destroy === 'function') {
                        stream.destroy();
                        cleanedCount++;
                    }
                    this.activeStreams.delete(id);
                } catch (error) {
                    logger.warn(`Failed to cleanup old stream ${id}`, { error: error.message });
                }
            }
        });
        
        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} old streams`);
        }
    }
    
    /**
     * 캐시 정리
     */
    clearCaches() {
        // 전역 캐시가 있다면 정리
        if (global.appCache && typeof global.appCache.clear === 'function') {
            global.appCache.clear();
            logger.info('Application cache cleared');
        }
        
        // 모듈 캐시 일부 정리 (주의: 필요한 모듈은 유지)
        this.clearModuleCache();
    }
    
    /**
     * 모듈 캐시 선택적 정리
     */
    clearModuleCache() {
        const cacheKeys = Object.keys(require.cache);
        const temporaryModules = cacheKeys.filter(key => 
            key.includes('temp') || 
            key.includes('cache') || 
            key.includes('.tmp')
        );
        
        temporaryModules.forEach(key => {
            try {
                delete require.cache[key];
            } catch (error) {
                // 무시
            }
        });
        
        if (temporaryModules.length > 0) {
            logger.info(`Cleared ${temporaryModules.length} temporary modules from cache`);
        }
    }
    
    /**
     * 메모리 압축
     */
    compactMemory() {
        // V8 엔진의 메모리 압축 시도
        if (global.gc) {
            // 여러 번의 가비지 컬렉션으로 메모리 압축 효과
            for (let i = 0; i < 3; i++) {
                global.gc();
            }
        }
        
        // 힙 스냅샷 생성 (디버깅용, 프로덕션에서는 비활성화)
        if (process.env.NODE_ENV === 'development') {
            this.createHeapSnapshot();
        }
    }
    
    /**
     * 힙 스냅샷 생성
     */
    createHeapSnapshot() {
        try {
            const v8 = require('v8');
            const fs = require('fs');
            const path = require('path');
            
            const snapshotPath = path.join(process.cwd(), 'logs', `heap-${Date.now()}.heapsnapshot`);
            const snapshot = v8.getHeapSnapshot();
            const fileStream = fs.createWriteStream(snapshotPath);
            
            snapshot.pipe(fileStream);
            
            logger.info('Heap snapshot created', { path: snapshotPath });
        } catch (error) {
            logger.warn('Failed to create heap snapshot', { error: error.message });
        }
    }
    
    /**
     * 메모리 트렌드 계산 (개선된 버전)
     */
    calculateMemoryTrend() {
        if (this.memoryHistory.length < 3) return 'stable';
        
        const recent = this.memoryHistory.slice(-3);
        const trend = recent[2].heapUsed - recent[0].heapUsed;
        const threshold = 10 * 1024 * 1024; // 10MB
        const timeSpan = recent[2].timestamp - recent[0].timestamp;
        const trendRate = trend / (timeSpan / 1000); // bytes per second
        
        // 시간 기반 트렌드 분석 추가
        if (trend > threshold && trendRate > 1024 * 1024) return 'rapidly_increasing';
        if (trend > threshold) return 'increasing';
        if (trend < -threshold && trendRate < -1024 * 1024) return 'rapidly_decreasing';
        if (trend < -threshold) return 'decreasing';
        return 'stable';
    }
    
    /**
     * 바이트를 읽기 쉬운 형태로 포맷
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * 강제 가비지 컬렉션 실행
     */
    forceGarbageCollection() {
        if (global.gc) {
            const beforeGC = process.memoryUsage().heapUsed;
            global.gc();
            const afterGC = process.memoryUsage().heapUsed;
            const freedMB = (beforeGC - afterGC) / 1024 / 1024;
            
            this.memoryStats.gcCount++;
            
            logger.info('Garbage collection executed', {
                freedMB: freedMB.toFixed(2),
                beforeMB: (beforeGC / 1024 / 1024).toFixed(2),
                afterMB: (afterGC / 1024 / 1024).toFixed(2)
            });
            
            return freedMB;
        } else {
            logger.warn('Garbage collection not available. Start Node.js with --expose-gc flag');
            return 0;
        }
    }
    
    /**
     * 메모리 누수 감지
     */
    detectMemoryLeaks() {
        const currentTime = Date.now();
        const memUsage = process.memoryUsage();
        
        // 메모리 누수 패턴 감지 (지속적인 증가)
        if (this.memoryHistory.length >= 5) {
            const recent = this.memoryHistory.slice(-5);
            const isIncreasing = recent.every((curr, index) => {
                if (index === 0) return true;
                return curr.heapUsed > recent[index - 1].heapUsed;
            });
            
            if (isIncreasing) {
                const firstUsage = recent[0].heapUsed;
                const lastUsage = recent[recent.length - 1].heapUsed;
                const increaseMB = (lastUsage - firstUsage) / 1024 / 1024;
                
                if (increaseMB > 50) { // 50MB 이상 증가
                    logger.warn('Potential memory leak detected', {
                        increaseMB: increaseMB.toFixed(2),
                        timeSpanMinutes: ((currentTime - recent[0].timestamp) / 60000).toFixed(2)
                    });
                }
            }
        }
    }
    
    /**
     * 스트림 기반 파일 처리
     * @param {ReadableStream} inputStream - 입력 스트림
     * @param {WritableStream} outputStream - 출력 스트림
     * @param {Function} transformFn - 변환 함수
     */
    async processStreamWithOptimization(inputStream, outputStream, transformFn = null) {
        const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.activeStreams.add(streamId);
        this.memoryStats.streamCount++;
        
        try {
            let processedChunks = 0;
            let totalBytes = 0;
            
            const transformStream = new stream.Transform({
                objectMode: false,
                highWaterMark: this.options.streamChunkSize,
                transform(chunk, encoding, callback) {
                    try {
                        processedChunks++;
                        totalBytes += chunk.length;
                        
                        // 주기적으로 메모리 체크
                        if (processedChunks % 100 === 0) {
                            const memUsage = process.memoryUsage();
                            if (memUsage.heapUsed > this.options.maxMemoryUsage * 0.9) {
                                logger.warn('High memory usage during stream processing', {
                                    streamId,
                                    processedChunks,
                                    totalMB: (totalBytes / 1024 / 1024).toFixed(2),
                                    memoryMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2)
                                });
                            }
                        }
                        
                        // 변환 함수 적용
                        const result = transformFn ? transformFn(chunk) : chunk;
                        callback(null, result);
                    } catch (error) {
                        callback(error);
                    }
                }
            });
            
            await pipeline(inputStream, transformStream, outputStream);
            
            logger.info('Stream processing completed', {
                streamId,
                processedChunks,
                totalMB: (totalBytes / 1024 / 1024).toFixed(2)
            });
            
        } catch (error) {
            logger.error('Stream processing failed', {
                streamId,
                error: error.message
            });
            throw error;
        } finally {
            this.activeStreams.delete(streamId);
        }
    }
    
    /**
     * 대용량 객체 최적화
     * @param {Object} largeObject - 최적화할 객체
     * @param {Object} options - 최적화 옵션
     */
    optimizeLargeObject(largeObject, options = {}) {
        const {
            maxDepth = 10,
            maxArrayLength = 1000,
            maxStringLength = 10000,
            removeCircularRefs = true
        } = options;
        
        this.memoryStats.optimizationCount++;
        
        const seen = new WeakSet();
        
        const optimize = (obj, depth = 0) => {
            if (depth > maxDepth) {
                return '[Max Depth Reached]';
            }
            
            if (obj === null || typeof obj !== 'object') {
                return obj;
            }
            
            if (removeCircularRefs && seen.has(obj)) {
                return '[Circular Reference]';
            }
            
            seen.add(obj);
            
            if (Array.isArray(obj)) {
                if (obj.length > maxArrayLength) {
                    const truncated = obj.slice(0, maxArrayLength).map(item => optimize(item, depth + 1));
                    truncated.push(`[Truncated: ${obj.length - maxArrayLength} more items]`);
                    return truncated;
                }
                return obj.map(item => optimize(item, depth + 1));
            }
            
            const optimized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'string' && value.length > maxStringLength) {
                    optimized[key] = value.substring(0, maxStringLength) + `[Truncated: ${value.length - maxStringLength} more chars]`;
                } else {
                    optimized[key] = optimize(value, depth + 1);
                }
            }
            
            return optimized;
        };
        
        return optimize(largeObject);
    }
    
    /**
     * 메모리 사용량 프로파일링
     * @param {Function} fn - 프로파일링할 함수
     * @param {string} label - 프로파일 라벨
     */
    async profileMemoryUsage(fn, label = 'function') {
        const beforeMemory = process.memoryUsage();
        const startTime = Date.now();
        
        try {
            const result = await fn();
            
            const afterMemory = process.memoryUsage();
            const endTime = Date.now();
            
            const memoryDiff = {
                heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
                heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
                external: afterMemory.external - beforeMemory.external,
                rss: afterMemory.rss - beforeMemory.rss
            };
            
            logger.info('Memory profile completed', {
                label,
                duration: endTime - startTime,
                memoryDiff: {
                    heapUsedMB: (memoryDiff.heapUsed / 1024 / 1024).toFixed(2),
                    heapTotalMB: (memoryDiff.heapTotal / 1024 / 1024).toFixed(2),
                    externalMB: (memoryDiff.external / 1024 / 1024).toFixed(2),
                    rssMB: (memoryDiff.rss / 1024 / 1024).toFixed(2)
                }
            });
            
            return result;
        } catch (error) {
            logger.error('Memory profile failed', {
                label,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * 메모리 통계 조회
     */
    getMemoryStats() {
        const currentMemory = this.checkMemoryUsage();
        
        return {
            ...this.memoryStats,
            current: currentMemory,
            activeStreams: this.activeStreams.size,
            peakUsageMB: (this.memoryStats.peakUsage / 1024 / 1024).toFixed(2),
            options: this.options
        };
    }
    
    /**
     * 메모리 최적화 권장사항
     */
    getOptimizationRecommendations() {
        const stats = this.getMemoryStats();
        const recommendations = [];
        
        if (stats.current.usageRatio > 0.8) {
            recommendations.push({
                type: 'critical',
                message: 'Memory usage is critically high. Consider increasing memory limit or optimizing code.',
                action: 'Immediate garbage collection recommended'
            });
        }
        
        if (stats.activeStreams > 10) {
            recommendations.push({
                type: 'warning',
                message: 'High number of active streams detected.',
                action: 'Consider implementing stream pooling or limiting concurrent streams'
            });
        }
        
        if (stats.gcCount > 100) {
            recommendations.push({
                type: 'info',
                message: 'Frequent garbage collection detected.',
                action: 'Review memory allocation patterns and consider object pooling'
            });
        }
        
        return recommendations;
    }
    
    /**
     * 메모리 최적화기 종료
     */
    destroy() {
        this.stopMemoryMonitoring();
        
        // 활성 스트림 정리
        this.activeStreams.clear();
        
        logger.info('MemoryOptimizer destroyed', {
            finalStats: this.getMemoryStats()
        });
    }
}

// 전역 메모리 최적화기 인스턴스 (더 현실적인 설정으로 조정)
const globalMemoryOptimizer = new MemoryOptimizer({
    maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB로 증가
    gcThreshold: 0.85, // 85%로 조정
    monitorInterval: 60000, // 1분으로 증가하여 빈번한 체크 방지
    historySize: 20 // 히스토리 크기 증가
});

// 프로세스 종료 시 정리
process.on('exit', () => {
    globalMemoryOptimizer.destroy();
});

process.on('SIGINT', () => {
    globalMemoryOptimizer.destroy();
    process.exit(0);
});

export {
    MemoryOptimizer,
    globalMemoryOptimizer
};