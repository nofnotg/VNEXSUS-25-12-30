/**
 * 실시간 성능 최적화 시스템
 * 캐싱, 병렬 처리, 메모리 최적화를 통한 성능 향상
 */

import NodeCache from 'node-cache';
import cluster from 'cluster';
import os from 'os';

class PerformanceOptimizer {
    constructor() {
        // 다층 캐싱 시스템
        this.caches = {
            // L1: 빠른 메모리 캐시 (TTL: 5분)
            l1: new NodeCache({ stdTTL: 300, checkperiod: 60 }),
            // L2: 중간 캐시 (TTL: 30분)
            l2: new NodeCache({ stdTTL: 1800, checkperiod: 300 }),
            // L3: 장기 캐시 (TTL: 2시간)
            l3: new NodeCache({ stdTTL: 7200, checkperiod: 600 }),
            // 예측 캐시: 자주 사용될 것으로 예상되는 데이터
            predictive: new NodeCache({ stdTTL: 3600, checkperiod: 300 })
        };

        // 병렬 처리 풀
        this.workerPool = {
            maxWorkers: os.cpus().length,
            activeWorkers: 0,
            queue: [],
            workers: new Map()
        };

        // 메모리 관리
        this.memoryManager = {
            maxHeapUsage: 0.8, // 80% 임계점
            gcThreshold: 0.7,   // 70%에서 GC 유도
            cleanupInterval: 60000 // 1분마다 정리
        };

        // 성능 메트릭
        this.metrics = {
            cacheHits: { l1: 0, l2: 0, l3: 0, predictive: 0 },
            cacheMisses: { l1: 0, l2: 0, l3: 0, predictive: 0 },
            processingTimes: [],
            memoryUsage: [],
            parallelTasks: 0,
            cacheWarmingStats: {
                successful: 0,
                failed: 0,
                totalTime: 0
            }
        };

        // 캐시 사용 패턴 추적
        this.cachePatterns = {
            accessFrequency: new Map(), // 키별 접근 빈도
            accessTimes: new Map(),     // 키별 접근 시간
            keyRelationships: new Map(), // 키 간 관계 (함께 사용되는 패턴)
            popularKeys: new Set()       // 인기 키 목록
        };

        // 캐시 워밍 설정
        this.cacheWarming = {
            enabled: true,
            warmingInterval: 600000, // 10분마다
            maxWarmingTasks: 5,
            predictiveThreshold: 0.7 // 70% 확률 이상일 때 예측 캐싱
        };

        this.initializeOptimizer();
    }

    /**
     * 최적화 시스템 초기화
     */
    initializeOptimizer() {
        // 메모리 모니터링 시작
        this.startMemoryMonitoring();
        
        // 캐시 이벤트 리스너 설정
        this.setupCacheEventListeners();
        
        // 정기적인 성능 최적화 작업
        this.startPerformanceOptimization();

        // 캐시 워밍 시작
        if (this.cacheWarming.enabled) {
            this.startCacheWarming();
        }

        // 캐시 패턴 분석 시작
        this.startCachePatternAnalysis();
    }

