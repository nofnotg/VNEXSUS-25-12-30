/**
 * 통합 캐시 관리자
 * 
 * 로컬 파일 기반 캐싱 시스템
 * 분석 결과, 검색 결과, 임베딩 벡터 캐싱 지원
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 메모리 캐시 구현
 */
class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 3600; // 1시간
    this.cleanupInterval = options.cleanupInterval || 300; // 5분
    
    // 주기적 정리
    this.startCleanup();
  }

  set(key, value, ttl = null) {
    const expiry = Date.now() + (ttl || this.defaultTTL) * 1000;
    
    // 크기 제한 확인
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      value,
      expiry,
      accessCount: 0,
      lastAccess: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // 만료 확인
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    // 접근 통계 업데이트
    item.accessCount++;
    item.lastAccess = Date.now();
    
    return item.value;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  size() {
    return this.cache.size;
  }

  // LRU 기반 제거
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, item] of this.cache) {
      if (item.lastAccess < oldestTime) {
        oldestTime = item.lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // 만료된 항목 정리
  cleanup() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.cache.delete(key));
    
    if (toDelete.length > 0) {
      console.log(`🧹 메모리 캐시 정리: ${toDelete.length}개 항목 제거`);
    }
  }

  startCleanup() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval * 1000);
  }

  getStats() {
    const stats = {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0,
      totalAccess: 0
    };
    
    for (const item of this.cache.values()) {
      stats.totalAccess += item.accessCount;
    }
    
    return stats;
  }
}

/**
 * Redis 캐시 어댑터 (Redis 없이도 동작)
 */
class RedisAdapter {
  constructor(options = {}) {
    this.enabled = false;
    this.client = null;
    this.fallbackCache = new MemoryCache(options);
    
    // Redis 연결 시도 (선택적)
    this.tryConnect(options);
  }

  async tryConnect(options) {
    try {
      // Redis 클라이언트가 있다면 연결 시도
      if (typeof require !== 'undefined') {
        const redis = require('redis');
        this.client = redis.createClient(options.redis || {});
        
        await this.client.connect();
        this.enabled = true;
        console.log('✅ Redis 캐시 연결 성공');
      }
    } catch (error) {
      console.log('⚠️ Redis 연결 실패, 메모리 캐시 사용:', error.message);
      this.enabled = false;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      if (this.enabled && this.client) {
        const serialized = JSON.stringify(value);
        await this.client.setEx(key, ttl, serialized);
      } else {
        this.fallbackCache.set(key, value, ttl);
      }
    } catch (error) {
      console.error('Redis set 오류:', error);
      this.fallbackCache.set(key, value, ttl);
    }
  }

  async get(key) {
    try {
      if (this.enabled && this.client) {
        const result = await this.client.get(key);
        return result ? JSON.parse(result) : null;
      } else {
        return this.fallbackCache.get(key);
      }
    } catch (error) {
      console.error('Redis get 오류:', error);
      return this.fallbackCache.get(key);
    }
  }

  async delete(key) {
    try {
      if (this.enabled && this.client) {
        await this.client.del(key);
      } else {
        this.fallbackCache.delete(key);
      }
    } catch (error) {
      console.error('Redis delete 오류:', error);
      this.fallbackCache.delete(key);
    }
  }

  async clear() {
    try {
      if (this.enabled && this.client) {
        await this.client.flushDb();
      } else {
        this.fallbackCache.clear();
      }
    } catch (error) {
      console.error('Redis clear 오류:', error);
      this.fallbackCache.clear();
    }
  }

  async disconnect() {
    if (this.enabled && this.client) {
      await this.client.disconnect();
    }
  }
}

/**
 * 통합 캐시 관리자
 */
export class CacheManager {
  constructor(config = {}) {
    this.config = {
      maxMemorySize: config.maxMemorySize || 1000,
      ttl: config.ttl || 3600000, // 1시간
      persistentCache: config.persistentCache !== false,
      cacheDir: config.cacheDir || path.join(__dirname, '../data/cache'),
      ...config
    };

    this.memoryCache = new MemoryCache(this.config.maxMemorySize, this.config.ttl);
    this.isInitialized = false;
  }

