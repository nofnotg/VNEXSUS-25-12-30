// cacheMiddleware.js - API 응답 캐시 미들웨어
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

import { apiCache, analysisCache, CacheManager } from '../utils/cacheManager.js';
const { createLogger } = require('../utils/enhancedLogger.js');

const logger = createLogger('CacheMiddleware');

/**
 * API 응답 캐시 미들웨어
 * @param {Object} options - 캐시 옵션
 * @param {number} options.ttl - TTL (밀리초)
 * @param {string} options.keyPrefix - 캐시 키 접두사
 * @param {Function} options.keyGenerator - 커스텀 키 생성 함수
 * @param {Array} options.excludeMethods - 캐시에서 제외할 HTTP 메서드
 * @param {Function} options.shouldCache - 캐시 여부 결정 함수
 * @returns {Function} Express 미들웨어
 */
function cacheResponse(options = {}) {
    const {
        ttl = 300000, // 5분
        keyPrefix = 'api',
        keyGenerator = null,
        excludeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'],
        shouldCache = null,
        cacheInstance = apiCache
    } = options;
    
    return (req, res, next) => {
        // 캐시 제외 메서드 확인
        if (excludeMethods.includes(req.method)) {
            return next();
        }
        
        // 커스텀 캐시 조건 확인
        if (shouldCache && !shouldCache(req, res)) {
            return next();
        }
        
        // 캐시 키 생성
        const cacheKey = keyGenerator 
            ? keyGenerator(req)
            : generateDefaultCacheKey(keyPrefix, req);
        
        // 캐시에서 조회
        const cachedResponse = cacheInstance.get(cacheKey);
        if (cachedResponse) {
            logger.debug('Cache hit for API response', { 
                method: req.method,
                url: req.originalUrl,
                cacheKey 
            });
            
            // 캐시된 응답 반환
            res.set(cachedResponse.headers);
            res.status(cachedResponse.statusCode);
            return res.json(cachedResponse.data);
        }
        
        // 원본 응답 메서드들 저장
        const originalJson = res.json;
        const originalSend = res.send;
        
        // 응답 데이터 캐시
        res.json = function(data) {
            // 성공적인 응답만 캐시
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const responseToCache = {
                    statusCode: res.statusCode,
                    headers: res.getHeaders(),
                    data: data
                };
                
                cacheInstance.set(cacheKey, responseToCache, ttl);
                
                logger.debug('Response cached', {
                    method: req.method,
                    url: req.originalUrl,
                    cacheKey,
                    statusCode: res.statusCode,
                    ttl
                });
            }
            
            return originalJson.call(this, data);
        };
        
        res.send = function(data) {
            // JSON이 아닌 응답도 캐시 (필요한 경우)
            if (res.statusCode >= 200 && res.statusCode < 300 && 
                res.get('Content-Type')?.includes('application/json')) {
                
                try {
                    const jsonData = JSON.parse(data);
                    const responseToCache = {
                        statusCode: res.statusCode,
                        headers: res.getHeaders(),
                        data: jsonData
                    };
                    
                    cacheInstance.set(cacheKey, responseToCache, ttl);
                    
                    logger.debug('Response cached via send', {
                        method: req.method,
                        url: req.originalUrl,
                        cacheKey,
                        statusCode: res.statusCode,
                        ttl
                    });
                } catch (error) {
                    logger.warn('Failed to parse response for caching', { error: error.message });
                }
            }
            
            return originalSend.call(this, data);
        };
        
        next();
    };
}

/**
 * 분석 결과 캐시 미들웨어 (더 긴 TTL)
 */
function cacheAnalysisResponse(options = {}) {
    return cacheResponse({
        ttl: 600000, // 10분
        keyPrefix: 'analysis',
        cacheInstance: analysisCache,
        ...options
    });
}

/**
 * 기본 캐시 키 생성
 * @param {string} prefix - 키 접두사
 * @param {Object} req - Express 요청 객체
 * @returns {string} 생성된 캐시 키
 */
function generateDefaultCacheKey(prefix, req) {
    const params = {
        method: req.method,
        url: req.originalUrl,
        query: req.query,
        // POST 요청의 경우 body도 포함 (민감한 정보 제외)
        ...(req.method === 'POST' && req.body ? { body: sanitizeBody(req.body) } : {})
    };
    
    return CacheManager.generateKey(prefix, params);
}