    /**
     * 지능형 다층 캐싱 시스템
     */
    async getCachedResult(key, computeFunction, options = {}) {
        const { 
            level = 'auto', 
            ttl = null, 
            forceRefresh = false,
            enablePredictive = true 
        } = options;

        // 접근 패턴 기록
        this.recordCacheAccess(key);

        if (!forceRefresh) {
            // 예측 캐시 확인 (가장 높은 우선순위)
            if (enablePredictive) {
                let result = this.caches.predictive.get(key);
                if (result !== undefined) {
                    this.metrics.cacheHits.predictive++;
                    this.promoteToL1(key, result);
                    return { data: result, source: 'predictive_cache' };
                }
                this.metrics.cacheMisses.predictive++;
            }

            // L1 캐시 확인
            let result = this.caches.l1.get(key);
            if (result !== undefined) {
                this.metrics.cacheHits.l1++;
                return { data: result, source: 'l1_cache' };
            }
            this.metrics.cacheMisses.l1++;

            // L2 캐시 확인
            result = this.caches.l2.get(key);
            if (result !== undefined) {
                this.metrics.cacheHits.l2++;
                // L1으로 승격
                this.promoteToL1(key, result);
                return { data: result, source: 'l2_cache' };
            }
            this.metrics.cacheMisses.l2++;

            // L3 캐시 확인
            result = this.caches.l3.get(key);
            if (result !== undefined) {
                this.metrics.cacheHits.l3++;
                // L2로 승격
                this.promoteToL2(key, result);
                return { data: result, source: 'l3_cache' };
            }
            this.metrics.cacheMisses.l3++;
        }

        // 캐시 미스 - 새로 계산
        const startTime = Date.now();
        const result = await computeFunction();
        const processingTime = Date.now() - startTime;

        // 처리 시간과 접근 패턴에 따른 캐시 레벨 결정
        const cacheLevel = this.determineCacheLevel(processingTime, level, key);
        this.setCachedResult(key, result, cacheLevel, ttl);

        // 관련 키 예측 캐싱 트리거
        this.triggerPredictiveCaching(key, result);

        this.metrics.processingTimes.push(processingTime);
        
        return { 
            data: result, 
            source: 'computed', 
            processingTime,
            cacheLevel 
        };
    }

    /**
     * 캐시 접근 패턴 기록
     */
    recordCacheAccess(key) {
        const now = Date.now();
        
        // 접근 빈도 증가
        const frequency = this.cachePatterns.accessFrequency.get(key) || 0;
        this.cachePatterns.accessFrequency.set(key, frequency + 1);
        
        // 접근 시간 기록
        if (!this.cachePatterns.accessTimes.has(key)) {
            this.cachePatterns.accessTimes.set(key, []);
        }
        const times = this.cachePatterns.accessTimes.get(key);
        times.push(now);
        
        // 최근 100개 접근 시간만 유지
        if (times.length > 100) {
            times.splice(0, times.length - 100);
        }
        
        // 인기 키 업데이트
        if (frequency > 10) {
            this.cachePatterns.popularKeys.add(key);
        }
    }

    /**
     * L1 캐시로 승격
     */
    promoteToL1(key, result) {
        this.caches.l1.set(key, result);
    }

    /**
     * L2 캐시로 승격
     */
    promoteToL2(key, result) {
        this.caches.l2.set(key, result);
    }

    /**
     * 지능형 캐시 레벨 결정
     */
    determineCacheLevel(processingTime, preferredLevel, key) {
        if (preferredLevel !== 'auto') return preferredLevel;

        // 접근 빈도 고려
        const frequency = this.cachePatterns.accessFrequency.get(key) || 0;
        const isPopular = this.cachePatterns.popularKeys.has(key);

        // 인기 키는 더 높은 레벨 캐시에 저장
        if (isPopular || frequency > 20) {
            if (processingTime > 2000) return 'l3';
            if (processingTime > 500) return 'l2';
            return 'l1';
        }

        // 일반적인 레벨 결정
        if (processingTime > 5000) return 'l3';
        if (processingTime > 1000) return 'l2';
        return 'l1';
    }

    /**
     * 예측 캐싱 트리거
     */
    async triggerPredictiveCaching(key, result) {
        // 관련 키 찾기
        const relatedKeys = this.findRelatedKeys(key);
        
        for (const relatedKey of relatedKeys) {
            const probability = this.calculateCachingProbability(relatedKey);
            
            if (probability > this.cacheWarming.predictiveThreshold) {
                // 예측 캐시에 저장
                this.caches.predictive.set(relatedKey, result);
            }
        }
    }

    /**
     * 관련 키 찾기
     */
    findRelatedKeys(key) {
        const related = [];
        const keyParts = key.split('_');
        
        // 키의 일부를 공유하는 키들 찾기
        for (const [otherKey] of this.cachePatterns.accessFrequency) {
            if (otherKey !== key) {
                const otherParts = otherKey.split('_');
                const commonParts = keyParts.filter(part => otherParts.includes(part));
                
                if (commonParts.length > 0) {
                    related.push(otherKey);
                }
            }
        }
        
        return related.slice(0, 5); // 최대 5개만 반환
    }