  /**
   * 캐시 매니저 초기화
   */
  async initialize() {
    try {
      // 캐시 디렉토리 생성
      if (!fs.existsSync(this.config.cacheDir)) {
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
      }

      // 영구 캐시 로드
      if (this.config.persistentCache) {
        await this.loadPersistentCache();
      }

      this.isInitialized = true;
      console.log('✅ 캐시 매니저 초기화 완료');
      
    } catch (error) {
      console.error('캐시 매니저 초기화 오류:', error);
      throw error;
    }
  }

  /**
   * 캐시 키 생성
   */
  generateKey(prefix, data) {
    const hash = crypto.createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * 분석 결과 캐싱
   */
  async cacheAnalysisResult(analysisId, result, ttl = 86400) { // 24시간
    const key = `analysis:${analysisId}`;
    
    // 메모리 캐시
    this.memoryCache.set(key, result, ttl);
    
    // Redis 캐시
    await this.redisCache.set(key, result, ttl);
    
    // 지속성 캐시 (중요한 분석 결과)
    if (this.config.persistence.enabled) {
      this.persistentCache.set(key, {
        result,
        timestamp: Date.now(),
        ttl: ttl * 1000
      });
    }
    
    console.log(`💾 분석 결과 캐시 저장: ${analysisId}`);
  }

  /**
   * 분석 결과 조회
   */
  async getAnalysisResult(analysisId) {
    const key = `analysis:${analysisId}`;
    
    // 1. 메모리 캐시 확인
    let result = this.memoryCache.get(key);
    if (result) {
      console.log(`🎯 메모리 캐시 히트: ${analysisId}`);
      return result;
    }
    
    // 2. Redis 캐시 확인
    result = await this.redisCache.get(key);
    if (result) {
      // 메모리 캐시에 복사
      this.memoryCache.set(key, result, 3600);
      console.log(`🎯 Redis 캐시 히트: ${analysisId}`);
      return result;
    }
    
    // 3. 지속성 캐시 확인
    const persistent = this.persistentCache.get(key);
    if (persistent && Date.now() - persistent.timestamp < persistent.ttl) {
      // 상위 캐시에 복사
      this.memoryCache.set(key, persistent.result, 3600);
      await this.redisCache.set(key, persistent.result, 3600);
      console.log(`🎯 지속성 캐시 히트: ${analysisId}`);
      return persistent.result;
    }
    
    return null;
  }

  /**
   * 검색 결과 캐싱
   */
  async cacheSearchResult(query, filters, results, ttl = 3600) { // 1시간
    const key = this.generateKey('search', { query, filters });
    
    this.memoryCache.set(key, results, ttl);
    await this.redisCache.set(key, results, ttl);
    
    console.log(`🔍 검색 결과 캐시 저장: ${query}`);
  }

  /**
   * 검색 결과 조회
   */
  async getSearchResult(query, filters) {
    const key = this.generateKey('search', { query, filters });
    
    // 메모리 캐시 우선
    let result = this.memoryCache.get(key);
    if (result) {
      return result;
    }
    
    // Redis 캐시
    result = await this.redisCache.get(key);
    if (result) {
      this.memoryCache.set(key, result, 1800); // 30분
      return result;
    }
    
    return null;
  }

  /**
   * 임베딩 벡터 캐싱
   */
  async cacheEmbedding(text, model, embedding, ttl = 604800) { // 7일
    const key = this.generateKey('embedding', { text, model });
    
    this.memoryCache.set(key, embedding, ttl);
    await this.redisCache.set(key, embedding, ttl);
    
    // 임베딩은 지속성 캐시에도 저장
    if (this.config.persistence.enabled) {
      this.persistentCache.set(key, {
        result: embedding,
        timestamp: Date.now(),
        ttl: ttl * 1000
      });
    }
  }

  /**
   * 임베딩 벡터 조회
   */
  async getEmbedding(text, model) {
    const key = this.generateKey('embedding', { text, model });
    
    // 메모리 캐시
    let result = this.memoryCache.get(key);
    if (result) return result;
    
    // Redis 캐시
    result = await this.redisCache.get(key);
    if (result) {
      this.memoryCache.set(key, result, 86400); // 24시간
      return result;
    }
    
    // 지속성 캐시
    const persistent = this.persistentCache.get(key);
    if (persistent && Date.now() - persistent.timestamp < persistent.ttl) {
      this.memoryCache.set(key, persistent.result, 86400);
      await this.redisCache.set(key, persistent.result, 86400);
      return persistent.result;
    }
    
    return null;
  }

  /**
   * 중복 분석 방지
   */
  async isDuplicateAnalysis(analysisData) {
    const key = this.generateKey('duplicate', analysisData);
    
    // 메모리 캐시에서 확인
    if (this.memoryCache.has(key)) {
      return true;
    }
    
    // Redis에서 확인
    const exists = await this.redisCache.get(key);
    return exists !== null;
  }

  /**
   * 분석 중복 마킹
   */
  async markAnalysisInProgress(analysisData, ttl = 1800) { // 30분
    const key = this.generateKey('duplicate', analysisData);
    
    this.memoryCache.set(key, true, ttl);
    await this.redisCache.set(key, true, ttl);
  }

  /**
   * 지속성 캐시 로드
   */
  loadPersistentCache() {
    if (!this.config.persistence.enabled) return;
    
    try {
      const cachePath = path.join(this.config.persistence.path, 'cache.json');
      
      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        
        for (const [key, item] of Object.entries(data)) {
          // 만료되지 않은 항목만 로드
          if (Date.now() - item.timestamp < item.ttl) {
            this.persistentCache.set(key, item);
          }
        }
        
        console.log(`📂 지속성 캐시 로드: ${this.persistentCache.size}개 항목`);
      }
    } catch (error) {
      console.error('지속성 캐시 로드 오류:', error);
    }
  }