/**
 * 요청 body에서 민감한 정보 제거
 * @param {Object} body - 요청 body
 * @returns {Object} 정제된 body
 */
function sanitizeBody(body) {
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
    const sanitized = { ...body };
    
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });
    
    return sanitized;
}

/**
 * 캐시 무효화 미들웨어
 * @param {Object} options - 무효화 옵션
 * @param {Array} options.patterns - 무효화할 키 패턴들
 * @param {Function} options.keyGenerator - 무효화할 키 생성 함수
 * @returns {Function} Express 미들웨어
 */
function invalidateCache(options = {}) {
    const { patterns = [], keyGenerator = null, cacheInstance = apiCache } = options;
    
    return (req, res, next) => {
        // 원본 응답 메서드 저장
        const originalJson = res.json;
        const originalSend = res.send;
        
        // 응답 후 캐시 무효화
        const invalidateCacheEntries = () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                if (keyGenerator) {
                    const keyToInvalidate = keyGenerator(req);
                    cacheInstance.delete(keyToInvalidate);
                    logger.debug('Cache invalidated by key generator', { key: keyToInvalidate });
                }
                
                patterns.forEach(pattern => {
                    // 패턴 매칭으로 캐시 무효화 (간단한 구현)
                    for (const [key] of cacheInstance.cache.entries()) {
                        if (key.includes(pattern)) {
                            cacheInstance.delete(key);
                            logger.debug('Cache invalidated by pattern', { key, pattern });
                        }
                    }
                });
            }
        };
        
        res.json = function(data) {
            const result = originalJson.call(this, data);
            invalidateCacheEntries();
            return result;
        };
        
        res.send = function(data) {
            const result = originalSend.call(this, data);
            invalidateCacheEntries();
            return result;
        };
        
        next();
    };
}

/**
 * 캐시 통계 엔드포인트
 */
function getCacheStats(req, res) {
    const stats = {
        apiCache: apiCache.getStats(),
        analysisCache: analysisCache.getStats(),
        timestamp: new Date().toISOString()
    };
    
    res.json(stats);
}

/**
 * 캐시 초기화 엔드포인트
 */
function clearCache(req, res) {
    const { type = 'all' } = req.query;
    
    try {
        switch (type) {
            case 'api':
                apiCache.clear();
                break;
            case 'analysis':
                analysisCache.clear();
                break;
            case 'all':
            default:
                apiCache.clear();
                analysisCache.clear();
                break;
        }
        
        logger.info('Cache cleared', { type });
        res.json({ 
            success: true, 
            message: `${type} cache cleared successfully`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to clear cache', { error: error.message, type });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to clear cache' 
        });
    }
}

/**
 * 특정 키 패턴으로 캐시 무효화
 */
function invalidateCacheByPattern(req, res) {
    const { pattern } = req.body;
    
    if (!pattern) {
        return res.status(400).json({ 
            success: false, 
            error: 'Pattern is required' 
        });
    }
    
    try {
        let invalidatedCount = 0;
        
        // API 캐시에서 패턴 매칭 삭제
        for (const [key] of apiCache.cache.entries()) {
            if (key.includes(pattern)) {
                apiCache.delete(key);
                invalidatedCount++;
            }
        }
        
        // 분석 캐시에서 패턴 매칭 삭제
        for (const [key] of analysisCache.cache.entries()) {
            if (key.includes(pattern)) {
                analysisCache.delete(key);
                invalidatedCount++;
            }
        }
        
        logger.info('Cache invalidated by pattern', { pattern, invalidatedCount });
        res.json({ 
            success: true, 
            message: `Invalidated ${invalidatedCount} cache entries`,
            pattern,
            invalidatedCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to invalidate cache by pattern', { 
            error: error.message, 
            pattern 
        });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to invalidate cache' 
        });
    }
}

export {
    cacheResponse,
    cacheAnalysisResponse,
    invalidateCache,
    getCacheStats,
    clearCache,
    invalidateCacheByPattern,
    generateDefaultCacheKey
};