    /**
     * 캐싱 확률 계산
     */
    calculateCachingProbability(key) {
        const frequency = this.cachePatterns.accessFrequency.get(key) || 0;
        const times = this.cachePatterns.accessTimes.get(key) || [];
        
        if (times.length < 2) return 0;
        
        // 최근 접근 패턴 분석
        const now = Date.now();
        const recentAccesses = times.filter(time => now - time < 3600000); // 1시간 내
        
        // 빈도와 최근성을 고려한 확률 계산
        const frequencyScore = Math.min(frequency / 50, 1); // 최대 1.0
        const recencyScore = recentAccesses.length / times.length;
        
        return (frequencyScore + recencyScore) / 2;
    }

    /**
     * 캐시 워밍 시작
     */
    startCacheWarming() {
        setInterval(() => {
            this.performCacheWarming();
        }, this.cacheWarming.warmingInterval);
    }

    /**
     * 캐시 워밍 수행
     */
    async performCacheWarming() {
        const startTime = Date.now();
        let successful = 0;
        let failed = 0;

        try {
            // 인기 키들을 예측 캐시로 워밍
            const popularKeys = Array.from(this.cachePatterns.popularKeys)
                .slice(0, this.cacheWarming.maxWarmingTasks);

            for (const key of popularKeys) {
                try {
                    // 캐시에 없는 인기 키들을 미리 로드
                    if (!this.isKeyInAnyCache(key)) {
                        await this.warmCacheForKey(key);
                        successful++;
                    }
                } catch (error) {
                    console.warn(`Cache warming failed for key ${key}:`, error.message);
                    failed++;
                }
            }

            // 통계 업데이트
            this.metrics.cacheWarmingStats.successful += successful;
            this.metrics.cacheWarmingStats.failed += failed;
            this.metrics.cacheWarmingStats.totalTime += Date.now() - startTime;

            console.log(`Cache warming completed: ${successful} successful, ${failed} failed`);
        } catch (error) {
            console.error('Cache warming error:', error);
        }
    }

    /**
     * 키가 어떤 캐시에든 있는지 확인
     */
    isKeyInAnyCache(key) {
        return this.caches.l1.has(key) || 
               this.caches.l2.has(key) || 
               this.caches.l3.has(key) || 
               this.caches.predictive.has(key);
    }

    /**
     * 특정 키에 대한 캐시 워밍
     */
    async warmCacheForKey(key) {
        // 키 패턴에 따른 데이터 생성 로직
        // 실제 구현에서는 키에 따른 적절한 데이터 생성 함수를 호출
        const mockData = { warmed: true, key, timestamp: Date.now() };
        this.caches.predictive.set(key, mockData);
    }

    /**
     * 캐시 패턴 분석 시작
     */
    startCachePatternAnalysis() {
        setInterval(() => {
            this.analyzeCachePatterns();
        }, 300000); // 5분마다 분석
    }

    /**
     * 캐시 패턴 분석
     */
    analyzeCachePatterns() {
        // 인기 키 업데이트
        this.updatePopularKeys();
        
        // 비효율적인 캐시 항목 정리
        this.cleanupIneffectiveCache();
        
        // 캐시 레벨 재조정
        this.rebalanceCacheLevels();
    }

    /**
     * 인기 키 업데이트
     */
    updatePopularKeys() {
        const threshold = 5; // 최소 5회 접근
        
        this.cachePatterns.popularKeys.clear();
        
        for (const [key, frequency] of this.cachePatterns.accessFrequency) {
            if (frequency >= threshold) {
                this.cachePatterns.popularKeys.add(key);
            }
        }
    }

