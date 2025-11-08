// cacheRoutes.js - 캐시 관리 API 라우트
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const express = require('express');
import { 
    getCacheStats, 
    clearCache, 
    invalidateCacheByPattern 
} from '../middleware/cacheMiddleware.js';
import { apiCache, analysisCache } from '../utils/cacheManager.js';
const { createLogger } = require('../utils/enhancedLogger.js');

const router = express.Router();
const logger = createLogger('CacheRoutes');

/**
 * 캐시 통계 조회
 * GET /api/cache/stats
 */
router.get('/stats', getCacheStats);

/**
 * 캐시 초기화
 * DELETE /api/cache/clear
 * Query params:
 * - type: 'api' | 'analysis' | 'all' (default: 'all')
 */
router.delete('/clear', clearCache);

/**
 * 패턴으로 캐시 무효화
 * POST /api/cache/invalidate
 * Body: { pattern: string }
 */
router.post('/invalidate', invalidateCacheByPattern);

/**
 * 특정 캐시 키 삭제
 * DELETE /api/cache/key/:key
 */
router.delete('/key/:key', (req, res) => {
    const { key } = req.params;
    const { type = 'all' } = req.query;
    
    try {
        let deleted = false;
        
        switch (type) {
            case 'api':
                deleted = apiCache.delete(key);
                break;
            case 'analysis':
                deleted = analysisCache.delete(key);
                break;
            case 'all':
            default:
                const apiDeleted = apiCache.delete(key);
                const analysisDeleted = analysisCache.delete(key);
                deleted = apiDeleted || analysisDeleted;
                break;
        }
        
        if (deleted) {
            logger.info('Cache key deleted', { key, type });
            res.json({ 
                success: true, 
                message: 'Cache key deleted successfully',
                key,
                type,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Cache key not found',
                key,
                type
            });
        }
    } catch (error) {
        logger.error('Failed to delete cache key', { error: error.message, key, type });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete cache key' 
        });
    }
});

/**
 * 캐시 키 목록 조회
 * GET /api/cache/keys
 */
router.get('/keys', (req, res) => {
    const { type = 'all', limit = 100, pattern } = req.query;
    
    try {
        let keys = [];
        
        const addKeysFromCache = (cache, cacheType) => {
            for (const [key] of cache.cache.entries()) {
                if (!pattern || key.includes(pattern)) {
                    keys.push({
                        key,
                        type: cacheType,
                        hasValue: cache.has(key)
                    });
                }
            }
        };
        
        switch (type) {
            case 'api':
                addKeysFromCache(apiCache, 'api');
                break;
            case 'analysis':
                addKeysFromCache(analysisCache, 'analysis');
                break;
            case 'all':
            default:
                addKeysFromCache(apiCache, 'api');
                addKeysFromCache(analysisCache, 'analysis');
                break;
        }
        
        // 제한된 수만큼 반환
        keys = keys.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            keys,
            total: keys.length,
            type,
            pattern: pattern || null,
            limit: parseInt(limit),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get cache keys', { error: error.message, type, pattern });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get cache keys' 
        });
    }
});

/**
 * 특정 캐시 키의 값 조회
 * GET /api/cache/value/:key
 */
router.get('/value/:key', (req, res) => {
    const { key } = req.params;
    const { type = 'all' } = req.query;
    
    try {
        let value = null;
        let foundIn = null;
        
        switch (type) {
            case 'api':
                value = apiCache.get(key);
                foundIn = value ? 'api' : null;
                break;
            case 'analysis':
                value = analysisCache.get(key);
                foundIn = value ? 'analysis' : null;
                break;
            case 'all':
            default:
                value = apiCache.get(key);
                if (value) {
                    foundIn = 'api';
                } else {
                    value = analysisCache.get(key);
                    foundIn = value ? 'analysis' : null;
                }
                break;
        }
        
        if (value !== null && value !== undefined) {
            res.json({
                success: true,
                key,
                value,
                foundIn,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Cache key not found or expired',
                key,
                type
            });
        }
    } catch (error) {
        logger.error('Failed to get cache value', { error: error.message, key, type });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get cache value' 
        });
    }
});

/**
 * 캐시 상태 확인
 * GET /api/cache/health
 */
router.get('/health', (req, res) => {
    try {
        const apiStats = apiCache.getStats();
        const analysisStats = analysisCache.getStats();
        
        const health = {
            status: 'healthy',
            caches: {
                api: {
                    ...apiStats,
                    healthy: apiStats.currentSize <= apiCache.maxSize * 0.9
                },
                analysis: {
                    ...analysisStats,
                    healthy: analysisStats.currentSize <= analysisCache.maxSize * 0.9
                }
            },
            timestamp: new Date().toISOString()
        };
        
        // 전체 상태 결정
        const overallHealthy = health.caches.api.healthy && health.caches.analysis.healthy;
        health.status = overallHealthy ? 'healthy' : 'warning';
        
        res.json(health);
    } catch (error) {
        logger.error('Failed to get cache health', { error: error.message });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get cache health' 
        });
    }
});

/**
 * 캐시 설정 조회
 * GET /api/cache/config
 */
router.get('/config', (req, res) => {
    try {
        const config = {
            api: {
                maxSize: apiCache.maxSize,
                defaultTTL: apiCache.defaultTTL,
                cleanupInterval: apiCache.cleanupInterval
            },
            analysis: {
                maxSize: analysisCache.maxSize,
                defaultTTL: analysisCache.defaultTTL,
                cleanupInterval: analysisCache.cleanupInterval
            },
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get cache config', { error: error.message });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get cache config' 
        });
    }
});

/**
 * 캐시 정리 수동 실행
 * POST /api/cache/cleanup
 */
router.post('/cleanup', (req, res) => {
    const { type = 'all' } = req.body;
    
    try {
        let cleanedCount = 0;
        
        switch (type) {
            case 'api':
                apiCache.cleanup();
                break;
            case 'analysis':
                analysisCache.cleanup();
                break;
            case 'all':
            default:
                apiCache.cleanup();
                analysisCache.cleanup();
                break;
        }
        
        logger.info('Manual cache cleanup executed', { type });
        res.json({
            success: true,
            message: 'Cache cleanup completed',
            type,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to execute cache cleanup', { error: error.message, type });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to execute cache cleanup' 
        });
    }
});

export default router;