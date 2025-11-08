// MemorySnapshot.js - 메모리 최적화 및 링 버퍼 시스템
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../../utils/logger.js';

class MemorySnapshot {
    constructor(options = {}) {
        this.options = {
            maxMemoryUsage: options.maxMemoryUsage || 512 * 1024 * 1024, // 512MB
            ringBufferSize: options.ringBufferSize || 100,
            compressionEnabled: options.compressionEnabled !== false,
            persistenceEnabled: options.persistenceEnabled !== false,
            cleanupInterval: options.cleanupInterval || 300000, // 5분
            ...options
        };

        // 링 버퍼 구조
        this.ringBuffer = {
            buffer: new Array(this.options.ringBufferSize),
            head: 0,
            tail: 0,
            size: 0,
            maxSize: this.options.ringBufferSize
        };

        // 메모리 풀
        this.memoryPools = {
            segments: [],
            entities: [],
            events: [],
            caseBundles: []
        };

        // 압축 캐시
        this.compressionCache = new Map();
        
        // 메모리 사용량 추적
        this.memoryUsage = {
            current: 0,
            peak: 0,
            allocated: 0,
            freed: 0
        };

        // 성능 메트릭
        this.performanceMetrics = {
            compressionRatio: 0,
            accessTime: 0,
            hitRate: 0,
            totalAccesses: 0,
            cacheHits: 0
        };

        // 정리 타이머 시작
        this.startCleanupTimer();

        logService.info('MemorySnapshot initialized', { 
            options: this.options 
        });
    }