    /**
     * 비효율적인 캐시 항목 정리
     */
    cleanupIneffectiveCache() {
        const now = Date.now();
        const inactiveThreshold = 3600000; // 1시간
        
        for (const [key, times] of this.cachePatterns.accessTimes) {
            const lastAccess = Math.max(...times);
            
            if (now - lastAccess > inactiveThreshold) {
                // 모든 캐시 레벨에서 제거
                this.caches.l1.del(key);
                this.caches.l2.del(key);
                this.caches.l3.del(key);
                this.caches.predictive.del(key);
                
                // 패턴 데이터도 정리
                this.cachePatterns.accessFrequency.delete(key);
                this.cachePatterns.accessTimes.delete(key);
                this.cachePatterns.popularKeys.delete(key);
            }
        }
    }

    /**
     * 캐시 레벨 재조정
     */
    rebalanceCacheLevels() {
        // L1 캐시가 가득 찬 경우 인기도가 낮은 항목을 L2로 이동
        const l1Keys = this.caches.l1.keys();
        if (l1Keys.length > 100) { // L1 캐시 크기 제한
            const keysToMove = l1Keys
                .map(key => ({
                    key,
                    frequency: this.cachePatterns.accessFrequency.get(key) || 0
                }))
                .sort((a, b) => a.frequency - b.frequency)
                .slice(0, 20); // 하위 20개 이동

            keysToMove.forEach(({ key }) => {
                const value = this.caches.l1.get(key);
                if (value !== undefined) {
                    this.caches.l2.set(key, value);
                    this.caches.l1.del(key);
                }
            });
        }
    }

    /**
     * 캐시 저장
     */
    setCachedResult(key, result, level, ttl) {
        const cache = this.caches[level];
        if (cache) {
            if (ttl) {
                cache.set(key, result, ttl);
            } else {
                cache.set(key, result);
            }
        }
    }

    /**
     * 병렬 처리 시스템
     */
    async processInParallel(tasks, options = {}) {
        const {
            maxConcurrency = this.workerPool.maxWorkers,
            timeout = 30000,
            retryCount = 2
        } = options;

        const results = [];
        const errors = [];
        const semaphore = new Semaphore(maxConcurrency);

        const processTask = async (task, index) => {
            await semaphore.acquire();
            
            try {
                this.metrics.parallelTasks++;
                
                const result = await Promise.race([
                    this.executeTask(task),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Task timeout')), timeout)
                    )
                ]);
                
                results[index] = { success: true, data: result };
            } catch (error) {
                errors.push({ index, error: error.message, task });
                results[index] = { success: false, error: error.message };
            } finally {
                this.metrics.parallelTasks--;
                semaphore.release();
            }
        };

        // 모든 작업을 병렬로 실행
        const promises = tasks.map((task, index) => processTask(task, index));
        await Promise.allSettled(promises);