  /**
   * 지속성 캐시 저장
   */
  savePersistentCache() {
    if (!this.config.persistence.enabled) return;
    
    try {
      // 디렉토리 생성
      if (!fs.existsSync(this.config.persistence.path)) {
        fs.mkdirSync(this.config.persistence.path, { recursive: true });
      }
      
      // 만료된 항목 제거
      const now = Date.now();
      const validItems = {};
      
      for (const [key, item] of this.persistentCache) {
        if (now - item.timestamp < item.ttl) {
          validItems[key] = item;
        }
      }
      
      // 파일 저장
      const cachePath = path.join(this.config.persistence.path, 'cache.json');
      fs.writeFileSync(cachePath, JSON.stringify(validItems, null, 2));
      
      console.log(`💾 지속성 캐시 저장: ${Object.keys(validItems).length}개 항목`);
    } catch (error) {
      console.error('지속성 캐시 저장 오류:', error);
    }
  }

  /**
   * 자동 저장 시작
   */
  startPersistentSave() {
    setInterval(() => {
      this.savePersistentCache();
    }, this.config.persistence.saveInterval * 1000);
  }

  /**
   * 캐시 통계
   */
  getStats() {
    return {
      memory: this.memoryCache.getStats(),
      redis: {
        enabled: this.redisCache.enabled,
        connected: this.redisCache.client !== null
      },
      persistent: {
        size: this.persistentCache.size,
        enabled: this.config.persistence.enabled
      }
    };
  }

  /**
   * 캐시 정리
   */
  async cleanup() {
    // 메모리 캐시 정리
    this.memoryCache.cleanup();
    
    // 지속성 캐시 정리
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, item] of this.persistentCache) {
      if (now - item.timestamp >= item.ttl) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.persistentCache.delete(key));
    
    if (toDelete.length > 0) {
      console.log(`🧹 지속성 캐시 정리: ${toDelete.length}개 항목 제거`);
    }
  }

  /**
   * 시스템 종료
   */
  async shutdown() {
    // 지속성 캐시 저장
    this.savePersistentCache();
    
    // Redis 연결 종료
    await this.redisCache.disconnect();
    
    console.log('🛑 캐시 매니저 종료 완료');
  }
}

export default CacheManager;