    /**
     * 케이스 번들을 메모리에 저장
     * @param {CaseBundle} caseBundle - 저장할 케이스 번들
     * @param {Object} metadata - 메타데이터
     * @returns {Promise<string>} 스냅샷 ID
     */
    async saveSnapshot(caseBundle, metadata = {}) {
        try {
            const startTime = Date.now();
            
            // 1. 메모리 사용량 확인
            await this.checkMemoryUsage();
            
            // 2. 스냅샷 생성
            const snapshot = {
                id: this.generateSnapshotId(),
                caseBundle: caseBundle,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    originalSize: this.calculateObjectSize(caseBundle),
                    version: '1.0.0'
                },
                accessCount: 0,
                lastAccessed: Date.now()
            };

            // 3. 압축 적용 (옵션)
            if (this.options.compressionEnabled) {
                snapshot.compressed = await this.compressData(caseBundle);
                snapshot.metadata.compressedSize = this.calculateObjectSize(snapshot.compressed);
                snapshot.metadata.compressionRatio = snapshot.metadata.originalSize / snapshot.metadata.compressedSize;
            }

            // 4. 링 버퍼에 저장
            this.addToRingBuffer(snapshot);

            // 5. 메모리 사용량 업데이트
            this.updateMemoryUsage(snapshot);

            // 6. 성능 메트릭 업데이트
            const processingTime = Date.now() - startTime;
            this.updatePerformanceMetrics('save', processingTime);

            logService.info('Snapshot saved', {
                snapshotId: snapshot.id,
                originalSize: snapshot.metadata.originalSize,
                compressedSize: snapshot.metadata.compressedSize,
                processingTime
            });

            return snapshot.id;

        } catch (error) {
            logService.error('Snapshot save failed', { 
                error: error.message 
            });
            throw new Error(`MemorySnapshot save failed: ${error.message}`);
        }
    }

    /**
     * 스냅샷 로드
     * @param {string} snapshotId - 스냅샷 ID
     * @returns {Promise<CaseBundle>} 케이스 번들
     */
    async loadSnapshot(snapshotId) {
        try {
            const startTime = Date.now();
            
            // 1. 링 버퍼에서 검색
            const snapshot = this.findInRingBuffer(snapshotId);
            
            if (!snapshot) {
                throw new Error(`Snapshot not found: ${snapshotId}`);
            }

            // 2. 액세스 카운트 업데이트
            snapshot.accessCount++;
            snapshot.lastAccessed = Date.now();

            // 3. 데이터 복원
            let caseBundle;
            if (snapshot.compressed) {
                // 압축 해제
                caseBundle = await this.decompressData(snapshot.compressed);
                this.performanceMetrics.cacheHits++;
            } else {
                caseBundle = snapshot.caseBundle;
            }

            // 4. 성능 메트릭 업데이트
            const processingTime = Date.now() - startTime;
            this.updatePerformanceMetrics('load', processingTime);
            this.performanceMetrics.totalAccesses++;

            logService.info('Snapshot loaded', {
                snapshotId: snapshotId,
                accessCount: snapshot.accessCount,
                processingTime
            });

            return caseBundle;

        } catch (error) {
            logService.error('Snapshot load failed', { 
                error: error.message 
            });
            throw new Error(`MemorySnapshot load failed: ${error.message}`);
        }
    }

    /**
     * 스냅샷 삭제
     * @param {string} snapshotId - 스냅샷 ID
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deleteSnapshot(snapshotId) {
        try {
            const snapshot = this.findInRingBuffer(snapshotId);
            
            if (!snapshot) {
                return false;
            }

            // 링 버퍼에서 제거
            this.removeFromRingBuffer(snapshotId);

            // 메모리 사용량 업데이트
            this.updateMemoryUsage(snapshot, true);

            // 압축 캐시에서 제거
            if (this.compressionCache.has(snapshotId)) {
                this.compressionCache.delete(snapshotId);
            }

            logService.info('Snapshot deleted', {
                snapshotId: snapshotId
            });

            return true;

        } catch (error) {
            logService.error('Snapshot delete failed', { 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * 메모리 사용량 확인 및 정리
     */
    async checkMemoryUsage() {
        const currentUsage = this.getCurrentMemoryUsage();
        
        if (currentUsage > this.options.maxMemoryUsage) {
            logService.info('Memory usage exceeded', {
                currentUsage: currentUsage,
                maxUsage: this.options.maxMemoryUsage
            });
            
            await this.performMemoryCleanup();
        }
    }

    /**
     * 메모리 정리 수행
     */
    async performMemoryCleanup() {
        try {
            const beforeUsage = this.getCurrentMemoryUsage();
            
            // 1. LRU 기반 정리
            await this.performLRUCleanup();
            
            // 2. 압축 캐시 정리
            await this.cleanupCompressionCache();
            
            // 3. 메모리 풀 정리
            await this.cleanupMemoryPools();
            
            // 4. 가비지 컬렉션 힌트
            if (global.gc) {
                global.gc();
            }
            
            const afterUsage = this.getCurrentMemoryUsage();
            const freedMemory = beforeUsage - afterUsage;
            
            logService.info('Memory cleanup completed', {
                beforeUsage: beforeUsage,
                afterUsage: afterUsage,
                freedMemory: freedMemory
            });

        } catch (error) {
            logService.error('Memory cleanup failed', {
                error: error.message 
            });
        }
    }

    /**
     * LRU 기반 정리
     */
    async performLRUCleanup() {
        const snapshots = this.getAllSnapshots()
            .sort((a, b) => a.lastAccessed - b.lastAccessed);
        
        // 가장 오래된 25% 제거
        const removeCount = Math.floor(snapshots.length * 0.25);
        
        for (let i = 0; i < removeCount; i++) {
            await this.deleteSnapshot(snapshots[i].id);
        }
    }

    /**
     * 데이터 압축
     * @param {Object} data - 압축할 데이터
     * @returns {Promise<Object>} 압축된 데이터
     */
    async compressData(data) {
        try {
            // JSON 직렬화
            const jsonString = JSON.stringify(data);
            
            // 간단한 압축 (실제로는 zlib 등 사용)
            const compressed = {
                data: this.simpleCompress(jsonString),
                originalLength: jsonString.length,
                algorithm: 'simple'
            };
            
            return compressed;

        } catch (error) {
            logService.error('Data compression failed', {
                error: error.message 
            });
            return data; // 압축 실패 시 원본 반환
        }
    }

    /**
     * 데이터 압축 해제
     * @param {Object} compressedData - 압축된 데이터
     * @returns {Promise<Object>} 원본 데이터
     */
    async decompressData(compressedData) {
        try {
            const decompressed = this.simpleDecompress(compressedData.data);
            return JSON.parse(decompressed);

        } catch (error) {
            logService.error('Data decompression failed', {
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * 링 버퍼에 추가
     */
    addToRingBuffer(snapshot) {
        // 버퍼가 가득 찬 경우 가장 오래된 항목 제거
        if (this.ringBuffer.size === this.ringBuffer.maxSize) {
            const oldSnapshot = this.ringBuffer.buffer[this.ringBuffer.tail];
            if (oldSnapshot) {
                this.updateMemoryUsage(oldSnapshot, true);
            }
            this.ringBuffer.tail = (this.ringBuffer.tail + 1) % this.ringBuffer.maxSize;
        } else {
            this.ringBuffer.size++;
        }

        // 새 항목 추가
        this.ringBuffer.buffer[this.ringBuffer.head] = snapshot;
        this.ringBuffer.head = (this.ringBuffer.head + 1) % this.ringBuffer.maxSize;
    }

    /**
     * 링 버퍼에서 검색
     */
    findInRingBuffer(snapshotId) {
        for (let i = 0; i < this.ringBuffer.size; i++) {
            const index = (this.ringBuffer.tail + i) % this.ringBuffer.maxSize;
            const snapshot = this.ringBuffer.buffer[index];
            
            if (snapshot && snapshot.id === snapshotId) {
                return snapshot;
            }
        }
        return null;
    }

    /**
     * 링 버퍼에서 제거
     */
    removeFromRingBuffer(snapshotId) {
        for (let i = 0; i < this.ringBuffer.size; i++) {
            const index = (this.ringBuffer.tail + i) % this.ringBuffer.maxSize;
            const snapshot = this.ringBuffer.buffer[index];
            
            if (snapshot && snapshot.id === snapshotId) {
                this.ringBuffer.buffer[index] = null;
                
                // 버퍼 재정렬 (간단한 구현)
                this.compactRingBuffer();
                break;
            }
        }
    }

    /**
     * 링 버퍼 압축
     */
    compactRingBuffer() {
        const validSnapshots = [];
        
        for (let i = 0; i < this.ringBuffer.size; i++) {
            const index = (this.ringBuffer.tail + i) % this.ringBuffer.maxSize;
            const snapshot = this.ringBuffer.buffer[index];
            
            if (snapshot) {
                validSnapshots.push(snapshot);
            }
        }

        // 버퍼 재초기화
        this.ringBuffer.buffer = new Array(this.ringBuffer.maxSize);
        this.ringBuffer.head = 0;
        this.ringBuffer.tail = 0;
        this.ringBuffer.size = 0;

        // 유효한 스냅샷 재추가
        for (const snapshot of validSnapshots) {
            this.addToRingBuffer(snapshot);
        }
    }

    /**
     * 모든 스냅샷 조회
     */
    getAllSnapshots() {
        const snapshots = [];
        
        for (let i = 0; i < this.ringBuffer.size; i++) {
            const index = (this.ringBuffer.tail + i) % this.ringBuffer.maxSize;
            const snapshot = this.ringBuffer.buffer[index];
            
            if (snapshot) {
                snapshots.push(snapshot);
            }
        }
        
        return snapshots;
    }

    /**
     * 메모리 사용량 업데이트
     */
    updateMemoryUsage(snapshot, isRemoval = false) {
        const size = snapshot.metadata.compressedSize || snapshot.metadata.originalSize;
        
        if (isRemoval) {
            this.memoryUsage.current -= size;
            this.memoryUsage.freed += size;
        } else {
            this.memoryUsage.current += size;
            this.memoryUsage.allocated += size;
            
            if (this.memoryUsage.current > this.memoryUsage.peak) {
                this.memoryUsage.peak = this.memoryUsage.current;
            }
        }
    }

    /**
     * 현재 메모리 사용량 조회
     */
    getCurrentMemoryUsage() {
        return this.memoryUsage.current;
    }

    /**
     * 성능 메트릭 업데이트
     */
    updatePerformanceMetrics(operation, processingTime) {
        this.performanceMetrics.accessTime = 
            (this.performanceMetrics.accessTime + processingTime) / 2;
        
        if (this.performanceMetrics.totalAccesses > 0) {
            this.performanceMetrics.hitRate = 
                this.performanceMetrics.cacheHits / this.performanceMetrics.totalAccesses;
        }
    }

    /**
     * 압축 캐시 정리
     */
    async cleanupCompressionCache() {
        const cacheSize = this.compressionCache.size;
        const maxCacheSize = Math.floor(this.options.ringBufferSize * 0.5);
        
        if (cacheSize > maxCacheSize) {
            const entries = Array.from(this.compressionCache.entries());
            const removeCount = cacheSize - maxCacheSize;
            
            // 가장 오래된 항목부터 제거
            for (let i = 0; i < removeCount; i++) {
                this.compressionCache.delete(entries[i][0]);
            }
        }
    }

    /**
     * 메모리 풀 정리
     */
    async cleanupMemoryPools() {
        for (const poolName in this.memoryPools) {
            const pool = this.memoryPools[poolName];
            
            // 풀 크기를 절반으로 줄임
            if (pool.length > 50) {
                this.memoryPools[poolName] = pool.slice(0, 25);
            }
        }
    }

    /**
     * 정리 타이머 시작
     */
    startCleanupTimer() {
        setInterval(async () => {
            await this.performMemoryCleanup();
        }, this.options.cleanupInterval);
    }

    /**
     * 객체 크기 계산
     */
    calculateObjectSize(obj) {
        const jsonString = JSON.stringify(obj);
        return Buffer.byteLength(jsonString, 'utf8');
    }

    /**
     * 스냅샷 ID 생성
     */
    generateSnapshotId() {
        return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 간단한 압축 (실제로는 더 효율적인 알고리즘 사용)
     */
    simpleCompress(data) {
        // RLE (Run Length Encoding) 기반 간단한 압축
        let compressed = '';
        let count = 1;
        let current = data[0];
        
        for (let i = 1; i < data.length; i++) {
            if (data[i] === current && count < 255) {
                count++;
            } else {
                compressed += String.fromCharCode(count) + current;
                current = data[i];
                count = 1;
            }
        }
        
        compressed += String.fromCharCode(count) + current;
        return compressed;
    }

    /**
     * 간단한 압축 해제
     */
    simpleDecompress(compressed) {
        let decompressed = '';
        
        for (let i = 0; i < compressed.length; i += 2) {
            const count = compressed.charCodeAt(i);
            const char = compressed[i + 1];
            
            decompressed += char.repeat(count);
        }
        
        return decompressed;
    }

    /**
     * 메모리 통계 조회
     */
    getMemoryStats() {
        return {
            usage: this.memoryUsage,
            ringBuffer: {
                size: this.ringBuffer.size,
                maxSize: this.ringBuffer.maxSize,
                utilization: this.ringBuffer.size / this.ringBuffer.maxSize
            },
            performance: this.performanceMetrics,
            compressionCache: {
                size: this.compressionCache.size,
                hitRate: this.performanceMetrics.hitRate
            }
        };
    }

    /**
     * 메모리 최적화 실행
     */
    optimizeMemory() {
        const stats = this.getMemoryStats();
        const optimizationResult = {
            beforeOptimization: {
                memoryUsage: stats.usage.current,
                cacheSize: this.compressionCache.size,
                ringBufferSize: this.ringBuffer.size
            },
            actions: [],
            afterOptimization: {}
        };

        // 메모리 사용량이 높으면 정리 수행
        if (stats.usage.current > this.options.maxMemoryUsage * 0.8) {
            this.performMemoryCleanup();
            optimizationResult.actions.push('memory_cleanup');
        }

        // 캐시 크기가 크면 압축 캐시 정리
        if (this.compressionCache.size > 100) {
            this.cleanupCompressionCache();
            optimizationResult.actions.push('cache_cleanup');
        }

        // 메모리 풀 정리
        this.cleanupMemoryPools();
        optimizationResult.actions.push('pool_cleanup');

        // 가비지 컬렉션 수행
        if (global.gc) {
            global.gc();
            optimizationResult.actions.push('garbage_collection');
        }

        // 최적화 후 상태 기록
        const afterStats = this.getMemoryStats();
        optimizationResult.afterOptimization = {
            memoryUsage: afterStats.usage.current,
            cacheSize: this.compressionCache.size,
            ringBufferSize: this.ringBuffer.size
        };

        logService.info(`Memory optimization completed: ${optimizationResult.actions.join(', ')}`);
        return optimizationResult;
    }

    /**
     * 메모리 최적화 제안
     */
    getOptimizationSuggestions() {
        const suggestions = [];
        const stats = this.getMemoryStats();
        
        if (stats.usage.current > this.options.maxMemoryUsage * 0.8) {
            suggestions.push({
                type: 'memory_usage',
                priority: 'high',
                description: '메모리 사용량이 80%를 초과했습니다. 정리가 필요합니다.'
            });
        }
        
        if (stats.performance.hitRate < 0.7) {
            suggestions.push({
                type: 'cache_efficiency',
                priority: 'medium',
                description: '캐시 적중률이 낮습니다. 링 버퍼 크기 증가를 고려하세요.'
            });
        }
        
        if (stats.ringBuffer.utilization > 0.9) {
            suggestions.push({
                type: 'buffer_size',
                priority: 'medium',
                description: '링 버퍼 사용률이 높습니다. 버퍼 크기 증가를 고려하세요.'
            });
        }
        
        return suggestions;
    }

    /**
     * 리소스 정리
     */
    cleanup() {
        // 모든 스냅샷 제거
        const snapshots = this.getAllSnapshots();
        for (const snapshot of snapshots) {
            this.deleteSnapshot(snapshot.id);
        }
        
        // 캐시 정리
        this.compressionCache.clear();
        
        // 메모리 풀 정리
        for (const poolName in this.memoryPools) {
            this.memoryPools[poolName] = [];
        }
        
        logService.info('MemorySnapshot cleanup completed');
    }
}

export default MemorySnapshot;