        return {
            results,
            errors,
            successCount: results.filter(r => r.success).length,
            errorCount: errors.length
        };
    }

    /**
     * 개별 작업 실행
     */
    async executeTask(task) {
        if (typeof task === 'function') {
            return await task();
        }
        
        if (task.type === 'document_processing') {
            return await this.processDocument(task.document, task.options);
        }
        
        throw new Error('Unknown task type');
    }

    /**
     * 문서 처리 (병렬 처리 최적화)
     */
    async processDocument(document, options = {}) {
        const cacheKey = this.generateCacheKey(document, options);
        
        return await this.getCachedResult(cacheKey, async () => {
            // 문서를 청크로 분할하여 병렬 처리
            const chunks = this.splitDocumentIntoChunks(document);
            
            const chunkTasks = chunks.map(chunk => ({
                type: 'chunk_processing',
                chunk,
                options
            }));

            const chunkResults = await this.processInParallel(chunkTasks, {
                maxConcurrency: Math.min(chunks.length, 4)
            });

            // 결과 병합
            return this.mergeChunkResults(chunkResults.results);
        }, { level: 'l2' });
    }

    /**
     * 문서 청크 분할
     */
    splitDocumentIntoChunks(document, chunkSize = 1000) {
        const text = typeof document === 'string' ? document : document.text || '';
        const chunks = [];
        
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push({
                text: text.slice(i, i + chunkSize),
                index: Math.floor(i / chunkSize),
                isFirst: i === 0,
                isLast: i + chunkSize >= text.length
            });
        }
        
        return chunks;
    }

    /**
     * 청크 결과 병합
     */
    mergeChunkResults(chunkResults) {
        const merged = {
            processedText: '',
            dateBlocks: [],
            medicalTerms: [],
            metadata: {
                totalChunks: chunkResults.length,
                successfulChunks: 0,
                processingTime: 0
            }
        };

        chunkResults.forEach(result => {
            if (result.success && result.data) {
                merged.processedText += result.data.text || '';
                merged.dateBlocks.push(...(result.data.dateBlocks || []));
                merged.medicalTerms.push(...(result.data.medicalTerms || []));
                merged.metadata.successfulChunks++;
            }
        });

        return merged;
    }

    /**
     * 메모리 최적화
     */
    startMemoryMonitoring() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
            const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
            const heapUsageRatio = heapUsedMB / heapTotalMB;

            this.metrics.memoryUsage.push({
                timestamp: Date.now(),
                heapUsed: heapUsedMB,
                heapTotal: heapTotalMB,
                heapUsageRatio,
                rss: memUsage.rss / 1024 / 1024,
                external: memUsage.external / 1024 / 1024
            });

            // 메모리 사용량이 임계점을 넘으면 정리 작업 수행
            if (heapUsageRatio > this.memoryManager.gcThreshold) {
                this.performMemoryCleanup();
            }

            // 메트릭 배열 크기 제한 (최근 1000개만 유지)
            if (this.metrics.memoryUsage.length > 1000) {
                this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-500);
            }
            if (this.metrics.processingTimes.length > 1000) {
                this.metrics.processingTimes = this.metrics.processingTimes.slice(-500);
            }

        }, this.memoryManager.cleanupInterval);
    }

    /**
     * 메모리 정리 작업
     */
    performMemoryCleanup() {
        console.log('Performing memory cleanup...');
        
        // 캐시 정리 (오래된 항목부터)
        this.cleanupCaches();
        
        // 가비지 컬렉션 유도
        if (global.gc) {
            global.gc();
        }
        
        // 대기 중인 작업 큐 정리
        this.cleanupTaskQueue();
    }

    /**
     * 캐시 정리
     */
    cleanupCaches() {
        // L1 캐시의 50% 정리
        const l1Keys = this.caches.l1.keys();
        const l1ToDelete = Math.floor(l1Keys.length * 0.5);
        l1Keys.slice(0, l1ToDelete).forEach(key => {
            this.caches.l1.del(key);
        });

        // L2 캐시의 30% 정리
        const l2Keys = this.caches.l2.keys();
        const l2ToDelete = Math.floor(l2Keys.length * 0.3);
        l2Keys.slice(0, l2ToDelete).forEach(key => {
            this.caches.l2.del(key);
        });
    }

    /**
     * 작업 큐 정리
     */
    cleanupTaskQueue() {
        // 오래된 대기 작업 제거 (5분 이상 대기)
        const now = Date.now();
        this.workerPool.queue = this.workerPool.queue.filter(task => {
            return (now - task.timestamp) < 300000; // 5분
        });
    }

    /**
     * 캐시 키 생성
     */
    generateCacheKey(document, options) {
        const docHash = this.hashDocument(document);
        const optionsHash = this.hashObject(options);
        return `doc_${docHash}_opt_${optionsHash}`;
    }

    /**
     * 문서 해시 생성
     */
    hashDocument(document) {
        const text = typeof document === 'string' ? document : document.text || '';
        return this.simpleHash(text.substring(0, 1000)); // 첫 1000자만 사용
    }

    /**
     * 객체 해시 생성
     */
    hashObject(obj) {
        return this.simpleHash(JSON.stringify(obj));
    }

    /**
     * 간단한 해시 함수
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32비트 정수로 변환
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 캐시 이벤트 리스너 설정
     */
    setupCacheEventListeners() {
        Object.keys(this.caches).forEach(level => {
            const cache = this.caches[level];
            
            cache.on('set', (key, value) => {
                console.log(`Cache ${level} set: ${key}`);
            });
            
            cache.on('expired', (key, value) => {
                console.log(`Cache ${level} expired: ${key}`);
            });
        });
    }

    /**
     * 성능 최적화 작업 시작
     */
    startPerformanceOptimization() {
        setInterval(() => {
            this.optimizePerformance();
        }, 300000); // 5분마다 실행
    }

    /**
     * 성능 최적화 실행
     */
    optimizePerformance() {
        // 캐시 히트율 분석
        const cacheStats = this.getCacheStatistics();
        
        // 히트율이 낮은 캐시 레벨 조정
        if (cacheStats.l1.hitRate < 0.3) {
            this.adjustCacheStrategy('l1', 'increase_ttl');
        }
        
        // 메모리 사용량 최적화
        const memoryStats = this.getMemoryStatistics();
        if (memoryStats.averageUsage > 0.7) {
            this.performMemoryCleanup();
        }
        
        // 병렬 처리 최적화
        this.optimizeParallelProcessing();
    }

    /**
     * 병렬 처리 최적화
     */
    optimizeParallelProcessing() {
        const avgProcessingTime = this.getAverageProcessingTime();
        
        // 처리 시간이 길면 병렬도 증가
        if (avgProcessingTime > 2000 && this.workerPool.maxWorkers < os.cpus().length * 2) {
            this.workerPool.maxWorkers++;
        }
        
        // 처리 시간이 짧으면 병렬도 감소
        if (avgProcessingTime < 500 && this.workerPool.maxWorkers > 2) {
            this.workerPool.maxWorkers--;
        }
    }

    /**
     * 통계 정보 조회
     */
    getCacheStatistics() {
        const stats = {};
        
        Object.keys(this.caches).forEach(level => {
            const hits = this.metrics.cacheHits[level];
            const misses = this.metrics.cacheMisses[level];
            const total = hits + misses;
            
            stats[level] = {
                hits,
                misses,
                total,
                hitRate: total > 0 ? hits / total : 0,
                size: this.caches[level].keys().length
            };
        });
        
        return stats;
    }

    /**
     * 메모리 통계 조회
     */
    getMemoryStatistics() {
        const recent = this.metrics.memoryUsage.slice(-10);
        
        if (recent.length === 0) return { averageUsage: 0 };
        
        const avgUsage = recent.reduce((sum, usage) => sum + usage.heapUsageRatio, 0) / recent.length;
        const maxUsage = Math.max(...recent.map(usage => usage.heapUsageRatio));
        
        return {
            averageUsage: avgUsage,
            maxUsage: maxUsage,
            currentUsage: recent[recent.length - 1]?.heapUsageRatio || 0
        };
    }

    /**
     * 평균 처리 시간 조회
     */
    getAverageProcessingTime() {
        const recent = this.metrics.processingTimes.slice(-50);
        if (recent.length === 0) return 0;
        
        return recent.reduce((sum, time) => sum + time, 0) / recent.length;
    }

    /**
     * 전체 성능 메트릭 조회
     */
    getPerformanceMetrics() {
        return {
            cache: this.getCacheStatistics(),
            memory: this.getMemoryStatistics(),
            processing: {
                averageTime: this.getAverageProcessingTime(),
                totalTasks: this.metrics.processingTimes.length,
                parallelTasks: this.metrics.parallelTasks
            },
            system: {
                maxWorkers: this.workerPool.maxWorkers,
                activeWorkers: this.workerPool.activeWorkers,
                queueLength: this.workerPool.queue.length
            }
        };
    }
}

/**
 * 세마포어 클래스 (병렬 처리 제어)
 */
class Semaphore {
    constructor(maxConcurrency) {
        this.maxConcurrency = maxConcurrency;
        this.currentConcurrency = 0;
        this.queue = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (this.currentConcurrency < this.maxConcurrency) {
                this.currentConcurrency++;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release() {
        this.currentConcurrency--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.currentConcurrency++;
            next();
        }
    }
}

export default PerformanceOptimizer;