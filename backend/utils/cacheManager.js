// cacheManager.js - 인메모리 캐시 관리 시스템
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { createLogger } = require('./enhancedLogger.js');

class CacheManager {
    constructor(options = {}) {
        this.cache = new Map();
        this.ttlMap = new Map(); // TTL 추적용
        this.maxSize = options.maxSize || 1000; // 최대 캐시 항목 수
        this.defaultTTL = options.defaultTTL || 300000; // 기본 TTL: 5분
        this.cleanupInterval = options.cleanupInterval || 60000; // 정리 주기: 1분
        this.logger = createLogger('CacheManager');
        
        // 통계 정보
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0,
            cleanups: 0
        };
        
        // 정기적인 만료된 항목 정리
        this.startCleanupTimer();
        
        this.logger.info('CacheManager initialized', {
            maxSize: this.maxSize,
            defaultTTL: this.defaultTTL,
            cleanupInterval: this.cleanupInterval
        });
    }
    
    /**
     * 캐시에서 값 조회
     * @param {string} key - 캐시 키
     * @returns {*} 캐시된 값 또는 undefined
     */
    get(key) {
        if (!this.cache.has(key)) {
            this.stats.misses++;
            return undefined;
        }
        
        const ttl = this.ttlMap.get(key);
        if (ttl && Date.now() > ttl) {
            // 만료된 항목 제거
            this.delete(key);
            this.stats.misses++;
            return undefined;
        }
        
        this.stats.hits++;
        const value = this.cache.get(key);
        
        this.logger.debug('Cache hit', { key, hasValue: !!value });
        return value;
    }
    
    /**
     * 캐시에 값 저장
     * @param {string} key - 캐시 키
     * @param {*} value - 저장할 값
     * @param {number} ttl - TTL (밀리초), 기본값은 defaultTTL
     */
    set(key, value, ttl = this.defaultTTL) {
        // 캐시 크기 제한 확인
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }
        
        this.cache.set(key, value);
        
        if (ttl > 0) {
            this.ttlMap.set(key, Date.now() + ttl);
        } else {
            this.ttlMap.delete(key);
        }
        
        this.stats.sets++;
        
        this.logger.debug('Cache set', { 
            key, 
            hasValue: !!value, 
            ttl,
            cacheSize: this.cache.size 
        });
    }
    
    /**
     * 캐시에서 항목 삭제
     * @param {string} key - 삭제할 키
     * @returns {boolean} 삭제 성공 여부
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        this.ttlMap.delete(key);
        
        if (deleted) {
            this.stats.deletes++;
            this.logger.debug('Cache delete', { key });
        }
        
        return deleted;
    }
    
    /**
     * 캐시 존재 여부 확인
     * @param {string} key - 확인할 키
     * @returns {boolean} 존재 여부
     */
    has(key) {
        if (!this.cache.has(key)) {
            return false;
        }
        
        const ttl = this.ttlMap.get(key);
        if (ttl && Date.now() > ttl) {
            this.delete(key);
            return false;
        }
        
        return true;
    }
    
    /**
     * 전체 캐시 초기화
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.ttlMap.clear();
        
        this.logger.info('Cache cleared', { previousSize: size });
    }
    
    /**
     * 가장 오래된 항목 제거 (LRU 방식)
     */
    evictOldest() {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
            this.delete(firstKey);
            this.stats.evictions++;
            this.logger.debug('Cache eviction', { evictedKey: firstKey });
        }
    }
    
    /**
     * 만료된 항목들 정리
     */
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, ttl] of this.ttlMap.entries()) {
            if (ttl && now > ttl) {
                this.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            this.stats.cleanups++;
            this.logger.debug('Cache cleanup completed', { 
                cleanedCount,
                remainingSize: this.cache.size 
            });
        }
    }
    
    /**
     * 정리 타이머 시작
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }
    
    /**
     * 정리 타이머 중지
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
    
    /**
     * 캐시 통계 정보 반환
     * @returns {Object} 통계 정보
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
            
        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            currentSize: this.cache.size,
            maxSize: this.maxSize,
            memoryUsage: this.getMemoryUsage()
        };
    }
    
    /**
     * 메모리 사용량 추정
     * @returns {Object} 메모리 사용량 정보
     */
    getMemoryUsage() {
        let estimatedSize = 0;
        
        for (const [key, value] of this.cache.entries()) {
            estimatedSize += this.estimateObjectSize(key) + this.estimateObjectSize(value);
        }
        
        return {
            estimatedBytes: estimatedSize,
            estimatedMB: (estimatedSize / 1024 / 1024).toFixed(2)
        };
    }
    
    /**
     * 객체 크기 추정
     * @param {*} obj - 크기를 추정할 객체
     * @returns {number} 추정 크기 (바이트)
     */
    estimateObjectSize(obj) {
        if (obj === null || obj === undefined) return 0;
        
        if (typeof obj === 'string') {
            return obj.length * 2; // UTF-16
        }
        
        if (typeof obj === 'number') {
            return 8;
        }
        
        if (typeof obj === 'boolean') {
            return 4;
        }
        
        if (Array.isArray(obj)) {
            return obj.reduce((size, item) => size + this.estimateObjectSize(item), 0);
        }
        
        if (typeof obj === 'object') {
            return Object.entries(obj).reduce((size, [key, value]) => {
                return size + this.estimateObjectSize(key) + this.estimateObjectSize(value);
            }, 0);
        }
        
        return 0;
    }
    
    /**
     * 캐시 키 생성 헬퍼
     * @param {string} prefix - 키 접두사
     * @param {Object} params - 파라미터 객체
     * @returns {string} 생성된 캐시 키
     */
    static generateKey(prefix, params = {}) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${key}:${JSON.stringify(params[key])}`)
            .join('|');
            
        return `${prefix}:${sortedParams}`;
    }
    
    /**
     * 캐시 매니저 종료
     */
    destroy() {
        this.stopCleanupTimer();
        this.clear();
        this.logger.info('CacheManager destroyed');
    }
}

// 전역 캐시 인스턴스들
const globalCache = new CacheManager({
    maxSize: 1000,
    defaultTTL: 300000, // 5분
    cleanupInterval: 60000 // 1분
});

const apiCache = new CacheManager({
    maxSize: 500,
    defaultTTL: 180000, // 3분
    cleanupInterval: 30000 // 30초
});

const analysisCache = new CacheManager({
    maxSize: 200,
    defaultTTL: 600000, // 10분
    cleanupInterval: 120000 // 2분
});

export {
    CacheManager,
    globalCache,
    apiCache,
    analysisCache
};